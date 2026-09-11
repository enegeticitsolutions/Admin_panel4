# MaiHoonNa — Unconfigured & Pending Notification Templates Inventory

> **Document Version**: 2.0  
> **Date**: September 11, 2026  
> **Master Catalog Reference**: `MHN-CFG-NOTIF-001_WhatsApp_Email_Notification_Templates_v1.0.xlsx`  
> **Target Audience**: Core Engineering Team, Operations, Product Managers  
> **Scope**: All notification templates awaiting Meta/MSG91 approval, HTML layouts, or cron jobs.

---

## 1. Executive Summary & Status Overview

Across the MaiHoonNa ecosystem, notification templates are categorized across two sheets in the master catalog:
1. **Sathi App Notification Catalog (`ST-` series)**: 28 Templates
2. **Omnichannel Master Catalog (`NT-` series)**: 73 Events / 64 Base Templates (WhatsApp, Email, SMS, In-App)

### Current Implementation Matrix

| Category | Total in Catalog | Fully Configured & Active | Pending Configuration | Completion Rate |
|:---|:---:|:---:|:---:|:---:|
| **Sathi App Notifications (`ST-`)** | 28 | **28** | **0** | **100%** |
| **Care Mitra Field Notifications** | 22 | **22** | **0** | **100%** |
| **WhatsApp Master Templates (`NT-`)** | 73 | **62** | **11** | **85%** |
| **Email-Only Digest & Reports (`NT-`)** | 9 | **0** | **9** | **0% (Pending Layouts)** |
| **Overall Ecosystem** | **101** | **81** | **20** | **80.2%** |

---

## 2. Unconfigured WhatsApp Notification Templates (11 Pending)

These 11 WhatsApp templates are fully architected in the backend event dispatchers, but **await official Meta / MSG91 template approval** or production cURL payloads before they can deliver via WhatsApp outbound.

> [!IMPORTANT]
> **Why are these unconfigured?**  
> Meta (WhatsApp Business Platform) requires explicit template pre-approval for outbound messaging. Until MSG91 provides the approved template slug name and namespace, calling MSG91 with these slugs will result in rejection (error 400).  
> **Fallback Active**: In-app push notifications and database notifications for these events are already functioning.

### Detailed Breakdown of the 11 Pending WhatsApp Templates

| # | Template ID | Module | Event Trigger | Audience | Channels | Parameters / Variables | Current Status & Action Required |
|:---:|:---|:---|:---|:---|:---|:---|:---|
| 1 | **NT-008** | Onboarding & Account | Password / PIN reset request | All Users | WhatsApp, Email, SMS | `{{1}}` = Reset code | **Can reuse `otp` template** (`body_1: otpCode`) without submitting a new Meta template. Ready for alias wiring. |
| 2 | **NT-022** | Mood & Wellbeing | Happiness Score dropped below threshold | Subscriber, CC, FM | WhatsApp, Email | `{{1}}` = Beneficiary name<br>`{{2}}` = New score | Awaiting MSG91/Meta template submission & approved slug. |
| 3 | **NT-030** | Vitals & Medication | Vitals out of configured normal range (critical threshold alert) | Subscriber, CC, Doctor | WhatsApp, Email | `{{1}}` = Beneficiary name<br>`{{2}}` = Vital type<br>`{{3}}` = Reading<br>`{{4}}` = CC name | Awaiting approved slug. *(Note: Generic `vitals_alert` exists; this is the threshold breach alert).* |
| 4 | **NT-042** | Subscriptions & Renewal | Subscription renewal reminder (30/15/7 days before expiry) | Subscriber | WhatsApp, Email | `{{1}}` = Subscriber name<br>`{{2}}` = Package name<br>`{{3}}` = Beneficiary name<br>`{{4}}` = Expiry date | Awaiting approved slug from MSG91/Meta. *(Payment links `renewal_payment_link` are active).* |
| 5 | **NT-049** | Subscriptions | Free trial ending soon (3 days before expiry) | Subscriber | WhatsApp, Email | `{{1}}` = Subscriber name<br>`{{2}}` = Beneficiary name<br>`{{3}}` = End date | Awaiting approved slug from MSG91/Meta. |
| 6 | **NT-050** | Emergency | Emergency triggered by beneficiary / SOS button pressed | Subscriber, CC, FM, ERC | WhatsApp, SMS, Voice Call | `{{1}}` = Beneficiary name<br>`{{2}}` = Timestamp<br>`{{3}}` = Location | Awaiting approved slug. *(Note: `emergency_acknowledged_by_erc` and `ambulance_dispatched` are already active).* |
| 7 | **NT-062** | Care Team & Allocation | New Care Mitra assigned to FM's team | Field Manager | WhatsApp | `{{1}}` = CC name<br>`{{2}}` = Effective date | Awaiting approved slug from MSG91/Meta. |
| 8 | **NT-063** | Care Team & Allocation | Care Mitra deactivated / terminated | Field Manager, Ops Manager | WhatsApp, Email | `{{1}}` = CC name<br>`{{2}}` = Last working date<br>`{{3}}` = Reason | Awaiting approved slug from MSG91/Meta. |
| 9 | **NT-064** | Care Team & Engagement | Birthday / special occasion reminder for beneficiary | Care Mitra, Field Manager | WhatsApp | `{{1}}` = Beneficiary name<br>`{{2}}` = Birthday date | Awaiting approved slug. *(Push notification engine already active).* |
| 10 | **NT-073** | Community & Saathi Network | Community event upcoming / RSVP reminder | Beneficiary, Subscriber | WhatsApp, Email | `{{1}}` = Event name<br>`{{2}}` = Date<br>`{{3}}` = Venue | Awaiting approved slug from MSG91/Meta. |
| 11 | **NT-094** | Admin & Operations | Care Mitra absence / unavailability reported | Field Manager, Ops Manager | WhatsApp | `{{1}}` = CC name<br>`{{2}}` = Date<br>`{{3}}` = Impacted visit count | Awaiting approved slug from MSG91/Meta. |

