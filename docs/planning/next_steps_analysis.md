# MaiHoonAa — Next Steps Analysis
**Current date:** 2026-04-15

---

## What's Already Built (Strong Foundation ✅)

| Area | Status |
|---|---|
| Admin: Zone / Team / Zone Assignment | ✅ Done |
| Admin: Staff Onboarding (CC, FM, OM, Sales) | ✅ Done + RBAC |
| Admin: Staff Edit Modal | ✅ Done |
| Admin: Enrollment Wizard (Subscriber + Beneficiary + Medical + Emergency) | ✅ Done |
| Admin: Subscription Packages (Product Factory + Pricing)| ✅ Done |
| Admin: Benefit Types & Benefits Library | ✅ Done |
| Admin: Coupon Engine (CRUD + Validation) | ✅ Done |
| Admin: Beneficiary Staff Assignment (Pincode-based) | ✅ Done |
| Admin: Beneficiary Profile Page | ✅ Done |
| Admin: Callback Requests Page | ✅ Done |
| Admin: Vitals Management | ✅ Done |
| Mobile: Subscriber Registration + Login + OTP | ✅ Done |
| Mobile: Subscriber Dashboard (beneficiary list, stats, callback) | ✅ Done |
| Mobile: Subscription Flow (packages → checkout → coupon → purchase) | ✅ Done |
| Mobile: Beneficiary Dashboard (CC info, meds, emergency btn) | ✅ Done |
| Mobile: Beneficiary Schedule screen (basic) | ✅ Done |
| Mobile: Beneficiary Meds screen (basic) | ✅ Done |
| Mobile: Beneficiary Team screen | ✅ Done |
| Mobile: CC Dashboard (assigned beneficiaries) | ✅ Done |
| Mobile: CC Schedule screen | ✅ Done |
| Mobile: CC Visit Check-in/out with geo-fencing | ✅ Done |
| Mobile: CC Vitals capture | ✅ Done |
| Mobile: CC Visit history | ✅ Done |
| Backend: Visit Checkout with hour deduction + PackageHoursLog | ✅ Done |
| Backend: Notification records on CC assignment | ✅ Done |
| Backend: RBAC for FM (zone-scoped beneficiary list) | ✅ Done |

---

## Gap Analysis by Requirement

### 🟠 PRIORITY 1 — High Value, Close to Done

These build on existing screens/services with relatively small additions.

---

#### SUB-014 · Beneficiary list → emotional score + hours usage %
> Subscriber main screen shows name/photo, happiness score, subscription usage %.

**Current state:** `index.tsx` shows beneficiary name + photo + age/relationship. Dashboard API already returns `emotionalScore` and `hoursUsed/hoursTotal`.
**Gap:** Just display the emotional score badge and a mini progress bar of `hoursUsed / hoursTotal`.
**Touch points:** `apps/mobile-app/app/(subscriber)/index.tsx` (benCard section)

---

#### SUB-018 · Interaction record detail view (vitals + notes)
> Subscriber can click an interaction record to view vitals and notes.

**Current state:** `beneficiary-profile.tsx` exists (13 KB). Subscriber dashboard shows recent updates.
**Gap:** Need a mobile screen `/subscriber/interaction/[visitId]` showing vitals captured during that visit.
**Touch points:** New screen + `GET /subscriber/visits/:visitId/details` in mobile-backend.

---

#### SUB-019 · EMR — timeline of vitals
> Subscriber can view the beneficiary's Electronic Medical Record — timeline of vitals.

**Current state:** Vitals are captured in `VitalReading` during CC visits. Not exposed to subscriber yet.
**Gap:** Screen showing a timeline of `VitalReading` records per beneficiary with graphs.
**Touch points:** New screen in `(subscriber)/` + backend route `GET /subscriber/beneficiary/:id/emr`.

---

#### SUB-024 · Subscription utilisation (hours used vs. allocated)
> Subscriber can view subscription utilisation.

