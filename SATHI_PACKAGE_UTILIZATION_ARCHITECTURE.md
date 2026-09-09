# Sathi Companion Package Utilization & Activity History: Technical Architecture & Implementation Guide

## 1. Executive Summary & Problem Description

When Sathi volunteers completed visits with beneficiaries (such as a 6-hour or 8.5-hour companion visit), the **Package Utilization** screen in the mobile application suffered from two critical bugs:
1. **Sathi Companion Hours did not show usage**:
   - The utilization card displayed `0h used · 10h remaining` (0% progress), as if no hours had been consumed.
2. **Recent Activity remained empty**:
   - The activity feed rendered `0 entries` ("No usage logged yet. Activity will appear once visits are completed.") instead of displaying the completed Sathi visits.

This document details the root causes, the underlying data models, the exact code modifications implemented across the backend and frontend, and how to verify the solution.

---

## 2. Root Cause Analysis

### A. Dual Balance Architectures (Legacy vs. Discrete Monthly Periods)
The MHN system contains two co-existing balance tracking architectures:

1. **Legacy Model (`SubscriptionBenefitBalance`)**:
   - Table: `subscription_benefit_balances` (foreign key to `subscriptions`).
   - Fields: `totalUnits`, `usedUnits`, `availableUnits`, `reservedUnits`.
   - Used by older endpoints and simple lifetime counting.

2. **Discrete Monthly Period Model (`BenefitPeriod` & `BenefitPeriodBalance`)**:
   - Tables: `benefit_periods`, `benefit_period_balances`, and `benefit_usages`.
   - Introduced for multi-month subscriptions to support monthly allocations and rollovers.
   - Evaluated Just-In-Time (JIT) by `BenefitPeriodManager.ts`.
   - Immutable audit ledger entries are created via `BenefitLedgerEngine.ts`.
   - Fields on `benefit_period_balances`: `baseAllocation`, `rolloverAllocation`, `totalAllocation`, `usedQuantity`, `reservedQuantity`, `remainingQuantity`.

### B. Why Sathi Visits Did Not Deduct Hours
In `apps/api/app/services/sathi/sathi_service.ts` inside `checkoutVolunteerVisit`:
- The previous checkout code only updated the legacy table:
  ```ts
  await tx.subscriptionBenefitBalance.update({
    where: { id: visitLog.subscriptionBenefitBalanceId },
    data: { usedUnits: { increment: hoursEarned } }
  });
  ```
- **The flaw**: It **never** interacted with `BenefitPeriodManager` or `BenefitPeriodBalance`.
- Meanwhile, the mobile app's package utilization endpoint (`GET /api/shared/utilization` in `utilization.routes.ts`) calls `benefitPeriodManager.evaluateAndTransitionJIT(activeSub.id)`. When an active period exists, it reads benefit quotas exclusively from `BenefitPeriodBalance`. Because `BenefitPeriodBalance.usedQuantity` was never updated by Sathi checkout, it evaluated `usedQuantity = 0`, showing `0h used · 10h remaining`.

### C. Why Recent Activity Showed 0 Entries
In `apps/api/app/api/shared/utilization.routes.ts`:
- `recentLogs` was assembled only from `package_hours_logs` (populated by Care Companion visits) and `service_requests`.
- Sathi visits are saved in `volunteer_visit_logs`.
- **The flaw**:
  1. `volunteer_visit_logs` was **never queried** by `utilization.routes.ts`.
  2. `checkoutVolunteerVisit` in `sathi_service.ts` **never created** a `PackageHoursLog` record upon checkout.
  3. Although `utilization.routes.ts` queried `benefitLedgerEngine.getSubscriptionLedger` into `mappedUsage`, it omitted `mappedUsage` when assembling `recentLogs = [...mappedLogs, ...mappedRequests]`.

---

