# MaiHoonNa — WhatsApp Notification Ingestion & Remaining Templates Status

> **Document Version**: 1.0  
> **Date**: September 10, 2026  
> **Master Catalog Reference**: `MHN-CFG-NOTIF-001_WhatsApp_Email_Notification_Templates_v1.0.xlsx`  
> **Tracking Document**: `NOTIFICATION_SYNC_TRACKER.md`  
> **Codebase Registry**: `packages/notifications/src/registry/whatsapp.registry.ts`

---

## 1. Executive Summary

- **Total Templates in Master Catalog**: 73 WhatsApp Templates
- **Total Templates Fully Aligned & Ingested**: **62 Templates (85% Complete)**
- **Total Templates Remaining**: **11 Templates (15% Remaining)**
- **Architecture**:
  - All WhatsApp notifications are fully decoupled from user-facing HTTP requests via `setImmediate` asynchronous workers and Redis event streams.
  - Zero impact on API latency (< 20ms response time).
  - All variables strictly mapped to MSG91 / Meta approved slugs (`body_1`, `body_2`, etc.).

---

## 2. The 11 Remaining Notification Templates

Below is the exhaustive list of the 11 WhatsApp templates awaiting approved MSG91 / Meta template slugs or final alignment:

| # | Excel ID | Module | Event Trigger / Description | Audience | Required Variables | Recommended Action / Status |
|:---|:---|:---|:---|:---|:---|:---|
| 1 | **NT-008** | Auth & Login | Password / PIN reset request | All Users | `{{1}}` = Reset code | **Can reuse `otp`** template (slug: `otp`, `body_1: otpCode`) without creating a new template. |
| 2 | **NT-022** | Mood & Wellbeing | Happiness Score dropped below threshold | Subscriber, CC, FM | `{{1}}` = Beneficiary name<br>`{{2}}` = New score | Awaiting MSG91 approval or cURL. |
| 3 | **NT-030** | Vitals & Medication | Vitals out of configured normal range (critical alert) | Subscriber, CC, Doctor | `{{1}}` = Beneficiary name<br>`{{2}}` = Vital type<br>`{{3}}` = Reading<br>`{{4}}` = CC name | Awaiting MSG91 approval or cURL. *(Note: `vitals_alert` exists for generic alerts; this is the threshold breach).* |
| 4 | **NT-042** | Subscriptions & Renewal | Subscription renewal reminder (30/15/7 days before expiry) | Subscriber | `{{1}}` = Subscriber name<br>`{{2}}` = Package name<br>`{{3}}` = Beneficiary name<br>`{{4}}` = Expiry date | Awaiting MSG91 approval or cURL. |
| 5 | **NT-049** | Subscriptions | Free trial ending soon (3 days before expiry) | Subscriber | `{{1}}` = Subscriber name<br>`{{2}}` = Beneficiary name<br>`{{3}}` = End date | Awaiting MSG91 approval or cURL. |
| 6 | **NT-050** | Emergency | Emergency triggered by beneficiary / SOS button pressed | Subscriber, CC, FM, ERC | `{{1}}` = Beneficiary name<br>`{{2}}` = Timestamp<br>`{{3}}` = Location | Awaiting MSG91 approval or cURL. *(Note: `emergency_acknowledged_by_erc` and `ambulance_dispatched` are already active).* |
| 7 | **NT-062** | Care Team & Field | New Care Mitra assigned to FM's team | Field Manager | `{{1}}` = CC name<br>`{{2}}` = Date | Awaiting MSG91 approval or cURL. |
| 8 | **NT-063** | Care Team & Field | Care Mitra deactivated / terminated | Field Manager, Ops Manager | `{{1}}` = CC name<br>`{{2}}` = Last working date<br>`{{3}}` = Reason | Awaiting MSG91 approval or cURL. |
| 9 | **NT-064** | Care Team & Engagement | Birthday / special occasion reminder for beneficiary | Care Companion | `{{1}}` = Beneficiary name<br>`{{2}}` = Date | Awaiting MSG91 approval or cURL. |
| 10 | **NT-073** | Community | Community event upcoming / RSVP reminder | Subscriber, Beneficiary | `{{1}}` = Event name<br>`{{2}}` = Date<br>`{{3}}` = Venue | Awaiting MSG91 approval or cURL. |
| 11 | **NT-094** | Admin & Operations | Care Mitra absence / unavailability reported | Field Manager, Ops Manager | `{{1}}` = CC name<br>`{{2}}` = Date<br>`{{3}}` = Impacted visit count | Awaiting MSG91 approval or cURL. |

---

## 3. Recently Aligned Highlights in this Sprint

1. **Saathi Volunteer Approval (`ST-003`)**:
   - Slug: `saathi_volunteer`
   - Variables: `body_1` = `volunteerName`
   - Bound to: `PATCH /api/volunteers/:id/verify` in `apps/admin-backend/routes/volunteers.js`.
   - `welcome_subscriber` is now strictly preserved for subscribers only.
2. **Schedule Change & Reschedule Requests (`NT-040`, `NT-084`)**:
   - Reused approved slug: `appointment_rescheduled__cancelled`
   - Two-way implementation:
     - Beneficiary app requesting visit schedule change (`POST /beneficiary/visits/:visitId/request-change`).
     - Saathi companion proposing reschedule when unavailable (`POST /sathi/visit-requests/:requestId/propose-reschedule`).
3. **Payment Failed Correction (`NT-045`)**:
   - Slug: `payment_failed`
   - Corrected variable signature to 4 parameters: `['subscriberName', 'amount', 'beneficiaryName', 'paymentLink']`.
4. **All 55 Notification Dispatchers Verified**:
   - Full automated audit confirmed 100% parameter match across backend services.
   - TypeScript compilation verified (`tsc --noEmit` exit code 0).
