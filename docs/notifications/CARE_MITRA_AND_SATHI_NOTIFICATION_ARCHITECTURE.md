# Care Mitra & Sathi Multi-Channel Notification Engine Architecture

> **Last Updated**: 2026-08-21 | **Module**: `@maihoonna/notifications` | **Apps**: `apps/sathi-app`, `apps/mobile-app`, `apps/api`, `apps/admin-backend`

---

## 1. Executive Summary & Design Goals

The Care Mitra & Saathi Volunteer notification system provides automated, multi-channel (Push FCM, WhatsApp, Email, In-App) messaging across the entire lifecycle of field operations:
* **Decoupled OOP & Multi-Provider Architecture**: Pure TypeScript interfaces allowing interchangeable push gateways (Expo FCM, direct Firebase Admin, OneSignal, APNs) and messaging channels (WhatsApp, SMS, Email).
* **Pub/Sub Domain Event Bus**: In-memory and distributed asynchronous event bus (`NotificationEventBus`) for fanning out domain events to multiple communication channels.
* **Strict Care Mitra Template Registry**: 8 pre-configured, categorized templates with typed variable replacement and priority tiers (`NT-006` through `NT-071`).
* **Multi-Device Token Lifecycle**: Push token registration on login and multi-device token purge on logout.
* **Sathi Native Integration (`apps/sathi-app`)**: Full foreground notification listeners, tap deep-linking to specific screens (`/(sathi)/schedule`, `/(sathi)/requests`, `/(sathi)/notifications`), and Android notification channels.

---

## 2. Architecture & Class Diagram

```
                              ┌───────────────────────────────────┐
                              │     Domain Events & Dispatch      │
                              │ (Visits, Training, Requests, SOS) │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │       NotificationEventBus        │
                              │   (Pub/Sub Event Distribution)    │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │    CareMitraNotificationService   │
                              │       (OOP Singleton Service)     │
                              └───────┬───────────────────┬───────┘
                                      │                   │
                     ┌────────────────┴───┐       ┌───────┴────────────┐
                     │ PushChannel Router │       │ WhatsApp / SMS /   │
                     │                    │       │ Email Channels     │
                     └────────┬───────────┘       └────────────────────┘
                              │
                              ▼
                     ┌───────────────────┐
                     │   IPushProvider   │
                     └────────┬──────────┘
                              │
                              ▼
                     ┌───────────────────┐
                     │ExpoFcmPushProvider│
                     └────────┬──────────┘
                              │
                              ▼
                     ┌───────────────────┐
                     │  Google FCM /     │
                     │  Apple APNs       │
                     └────────┬──────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │ Sathi App (Care Mitra/Vol)  │
                │     `apps/sathi-app`        │
                └─────────────────────────────┘
```

---

## 3. Care Mitra Template Registry

All templates are registered in `packages/notifications/src/registry/care-mitra-templates.registry.ts`:

| Template ID | Event Code | Trigger Event | Channels | WA Category | Priority | Variables |
|---|---|---|---|---|---|---|
| **NT-006** | `CARE_MITRA_ONBOARDING_CLEARED` | BGV approved, deployment cleared | WhatsApp, Email, Push | Utility | Medium | `{{1}}` = CC Name, `{{2}}` = FM Name |
| **NT-007** | `CARE_MITRA_TRAINING_REMINDER` | Training session reminder | WhatsApp, Push | Utility | Medium | `{{1}}` = CC Name, `{{2}}` = Module, `{{3}}` = Date, `{{4}}` = Time/Location |
| **NT-010** | `CARE_MITRA_VISIT_SCHEDULED` | Visit scheduled / roster published | WhatsApp, Push | Utility | Medium | `{{1}}` = CC Name, `{{2}}` = Ben Name, `{{3}}` = Date, `{{4}}` = Time, `{{5}}` = Address |
| **NT-011** | `CARE_MITRA_VISIT_REMINDER` | Visit reminder 1h before | WhatsApp, Push | Utility | High | `{{1}}` = CC Name, `{{2}}` = Ben Name, `{{3}}` = Time, `{{4}}` = Address |
| **NT-064** | `CARE_MITRA_BIRTHDAY_REMINDER` | Beneficiary Birthday celebration | WhatsApp, Push | Utility | Medium | `{{1}}` = CC Name, `{{2}}` = Ben Name, `{{3}}` = Date, `{{4}}` = Age |
| **NT-065** | `CARE_MITRA_PERFORMANCE_RATING` | CC performance rating received | WhatsApp, Push | Utility | Low | `{{1}}` = CC Name, `{{2}}` = Rating (Stars), `{{3}}` = Comments |
| **NT-070** | `SAATHI_INTERACTION_REQUEST` | Saathi interaction request received | WhatsApp, Push | Utility | Medium | `{{1}}` = Volunteer Name, `{{2}}` = Ben Name, `{{3}}` = Preferred Date/Time |
| **NT-071** | `SAATHI_VISIT_CREDITS_EARNED` | Saathi visit completed / credits | WhatsApp, Push | Utility | Low | `{{1}}` = Volunteer Name, `{{2}}` = Credits Earned, `{{3}}` = Total Credits |

---

## 4. Multi-Device Push Token Lifecycle

To prevent notifications from delivering to logged-out devices or leaking across shared devices:

```
[User Logs In] ──► registerForPushNotifications() ──► POST /shared/users/push-token ──► Stored in User.fcmToken
[User Logs Out] ──► unregisterPushToken() ─────────► DELETE /shared/users/push-token ──► User.fcmToken set to NULL
```

### Endpoints:
1. `POST /api/shared/users/push-token` (`apps/api` & `apps/admin-backend`):
   * Authenticated endpoint storing the device FCM token on `User.fcmToken` and auditing device metadata.
2. `DELETE /api/shared/users/push-token` (`apps/api` & `apps/admin-backend`):
   * Purges `User.fcmToken` and clears local storage `AsyncStorage.removeItem('expo_push_token')`.

---

## 5. Sathi App (`apps/sathi-app`) Native Setup

### Android Notification Channels:
1. **`default`**: Priority MAX, light color `#FF7A00`, vibration `[0, 250, 250, 250]`.
2. **`visits`**: Priority HIGH, light color `#FE6700`, for real-time visit assignments and reminders.

### Deep Linking & Tap Navigation (`apps/sathi-app/app/_layout.tsx`):
* `data.screen: '/(sathi)/schedule'` ➔ Automatically navigates Care Mitra to their schedule on tap.
* `data.screen: '/(sathi)/requests'` ➔ Navigates Saathi Volunteer to incoming requests.
* Default fallback ➔ Navigates to In-App Notification Center `/(sathi)/notifications`.
