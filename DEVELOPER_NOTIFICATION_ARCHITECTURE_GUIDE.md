# Developer Guide: Push & In-App Notification Architecture

> **Package**: `@maihoonna/notifications` | **Backend API**: `apps/api` | **Admin API**: `apps/admin-backend`  
> **Mobile Apps**: `apps/sathi-app` & `apps/mobile-app` | **Engine**: Redis Streams + In-Process Fallback

---

## 🏛️ Architecture Overview

The notification system uses an enterprise **Dual-Channel, Loosely-Coupled Microservice Architecture**:
1. **Push Notifications**: Sent via **Expo Push Service / Google FCM** to device trays with sound, badges, and deep-link routing.
2. **In-App Notifications**: Stored in PostgreSQL (`notifications` table via Prisma) and rendered in the in-app notification center.
3. **Queue & Asynchronous Decoupling**: Uses **Redis Streams** (`notif:stream:push`) for non-blocking sub-2ms job queuing.
4. **Resilient Offline Fallback**: If Redis is not running (e.g. local offline dev), an in-process non-blocking fallback automatically fires without slowing down or crashing the API.

```
┌────────────────────────────────────────────────────────┐
│               Business Layer (API / Admin)            │
│  e.g. sathi_service.ts / volunteers.js / routes        │
└──────────────────────────┬─────────────────────────────┘
                           │ 1. Emits event (non-blocking)
                           ▼
┌────────────────────────────────────────────────────────┐
│            Dispatcher Layer (apps/api)                 │
│  e.g. sathi-notification.dispatcher.ts                 │
│  - Formats template from @maihoonna/notifications      │
│  - Resolves target & creates Shadow User if needed     │
│  - Persists In-App notification record in DB           │
└──────────────────────────┬─────────────────────────────┘
                           │ 2. Background queue (setImmediate)
                           ▼
            ┌─────────────────────────────┐
            │  Is Redis Running?          │
            └──────┬───────────────┬──────┘
                   │ YES           │ NO (Fallback)
                   ▼               ▼
      ┌──────────────────────┐   ┌───────────────────────────┐
      │ Redis Stream: PUSH   │   │ In-Process PushDispatcher │
      │ XADD (< 2ms)         │   │ (Direct Expo API call)    │
      └──────────┬───────────┘   └─────────────┬─────────────┘
                 │ Worker Poll                 │
                 ▼                             │
      ┌──────────────────────┐                 │
      │ NotificationConsumer │                 │
      │ (worker.ts)          │                 │
      └──────────┬───────────┘                 │
                 │                             │
                 └──────────────┬──────────────┘
                                │ Sends HTTP payload
                                ▼
                   ┌────────────────────────┐
                   │ Expo Push Server / FCM │
                   └────────────┬───────────┘
                                │ Delivers to device tray
                                ▼
                   ┌────────────────────────┐
                   │ Sathi App / Mobile App │
                   │ - System Tray Banner   │
                   │ - Tap -> Deep Link     │
                   │ - In-App Center Card   │
                   └────────────────────────┘
```

---

## 🛡️ Core Architectural Rules (MUST READ)

### Rule 1: Loosely Coupled Business Logic
Never import `Expo`, `PushChannel`, or HTTP fetch directly inside controllers or domain services. Business code must only emit semantic domain events:
```typescript
// ✅ CORRECT: Semantic helper function, completely decoupled
dispatchSaathiVisitCheckedOut(volunteerId, { volunteerName, beneficiaryName, duration, points, visitId });

// ❌ WRONG: Hardcoding push or channels inside business services
fetch('https://exp.host/--/api/v2/push/send', { ... });
```

### Rule 2: Non-Blocking Execution (Zero API Latency Guarantee)
Push notification network round-trips to Expo or FCM can take 200ms - 2000ms. External network latency or timeouts must **NEVER block the user's API response**:
- Database transactions (checkout, balance deductions, OTPs) must commit and return to the client **first**.
- Remote push dispatch is scheduled asynchronously in the background via `setImmediate(...)` or unawaited promises with `.catch(...)`.
- A failed push notification must **NEVER throw a 500 API error or roll back the business transaction**.