**Current state:** Dashboard API returns `hoursUsed/hoursTotal`. Beneficiary dashboard shows this on beneficiary side.
**Gap:** A dedicated utilisation card/screen from the **subscriber** perspective.
**Touch points:** `(subscriber)/package-details/` directory already exists — populate it.

---

#### BEN-001 · Emergency button with confirmation dialog
> Large Emergency button with confirmation before triggering.

**Current state:** The beneficiary `index.tsx` has an `emergencyBtn` with a red button, but **no confirmation dialog** and **no backend call**.
**Gap:** Add `Alert.alert` confirmation dialog → POST to `POST /beneficiary/emergency` which creates an `EmergencyRequest` and triggers notifications.
**Touch points:** `(beneficiary)/index.tsx` + new `EmergencyRequest` table + backend route.

---

#### BEN-006 / SUB-021 · Post-interaction 1–5 star rating + comments
> End of each CC interaction prompts rating from both subscriber and beneficiary.

**Current state:** `VisitRating` model likely exists (based on schema context). Visit checkout is done.
**Gap:** After a visit's `status` turns `completed`, push a rating prompt. Mobile screens for both beneficiary and subscriber.
**Touch points:** `(beneficiary)/schedule.tsx`, new rating modal, `POST /visits/:id/rate`.

---

#### BEN-008 · EMR — vitals timeline + manual entry
> Beneficiary can view their EMR with ability to manually enter readings.

**Current state:** Beneficiary `meds.tsx` exists. No EMR screen found.
**Gap:** New `(beneficiary)/emr.tsx` — timeline of vitals with a "Log Reading" modal. Backend: `POST /beneficiary/vitals/manual`.
**Touch points:** New screen + new route + who-entered audit logging.

---

#### BEN-009 / BEN-010 · Medication adherence tracking + pill reminders
> Beneficiary can track adherence, system sends reminders; confirming marks adherence in EMR.

**Current state:** `meds.tsx` shows today's medications (basic). Medication model has `setReminders` boolean.
**Gap:** 
- Adherence toggle ("mark as taken") that calls `POST /beneficiary/medications/:id/mark-taken`
- Expo push notification integration for pill reminders

**Touch points:** `(beneficiary)/meds.tsx` + backend adherence route + push notifications (`expo-notifications`).

---

#### CC-007 · Vital capture during visit
> CC captures vitals per beneficiary configuration.

**Current state:** `visit-details.tsx` (19 KB) exists in CC app. Backend stores vitals.
**Gap:** Need to validate that the vitals form in `visit-details.tsx` is wired to `POST /care-companion/visits/:id/vitals` and actually saves to `VitalReading`. Verify the data flow end-to-end.
**Touch points:** `(care-companion)/visit-details.tsx`.

---

#### CC-011 · Mood capture + auto-alert on negative mood
> CC captures beneficiary mood. Negative mood triggers inbox message to subscriber.

**Current state:** Visit notes exist. No `mood` enum dropdown found in the CC visit screen.
**Gap:** Add mood selector (Happy/Neutral/Sad/Depressed) in visit flow. If negative → `POST /notifications` to subscriber.
**Touch points:** `(care-companion)/visit-details.tsx` + notification dispatch in `visit_service.ts`.

---

#### CC-014 · Birthday/anniversary notifications
> System notifies CC (and FM) of beneficiary birthdays and anniversaries.

**Gap:** A scheduled job (cron) that runs daily, finds beneficiaries with DOB/anniversary today, sends push notification to assigned CC and FM.
**Touch points:** New `scheduler.ts` in mobile-backend. `node-cron` or similar.

---

### 🟡 PRIORITY 2 — Mid-Complexity New Features

---

#### SUB-020 / BEN-005 · Schedule change request (configurable notice period)
> Subscriber/Beneficiary can request a schedule change with minimum X days notice.

