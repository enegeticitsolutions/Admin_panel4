# Omnichannel Notification Engine Architecture & Integration Guide

## 1. Executive Summary & Architectural Goals

The MaiHoonNa Notification Engine is a production-grade, enterprise-decoupled notification system designed to support **Omnichannel Messaging** (WhatsApp via MSG91, In-App Lock-Screen Push via Expo/FCM, SMS, and Email).

### Core Architectural Principles
1. **Zero Blast Radius**: Notification dispatching is 100% asynchronous and fail-safe. Network errors, invalid phone numbers, or third-party API outages (MSG91/Expo) will never crash core database transactions or block API HTTP responses.
2. **Single Responsibility Principle (SRP)**: Core controllers (payments, visits, staff assignment) emit clean semantic domain calls (e.g., `dispatchVisitScheduled(target, variables)`). They have zero knowledge of third-party templates, vendor APIs, or JSON payload structures.
3. **Type-Safe Registry Pattern**: All 63 business events are registered in a central registry mapping event keys to MSG91 template IDs, namespaces, and mandatory variable schemas.
4. **Omnichannel Targeting**: A single dispatcher call simultaneously triggers WhatsApp messages and Expo/FCM In-App Push notifications.

---

## 2. Package Architecture (`packages/notifications`)

The notification SDK resides in the monorepo workspace at `packages/notifications`.

### Key Files:
- **`src/registry/whatsapp.registry.ts`**: Contains the full mapping of all 63 business events (e.g., `OTP_LOGIN_SIGNUP` mapped to template `'otp'`, `SUBSCRIPTION_ACTIVATED`, `VISIT_SCHEDULED`, `RENEWAL_PAYMENT_LINK`, `CC_ASSIGNED`, `LAB_TEST_SCHEDULED`, `EMERGENCY_TRIGGERED`).
  ```typescript
  export interface WhatsAppTemplateConfig {
    template: string;
    body: string[];
  }
  ```
- **`src/providers/whatsapp/Msg91WhatsAppProvider.ts`**: Encapsulates HTTP calls to MSG91 outbound bulk WhatsApp endpoint (`https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`).
  - Integrated Number: Loaded from `process.env.MSG91_WHATSAPP_NUMBER`
  - Template Name: Loaded from `process.env.MSG91_WHATSAPP_OTP_TEMPLATE`
  - Namespace: Loaded from `process.env.MSG91_WHATSAPP_NAMESPACE`
  - Supports dynamic `components` mapping (e.g. `body_1`, `button_1` copy code).
- **`src/index.ts`**: Exports `sendWhatsAppOTP(to, otp)` and `sendWhatsApp(message)`.

---

## 3. Backend Dispatcher Layer (`apps/admin-backend/services/notification.dispatcher.js`)

To prevent controllers from being bloated with payload formatting, all backend notification dispatches route through `notification.dispatcher.js`.

### Target Normalization
The dispatcher accepts a flexible `target` parameter:
- **String (`phone`)**: Triggers WhatsApp notification only.
- **Object (`{ phone, userId }`)**: Triggers **both** WhatsApp message AND Expo Lock-Screen Push notification in parallel.

```javascript
const { notificationService } = require('@maihoonna/notifications');
const { notifyUser } = require('./notifications');
const { prisma } = require('../lib/prisma');
```

### Supported Dispatcher Methods:
1. **`dispatchPaymentLinkGenerated(target, variables)`**
   - WhatsApp Event: `RENEWAL_PAYMENT_LINK`
   - In-App Push: `💳 Renewal Payment Link` (Deep link: `/payments`)
2. **`dispatchPaymentSuccessful(target, variables)`**
   - WhatsApp Events: `PAYMENT_SUCCESSFUL` + `SUBSCRIPTION_ACTIVATED`
   - In-App Push: `✅ Payment Successful` (Deep link: `/subscriptions`)
3. **`dispatchVisitScheduled(target, variables)`**
   - WhatsApp Event: `VISIT_SCHEDULED`
   - In-App Push: `📅 Care Visit Scheduled` (Deep link: `/schedule`)
4. **`dispatchCareCompanionAssigned(target, variables)`**
   - WhatsApp Event: `CC_ASSIGNED`
   - In-App Push: `🤝 Care Companion Assigned` (Deep link: `/care-team`)

---

## 4. Integrated Backend Controllers & Call Sites

