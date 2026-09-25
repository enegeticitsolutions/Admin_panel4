/**
 * Migration Script: Migrate Profile "Anirudh" (phone: 8585858585)
 * From: maihoonna_staging
 * To:   maihoonna_prod
 *
 * Usage on EC2:
 *   cd ~/Admin_panel4/apps/api
 *   node scripts/migrate_anirudh.js
 */

const { Client } = require('pg');

const STAGING_URL = process.env.STAGING_DATABASE_URL ||
  'postgresql://MaihoonnaPSQLDev:secure%231212@maihoonnapostgresqldev.cluster-czyi8ye04wpq.ap-south-1.rds.amazonaws.com:5432/maihoonna_staging?sslmode=no-verify';

const PROD_URL = process.env.PROD_DATABASE_URL ||
  'postgresql://MaihoonnaPSQLDev:secure%231212@maihoonnapostgresqldev.cluster-czyi8ye04wpq.ap-south-1.rds.amazonaws.com:5432/maihoonna_prod?sslmode=no-verify';

const TARGET_PHONE_DIGITS = '8585858585';
const TARGET_NAME = 'anirudh';

const columnsCache = new Map();

async function getTableColumns(client, tableName) {
  if (columnsCache.has(tableName)) {
    return columnsCache.get(tableName);
  }
  try {
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [tableName]
    );
    const set = new Set(res.rows.map(r => r.column_name));
    columnsCache.set(tableName, set);
    return set;
  } catch (e) {
    return new Set();
  }
}