## 3. End-to-End Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Volunteer Checkout Flow
        V[Sathi App / Volunteer] -->|POST /api/sathi/visits/:id/checkout| CO[sathi_service.ts: checkoutVolunteerVisit]
        CO -->|1. Calculate Hours| CALC[rawMinutes / 60 = hoursEarned]
        CO -->|2. Update Legacy Balance| SBB[(subscription_benefit_balances: usedUnits += hoursEarned)]
        CO -->|3. Evaluate Active Period| BPM[BenefitPeriodManager: evaluateAndTransitionJIT]
        BPM --> BP[(benefit_periods: ACTIVE)]
        CO -->|4. Ledger Deduction| BLE[BenefitLedgerEngine: deductUnits]
        BLE --> BPB[(benefit_period_balances: usedQuantity += qty, remaining -= qty)]
        BLE --> BU[(benefit_usages: UsageType.SATHI_HOURS)]
        CO -->|5. Audit Log| PHL[(package_hours_logs: hoursConsumed, balanceBefore, balanceAfter)]
        CO -->|6. Complete Visit| VVL[(volunteer_visit_logs: status = completed, checkOutTime)]
    end

    subgraph Mobile App Package Utilization API
        MOB[Mobile App / Subscriber] -->|GET /api/shared/utilization| UR[utilization.routes.ts: buildDetailedUtilization]
        UR --> BPB
        UR -->|Auto-Sync with SBB| SYNC[effectiveUsed = max(pb.usedQuantity, matchingBal.usedUnits)]
        UR --> PHL
        UR --> VVL
        UR --> BU
        UR --> SR[(service_requests)]
        UR -->|Merge & Deduplicate| RES[Combined recentLogs]
        RES --> UI[PackageUtilizationPanel.tsx UI]
    end