### A. Payment Link Generation
- **File**: `apps/admin-backend/modules/payments/payment.service.js`
- **Hook**: Inside `generatePaymentLink()`
- **Invocation**:
  ```javascript
  dispatchPaymentLinkGenerated(subscriberPhone, {
    beneficiaryName: beneficiaryId ? 'your beneficiary' : 'you',
    packageName: packageName || resolvedPackageType,
    paymentLink: paymentLinkUrl
  });
  ```

### B. Payment Webhook Success & Subscription Activation
- **File**: `apps/admin-backend/modules/payments/payment.repository.js`
- **Hook**: Inside `markPaymentSuccessfulTransaction()` after `prisma.$transaction` commits
- **Invocation**:
  ```javascript
  if (existing.subscriber) {
    dispatchPaymentSuccessful(
      { phone: existing.subscriber.phone, userId: existing.subscriberId },
      {
        amount: existing.amountPaid.toString(),
        beneficiaryName: existing.beneficiary ? existing.beneficiary.name : 'you',
        packageName: existing.packageType,
        isSubscriptionActive: !!existing.subscriptionId,
        subscriberName: existing.subscriber.name || 'Subscriber',
        startDate: paidAt.toLocaleDateString(),
      }
    );
  }
  ```

### C. Visit Scheduling
- **File**: `apps/admin-backend/routes/visits.js`
- **Hook**: `POST /api/visits` route after visit creation transaction
- **Invocation**:
  ```javascript
  dispatchVisitScheduled(
    { phone: subscriberUser.phone, userId: subscriberUser.id },
    {
      ccName: result.careCompanion?.name || 'Your Care Companion',
      beneficiaryName: result.beneficiary?.name || 'the beneficiary',
      date: formattedDate,
      time: formattedTime,
      address: 'the registered address',
    }
  );
  ```

### D. Staff / Care Companion Assignment
- **File**: `apps/admin-backend/routes/beneficiaries.js`
- **Hook**: `PUT /api/beneficiaries/:id/assign-staff` route
- **Invocation**:
  ```javascript
  dispatchCareCompanionAssigned(
    { phone: beneficiary.subscriber.phone, userId: beneficiary.subscriberId },
    {
      ccName: newPrimaryCC.name || 'Your Care Companion',
      beneficiaryName: beneficiary.name || 'your beneficiary',
      primaryOrSecondary: 'Primary'
    }
  );
  ```

---

## 5. Lock-Screen Push Notification Pipeline (`apps/mobile-app`)

### Client-side Registration (`apps/mobile-app/services/notifications.ts`)
1. On app launch/login (`_layout.tsx`), `registerForPushNotifications()` is invoked.
2. Prompts user for OS Push permissions (iOS APNs / Android FCM).
3. Obtains Expo Push Token (`ExponentPushToken[...]`).
4. Syncs token to backend via `POST /shared/users/push-token`.

### Database Storage
- User record in Prisma database (`packages/database/prisma/schema.prisma`):
  `User.fcmToken` stores the Expo Push Token.

### Push Dispatch (`apps/admin-backend/services/notifications.js`)
- `notifyUser(tx, { userId, title, body, data })`:
  1. Creates DB record in `Notification` table for in-app bell tray history.
  2. Queries `User.fcmToken`.
  3. Sends HTTP POST payload to `https://exp.host/--/api/v2/push/send`.

---

## 6. How to Extend for Future Features

### Adding a New WhatsApp Template:
1. Add template entry to `WHATSAPP_TEMPLATES` in `packages/notifications/src/registry/whatsapp.registry.ts`.
2. Add a helper function in `apps/admin-backend/services/notification.dispatcher.js`.
3. Call the helper from the relevant controller/route.

### Adding SMS or Email Channels:
1. Extend `NotificationRequest` interface in `packages/notifications/src/services/notification.service.ts` to include `channel: 'sms' | 'email'`.
2. Implement SMS (e.g., MSG91 SMS API) or Email (e.g., SendGrid / AWS SES) strategy method inside `NotificationService`.
3. In `notification.dispatcher.js`, include the new channel call inside the corresponding `dispatch...()` function.

---

## 7. Firebase FCM Android Setup & Configuration

### Firebase Project & Android Credentials
- **Firebase Project ID**: `YOUR_FIREBASE_PROJECT_ID`
- **Project Number**: `YOUR_FIREBASE_PROJECT_NUMBER`
- **Storage Bucket**: `YOUR_FIREBASE_STORAGE_BUCKET`
- **Android Package Name**: `com.rajeev_23.maihoonna`

### `google-services.json` File Locations
1. `apps/mobile-app/google-services.json` *(Expo managed & EAS build)*
2. `apps/mobile-app/android/app/google-services.json` *(Native Android build)*