async function migrateTable(stagingClient, prodClient, tableName, rows, options = {}) {
  if (!rows || rows.length === 0) return 0;
  const { conflictKey = 'id', onConflict = 'UPDATE', modifyRow = null } = options;

  const prodCols = await getTableColumns(prodClient, tableName);
  if (prodCols.size === 0) {
    console.warn(`  [SKIP] Table "${tableName}" not found or empty column set in production database.`);
    return 0;
  }

  let count = 0;
  for (const rawRow of rows) {
    const row = modifyRow ? await modifyRow(rawRow) : rawRow;
    if (!row) continue;

    const validKeys = Object.keys(row).filter(k => prodCols.has(k));
    if (validKeys.length === 0) continue;

    const cols = validKeys.map(k => `"${k}"`).join(', ');
    const placeholders = validKeys.map((_, i) => `$${i + 1}`).join(', ');
    const vals = validKeys.map(k => row[k]);

    let sql;
    if (onConflict === 'UPDATE' && conflictKey && prodCols.has(conflictKey)) {
      const updateCols = validKeys
        .filter(k => k !== conflictKey)
        .map(k => `"${k}" = EXCLUDED."${k}"`)
        .join(', ');
      if (updateCols.length > 0) {
        sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("${conflictKey}") DO UPDATE SET ${updateCols};`;
      } else {
        sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("${conflictKey}") DO NOTHING;`;
      }
    } else if (onConflict === 'NOTHING' && conflictKey && prodCols.has(conflictKey)) {
      sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT ("${conflictKey}") DO NOTHING;`;
    } else {
      sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
    }

    // Use SAVEPOINT per row so a foreign key issue on a single log never aborts the overall transaction
    const spName = `sp_${tableName.substring(0, 10)}_${count}`;
    try {
      await prodClient.query(`SAVEPOINT ${spName}`);
      await prodClient.query(sql, vals);
      await prodClient.query(`RELEASE SAVEPOINT ${spName}`);
      count++;
    } catch (err) {
      await prodClient.query(`ROLLBACK TO SAVEPOINT ${spName}`);
      console.warn(`  [WARN] ${tableName} row skipped: ${err.message}`);
    }
  }
  return count;
}

async function run() {
  console.log('='.repeat(70));
  console.log('  MaiHoonNa Data Migration: Staging -> Production (v2 with Savepoints)');
  console.log('  Target Profile: Anirudh (Phone: 8585858585)');
  console.log('='.repeat(70));

  const staging = new Client({ connectionString: STAGING_URL, connectionTimeoutMillis: 10000 });
  const prod = new Client({ connectionString: PROD_URL, connectionTimeoutMillis: 10000 });

  try {
    console.log('\n[*] Connecting to Staging DB...');
    await staging.connect();
    console.log('    ✔ Connected to Staging.');

    console.log('[*] Connecting to Production DB...');
    await prod.connect();
    console.log('    ✔ Connected to Production.');

    // Pre-cache all production table column schemas BEFORE transaction starts
    const allExpectedTables = [
      'users', 'beneficiaries', 'addresses', 'emergency_contacts', 'schedule_preferences',
      'beneficiary_conditions', 'medical_records', 'medications', 'medication_adherence',
      'subscriptions', 'subscription_benefit_balances', 'benefit_periods', 'package_hours_logs',
      'payments', 'invoices', 'appointments', 'callback_requests', 'service_requests',
      'beneficiary_vital_configs', 'vital_readings', 'vital_alerts', 'otps',
      'medical_conditions', 'subscription_packages', 'package_versions', 'benefits', 'benefit_types',
      'vital_definitions'
    ];
    for (const t of allExpectedTables) {
      await getTableColumns(prod, t);
    }

    // 1. Locate User in Staging
    console.log('\n[1/6] Searching for User in Staging...');
    const userRes = await staging.query(
      `SELECT * FROM users WHERE phone LIKE $1 OR name ILIKE $2`,
      [`%${TARGET_PHONE_DIGITS}%`, `%${TARGET_NAME}%`]
    );

    if (userRes.rows.length === 0) {
      console.error(`❌ No user found matching phone "%${TARGET_PHONE_DIGITS}%" or name "%${TARGET_NAME}%" in Staging!`);
      return;
    }

    const primaryUser = userRes.rows[0];
    console.log(`    ✔ Found User: "${primaryUser.name}" | ID: ${primaryUser.id} | Phone: ${primaryUser.phone} | Role: ${primaryUser.role}`);

    const userIds = new Set(userRes.rows.map(u => u.id));

    // 2. Locate Beneficiaries
    console.log('\n[2/6] Finding Beneficiaries in Staging...');
    const benRes = await staging.query(
      `SELECT * FROM beneficiaries WHERE "subscriberId" = ANY($1::text[]) OR "userId" = ANY($1::text[])`,
      [Array.from(userIds)]
    );
    const beneficiaries = benRes.rows;
    console.log(`    ✔ Found ${beneficiaries.length} beneficiary record(s):`);
    beneficiaries.forEach(b => console.log(`       - "${b.name}" (ID: ${b.id}, userId: ${b.userId})`));

    const benUserIds = beneficiaries.map(b => b.userId).filter(Boolean);
    if (benUserIds.length > 0) {
      const extraUsersRes = await staging.query(
        `SELECT * FROM users WHERE id = ANY($1::text[])`,
        [benUserIds]
      );
      extraUsersRes.rows.forEach(u => userIds.add(u.id));
    }
    const allUserIds = Array.from(userIds);
    const allUsersRes = await staging.query(
      `SELECT * FROM users WHERE id = ANY($1::text[])`,
      [allUserIds]
    );
    const allUsers = allUsersRes.rows;
    console.log(`    ✔ Total user accounts involved: ${allUsers.length}`);

    const beneficiaryIds = beneficiaries.map(b => b.id);

    // 3. Fetch All Child/Related Records from Staging
    console.log('\n[3/6] Fetching related records from Staging...');

    const addresses = (await staging.query(
      `SELECT * FROM addresses WHERE "userId" = ANY($1::text[])`,
      [allUserIds]
    )).rows;

    const emergencyContacts = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM emergency_contacts WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const schedulePreferences = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM schedule_preferences WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const beneficiaryConditions = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM beneficiary_conditions WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const medicalRecords = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM medical_records WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const medications = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM medications WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const medicationAdherence = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM medication_adherence WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const subscriptions = (await staging.query(
      `SELECT * FROM subscriptions WHERE "subscriberId" = ANY($1::text[])` +
      (beneficiaryIds.length > 0 ? ` OR "beneficiaryId" = ANY($2::text[])` : ''),
      beneficiaryIds.length > 0 ? [allUserIds, beneficiaryIds] : [allUserIds]
    )).rows;
    const subscriptionIds = subscriptions.map(s => s.id);

    const benefitBalances = subscriptionIds.length > 0 ? (await staging.query(
      `SELECT * FROM subscription_benefit_balances WHERE "subscriptionId" = ANY($1::text[])`,
      [subscriptionIds]
    )).rows : [];

    const benefitPeriods = subscriptionIds.length > 0 ? (await staging.query(
      `SELECT * FROM benefit_periods WHERE "subscriptionId" = ANY($1::text[])`,
      [subscriptionIds]
    )).rows : [];

    const packageHoursLogs = subscriptionIds.length > 0 ? (await staging.query(
      `SELECT * FROM package_hours_logs WHERE "subscriptionId" = ANY($1::text[])`,
      [subscriptionIds]
    )).rows : [];

    const payments = (await staging.query(
      `SELECT * FROM payments WHERE "subscriberId" = ANY($1::text[])`,
      [allUserIds]
    )).rows;

    const invoices = (await staging.query(
      `SELECT * FROM invoices WHERE "subscriberId" = ANY($1::text[])`,
      [allUserIds]
    )).rows;

    const appointments = (await staging.query(
      `SELECT * FROM appointments WHERE "bookedBy" = ANY($1::text[])` +
      (beneficiaryIds.length > 0 ? ` OR "beneficiaryId" = ANY($2::text[])` : ''),
      beneficiaryIds.length > 0 ? [allUserIds, beneficiaryIds] : [allUserIds]
    )).rows;

    const callbackRequests = (await staging.query(
      `SELECT * FROM callback_requests WHERE "subscriberId" = ANY($1::text[])` +
      (beneficiaryIds.length > 0 ? ` OR "beneficiaryId" = ANY($2::text[])` : ''),
      beneficiaryIds.length > 0 ? [allUserIds, beneficiaryIds] : [allUserIds]
    )).rows;

    const serviceRequests = (await staging.query(
      `SELECT * FROM service_requests WHERE "subscriberId" = ANY($1::text[])` +
      (beneficiaryIds.length > 0 ? ` OR "beneficiaryId" = ANY($2::text[])` : ''),
      beneficiaryIds.length > 0 ? [allUserIds, beneficiaryIds] : [allUserIds]
    )).rows;

    const vitalConfigs = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM beneficiary_vital_configs WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const vitalReadings = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM vital_readings WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const vitalAlerts = beneficiaryIds.length > 0 ? (await staging.query(
      `SELECT * FROM vital_alerts WHERE "beneficiaryId" = ANY($1::text[])`,
      [beneficiaryIds]
    )).rows : [];

    const otps = (await staging.query(
      `SELECT * FROM otps WHERE phone LIKE $1`,
      [`%${TARGET_PHONE_DIGITS}%`]
    )).rows;

    console.log(`    📊 Data Summary:`);
    console.log(`       - Users:                  ${allUsers.length}`);
    console.log(`       - Beneficiaries:          ${beneficiaries.length}`);
    console.log(`       - Addresses:              ${addresses.length}`);
    console.log(`       - Emergency Contacts:     ${emergencyContacts.length}`);
    console.log(`       - Schedule Preferences:   ${schedulePreferences.length}`);
    console.log(`       - Medical Conditions:     ${beneficiaryConditions.length}`);
    console.log(`       - Medical Records:        ${medicalRecords.length}`);
    console.log(`       - Medications:            ${medications.length}`);
    console.log(`       - Subscriptions:          ${subscriptions.length}`);
    console.log(`       - Benefit Balances:       ${benefitBalances.length}`);
    console.log(`       - Package Hours Logs:     ${packageHoursLogs.length}`);
    console.log(`       - Payments:               ${payments.length}`);
    console.log(`       - Invoices:               ${invoices.length}`);
    console.log(`       - Appointments:           ${appointments.length}`);
    console.log(`       - Callback Requests:      ${callbackRequests.length}`);
    console.log(`       - Service Requests:       ${serviceRequests.length}`);
    console.log(`       - Vital Configs & Logs:   ${vitalConfigs.length + vitalReadings.length}`);
    console.log(`       - OTPs:                   ${otps.length}`);

    // 4. Resolve Catalog References
    console.log('\n[4/6] Verifying Catalog References in Production...');

    if (beneficiaryConditions.length > 0) {
      const condIds = [...new Set(beneficiaryConditions.map(c => c.conditionId))];
      for (const condId of condIds) {
        const check = await prod.query(`SELECT id FROM medical_conditions WHERE id = $1`, [condId]);
        if (check.rows.length === 0) {
          const condRow = (await staging.query(`SELECT * FROM medical_conditions WHERE id = $1`, [condId])).rows[0];
          if (condRow) {
            await migrateTable(staging, prod, 'medical_conditions', [condRow], { conflictKey: 'id' });
            console.log(`       + Synced missing medical_condition: "${condRow.name}"`);
          }
        }
      }
    }

    if (subscriptions.length > 0) {
      const pkgTypes = [...new Set(subscriptions.map(s => s.packageType).filter(Boolean))];
      for (const pkgType of pkgTypes) {
        const check = await prod.query(`SELECT type FROM subscription_packages WHERE type = $1`, [pkgType]);
        if (check.rows.length === 0) {
          const pkgRow = (await staging.query(`SELECT * FROM subscription_packages WHERE type = $1`, [pkgType])).rows[0];
          if (pkgRow) {
            await migrateTable(staging, prod, 'subscription_packages', [pkgRow], { conflictKey: 'type' });
            console.log(`       + Synced missing subscription_package: "${pkgRow.type}"`);
          }
        }
      }

      const versionIds = [...new Set(subscriptions.map(s => s.packageVersionId).filter(Boolean))];
      for (const verId of versionIds) {
        const check = await prod.query(`SELECT id FROM package_versions WHERE id = $1`, [verId]);
        if (check.rows.length === 0) {
          const verRow = (await staging.query(`SELECT * FROM package_versions WHERE id = $1`, [verId])).rows[0];
          if (verRow) {
            await migrateTable(staging, prod, 'package_versions', [verRow], { conflictKey: 'id' });
            console.log(`       + Synced missing package_version: "${verRow.id}"`);
          }
        }
      }
    }

    if (benefitBalances.length > 0) {
      const benefitIds = [...new Set(benefitBalances.map(b => b.benefitId).filter(Boolean))];
      for (const bId of benefitIds) {
        const check = await prod.query(`SELECT id FROM benefits WHERE id = $1`, [bId]);
        if (check.rows.length === 0) {
          const bRow = (await staging.query(`SELECT * FROM benefits WHERE id = $1`, [bId])).rows[0];
          if (bRow) {
            if (bRow.benefitTypeId) {
              const typeCheck = await prod.query(`SELECT id FROM benefit_types WHERE id = $1`, [bRow.benefitTypeId]);
              if (typeCheck.rows.length === 0) {
                const typeRow = (await staging.query(`SELECT * FROM benefit_types WHERE id = $1`, [bRow.benefitTypeId])).rows[0];
                if (typeRow) await migrateTable(staging, prod, 'benefit_types', [typeRow], { conflictKey: 'id' });
              }
            }
            await migrateTable(staging, prod, 'benefits', [bRow], { conflictKey: 'id' });
            console.log(`       + Synced missing benefit: "${bRow.name}"`);
          }
        }
      }
    }

    if (vitalConfigs.length > 0 || vitalReadings.length > 0) {
      const vDefIds = [
        ...new Set([
          ...vitalConfigs.map(c => c.vitalDefinitionId),
          ...vitalReadings.map(r => r.vitalDefinitionId)
        ].filter(Boolean))
      ];
      for (const vdId of vDefIds) {
        const check = await prod.query(`SELECT id FROM vital_definitions WHERE id = $1`, [vdId]);
        if (check.rows.length === 0) {
          const vdRow = (await staging.query(`SELECT * FROM vital_definitions WHERE id = $1`, [vdId])).rows[0];
          if (vdRow) {
            await migrateTable(staging, prod, 'vital_definitions', [vdRow], { conflictKey: 'id' });
            console.log(`       + Synced missing vital_definition: "${vdRow.name}"`);
          }
        }
      }
    }

    let prodCompanionIds = new Set();
    let prodTeamIds = new Set();
    let prodZoneIds = new Set();
    try { prodCompanionIds = new Set((await prod.query(`SELECT id FROM care_companions`)).rows.map(r => r.id)); } catch (e) {}
    try { prodTeamIds = new Set((await prod.query(`SELECT id FROM teams`)).rows.map(r => r.id)); } catch (e) {}
    try { prodZoneIds = new Set((await prod.query(`SELECT id FROM zones`)).rows.map(r => r.id)); } catch (e) {}

    // Check if user already exists in production by phone
    for (const u of allUsers) {
      const prodExisting = (await prod.query(`SELECT id, phone FROM users WHERE phone = $1`, [u.phone])).rows[0];
      if (prodExisting && prodExisting.id !== u.id) {
        console.log(`       ℹ User with phone ${u.phone} already exists in Prod with ID ${prodExisting.id}. Aligning IDs...`);
        const oldId = u.id;
        const newId = prodExisting.id;
        u.id = newId;
        beneficiaries.forEach(b => {
          if (b.subscriberId === oldId) b.subscriberId = newId;
          if (b.userId === oldId) b.userId = newId;
        });
        addresses.forEach(a => { if (a.userId === oldId) a.userId = newId; });
        subscriptions.forEach(s => { if (s.subscriberId === oldId) s.subscriberId = newId; });
        payments.forEach(p => { if (p.subscriberId === oldId) p.subscriberId = newId; });
        invoices.forEach(i => { if (i.subscriberId === oldId) i.subscriberId = newId; });
        appointments.forEach(ap => { if (ap.bookedBy === oldId) ap.bookedBy = newId; });
        callbackRequests.forEach(cb => { if (cb.subscriberId === oldId) cb.subscriberId = newId; });
        serviceRequests.forEach(sr => { if (sr.subscriberId === oldId) sr.subscriberId = newId; });
      }
    }

    const allUserIdsSet = new Set(allUsers.map(u => u.id));

    // 5. Execute Migration in Transaction
    console.log('\n[5/6] Writing data into Production DB (Safe Transaction)...');
    await prod.query('BEGIN');

    try {
      const uCount = await migrateTable(staging, prod, 'users', allUsers, { conflictKey: 'id' });
      console.log(`       ✔ users (${uCount})`);

      const sanitizedBeneficiaries = beneficiaries.map(b => {
        const copy = { ...b };
        if (copy.primaryCcId && !prodCompanionIds.has(copy.primaryCcId)) copy.primaryCcId = null;
        if (copy.secondaryCcId && !prodCompanionIds.has(copy.secondaryCcId)) copy.secondaryCcId = null;
        if (copy.teamId && !prodTeamIds.has(copy.teamId)) copy.teamId = null;
        return copy;
      });
      const bCount = await migrateTable(staging, prod, 'beneficiaries', sanitizedBeneficiaries, { conflictKey: 'id' });
      console.log(`       ✔ beneficiaries (${bCount})`);

      const sanitizedAddresses = addresses.map(a => {
        const copy = { ...a };
        if (copy.zoneId && !prodZoneIds.has(copy.zoneId)) copy.zoneId = null;
        return copy;
      });
      const aCount = await migrateTable(staging, prod, 'addresses', sanitizedAddresses, { conflictKey: 'id' });
      console.log(`       ✔ addresses (${aCount})`);

      const ecCount = await migrateTable(staging, prod, 'emergency_contacts', emergencyContacts, { conflictKey: 'id' });
      console.log(`       ✔ emergency_contacts (${ecCount})`);

      const spCount = await migrateTable(staging, prod, 'schedule_preferences', schedulePreferences, { conflictKey: 'id' });
      console.log(`       ✔ schedule_preferences (${spCount})`);

      const bcCount = await migrateTable(staging, prod, 'beneficiary_conditions', beneficiaryConditions, { conflictKey: 'id' });
      console.log(`       ✔ beneficiary_conditions (${bcCount})`);

      const mrCount = await migrateTable(staging, prod, 'medical_records', medicalRecords, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.uploadedBy && !allUserIdsSet.has(copy.uploadedBy)) copy.uploadedBy = primaryUser.id;
          return copy;
        }
      });
      console.log(`       ✔ medical_records (${mrCount})`);

      const medCount = await migrateTable(staging, prod, 'medications', medications, { conflictKey: 'id' });
      console.log(`       ✔ medications (${medCount})`);

      const maCount = await migrateTable(staging, prod, 'medication_adherence', medicationAdherence, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.recordedBy && !allUserIdsSet.has(copy.recordedBy)) copy.recordedBy = primaryUser.id;
          return copy;
        }
      });
      console.log(`       ✔ medication_adherence (${maCount})`);

      const sCount = await migrateTable(staging, prod, 'subscriptions', subscriptions, { conflictKey: 'id' });
      console.log(`       ✔ subscriptions (${sCount})`);

      const bbCount = await migrateTable(staging, prod, 'subscription_benefit_balances', benefitBalances, { conflictKey: 'id' });
      console.log(`       ✔ subscription_benefit_balances (${bbCount})`);

      const bpCount = await migrateTable(staging, prod, 'benefit_periods', benefitPeriods, { conflictKey: 'id' });
      console.log(`       ✔ benefit_periods (${bpCount})`);

      const phlCount = await migrateTable(staging, prod, 'package_hours_logs', packageHoursLogs, { conflictKey: 'id' });
      console.log(`       ✔ package_hours_logs (${phlCount})`);

      const pCount = await migrateTable(staging, prod, 'payments', payments, { conflictKey: 'id' });
      console.log(`       ✔ payments (${pCount})`);

      const iCount = await migrateTable(staging, prod, 'invoices', invoices, { conflictKey: 'id' });
      console.log(`       ✔ invoices (${iCount})`);

      const apptCount = await migrateTable(staging, prod, 'appointments', appointments, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.bookedBy && !allUserIdsSet.has(copy.bookedBy)) copy.bookedBy = primaryUser.id;
          if (copy.careCompanionId && !prodCompanionIds.has(copy.careCompanionId)) copy.careCompanionId = null;
          return copy;
        }
      });
      console.log(`       ✔ appointments (${apptCount})`);

      const cbCount = await migrateTable(staging, prod, 'callback_requests', callbackRequests, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.assignedTo && !allUserIdsSet.has(copy.assignedTo)) copy.assignedTo = null;
          return copy;
        }
      });
      console.log(`       ✔ callback_requests (${cbCount})`);

      const srCount = await migrateTable(staging, prod, 'service_requests', serviceRequests, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.requestedBy && !allUserIdsSet.has(copy.requestedBy)) copy.requestedBy = primaryUser.id;
          return copy;
        }
      });
      console.log(`       ✔ service_requests (${srCount})`);

      const vcCount = await migrateTable(staging, prod, 'beneficiary_vital_configs', vitalConfigs, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.selectedBySubscriberId && !allUserIdsSet.has(copy.selectedBySubscriberId)) {
            copy.selectedBySubscriberId = primaryUser.id;
          }
          return copy;
        }
      });
      const vrCount = await migrateTable(staging, prod, 'vital_readings', vitalReadings, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.capturedBy && !allUserIdsSet.has(copy.capturedBy)) copy.capturedBy = primaryUser.id;
          return copy;
        }
      });
      const vaCount = await migrateTable(staging, prod, 'vital_alerts', vitalAlerts, {
        conflictKey: 'id',
        modifyRow: async (row) => {
          const copy = { ...row };
          if (copy.acknowledgedBy && !allUserIdsSet.has(copy.acknowledgedBy)) copy.acknowledgedBy = null;
          return copy;
        }
      });
      console.log(`       ✔ vitals: ${vcCount} configs, ${vrCount} readings, ${vaCount} alerts`);

      const otpCount = await migrateTable(staging, prod, 'otps', otps, { conflictKey: 'id' });
      console.log(`       ✔ otps (${otpCount})`);

      await prod.query('COMMIT');
      console.log('\n    🎉 [SUCCESS] Transaction committed successfully!');
    } catch (err) {
      await prod.query('ROLLBACK');
      console.error('\n    ❌ [ERROR] Transaction failed & rolled back:', err.message);
      throw err;
    }

    // 6. Verification
    console.log('\n[6/6] Verifying Data in Production DB...');
    const verifyUser = await prod.query(
      `SELECT id, phone, name, role, "createdAt" FROM users WHERE phone LIKE $1`,
      [`%${TARGET_PHONE_DIGITS}%`]
    );
    console.log('    ✔ Production User:', verifyUser.rows);

    const verifyBen = await prod.query(
      `SELECT id, name, "subscriberId", "userId" FROM beneficiaries WHERE "subscriberId" = ANY($1::text[])`,
      [allUserIds]
    );
    console.log(`    ✔ Production Beneficiaries (${verifyBen.rows.length}):`, verifyBen.rows);

    console.log('\n' + '='.repeat(70));
    console.log('  MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70) + '\n');
  } catch (err) {
    console.error('Fatal Migration Error:', err.message);
  } finally {
    await staging.end();
    await prod.end();
  }
}

run();