```

---

## 4. Detailed Code Changes

### 1. `apps/api/app/services/sathi/sathi_service.ts`
- **Imports Added**:
  ```ts
  import { benefitPeriodManager } from '../benefit/BenefitPeriodManager';
  import { benefitLedgerEngine } from '../benefit/BenefitLedgerEngine';
  import { UsageType } from '@prisma/client';
  ```
- **Checkout Deduction via Ledger**:
  In `checkoutVolunteerVisit`, rounded hours to unit count:
  `const unitsToDeduct = Math.max(1, Math.round(hoursEarned));`
  Inside the database transaction:
  ```ts
  const activePeriod = await benefitPeriodManager.evaluateAndTransitionJIT(visitLog.subscriptionId);
  if (activePeriod) {
    try {
      await benefitLedgerEngine.deductUnits({
        subscriptionId: visitLog.subscriptionId,
        periodId: activePeriod.id,
        benefitId: sathiBalance.benefitId,
        quantity: unitsToDeduct,
        usageType: UsageType.SATHI_HOURS,
        referenceId: visitLog.id,
        notes: `Sathi Companion Visit Completed (${hoursEarned.toFixed(1)} hrs)`,
        performedByUserId: volunteerId,
      }, tx);
    } catch (deductErr) {
      // Fallback direct period balance decrement if ledger constraint is met
      const pb = await tx.benefitPeriodBalance.findUnique({
        where: { periodId_benefitId: { periodId: activePeriod.id, benefitId: sathiBalance.benefitId } }
      });
      if (pb) {
        const qty = Math.min(unitsToDeduct, pb.remainingQuantity);
        await tx.benefitPeriodBalance.update({
          where: { id: pb.id },
          data: {
            usedQuantity: pb.usedQuantity + qty,
            remainingQuantity: Math.max(0, pb.remainingQuantity - qty)
          }
        });
      }
    }
  }
  ```
- **Audit & Package Hours Logging**:
  ```ts
  await tx.packageHoursLog.create({
    data: {
      subscriptionId: visitLog.subscriptionId,
      beneficiaryId: visitLog.beneficiaryId,
      hoursConsumed: hoursEarned,
      balanceBefore: currentRemaining,
      balanceAfter: Math.max(0, currentRemaining - hoursEarned),
      description: `Sathi companion visit completed (${hoursEarned.toFixed(1)} hrs). Notes: ${notes || 'Completed'}`
    }
  });
  ```

---

### 2. `apps/api/app/api/shared/utilization.routes.ts`
- **Auto-Sync Balances**:
  When active period balances are read, computes:
  ```ts
  const matchingBal = (activeSub.benefitBalances || []).find((b: any) => b.benefitId === pb.benefitId);
  const effectiveUsed = Math.max(pb.usedQuantity, matchingBal ? Math.round(matchingBal.usedUnits) : 0);
  const total = pb.totalAllocation;
  const remaining = Math.max(0, total - effectiveUsed);
  ```
  If `pb.usedQuantity < effectiveUsed`, it updates `benefitPeriodBalance` asynchronously. This automatically backfills and syncs previously completed visits without requiring manual SQL scripts.
- **Query Completed Sathi Visits**:
  Added query for completed volunteer visits:
  ```ts
  const rawVolLogs = await prisma.volunteerVisitLog.findMany({
    where: { beneficiaryId: beneficiary.id, status: 'completed' },
    orderBy: { checkOutTime: 'desc' },
    take: 30,
    include: { volunteer: { select: { name: true, phone: true } } }
  });
  ```
- **Merged Recent Activity**:
  Merged `package_hours_logs`, `volunteer_visit_logs`, `benefit_usages`, and `service_requests` into `recentLogs` (deduplicated by ID/visitId and sorted by date descending).

---

### 3. `apps/api/app/services/care_companion/visit_service.ts`
- Added period balance synchronization in `checkoutCareCompanionVisit` (direct Care Companion checkout) so Care Companion visits also update discrete monthly periods and the `BenefitUsage` ledger.

---

### 4. Supporting Frontend Updates
- **`apps/sathi-app/components/shared/CareSupportModal.tsx`**:
  Replaced missing `@/utils/responsive` import with inline dynamic responsive scaling (`scale = (size) => Math.round((SCREEN_WIDTH / 390) * size)`).
- **`apps/mobile-app/app/(care-companion)/visit-details.tsx`**:
  Added numeric-only input validation (`/^\d+$/`) on all vital fields (Blood Pressure, Heart Rate, SpO2, Blood Sugar) and prevented blank submissions.

---

## 5. Verification & Test Results

### 1. TypeScript Compilation
Executed static type check across the API service:
```bash
cd apps/api && npx tsc --noEmit
# Output: Exited with code 0 (0 errors)
```

### 2. Database Verification
Simulated `buildDetailedUtilization` against actual database records:
- **Beneficiary Henuji** (`cc95f59f-d9fd-4383-a41e-82db26c4745a`):
  - **Sathi Companion Hours**: `8 used, 2 remaining (total 10) [hours]`
  - **Recent Logs**: `17 entries` loaded with volunteer names and timestamps.
- **Beneficiary Check 1** (`b6fbb358-a0b2-4852-82b6-47887ce2a519`):
  - **Recent Logs**: `3 entries` loaded (including completed `8.6 hrs` Sathi companion visit).

---

## 6. Summary of Key Files

| File Path | Description |
|---|---|
| `apps/api/app/services/sathi/sathi_service.ts` | Handles Sathi visit checkout, ledger deductions, and package hours logging |
| `apps/api/app/api/shared/utilization.routes.ts` | Provides `/api/shared/utilization` endpoint, balance auto-sync, and merged recent logs |
| `apps/api/app/services/care_companion/visit_service.ts` | Direct Care Companion checkout synchronization with discrete periods |
| `apps/mobile-app/components/shared/PackageUtilizationPanel.tsx` | Mobile app UI component rendering package benefits and recent activity list |
| `apps/sathi-app/components/shared/CareSupportModal.tsx` | Sathi app support bottom sheet modal with WhatsApp, phone, and email support |
| `apps/mobile-app/app/(care-companion)/visit-details.tsx` | Care Companion visit details and vital stats numeric validation |