### Expo & Gradle Integration
- **`apps/mobile-app/app.json`**:
  ```json
  "android": {
    "package": "com.rajeev_23.maihoonna",
    "googleServicesFile": "./google-services.json"
  }
  ```
- **`apps/mobile-app/android/build.gradle`**:
  ```groovy
  classpath('com.google.gms:google-services:4.4.1')
  ```
- **`apps/mobile-app/android/app/build.gradle`**:
  ```groovy
  apply plugin: "com.google.gms.google-services"
  ```

### Secure Environment Variables (`.env` & `app.config.js`)
All Firebase parameters are secured in `apps/mobile-app/.env` and `.env.example`:
```env
EXPO_PUBLIC_FIREBASE_PROJECT_NUMBER=YOUR_FIREBASE_PROJECT_NUMBER
EXPO_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
```
Dynamically bound in `apps/mobile-app/app.config.js` under `extra.firebase`.

---

## 8. Verified End-to-End Execution Flow

```
[ Mobile App Launch ] ➔ Permission Granted ➔ Gets Expo Push Token
        │
        ▼
[ POST /shared/users/push-token ] ➔ Saved to User.fcmToken in DB
        │
        ▼
[ Field Management / Backend Operation ] ➔ Fires Domain Event (e.g., Visit Scheduled)
        │
        ▼
[ services/events/visit-event.dispatcher.js ]
        ├─── Beneficiary: In-App Bell Tray + Expo FCM Lock-Screen Push
        ├─── Subscriber:  In-App Bell Tray + Expo FCM Push + Outbound MSG91 WhatsApp
        └─── Care Companion: In-App Bell Tray + Expo FCM Push
        │
        ▼
[ Mobile App Receiver (_layout.tsx) ] ➔ Invalidation Trigger ➔ React Query Live UI Refresh
```

---

## 9. Completed Implementations (Full Modular Event Dispatcher Suite)

All 5 core domain event groups are fully implemented under `apps/admin-backend/services/events/`:

### 1. Visit Lifecycle Events (`services/events/visit-event.dispatcher.js`)
- `dispatchVisitScheduled`: Triggered from `POST /api/visits` (Field Management Page).
- `dispatchVisitRescheduled`: Triggered from `PUT /api/visits/:id` or `PATCH /api/visits/:id/resolve-change`.
- `dispatchVisitCancelled`: Triggered from `DELETE /api/visits/:id`.
- `dispatchVisitStarted`: Triggered when Care Companion checks in.
- `dispatchVisitCompleted`: Triggered from `PATCH /api/visits/:id/complete`.

### 2. Medication Events (`services/events/medication-event.dispatcher.js`)
- `dispatchMedicationReminder`: Beneficiary FCM Push + WhatsApp `MEDICATION_REMINDER` template.
- `dispatchMedicationMissed`: Subscriber & Care Companion alert + WhatsApp `MEDICATION_MISSED` template.

### 3. Emergency Response Events (`services/events/emergency-event.dispatcher.js`)
- `dispatchEmergencyTriggered`: High-priority alert to Emergency Radar, Subscriber, and Care Companions.
- `dispatchAmbulanceDispatched`: Dispatched status update with ETA to Subscriber & Beneficiary.
- `dispatchEmergencyResolved`: Outcome summary sent to Subscriber.

### 4. Vitals Alert Events (`services/events/vitals-event.dispatcher.js`)
- `dispatchVitalsAlert`: Triggered when abnormal BP, SpO2, or Glucose is logged. Sends FCM Push + WhatsApp `VITALS_ALERT`.

### 5. Roster & Care Team Events (`services/events/roster-event.dispatcher.js`)
- `dispatchCareCompanionAssigned`: Triggered from `PUT /api/beneficiaries/:id/assign-staff`.
- `dispatchCCReallocated`: Alert when temporary substitute CC is assigned.
- `dispatchRosterApproved`: Triggered from `POST /api/visits/roster/approve` to notify Field Managers and CCs.

### 6. Account & Onboarding Events (`services/events/account-event.dispatcher.js`)
- `dispatchSubscriberAccountCreated`, `dispatchBeneficiaryProfileCreated`, `dispatchCMOnboardingCleared`, etc.

### 7. Mood & Happiness Score Events (`services/events/mood-event.dispatcher.js`)
- `dispatchMoodAlert`, `dispatchWellbeingCheckRecommended`, `dispatchHappinessScoreUpdate`, `dispatchWeeklyWellbeingDigest`.