**Gap:** A "Request Reschedule" flow on the mobile app that creates a `ScheduleChangeRequest` record (status: pending) and notifies FM. Admin panel shows this worklist.
**Touch points:** New mobile screen + `POST /subscriber/schedule-change-request` + admin worklist UI.

---

#### FM-010 / FM-012 · Roster management + real-time timeline
> FM can view/edit CC roster by zone with timeline, conflicts, and planned vs. actual.

**Current state:** `FieldManagementPage.tsx` (31 KB) exists. `visits.js` admin backend route exists.
**Gap:** Full timeline/Gantt view of CC schedules by zone day/week. Conflict detection. Real-time planned vs. actual view.
**Touch points:** `FieldManagementPage.tsx` — this is a significant UI feature.

---

#### FM-011 · Scheduling conflict detection + reassignment
> System highlights double-bookings/absences and allows FM to reassign.

**Gap:** Detect overlapping visits per CC for the same timeslot. Surface in admin roster view.
**Touch points:** `field-manager.js` backend + `FieldManagementPage.tsx`.

---

#### CSA-001 / CSA-002 · CSA reviews/edits/approves enrollment
> CSA reviews and approves subscriber enrollment, can update info over call and send for subscriber approval.

**Current state:** Admin RBAC is done. Enrollment wizard done.
**Gap:** A "Pending Approvals" queue in the admin panel for CSA role. Subscriber receives in-app notification to approve updated details (SUB-012).
**Touch points:** New `EnrollmentApprovalsPage.tsx` + `Subscription.status = 'pending_approval'` + mobile notification.

---

#### CSA-004 · Renewal reminder worklist
> CSA sees subscribers expiring in X days, logs call notes, sends payment links.

**Gap:** New admin page `RenewalRemindersPage.tsx` — filters subscriptions expiring within configurable X days. Log call notes. Generate payment link.
**Touch points:** New admin page + `GET /api/subscriptions?expiringInDays=X`.

---

#### CSA-005 · Subscription termination
> CSA can terminate a subscription with reason capture.

**Gap:** Admin action in `SubscriberProfilePage.tsx` or `SubscribersPage.tsx` — terminate button + reason modal → `PATCH /api/subscriptions/:id/terminate`.
**Touch points:** `SubscriberProfilePage.tsx` or `SubscribersPage.tsx` + backend route.

---

#### ERC-001 · Emergency Radar Dashboard
> ERC has a command center for all active/pending emergencies in real-time.

**Gap:** New admin page `EmergencyRadarPage.tsx` with live polling or WebSocket showing all `EmergencyRequest` records. Map view optional.
**Touch points:** `EmergencyRequest` schema (new) + admin page + real-time updates.

---

#### ERC-002 · Auto-alerts on emergency
> Any emergency triggers alerts to OM, FM, Primary CC, Secondary CC, ERC.

**Gap:** Backend `emergency_service.ts` that on `EmergencyRequest` creation, dispatches Notifications to all stakeholders.
**Touch points:** New service + `POST /beneficiary/emergency`.

---

#### ERC-003 · ERC work notes + SOP tracking
> ERC follows SOP, timestamps updates to emergency record.

**Gap:** In the Radar Dashboard, allow ERC to add timestamped notes to an `EmergencyRequest`. Status progression (received → dispatched → resolved).
**Touch points:** `EmergencyRadarPage.tsx` + `PUT /api/emergency/:id/notes`.

---

### 🔵 PRIORITY 3 — New Platform Capabilities

---

#### SUB-002 · Callback request from subscriber
> Subscriber can request a callback by providing phone number.

**Current state:** `CallbackButton` component exists on subscriber dashboard. `CallbacksPage.tsx` exists in admin.
**Gap:** Check if `callbacks.js` backend route supports subscriber-initiated requests. If yes, essentially ✅ — just verify end-to-end.

---

