# Session Implementation Context — Visit Buffer Billing, Timers, Admin Audit & Website Comparison

Branch: `staging` (also created `patch/production` from `origin/production` `68afc46` earlier in the session).

---

## 1. Website Package Comparison Table (`included` Only)
- **File:** `apps/website/src/pages/PlansPage.jsx`
- **Rule:** Only package benefits tagged as `included` (`pb.category || detectDefaultBenefitCategory(pb.benefit) === "included"`) and active (`pb.benefit.isActive !== false`) are shown and marked green/included in the side-by-side comparison table. `addon` (Member Rate) and `arranged` (We arrange it) benefits are excluded from comparison rows/ticks.
- **Verified:** `npm --prefix apps/website run build` passed.

---

## 2. Visit 10-Minute Grace Buffer & Actual-Time Deduction
- **Helper:** `apps/api/app/services/benefit/visitBillingCalculator.ts` (`calculateVisitBillableMinutes`)
- **Rule (default `baseMinutes = 60`, `bufferMinutes = 10`, configurable via `SystemConfig` key `VISIT_OVERTIME_BUFFER_MINUTES`):**
  - `0–60 min` → bills `60 min` (`1.0 hr`)
  - `61–70 min` (within 10-min grace buffer) → bills `60 min` (`1.0 hr`, buffer is free)
  - `> 70 min` (e.g., `60 + 10 + 10 = 80 min` elapsed) → bills `elapsed - 10` (`70 min` = `1.1667 hrs`)
- **Wired Into:**
  - `apps/api/app/services/care_companion/visit_service.ts` (`checkOut`)
  - `apps/api/app/services/sathi/sathi_service.ts`
  - `apps/api/app/services/beneficiary/beneficiary_sathi_service.ts`
  - `apps/admin-backend/routes/visits.js` (admin complete + admin edit)

---

## 3. Live Visit Reminder & Overtime Worker (`@maihoonna/notifications`)
- **Schema (`packages/database/prisma/schema.prisma` — `Visit`):**
  - Duration audit fields: `actualDurationMinutes`, `billableMinutes`, `overriddenDurationMinutes`
  - Idempotency timestamps: `reminder15mSentAt`, `reminder5mSentAt`, `timeCompleteSentAt`, `overtimeStartedSentAt`
  - Synced to DB via `npm --prefix packages/database run db:sync`.
- **Templates (`packages/notifications/src/registry/care-mitra-templates.registry.ts`):**
  - `VISIT_ENDING_15M` (15m before scheduled end)
  - `VISIT_ENDING_5M` (5m before scheduled end)
  - `VISIT_TIME_COMPLETE` (at scheduled end -> buffer starts)
  - `VISIT_OVERTIME_STARTED` (after 10m buffer expires -> overtime billing starts)
  - `VISIT_COMPLETED_FEEDBACK_PUSH` (post-checkout thank-you + feedback push to Beneficiary/Subscriber)
- **Worker:** `apps/api/app/workers/visitTimerWorker.ts`, registered in `apps/api/app/run.ts` (`startVisitTimerWorker()`). Runs every 60s on `in_progress` visits and dispatches push notifications via `notificationProducer.publish`.

---

## 4. Care Mitra Checkout Time Override
- **Mobile UI:** `apps/mobile-app/app/(care-companion)/visit-details.tsx`
  - Pre-fills **Actual Time Spent (minutes)** from `checkInTime` with live billable preview (`10 min` grace buffer).
  - Care Mitra can override the minutes before auto geo-fence or manual check-out (`actualMinutesOverride`).
- **API:** `apps/api/app/schemas/visit.ts` (`checkOutSchema`) & `apps/api/app/services/care_companion/visit_service.ts` (`checkOut`)
  - Stores `actualDurationMinutes`, `billableMinutes`, `overriddenDurationMinutes`, deducts `billableMinutes / 60`, and dispatches `VISIT_COMPLETED_FEEDBACK_PUSH` to Beneficiary/Subscriber.

---

## 5. Admin Visit Details — View, Edit & Audit Log
- **Backend (`apps/admin-backend/routes/visits.js`):**
  - `GET /api/visits/:id` returns `editLogs` from `ActivityLog` (`type: 'VISIT'`, `action: 'VISIT_EDITED'`).
  - `PATCH /api/visits/:id/edit` accepts `actualDurationMinutes`, recalculates `billableMinutes` with the 10-min buffer, and logs `from → to` diffs to `ActivityLog`.
- **Frontend (`apps/admin-frontend/src/app/components/field-management/VisitDetailsModal.tsx`):**
  - View mode displays **Actual Time (CC Submitted)** (with `CC Overridden` badge if overridden) and **Billable / Deducted**.
  - Edit mode allows editing **Actual Time Spent (Minutes — CC Filled)** with live billable preview.
  - **Edit History** section renders all `ActivityLog` diffs (`editedBy`, timestamp, `field: old → new`).