---

### Body Templates & Expected Copy for the 11 Pending WhatsApp Templates

#### NT-008: Password / PIN Reset
```text
Your password reset code is {{1}}. If you didn't request this, please contact support immediately.
```

#### NT-022: Happiness Score Drop Alert
```text
{{1}}'s Happiness Score has changed to {{2}}. Our care team has been notified and will follow up.
```

#### NT-030: Vitals Out of Configured Range
```text
{{1}}'s {{2}} reading today was {{3}}, outside the normal range. {{4}} has logged notes — please review.
```

#### NT-042: Subscription Renewal Reminder
```text
Hi {{1}}, your {{2}} subscription for {{3}} expires on {{4}}. Renew now to avoid a gap in care.
```

#### NT-049: Free Trial Ending Soon
```text
Hi {{1}}, your free trial for {{2}} ends on {{3}}. Subscribe now to continue care without interruption.
```

#### NT-050: Emergency Triggered by Beneficiary
```text
EMERGENCY: {{1}} has triggered an emergency request at {{2}} ({{3}}). Respond immediately.
```

#### NT-062: New Care Mitra Assigned to FM
```text
{{1}} has been added to your team, effective {{2}}.
```

#### NT-063: Care Mitra Deactivated / Terminated
```text
{{1}} has been deactivated effective {{2}}. Reason: {{3}}. Please reassign their beneficiaries.
```

#### NT-064: Birthday / Special Occasion Reminder
```text
Reminder: it's {{1}}'s birthday on {{2}}! Plan a small celebration during your visit.
```

#### NT-073: Community Event Upcoming / RSVP Reminder
```text
{{1}} is happening on {{2}} at {{3}}. Tap to RSVP.
```

#### NT-094: Care Mitra Absence Reported
```text
{{1}} has reported unavailability for {{2}}. {{3}} beneficiary visit(s) need reassignment.
```

---

## 3. Unconfigured Email-Only Digest & Periodic Reports (9 Pending)

These 9 templates are designated exclusively for the **Email** channel. They are not real-time WhatsApp or Push alerts; rather, they are periodic HTML summaries, EMR trend exports, or back-office operational notifications.

> [!NOTE]
> **Why are these unconfigured?**  
> These require HTML responsive email templates (designed in MJML / HTML) and automated cron schedules or admin workflow triggers. The outbound email provider (AWS SES v3 / Zoho SMTP) is operational in `packages/notifications/src/channels/email.channel.ts`.

### Detailed Breakdown of the 9 Email-Only Templates