### Rule 3: Database Foreign Key Safety (`ensureVolunteerShadowUser`)
In the database schema (`packages/database/prisma/schema.prisma`), the `Notification` model requires a foreign key relation to the `users` table:
```prisma
model Notification {
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
Volunteers are stored in the `volunteers` table. To prevent foreign-key violations when creating in-app notifications for volunteers:
- Always call `ensureVolunteerShadowUser(volunteerId)` in the dispatcher.
- It upserts a shadow record in `users` with `role: 'volunteer'` and mirrors the `fcmToken`.

---

## 📂 Code Layout & File Locations

| Layer | File / Path | Responsibility |
|---|---|---|
| **Template Registry** | `packages/notifications/src/registry/sathi-templates.registry.ts` | Single source of truth for all templates (IDs, title/subject, bodyTemplate, variables, priority, targetScreen). |
| **Notification Engine** | `packages/notifications/src/services/sathi-notification.service.ts` | Multi-channel formatting, validation, and delivery engine. |
| **Redis Producer** | `packages/notifications/src/redis/notification.producer.ts` | Pushes jobs into Redis Streams (`notif:stream:push`) in < 2ms. |
| **Redis Consumer** | `packages/notifications/src/redis/notification.consumer.ts` | Standalone worker consuming stream jobs with auto-claim and retries. |
| **API Dispatcher** | `apps/api/app/services/sathi/sathi-notification.dispatcher.ts` | Resolves recipient user/token, saves DB Notification, enqueues push. |
| **Admin Dispatcher** | `apps/admin-backend/services/events/sathi-event.dispatcher.js` | Emits admin/coordinator events from the Express admin portal. |
| **Mobile App UI** | `apps/sathi-app/app/(sathi)/notifications.tsx` | In-app notification center with category colors/icons & tap-to-navigate. |
| **Mobile App Deep Links** | `apps/sathi-app/app/_layout.tsx` | Native Expo background & system-tray tap listener routing to `data.screen`. |

---

## 🚀 How to Implement a New Notification in 4 Steps

Whenever you have a new notification requirement (e.g. from an Excel sheet or product spec), follow these 4 steps:

### Step 1: Register Template in `packages/notifications`

Add your template definition to `packages/notifications/src/registry/sathi-templates.registry.ts`:

```typescript
// 1. Add template definition
export const SathiTemplates: Record<string, SathiTemplateDefinition> = {
  // ... existing templates
  SAATHI_NEW_FEATURE_ANNOUNCED: {
    id: 'ST-070',                                    // Unique Template ID
    key: 'SAATHI_NEW_FEATURE_ANNOUNCED',             // Event key
    module: 'Guide & Support',                       // Logical module
    triggerEvent: 'New feature announced in app',    // Trigger description
    audience: 'Saathi Volunteer',                    // Target audience
    channels: ['push', 'in_app'],                    // Desired channels
    whatsappCategory: 'Utility',
    priority: 'normal',                              // 'low' | 'normal' | 'high' | 'critical'
    subject: 'New Feature Alert',                    // Title shown in notification
    bodyTemplate: 'Hi {{volunteerName}}, check out our new feature: {{featureName}}!', // Interpolated string
    variables: ['volunteerName', 'featureName'],     // Required dynamic variables
    targetScreen: '/(sathi)/guide',                  // Deep-link route in mobile app
  },
};
```

Update the typed payload interface in `packages/notifications/src/services/sathi-notification.service.ts`:
```typescript
export interface SathiNotificationPayloads {
  // ... existing payloads
  SAATHI_NEW_FEATURE_ANNOUNCED: { volunteerName: string; featureName: string };
}
```

Recompile the package:
```bash
cd packages/notifications
npm run build
```

---

### Step 2: Add Dispatcher in `apps/api`

In `apps/api/app/services/sathi/sathi-notification.dispatcher.ts`:

```typescript
/** ST-070: New Feature Announcement */
export async function dispatchSaathiNewFeatureAnnounced(
  volunteerId: string,
  data: { volunteerName: string; featureName: string }
) {
  return dispatchSathiNotification('SAATHI_NEW_FEATURE_ANNOUNCED', { volunteerId }, data);
}
```

The underlying `dispatchSathiNotification` function automatically:
1. Interpolates `{{volunteerName}}` and `{{featureName}}`.
2. Resolves `recipientUserId` and device `pushToken`.
3. Creates shadow user record if needed (`ensureVolunteerShadowUser`).
4. Creates in-app record in `prisma.notification`.
5. Enqueues push notification to Redis Streams in `< 2ms` with in-process fallback.

---

### Step 3: Trigger Dispatcher in Business Logic

In your route, controller, or service (e.g. `sathi_service.ts` or `beneficiary_sathi_service.ts`):

```typescript
import { dispatchSaathiNewFeatureAnnounced } from './sathi-notification.dispatcher';