#### SUB-005 / SUB-006 · Full subscriber + beneficiary details during enrollment
> Name, phone, email, address for subscriber. DOB, marital status, anniversary, gender, photo, Aadhaar, relationship for beneficiary.

**Current state:** Enrollment wizard captures most of this.
**Gap:** Verify `marital status` and `anniversary date` are captured and persisted. Profile photo upload for beneficiary in onboarding.

---

#### SUB-007 · Post-subscription medical info
> Subscriber can add medical conditions, medications, record uploads, insurance info.

**Current state:** Medical info onboarding exists. Post-subscription editing not clear.
**Gap:** Allow subscriber to **edit** medical info after subscription via profile section. Insurance info capture (new field in Beneficiary model).

---

#### SUB-008 · Vitals tracking checklist (subscriber-configured)
> Subscriber specifies which vitals to track via multi-select.

**Current state:** Vitals checklist in Enrollment Wizard step. CC uses per-beneficiary config.
**Gap:** Allow subscriber to **modify** vitals preference post-enrollment from subscriber profile settings.

---

#### SUB-010 · Beneficiary hobbies with Inner Circle consent
> Hobbies captured with consent toggle for community matching.

**Current state:** Hobbies captured in enrollment.
**Gap:** Add explicit consent flag `hobbyConsentGiven: Boolean` to Beneficiary model. Show/edit from subscriber profile.

---

#### SUB-013 · Multiple beneficiaries per subscription
> Subscriber can add more than one beneficiary.

**Current state:** Dashboard shows beneficiary list. Enrollment creates one beneficiary.
**Gap:** "Add Beneficiary" flow for existing subscribers that adds another beneficiary to an existing subscription. Verify subscription model supports `1:many` beneficiaries.

---

#### SYS-013 · Calendar view of companionship history
> System provides a calendar view of hours spent by CC with each beneficiary.

**Gap:** New admin page with a calendar (month view) showing CC visit hours per beneficiary per day. Library: `react-big-calendar` or similar.

---

## 🎯 Suggested Execution Order

```
SPRINT 1 — Mobile Polish (High User Impact)
├── BEN-001: Emergency button → confirmation + backend EmergencyRequest
├── SUB-014: Beneficiary cards → happiness score + hours % bar
├── BEN-009/010: Meds adherence toggle + push notifications  
├── CC-011: Mood capture in visit + negative mood alert
└── BEN-006/SUB-021: Post-visit rating prompt (both sides)

SPRINT 2 — EMR & Health Data
├── BEN-008: Beneficiary EMR screen (vitals timeline + manual entry)
├── SUB-019: Subscriber view of beneficiary EMR
└── SUB-018: Interaction record detail (vitals + notes)

SPRINT 3 — Admin Operations  
├── CSA-005: Subscription termination
├── CSA-004: Renewal reminder worklist
├── CSA-001/002: Enrollment approval queue + SUB-012
└── ERC-001/002/003: Emergency Radar Dashboard

SPRINT 4 — Scheduling
├── SUB-020/BEN-005: Schedule change requests
├── FM-010/012: Roster timeline + planned vs. actual
└── FM-011: Conflict detection + reassignment

SPRINT 5 — Notifications & Automations
├── CC-014: Birthday/anniversary cron job
├── BEN-010: Pill reminder push notifications
└── FM-007: WhatsApp notification on CC assignment
```

---

## Quick Wins (< 1 day each)

| Req | Work |
|---|---|
| SUB-014 | Add emotional score badge + hours bar to beneficiary card in `index.tsx` |
| BEN-001 | Add `Alert.alert` confirm dialog to emergency button + POST to backend |
| CSA-005 | Add terminate button + reason modal in admin `SubscribersPage.tsx` |
| CC-011 | Add mood dropdown to `visit-details.tsx` CC form |
| SUB-024 | Populate `(subscriber)/package-details/` with hours utilisation card |