| # | Template ID | Module | Event Trigger | Audience | Subject Line | Variables | Required Action |
|:---:|:---|:---|:---|:---|:---|:---|:---|
| 1 | **NT-023** | Mood & Happiness Score | Weekly happiness & wellbeing digest | Subscriber | `{{1}}'s Weekly Wellbeing Summary` | `{{1}}` = Beneficiary name | Create responsive weekly digest HTML layout; wire cron to run weekly. |
| 2 | **NT-033** | Vitals & Medication | Monthly EMR vitals trend report | Subscriber | `{{1}}'s Monthly Health Summary` | `{{1}}` = Beneficiary name<br>`{{2}}` = Month | Generate PDF/HTML monthly vitals trend graph attachment. |
| 3 | **NT-074** | Community & Saathi | Legacy Circle bio published | Subscriber | `Legacy Circle Bio Published` | `{{1}}` = Beneficiary name | Email layout notifying family that biography has been published. |
| 4 | **NT-090** | Admin & Operations | New subscription pending CSA review | Customer Support Agent (CSA) | `New Subscription Pending Review` | `{{1}}` = Subscriber name<br>`{{2}}` = Beneficiary name | Back-office notification when checkout completes. |
| 5 | **NT-091** | Admin & Operations | Subscription pending OM approval | Operations Manager | `Subscription Awaiting Approval` | `{{1}}` = Subscription ID<br>`{{2}}` = Beneficiary name | Back-office notification when manual review is required. |
| 6 | **NT-092** | Admin & Operations | Partner/supplier enrolment request | Operations Manager | `New Partner Enrolment Request` | `{{1}}` = Partner name<br>`{{2}}` = Partner type | Back-office notification when B2B vendor registers. |
| 7 | **NT-093** | Admin & Operations | Partner enrolment approved | Partner (B2B Vendor) | `Partner Enrolment Approved` | `{{1}}` = Partner name<br>`{{2}}` = Effective date | Welcome email with partner portal credentials link. |
| 8 | **NT-095** | Admin & Operations | Background verification (BGV) status update | Operations Manager | `BGV Status Update — {{1}}` | `{{1}}` = Candidate name<br>`{{2}}` = Status | Notification when third-party BGV report completes. |
| 9 | **NT-096** | Admin & Operations | Weekly zone utilisation report | Operations Manager | `Weekly Zone Performance Report` | `{{1}}` = Zone name<br>`{{2}}` = Week start date | Cron report aggregating Care Mitra hours, SLAs, and capacity. |

---

## 4. Sathi App Notification Templates (100% Configured)

All **28 Sathi App Notification Templates** (`ST-001` through `ST-062`) are **fully implemented, tested, and active** in production:

- **Registry**: `packages/notifications/src/registry/sathi-templates.registry.ts`
- **Dispatcher**: `apps/api/app/services/sathi/sathi-notification.dispatcher.ts`
- **Admin Coordinator**: `apps/admin-backend/services/events/sathi-event.dispatcher.js`
- **In-App Notification Center**: `apps/sathi-app/app/(sathi)/notifications.tsx`
- **System Tray Deep Linking**: `apps/sathi-app/app/_layout.tsx`

### Sathi App Templates Verification Matrix