// Inside your business function:
export const announceFeature = async (volunteerId: string, featureName: string) => {
  // 1. Perform database mutations first
  const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  
  // 2. Dispatch notification non-blockingly (fire-and-forget)
  if (volunteer) {
    dispatchSaathiNewFeatureAnnounced(volunteer.id, {
      volunteerName: volunteer.name,
      featureName: featureName,
    }).catch((err) => console.warn('[AnnounceFeature Error]:', err.message));
  }

  // 3. Return HTTP response immediately
  return { success: true };
};
```

---

### Step 4: Handle Deep Link & In-App UI in Mobile App

1. **System Tray Tap Listener** (`apps/sathi-app/app/_layout.tsx`):
   Already implemented globally:
   ```typescript
   addNotificationResponseListener((response) => {
     const data = response.notification.request.content.data;
     if (data?.screen) {
       router.push(data.screen as any);
     }
   });
   ```

2. **In-App Notification Center** (`apps/sathi-app/app/(sathi)/notifications.tsx`):
   When the user opens the in-app notification center, clicking a card automatically navigates to `item.data.screen`:
   ```typescript
   onPress={() => {
     if (!item.isRead) markAsRead(item.id);
     if (item.data?.screen) {
       router.push(item.data.screen as any);
     }
   }}
   ```

---

## 🎯 Priority Guidelines & Deep-Link Targets

### Priority Levels
| Level | Use Case | Sound / Tray Behavior |
|---|---|---|
| `critical` | Login OTP (`ST-001`), Emergency Alerts (`ST-051`) | High priority, heads-up banner, sound. |
| `high` | Match approved (`ST-003`, `ST-010`), Gift Card Delivered (`ST-032`), Concerns flagged (`ST-052`) | Sound, high priority. |
| `normal` | Visit checkout (`ST-021`), Visit request (`ST-012`), Reminders (`ST-022`) | Standard notification sound. |
| `low` | Address updated (`ST-040`), Guide tips (`ST-050`), Balance milestone (`ST-033`) | Silent / tray notification. |

### Mobile App Deep-Link Routes (`apps/sathi-app`)
| Route | Screen Name | Use Cases |
|---|---|---|
| `/(auth)/otp` | OTP Verification Screen | `ST-001` (Login OTP) |
| `/(sathi)` | Volunteer Home / Dashboard | `ST-012` (Visit Requests) |
| `/(sathi)/match` | My Matches Screen | `ST-003`, `ST-010`, `ST-011`, `ST-013` |
| `/(sathi)/hours` | Visit History & Hours | `ST-020` to `ST-026` (Check-in, Check-out, Goals) |
| `/(sathi)/credits` | Rewards & Credits | `ST-030` to `ST-033` (Redemption, Balance) |
| `/(sathi)/edit-profile` | Profile Settings | `ST-040`, `ST-041`, `ST-042` (Address, Schedule) |
| `/(sathi)/guide` | Saathi Guide / Tips | `ST-050`, `ST-051` (Training tips, Safety) |
| `/(sathi)/notifications` | Notification Center | `ST-052`, `ST-060` to `ST-062` (Alerts) |

---

## 🧪 Testing & Verification

We provide automated test scripts to verify all 28 templates without sending live messages to real users:

```bash
# 1. Verify template rendering, variable interpolation, and push payload formatting:
node scratch/verify_all_28_templates.js

# 2. Typecheck apps/api:
cd apps/api
npx tsc --noEmit

# 3. Typecheck apps/sathi-app:
cd apps/sathi-app
npx tsc --noEmit
```

---

## 💬 WhatsApp Notification Architecture (MSG91 / Meta Business)

In addition to Push & In-App, MaiHoonNa uses **WhatsApp Business API via MSG91** for critical transactional communications (e.g. Login OTPs, Registration confirmations, Visit summaries, Payment receipts, Emergency alerts).

```
┌────────────────────────────────────────────────────────┐
│            API / Service Layer                         │
│  notificationProducer.publish({ channel: 'whatsapp' }) │
└──────────────────────────┬─────────────────────────────┘
                           │ 1. XADD (< 2ms)
                           ▼
┌────────────────────────────────────────────────────────┐
│         Redis Stream: notif:stream:whatsapp            │
└──────────────────────────┬─────────────────────────────┘
                           │ 2. Worker Polling
                           ▼
