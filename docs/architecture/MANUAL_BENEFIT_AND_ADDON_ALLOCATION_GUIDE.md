# Manual Benefit & Add-on Allocation Guide (Database Runbook)

## 1. Overview & Purpose

This guide documents the exact procedure for manually granting, topping up, or fixing benefits and add-ons (such as **Emergency Button `EMR_101`**, **Sathi Hours**, **Nurse Visits**, or other add-ons) directly in the database for any subscriber or beneficiary profile.

Use this runbook when:
- Testing emergency alert triggers or service requests in staging or production.
- Customer support manually credits complimentary units or resolves an onboarding delay.
- Restoring expired subscription balances or granting an emergency override.

---

## 2. Database Architecture & Dual-Ledger System

MaiHoonNa uses a dual-ledger architecture to track benefit entitlements:

```
[users] 
   └── [beneficiaries] 
          └── [subscriptions] (must have isActive: true, endDate in the future)
                 │
                 ├── 1. [subscription_benefit_balances] 
                 │      (Total subscription lifetime / package quota ledger)
                 │      Checked by: Emergency Service, Sathi Service, Deductions
                 │
                 ├── 2. [benefit_periods] ──► [benefit_period_balances] 
                 │      (Active monthly window quota ledger)
                 │      Checked by: /api/shared/utilization (Mobile App & Web Dashboard)
                 │
                 └── 3. [benefit_transactions] 
                        (Immutable audit log for ALL allocations and consumptions)
```

> ⚠️ **CRITICAL RULE:**  
> When manually granting an add-on or benefit to an active subscription, you **MUST** update **BOTH** `subscription_benefit_balances` AND `benefit_period_balances` (for the active period). If you only update one, either the eligibility check or the UI display will show 0 remaining units.

---

## 3. Database Credentials & EC2 Bastion Access

Because AWS RDS PostgreSQL resides inside a private VPC, direct access is routed through the **EC2 Bastion Host**.

- **EC2 Bastion Host:** `13.207.100.161` (`ubuntu@ip-20-0-15-243`)
- **Key File:** `Maihoonna-Project-KEY-DEV.ppk` (PuTTY) or `.pem` (SSH)
- **RDS Cluster Endpoint:**  
  `maihoonnapostgresqldev.cluster-czyi8ye04wpq.ap-south-1.rds.amazonaws.com:5432`
- **Database Names:** `maihoonna_production` (Live) / `maihoonna_staging` (Staging)
- **DB User:** `MaihoonnaPSQLDev`
- **DB Password:** `secure#1212` (URL-encoded: `secure%231212`)

---

## 4. Step-by-Step Procedure

### Step 1: Identify the User, Active Subscription & Period

Run this query to find the active subscription and active period ID for a user:

```sql
SELECT 
  u.id AS user_id,
  u.phone,
  u.name,
  b.id AS beneficiary_id,
  s.id AS subscription_id,
  s."packageType",
  s."isActive" AS subscription_active,
  s."endDate",
  bp.id AS active_period_id,
  bp."periodNumber",
  bp.status AS period_status
FROM users u
JOIN beneficiaries b ON b."userId" = u.id
JOIN subscriptions s ON s."beneficiaryId" = b.id
LEFT JOIN benefit_periods bp ON bp."subscriptionId" = s.id AND bp.status = 'ACTIVE'
WHERE u.phone = '0000000000'; -- Replace with target phone number
```

> 💡 **Subscription Active Check:** If `s."isActive"` is `false` or `s."endDate"` has passed, reactivate it first:
> ```sql
> UPDATE subscriptions
> SET "isActive" = true, "endDate" = NOW() + INTERVAL '1 year'
> WHERE id = '<SUBSCRIPTION_ID>';
> ```

---

### Step 2: Get Benefit Details

Find the benefit ID and configured parameters from the `benefits` table:

```sql
SELECT id, code, name, "unitLabel", "addonIncludedUnits", "addonPrice"
FROM benefits 
WHERE code = 'EMR_101';
```

*(Common codes: `EMR_101` = Emergency Button, `EMR_125` = morning, `SATHI_102` = Sathi Visit)*

---

### Step 3: Pure SQL Allocation Script (Copy & Paste)

Run this SQL block inside `psql` (or save as `.sql` and execute):