### 8. Scheduling & Subscription Events (`services/events/subscription-event.dispatcher.js`)
- `dispatchScheduleChangeRequest`, `dispatchSubscriptionRenewalReminder`, `dispatchPaymentFailed`, `dispatchSubscriptionHoursLow`, `dispatchSubscriptionHoursExhausted`, `dispatchSubscriptionTerminated`, `dispatchFreeTrialEnding`.

### 9. Community & Saathi Network Events (`services/events/community-event.dispatcher.js`)
- `dispatchSaathiInteractionRequest`, `dispatchSaathiVisitCompleted`, `dispatchHobbyCircleMessage`, `dispatchCommunityEventUpcoming`, `dispatchLegacyCircleBioPublished`.

### 10. Service Requests Events (`services/events/service-request-event.dispatcher.js`)
- `dispatchTeleconsultationRequested`, `dispatchLabTestScheduled`, `dispatchPhysiotherapyScheduled`, `dispatchMedicineOrderPlaced`.

### 11. Admin & Operations Events (`services/events/admin-event.dispatcher.js`)
- `dispatchSubscriptionPendingCSA`, `dispatchSubscriptionPendingOM`, `dispatchPartnerEnrolmentRequest`, `dispatchPartnerEnrolmentApproved`, `dispatchCCAbsenceReported`, `dispatchBGVStatusUpdate`, `dispatchWeeklyZoneUtilisation`, `dispatchInbasketMessage`.

### Mobile Client Live Refresh (`apps/mobile-app/app/_layout.tsx`)
- Added global listener via `Notifications.addNotificationReceivedListener`.
- Automatically executes `queryClient.invalidateQueries` for `['subscriberDashboard']` and `['beneficiaryDashboardInfo']` to instantly refresh dashboard cards upon push arrival.

---

## 10. Celebration Notification Engine & Offline Catch-Up Sync (`CareCompanionCelebrationNotificationService`)

### Overview
Enterprise automated celebration notification engine managing birthday push alerts and offline synchronization for Care Companions regarding their assigned primary and secondary beneficiaries.

### Key Operational Components:
- **Service**: `apps/api/app/services/care_companion/celebration_notification_service.ts`
- **Worker**: `apps/api/app/workers/celebrationWorker.ts`
- **Constants & Templates**: `apps/api/app/constants/celebration_constants.ts`
- **UI Component**: `apps/mobile-app/components/care-companion/UpcomingCelebrationsCard.tsx`

### Functional Features:
1. **Targeting Scope**: Filters strictly for active beneficiaries (`isActive: true`) assigned to the companion as `primaryCcId` or `secondaryCcId`.
2. **Notification Schedule**:
   - **1 Day Before**: `🎂 Tomorrow is [Beneficiary]'s Birthday!`
   - **On the Day**: `🎉 Today is [Beneficiary]'s Birthday!`
3. **Offline Catch-Up Sync**:
   - Notifications write directly to `prisma.notification` table for in-app bell tray persistence.
   - On dashboard fetch (`GET /api/care-companion/dashboard`), a non-blocking `setImmediate` catch-up execution fires to immediately deliver any pending birthday alerts to companions returning online.
4. **Lock-Screen Push Banners**:
   - Payload includes `"channelId": "default"` to ensure Android 8.0+ system tray banners display when the app is killed/closed.
5. **Idempotency**: Checked against past lookback window (`config.notifications.lookbackDays`) to prevent duplicate notification delivery.

---

## 11. Decoupled Redis Streams Microservice Architecture (Implemented)

The notification engine is powered by **Redis Streams** (`XADD`, `XREADGROUP`, `XPENDING`, `XCLAIM`, `XACK`), providing complete decoupling, `< 2ms` API latency, at-least-once delivery, self-healing PEL auto-claim, and Dead Letter Queue (DLQ) capabilities.

> **Full Architectural Reference**: See [REDIS_STREAMS_NOTIFICATION_MICROSERVICE.md](./REDIS_STREAMS_NOTIFICATION_MICROSERVICE.md)

### Implemented Architecture & Flow:
```
[ API Route Handler (Express) ]
        │ (Fast <2ms non-blocking HTTP response)
        ▼
[ notificationProducer.publish() ] ➔ Redis Streams
                                        ├── stream:notifications:whatsapp
                                        ├── stream:notifications:push
                                        ├── stream:notifications:email
                                        └── stream:notifications:dlq
                                                 │
                                                 ▼
                             [ Notification Worker Daemon (`worker.ts`) ]
                                        ├── Outbound WhatsApp MSG91 Bulk
                                        ├── In-App Expo FCM / APNs Push
                                        └── AWS SES v3 / Zoho SMTP Fallback
```