┌────────────────────────────────────────────────────────┐
│         NotificationConsumer (worker.ts)               │
│  - Looks up event in WhatsAppRegistry                  │
│  - Orders variables -> body_1, body_2, etc.            │
│  - Calls Msg91WhatsAppProvider                         │
└──────────────────────────┬─────────────────────────────┘
                           │ 3. HTTP Bulk API POST
                           ▼
┌────────────────────────────────────────────────────────┐
│          MSG91 / Meta WhatsApp Cloud API               │
└──────────────────────────┬─────────────────────────────┘
                           │ 4. Delivered to WhatsApp Chat
                           ▼
┌────────────────────────────────────────────────────────┐
│            End User / Volunteer Device                 │
└────────────────────────────────────────────────────────┘
```

### 1. Template Registry (`WhatsAppRegistry`)
Located in `packages/notifications/src/registry/whatsapp.registry.ts`.
Each WhatsApp template is registered with:
- `template`: Exact slug/name approved in MSG91 / Meta Business Manager.
- `body`: Array of variable names in the exact positional order required by the template (`{{1}}` maps to `body[0]`, `{{2}}` maps to `body[1]`, etc.).

```typescript
export const WhatsAppRegistry: Record<string, WhatsAppTemplateConfig> = {
  // Event Key matching producer call
  SAATHI_VISIT_COMPLETED: {
    template: 'saathi_visit_completed__credits_earned', // Approved template slug
    body: ['beneficiaryName', 'credits'],               // Maps to {{1}} and {{2}}
  },
  OTP_LOGIN_SIGNUP: {
    template: 'otp',
    body: ['otpCode'],
  },
};
```

### 2. How to Add a New WhatsApp Template
1. Submit your template in the **MSG91 / Meta Business Manager** console and wait for approval.
2. Note the template name (e.g. `volunteer_milestone_badge`) and placeholder parameters (e.g. `{{1}}` = Volunteer Name, `{{2}}` = Badge Title).
3. Add the mapping to `packages/notifications/src/registry/whatsapp.registry.ts`:
   ```typescript
   VOLUNTEER_MILESTONE_BADGE: {
     template: 'volunteer_milestone_badge',
     body: ['volunteerName', 'badgeTitle'],
   },
   ```
4. Rebuild `@maihoonna/notifications`:
   ```bash
   cd packages/notifications
   npm run build
   ```

### 3. How to Trigger WhatsApp in Business Code
In your backend service or route:

```typescript
import { notificationProducer } from '@maihoonna/notifications';

// Trigger non-blockingly (fire-and-forget):
notificationProducer.publish({
  idempotencyKey: `badge-${volunteerId}-${Date.now()}`,
  channel: 'whatsapp',
  event: 'VOLUNTEER_MILESTONE_BADGE',
  recipient: {
    phone: volunteer.phone, // Formats automatically to 91XXXXXXXXXX
  },
  variables: {
    volunteerName: volunteer.name,
    badgeTitle: '50 Companion Hours Milestone',
  },
}).catch((err) => console.warn('[WhatsApp Dispatch Error]:', err.message));
```

### 4. Omnichannel (Dual Push + WhatsApp) Pattern
For high-impact notifications where both Push and WhatsApp are required (e.g. `ST-001` OTP, `ST-003` Approval, `ST-032` Gift Card Delivered):

```typescript
// Atomically publish both push and WhatsApp events
await notificationProducer.publishMany([
  {
    idempotencyKey: `giftcard-${redemptionId}-push`,
    channel: 'push',
    event: 'SAATHI_GIFT_CARD_DELIVERED',
    recipient: { pushToken: volunteer.fcmToken, userId: volunteer.id },
    variables: { amount, giftCardBrand, recipientContact: volunteer.phone, code },
    metadata: { screen: '/(sathi)/credits' },
  },
  {
    idempotencyKey: `giftcard-${redemptionId}-wa`,
    channel: 'whatsapp',
    event: 'SAATHI_GIFT_CARD_ISSUED',
    recipient: { phone: volunteer.phone },
    variables: { giftCardValue: amount, giftCardBrand, recipientContact: volunteer.phone },
  },
]);
```

### 5. Required Environment Variables for WhatsApp
Add to `apps/api/.env` and `packages/notifications/.env`:
```ini
MSG91_AUTH_KEY=454238AXXXXXXXXXXXXX
MSG91_WHATSAPP_NUMBER=918527070049
MSG91_WHATSAPP_NAMESPACE=bf28acb3_8719_4168_9ed4_bc225dcfe30d
MSG91_WHATSAPP_OTP_TEMPLATE=otp
```

---

## 🧪 Testing WhatsApp Notifications

We provide pre-built, robust testing scripts in `packages/notifications/`:

### 1. Test All WhatsApp Templates
Runs mock payloads through `WhatsAppChannel` and validates MSG91 responses:
```bash
cd packages/notifications
# Run with ts-node:
npx ts-node test-all-whatsapp-templates.ts
```

### 2. Test Single WhatsApp Template or Direct Delivery
To test a specific event to your phone number:
```bash
cd packages/notifications
npx ts-node -e "
  const { WhatsAppChannel } = require('./src/channels/whatsapp.channel');
  const channel = new WhatsAppChannel();
  channel.send({
    to: '919876543210',
    templateName: 'otp',
    variables: ['482910']
  }).then(res => console.log('Result:', res));