| Template ID | Event Code | Channel | Deep Link Screen | Status |
|:---|:---|:---|:---|:---:|
| `ST-001` | `SAATHI_ONBOARDING_APPLICATION_SUBMITTED` | Push & In-App | `/(sathi)/profile` | ✅ Active |
| `ST-002` | `SAATHI_ONBOARDING_DOCUMENTS_VERIFIED` | Push & In-App | `/(sathi)/profile` | ✅ Active |
| `ST-003` | `SAATHI_ONBOARDING_APPROVED_ACTIVE` | Push & In-App | `/(sathi)/dashboard` | ✅ Active |
| `ST-004` | `SAATHI_ONBOARDING_DOCUMENTS_REJECTED` | Push & In-App | `/(sathi)/profile` | ✅ Active |
| `ST-010` | `SAATHI_MATCH_ASSIGNED_NEW_BENEFICIARY` | Push & In-App | `/(sathi)/requests` | ✅ Active |
| `ST-011` | `SAATHI_MATCH_UNASSIGNED` | Push & In-App | `/(sathi)/dashboard` | ✅ Active |
| `ST-020` | `SAATHI_INTERACTION_NEW_REQUEST` | Push & In-App | `/(sathi)/requests` | ✅ Active |
| `ST-021` | `SAATHI_INTERACTION_ACCEPTED` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-022` | `SAATHI_INTERACTION_DECLINED` | Push & In-App | `/(sathi)/requests` | ✅ Active |
| `ST-023` | `SAATHI_INTERACTION_RESCHEDULE_PROPOSED` | Push & In-App | `/(sathi)/requests` | ✅ Active |
| `ST-024` | `SAATHI_INTERACTION_CANCELLED` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-025` | `SAATHI_INTERACTION_REMINDER_24H` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-026` | `SAATHI_INTERACTION_REMINDER_2H` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-030` | `SAATHI_VISIT_CHECKIN_OTP_PROMPT` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-031` | `SAATHI_VISIT_CHECKOUT_OTP_PROMPT` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-032` | `SAATHI_VISIT_OVERSTAY_ALERT` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-040` | `SAATHI_CREDITS_EARNED` | Push & In-App | `/(sathi)/credits` | ✅ Active |
| `ST-041` | `SAATHI_CREDIT_MILESTONE_REACHED` | Push & In-App | `/(sathi)/credits` | ✅ Active |
| `ST-042` | `SAATHI_CREDIT_DEDUCTION` | Push & In-App | `/(sathi)/credits` | ✅ Active |
| `ST-043` | `SAATHI_MONTHLY_SUMMARY` | Push & In-App | `/(sathi)/credits` | ✅ Active |
| `ST-050` | `SAATHI_COMMUNITY_NEW_EVENT` | Push & In-App | `/(sathi)/community` | ✅ Active |
| `ST-051` | `SAATHI_COMMUNITY_EVENT_REMINDER` | Push & In-App | `/(sathi)/community` | ✅ Active |
| `ST-052` | `SAATHI_COMMUNITY_VOLUNTEER_CALL` | Push & In-App | `/(sathi)/community` | ✅ Active |
| `ST-060` | `SAATHI_ACCOUNT_STATUS_CHANGE` | Push & In-App | `/(sathi)/profile` | ✅ Active |
| `ST-061` | `SAATHI_BGV_EXPIRY_WARNING` | Push & In-App | `/(sathi)/profile` | ✅ Active |
| `ST-062` | `SAATHI_SYSTEM_DOWNTIME_ALERT` | Push & In-App | `/(sathi)/notifications` | ✅ Active |
| `ST-033` | `SAATHI_VISIT_CANCELLED_BY_BENEFICIARY` | Push & In-App | `/(sathi)/schedule` | ✅ Active |
| `ST-034` | `SAATHI_VISIT_RESCHEDULED_CONFIRMATION` | Push & In-App | `/(sathi)/schedule` | ✅ Active |

---

## 5. Developer Guide: How to Configure a Pending Template Once Approved

When Meta approves a pending template slug or when MSG91 returns the cURL payload:

### Step 1: Add to `whatsapp.registry.ts`
Open `packages/notifications/src/registry/whatsapp.registry.ts` and add the template configuration:
```typescript
// Example: NT-022 Happiness score alert
HAPPINESS_SCORE_DROP_ALERT: {
  template: 'happiness_score_drop_alert', // Exact approved Meta slug
  body: ['beneficiaryName', 'newScore'],   // Matches {{1}} and {{2}} in order
  templateId: 'NT-022',
  description: 'Happiness score dropped below alert threshold',
},
```

### Step 2: Build the Notification Package
```bash
cd packages/notifications
npm run build
```

### Step 3: Wire the Dispatcher Call
In `apps/api` or `apps/admin-backend`, invoke `notificationProducer.publish`:
```typescript
await notificationProducer.publish({
  idempotencyKey: `happiness-alert-${beneficiaryId}-${Date.now()}`,
  channel: 'whatsapp',
  event: 'HAPPINESS_SCORE_DROP_ALERT',
  recipient: { phone: subscriber.phone },
  variables: {
    beneficiaryName: beneficiary.name,
    newScore: String(newScore),
  },
});
```

---

## 6. Document References & Related Architecture Guides

For full implementation, configuration, and architectural details:
- [DEVELOPER_NOTIFICATION_ARCHITECTURE_GUIDE.md](./DEVELOPER_NOTIFICATION_ARCHITECTURE_GUIDE.md) — Comprehensive developer guide for Push, In-App, WhatsApp, and Redis Streams.
- [MASTER_NOTIFICATION_CATALOG.md](./MASTER_NOTIFICATION_CATALOG.md) — Full master catalog with all 101 events.
- [NOTIFICATION_EVENT_TRIGGER_GUIDE.md](./NOTIFICATION_EVENT_TRIGGER_GUIDE.md) — Backend route and database event linkage.
- [REDIS_DEPLOYMENT_AND_DEVOPS_GUIDE.md](./REDIS_DEPLOYMENT_AND_DEVOPS_GUIDE.md) — Redis deployment, clustering, and worker runbooks.
- [NOTIFICATION_SYNC_TRACKER.md](./NOTIFICATION_SYNC_TRACKER.md) — Sprint synchronization and audit tracker.