```sql
BEGIN;

-- 1. Ensure Subscription is Active and Extended
UPDATE subscriptions
SET "isActive" = true,
    "endDate" = NOW() + INTERVAL '1 year',
    "updatedAt" = NOW()
WHERE id = '<SUBSCRIPTION_ID>';

-- 2. Upsert Subscription Benefit Balance (Lifetime Quota)
INSERT INTO subscription_benefit_balances (
  id,
  "subscriptionId",
  "benefitId",
  "snapshotBenefitName",
  "snapshotUnitLabel",
  "totalUnits",
  "availableUnits",
  "usedUnits",
  "reservedUnits",
  unit,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  '<SUBSCRIPTION_ID>',
  '<BENEFIT_ID>',
  'Emergency Button',  -- snapshot name
  'per request',       -- snapshot unitLabel
  5,                   -- totalUnits
  5,                   -- availableUnits
  0,                   -- usedUnits
  0,                   -- reservedUnits
  'per request',
  NOW(),
  NOW()
)
ON CONFLICT ("subscriptionId", "benefitId")
DO UPDATE SET
  "totalUnits" = 5,
  "availableUnits" = 5,
  "usedUnits" = 0,
  "reservedUnits" = 0,
  "snapshotBenefitName" = EXCLUDED."snapshotBenefitName",
  "snapshotUnitLabel" = EXCLUDED."snapshotUnitLabel",
  "updatedAt" = NOW();

-- 3. Upsert Benefit Period Balance (Active Window Display)
INSERT INTO benefit_period_balances (
  id,
  "periodId",
  "benefitId",
  "snapshotName",
  "snapshotUnitLabel",
  "baseAllocation",
  "rolloverAllocation",
  "totalAllocation",
  "usedQuantity",
  "reservedQuantity",
  "remainingQuantity",
  "rolloverCap",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  '<ACTIVE_PERIOD_ID>',
  '<BENEFIT_ID>',
  'Emergency Button',
  'per request',
  5,
  0,
  5,
  0,
  0,
  5,
  5,
  NOW(),
  NOW()
)
ON CONFLICT ("periodId", "benefitId")
DO UPDATE SET
  "baseAllocation" = 5,
  "totalAllocation" = 5,
  "remainingQuantity" = 5,
  "usedQuantity" = 0,
  "reservedQuantity" = 0,
  "snapshotName" = EXCLUDED."snapshotName",
  "snapshotUnitLabel" = EXCLUDED."snapshotUnitLabel",
  "updatedAt" = NOW();

-- 4. Create Audit Log Entry
INSERT INTO benefit_transactions (
  id,
  "balanceId",
  "transactionType",
  units,
  "totalBefore",
  "totalAfter",
  "reservedBefore",
  "reservedAfter",
  "usedBefore",
  "usedAfter",
  "availableBefore",
  "availableAfter",
  reason,
  "createdAt"
)
SELECT 
  gen_random_uuid(),
  sbb.id,
  'ALLOCATED',
  5,
  0,
  5,
  0,
  0,
  0,
  0,
  0,
  5,
  'Manual add-on allocation: Emergency Button (5 units)',
  NOW()
FROM subscription_benefit_balances sbb
WHERE sbb."subscriptionId" = '<SUBSCRIPTION_ID>' AND sbb."benefitId" = '<BENEFIT_ID>';

COMMIT;
```

---

## 5. Automated Node.js Script (Run on EC2)

You can run this self-contained script directly on the EC2 Bastion host:

```javascript
// File: apply_addon.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://MaihoonnaPSQLDev:secure%231212@maihoonnapostgresqldev.cluster-czyi8ye04wpq.ap-south-1.rds.amazonaws.com:5432/maihoonna_production",
  ssl: { rejectUnauthorized: false }
});

async function allocateAddon({ phone, benefitCode, unitsToGrant }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolve User & Beneficiary
    const userRes = await client.query(
      `SELECT u.id AS "userId", b.id AS "beneficiaryId" 
       FROM users u 
       JOIN beneficiaries b ON b."userId" = u.id 
       WHERE u.phone = $1`,
      [phone]
    );
    if (!userRes.rows.length) throw new Error(`User with phone ${phone} not found`);
    const { beneficiaryId } = userRes.rows[0];

    // 2. Resolve Active Subscription & Active Period
    const subRes = await client.query(
      `SELECT s.id AS "subscriptionId", bp.id AS "periodId"
       FROM subscriptions s
       LEFT JOIN benefit_periods bp ON bp."subscriptionId" = s.id AND bp.status = 'ACTIVE'
       WHERE s."beneficiaryId" = $1 AND s."isActive" = true
       ORDER BY s."createdAt" DESC LIMIT 1`,
      [beneficiaryId]
    );
    if (!subRes.rows.length) throw new Error(`No active subscription found for beneficiary ${beneficiaryId}`);
    const { subscriptionId, periodId } = subRes.rows[0];

    // 3. Resolve Benefit
    const benRes = await client.query(
      `SELECT id, name, "unitLabel" FROM benefits WHERE code = $1 LIMIT 1`,
      [benefitCode]
    );
    if (!benRes.rows.length) throw new Error(`Benefit with code ${benefitCode} not found`);
    const { id: benefitId, name: benefitName, unitLabel } = benRes.rows[0];

    // 4. Upsert subscription_benefit_balances
    const sbbRes = await client.query(`
      INSERT INTO subscription_benefit_balances (
        id, "subscriptionId", "benefitId", "snapshotBenefitName", "snapshotUnitLabel",
        "totalUnits", "availableUnits", "usedUnits", "reservedUnits", unit, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $5, 0, 0, $4, NOW(), NOW()
      )
      ON CONFLICT ("subscriptionId", "benefitId")
      DO UPDATE SET
        "totalUnits" = $5,
        "availableUnits" = $5,
        "usedUnits" = 0,
        "reservedUnits" = 0,
        "snapshotBenefitName" = EXCLUDED."snapshotBenefitName",
        "snapshotUnitLabel" = EXCLUDED."snapshotUnitLabel",
        "updatedAt" = NOW()
      RETURNING id;
    `, [subscriptionId, benefitId, benefitName, unitLabel, unitsToGrant]);

    // 5. Upsert benefit_period_balances (if period exists)
    if (periodId) {
      await client.query(`
        INSERT INTO benefit_period_balances (
          id, "periodId", "benefitId", "snapshotName", "snapshotUnitLabel",
          "baseAllocation", "rolloverAllocation", "totalAllocation",
          "usedQuantity", "reservedQuantity", "remainingQuantity", "rolloverCap",
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 0, $5, 0, 0, $5, $5, NOW(), NOW()
        )
        ON CONFLICT ("periodId", "benefitId")
        DO UPDATE SET
          "baseAllocation" = $5,
          "totalAllocation" = $5,
          "remainingQuantity" = $5,
          "usedQuantity" = 0,
          "reservedQuantity" = 0,
          "snapshotName" = EXCLUDED."snapshotName",
          "snapshotUnitLabel" = EXCLUDED."snapshotUnitLabel",
          "updatedAt" = NOW();
      `, [periodId, benefitId, benefitName, unitLabel, unitsToGrant]);
    }

    // 6. Audit transaction
    await client.query(`
      INSERT INTO benefit_transactions (
        id, "balanceId", "transactionType", units,
        "totalBefore", "totalAfter", "reservedBefore", "reservedAfter",
        "usedBefore", "usedAfter", "availableBefore", "availableAfter",
        reason, "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, 'ALLOCATED', $2,
        0, $2, 0, 0, 0, 0, 0, $2,
        'Manual add-on allocation: ' || $3 || ' (' || $2 || ' units)', NOW()
      );
    `, [sbbRes.rows[0].id, unitsToGrant, benefitName]);

    await client.query('COMMIT');
    console.log(`✅ Granted ${unitsToGrant} units of [${benefitName}] to ${phone} successfully!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Allocation failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

// Example usage:
allocateAddon({
  phone: '0000000000',
  benefitCode: 'EMR_101',
  unitsToGrant: 5
});
```

---

## 6. Verification Checklist

After running the query or script, execute this verification query to guarantee the changes are live:

```sql
SELECT 
  u.phone,
  u.name AS user_name,
  s."isActive" AS subscription_active,
  sbb."snapshotBenefitName",
  sbb."totalUnits" AS lifetime_total,
  sbb."availableUnits" AS lifetime_available,
  bpb."snapshotName" AS active_period_benefit,
  bpb."remainingQuantity" AS period_remaining_units
FROM users u
JOIN beneficiaries b ON b."userId" = u.id
JOIN subscriptions s ON s."beneficiaryId" = b.id
LEFT JOIN subscription_benefit_balances sbb ON sbb."subscriptionId" = s.id
LEFT JOIN benefit_periods bp ON bp."subscriptionId" = s.id AND bp.status = 'ACTIVE'
LEFT JOIN benefit_period_balances bpb ON bpb."periodId" = bp.id AND bpb."benefitId" = sbb."benefitId"
WHERE u.phone = '0000000000' AND s."isActive" = true;
```

**Expected output:**
- `subscription_active` = `true`
- `lifetime_available` = `5` (or desired units)
- `period_remaining_units` = `5`
- The benefit will now immediately show in the mobile app under **Utilization** and enable **Instant SOS** triggers.