"
```

### 3. Test End-to-End via Redis Streams Worker
```bash
# Terminal 1: Start background worker
cd packages/notifications
npm run dev:service

# Terminal 2: Run end-to-end action test
cd packages/notifications
npx ts-node test-e2e-action.ts
```

### 4. Common WhatsApp Errors & Solutions
| Error / Issue | Cause | Solution |
|---|---|---|
| `MSG91_AUTH_KEY environment variable missing` | Missing auth key in `.env` | Ensure `.env` is loaded via `dotenv` in your worker/app entry point. |
| `Missing variable "X" for template "Y"` | Variable key omitted in payload | Check `body: ['var1', 'var2']` in `WhatsAppRegistry` and provide all variables. |
| `Template does not exist` | Slug mismatch with MSG91 | Verify exact approved template slug name in Meta/MSG91 portal. |
| `Phone number not valid` | Missing country code | Ensure phone has `91` prefix (e.g. `919876543210`). The provider cleans non-numeric characters automatically. |

---

## ⚡ Redis Infrastructure Setup & Developer Commands

Redis powers the asynchronous microservice queue for both Push and WhatsApp notifications via **Redis Streams**. 

### 1. How to Start Redis (Choose One)

- **Option A: Docker Compose (Recommended)**
  From the project root:
  ```bash
  npm run redis:up
  ```
  *(Starts a production-identical Redis 7 container on port `6379`).*

- **Option B: Cloud Managed Redis (Upstash / Redis Cloud / AWS ElastiCache)**
  If you don't use Docker, create a free instance at [upstash.com](https://upstash.com) or [redis.io](https://redis.io) and paste the URL in `apps/api/.env` and `packages/notifications/.env`:
  ```ini
  REDIS_URL=rediss://default:YOUR_PASSWORD@your-endpoint.upstash.io:6379
  ```

- **Option C: Native Redis on Linux / WSL / Windows**
  ```bash
  sudo service redis-server start
  # Or on Windows (Memurai / Redis-server.exe):
  redis-server.exe
  ```

---

### 2. Verify Redis Connectivity

Run the automated diagnostic check:
```bash
npm run redis:check
```
**Expected Output when Healthy**:
```text
✅ Redis Status: ACTIVE & HEALTHY
   PING Response: "PONG"
--- Streams & Queue Depths ---
  📊 Stream [notif:stream:push]: 0 message(s)
  📊 Stream [notif:stream:whatsapp]: 0 message(s)
```

You can also check the backend API health in your browser:  
👉 **`http://localhost:8001/api/health/redis`**

```json
{
  "status": "healthy",
  "service": "redis",
  "connected": true,
  "host": "127.0.0.1",
  "port": 6379,
  "mode": "redis_streams"
}
```

---

### 3. Start the Background Consumer Worker

In a dedicated terminal tab, start the background worker daemon:
```bash
npm run worker
```
*(You will see: `✅ Redis connection verified.` and `🚀 [NotificationConsumer] Worker started`).*

All notification events published by `apps/api` or `apps/admin-backend` will now be consumed and processed out-of-band by this worker.

---

### 4. Useful Redis CLI Diagnostics

```bash
# View container logs
npm run redis:logs

# Stop Redis container
npm run redis:down

# Inspect stream lengths
redis-cli XLEN notif:stream:push
redis-cli XLEN notif:stream:whatsapp

# View recent stream entries
redis-cli XREVRANGE notif:stream:push + - COUNT 5

# Check Dead Letter Queue (DLQ)
redis-cli XLEN notif:stream:dlq
```