### 1. Producer Pattern (Inside Backend Handlers):
```typescript
import { notificationProducer } from '@maihoonna/notifications';

// Enqueue lightweight event payload with 60-second atomic idempotency
await notificationProducer.publish({
  idempotencyKey: `visit-${visitId}-scheduled`,
  channel: 'whatsapp',
  event: 'VISIT_SCHEDULED',
  recipient: { phone: subscriber.phone },
  variables: { ccName, beneficiaryName, date, time, address }
});
```

### 2. Consumer Pattern (Inside `packages/notifications/src/redis/notification.consumer.ts`):
- Initializes Consumer Group `notification-workers` with `XGROUP CREATE ... MKSTREAM`.
- Polls streams via `XREADGROUP`.
- Issues explicit `XACK` only upon successful external vendor delivery.
- Runs 30-second background auto-claim (`XAUTOCLAIM`) for messages idle > 60 seconds (recovering from worker crashes).
- Automatically routes messages exceeding 5 retries to `stream:notifications:dlq`.

### 3. Worker Daemon Execution:
```bash
# Start background worker daemon
npm run dev:notifications
```

---

## 12. Push Token Registration API Endpoint (`apps/admin-backend/routes/users.js`)

To ensure mobile app clients can save and sync their Expo FCM push tokens seamlessly upon user login, the following dual-route endpoint is registered:

### Endpoint Definition:
- **HTTP Methods**: `POST /api/users/push-token` & `POST /api/shared/users/push-token`
- **Request Body**:
  ```json
  {
    "token": "ExponentPushToken[XXXXXXXXXXXXXXXXXXXXXX]",
    "userId": "user-uuid-optional-if-jwt-present"
  }
  ```
- **Database Action**:
  Updates `User.fcmToken` in PostgreSQL for the authenticated user.

---

## 13. Production Deployment & Standalone Build Runbook

When deploying the backend to a remote server (AWS, Render, DigitalOcean) and generating release builds:

### Step 1: Environment Variable Configuration
Set mobile app API URL in `apps/mobile-app/.env`:
```env
EXPO_PUBLIC_API_URL=https://your-production-backend-domain.com/api
```

### Step 2: Firebase FCM V1 Credentials Linkage
1. Download `service-account.json` from Firebase Console ➔ Project Settings ➔ Service Accounts.
2. Go to Expo Dashboard (`expo.dev`) ➔ Project (`maihoonna`) ➔ Credentials ➔ Android FCM V1 Credentials.
3. Upload `service-account.json` to link FCM with Expo Push Gateway (`https://exp.host`).

### Step 3: Standalone Application Build
Execute EAS build for production Android/iOS binaries:
```bash
# Generate Production APK / AAB
eas build -p android --profile production
```
*(Push notifications deliver lock-screen alerts on physical devices running release builds).*

---

## 14. OOP Medication Reminder & Push Dispatcher Engine

To ensure reliable, scheduled reminders for medicines added during enrollment or beneficiary setup:

### A. Dispatcher & Service Architecture
1. **`PushNotificationDispatcher.ts`** (`apps/api/app/services/notifications/PushNotificationDispatcher.ts`):
   - Decoupled singleton dispatcher supporting Expo Push Protocol, Firebase Cloud Messaging (FCM V1), and Apple Push Notification Service (APNs).
   - Sanitizes and validates recipient push tokens before batching.
2. **`MedicationReminderService.ts`** (`apps/api/app/services/notifications/MedicationReminderService.ts`):
   - Queries `BeneficiaryMedication` and active schedules.
   - Calculates dose windows and triggers type-safe push notifications with sound, priority channels (`high`), and medication payload metadata (`{ screen: '/(beneficiary)/meds', medicationId, doseTime }`).
3. **`medicationWorker.ts`** (`apps/api/app/workers/medicationWorker.ts`):
   - Recurring cron/scheduler that checks upcoming medication reminders every minute and triggers batch dispatches.

### B. Mobile App Deep-Link Routing
- **File**: `apps/mobile-app/app/_layout.tsx`
- **Listener**: Added `Notifications.addNotificationResponseReceivedListener`.
- **Behavior**: When a user taps on any medication push notification on Android or iOS, the app automatically navigates directly to `/(beneficiary)/meds` and invalidates the `['medicationsToday']` query cache for immediate synchronization.
