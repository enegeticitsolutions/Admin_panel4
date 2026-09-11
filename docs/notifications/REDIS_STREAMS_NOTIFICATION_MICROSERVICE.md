# Decoupled Redis Streams Omnichannel Notification Microservice Architecture

> **Last Updated**: 2026-09-03 | **Module**: `@maihoonna/notifications` | **Service Script**: `npm run dev:notifications`

---

## 1. Executive Summary & Microservice Transformation

The MaiHoonNa Notification Engine has transitioned from an in-process, synchronous library to a fully decoupled, production-grade **Redis Streams Microservice**. 

### The Core Problems Solved:
1. **Zero HTTP Event Loop Blocking**: API routes in `apps/api` and `apps/admin-backend` no longer make slow external network requests to MSG91, Expo, or SMTP during the request cycle. They execute an `XADD` command to Redis in `< 2ms` and immediately return HTTP 200/201.
2. **At-Least-Once Delivery Guarantees**: Messages are logged in persistent append-only Redis Streams. Workers process messages through Consumer Groups and must issue explicit `XACK` acknowledgments.
3. **Automatic Crash Recovery & Self-Healing**: If a worker crashes mid-dispatch or network times out, the unacknowledged message remains in the Pending Entries List (PEL). A periodic auto-claim routine (`XAUTOCLAIM`) claims and redelivers orphaned messages.
4. **Dead Letter Queue (DLQ)**: Poison messages failing more than 5 attempts are automatically routed to `stream:notifications:dlq` with complete diagnostic metadata.
5. **Multi-Channel Omnichannel Support**:
   - **WhatsApp**: MSG91 outbound bulk template gateway with dynamic variable mapping (`body_1`, `body_2`, etc.) and rate limiting.
   - **Push**: Expo FCM / APNs gateway with automatic token sanitization.
   - **Email**: Dual-mode AWS SES SDK v3 engine with automatic Zoho SMTP fallback and dry-run safety.

---

## 2. End-to-End System Topology

```
┌─────────────────────────┐      ┌─────────────────────────┐
│     apps/admin-backend  │      │        apps/api         │
│  (Controllers / Routes) │      │  (Controllers / Routes) │
└────────────┬────────────┘      └────────────┬────────────┘
             │                                │
             │  Fast XADD (< 2ms)             │  Fast XADD (< 2ms)
             ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│              REDIS STREAMS CLUSTER / INSTANCE             │
│                                                          │
│  • stream:notifications:push     (Expo FCM / APNs)       │
│  • stream:notifications:whatsapp (MSG91 Bulk / Templates)│
│  • stream:notifications:email    (AWS SES / Nodemailer)  │
│  • stream:notifications:dlq      (Dead Letter Queue)     │
└────────────────────────────┬─────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
┌──────────────────────────────────────────────────────────┐
│        Notification Worker Daemon (`worker.ts`)          │
│          Command: `npm run dev:notifications`            │
│                                                          │
│  Consumer Group: `notification-workers`                  │
│                                                          │
│  ┌────────────────────┐ ┌────────────────────┐ ┌──────┐  │
│  │   Push Consumer    │ │ WhatsApp Consumer  │ │Email │  │
│  │  - Batching (100)  │ │ - MSG91 Rate Guard │ │- SES │  │
│  │  - Token Sanitizer │ │ - Template Mapper  │ │- HTML│  │
│  └─────────┬──────────┘ └─────────┬──────────┘ └──┬───┘  │
└────────────┼──────────────────────┼───────────────┼──────┘
             ▼                      ▼               ▼
     ┌──────────────┐       ┌──────────────┐ ┌─────────────┐
     │  Expo / FCM  │       │ MSG91 WABA   │ │ SMTP / SES  │
     │ Push Gateway │       │ Gateway API  │ │   Service   │
     └──────────────┘       └──────────────┘ └─────────────┘
```

---

## 3. Redis Streams Specifications & Data Contracts

### 3.1 Stream Keys & Consumer Groups

| Stream Name | Key Constant | Purpose | Gateway / Target |
|---|---|---|---|
| `stream:notifications:whatsapp` | `NOTIFICATION_STREAMS.WHATSAPP` | High-priority WABA templates | MSG91 Bulk WhatsApp API |
| `stream:notifications:push` | `NOTIFICATION_STREAMS.PUSH` | In-app push banners & lock screen | Expo Push Gateway (FCM / APNs) |
| `stream:notifications:email` | `NOTIFICATION_STREAMS.EMAIL` | Transactional emails, digests, PDFs | AWS SES v3 (with Zoho SMTP fallback) |
| `stream:notifications:dlq` | `NOTIFICATION_STREAMS.DLQ` | Dead Letter Queue for failed jobs | Operations monitoring & replay |

**Consumer Group Name**: `notification-workers`

### 3.2 Event Envelope Schema (`NotificationStreamEvent`)
Every message published to any notification stream adheres to this normalized contract:

```typescript
export interface NotificationStreamEvent {
  id?: string;             // Redis Stream Entry ID (e.g. 1725350000000-0)
  idempotencyKey?: string; // Atomic deduplication key (60-second TTL)
  channel: 'push' | 'whatsapp' | 'email';
  event: string;           // E.g. 'VISIT_SCHEDULED', 'CC_PERFORMANCE_RATING'
  recipient: {
    userId?: string;       // User UUID
    phone?: string;        // E.164 formatted phone (e.g. '91XXXXXXXXXX')
    email?: string;        // Target email address
    pushToken?: string;    // 'ExponentPushToken[...]'
  };
  variables: Record<string, any>; // Template variables
  metadata?: {
    screen?: string;       // Mobile app deep-link target
    priority?: 'high' | 'normal' | 'low';
    sound?: string;
    badge?: number;
    channelId?: string;    // Android system channel ('default', 'visits')
    subject?: string;      // Email subject line
    html?: string;         // Email HTML body
    sourceApp?: string;
  };
  retryCount?: number;     // Number of dispatch attempts (max 5)
  createdAt: number;       // Epoch timestamp
}
```

---

## 4. Producer Engine: Non-Blocking Ingestion

The publisher lives in `packages/notifications/src/redis/notification.producer.ts`.

### 4.1 Usage in Backend Services
```typescript
import { notificationProducer } from '@maihoonna/notifications';

// 1. Publishing WhatsApp Notification
await notificationProducer.publish({
  idempotencyKey: `visit-${visitId}-scheduled`,
  channel: 'whatsapp',
  event: 'VISIT_SCHEDULED',
  recipient: { phone: subscriber.phone },
  variables: {
    ccName: 'Priya Sharma',
    beneficiaryName: 'Mr. Ramesh Kumar',
    date: 'Sept 4, 2026',
    time: '11:00 AM',
    address: 'Sector 62, Noida'
  }
});

// 2. Publishing Push Notification
await notificationProducer.publish({
  channel: 'push',
  event: 'VISIT_SCHEDULED',
  recipient: { pushToken: user.fcmToken },
  variables: {
    title: '📅 Visit Scheduled',
    body: 'Priya Sharma is scheduled to visit you on Sept 4.'
  },
  metadata: {
    screen: '/schedule',
    priority: 'high'
  }
});

// 3. Publishing Email Notification
await notificationProducer.publish({
  channel: 'email',
  event: 'SUBSCRIPTION_ACTIVATED',
  recipient: { email: subscriber.email },
  variables: {
    subject: 'Your MaiHoonNa Subscription is Active! 🎉',
    html: '<h1>Welcome to MaiHoonNa</h1><p>Your care journey begins today.</p>'
  }
});
```

### 4.2 Idempotency Guard
To eliminate accidental duplicate alerts caused by mobile retries or webhook repeats, the producer executes an atomic check:
```typescript
const lockKey = `idemp:notif:${event.idempotencyKey}`;
const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
if (!acquired) {
  // Duplicate detected, safely ignored without re-enqueuing
  return { success: true, deduplicated: true };
}
```

---

## 5. Consumer Engine: Autonomous Worker Daemon

The consumer lives in `packages/notifications/src/redis/notification.consumer.ts`.

### 5.1 Continuous Polling Loop (`XREADGROUP`)
Workers continuously poll all three channel streams:
```typescript
const results = await redis.xreadgroup(
  'GROUP',
  'notification-workers',
  consumerName,
  'BLOCK', 2000,
  'COUNT', 10,
  'STREAMS',
  'stream:notifications:whatsapp',
  'stream:notifications:push',
  'stream:notifications:email',
  '>', '>', '>'
);
```

### 5.2 At-Least-Once Delivery (`XACK`)
- On successful HTTP delivery to the vendor (MSG91, Expo, or AWS SES), the worker executes:
  ```typescript
  await redis.xack(streamName, 'notification-workers', messageId);
  ```
- If the vendor returns a transient failure (502, network drop), the message is **not** acknowledged and remains in the Pending Entries List (PEL).

### 5.3 Self-Healing Auto-Claim (`XAUTOCLAIM`)
A background routine runs every 30 seconds to reclaim unacknowledged messages that have been idle for > 60 seconds (due to server crashes or dropped connections):
```typescript
await redis.xautoclaim(
  streamName,
  'notification-workers',
  consumerName,
  60000, // min-idle-time in ms
  '0-0',
  'COUNT', 10
);
```

### 5.4 Dead Letter Queue (DLQ)
Messages exceeding 5 failed attempts are routed to `stream:notifications:dlq`:
```typescript
await redis.xadd(
  'stream:notifications:dlq',
  '*',
  'originalStream', streamName,
  'originalMessageId', messageId,
  'failedAt', String(Date.now()),
  'error', errorReason,
  'payload', JSON.stringify({ ...eventData, retryCount })
);
await redis.xack(streamName, 'notification-workers', messageId);
```

---

## 6. Channel Adapters & Integrations

### 6.1 WhatsApp Channel (MSG91 Bulk Outbound)
- **File**: `packages/notifications/src/providers/whatsapp/Msg91WhatsAppProvider.ts`
- **Endpoint**: `POST https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`
- **Dynamic Component Construction**:
  The worker maps variables from `whatsapp.registry.ts` directly into MSG91's required structure:
  ```json
  {
    "integrated_number": "918527070049",
    "content_type": "template",
    "payload": {
      "messaging_product": "whatsapp",
      "type": "template",
      "template": {
        "name": "cc_performance_rating_received",
        "language": { "code": "en", "policy": "deterministic" },
        "namespace": "bf28acb3_8719_4168_9ed4_bc225dcfe30d",
        "to_and_components": [
          {
            "to": ["91XXXXXXXXXX"],
            "components": {
              "body_1": { "type": "text", "value": "5" },
              "body_2": { "type": "text", "value": "Mr. Sharma" },
              "body_3": { "type": "text", "value": "Very polite and attentive care." }
            }
          }
        ]
      }
    }
  }
  ```

> [!IMPORTANT]
> **Template Slug Rules in MSG91**:
> Template names in `whatsapp.registry.ts` must match the exact approved slug in your MSG91 dashboard (e.g. `cc_performance_rating_received` vs `cc_performance_rating`). If the slug is off by even one character, Meta will reject delivery after initial acceptance.

### 6.2 Email Channel (AWS SES v3 + Zoho SMTP Fallback)
- **File**: `packages/notifications/src/providers/email/AwsSesEmailProvider.ts`
- **Dual-Mode Operation**:
  1. **AWS SES SDK v3**: Automatically activated when `AWS_SES_ACCESS_KEY_ID` and `AWS_SES_SECRET_ACCESS_KEY` are provided. Uses `@aws-sdk/client-ses` with `SendRawEmailCommand`.
  2. **Zoho SMTP Fallback**: If AWS keys are empty, automatically falls back to `EMAIL_HOST=smtppro.zoho.in:465` with credentials `EMAIL_USER` and `EMAIL_PASS`.
  3. **Dry-Run Mode**: If neither is available, safely logs transmission details without crashing.

### 6.3 Push Channel (Expo FCM Gateway)
- **File**: `packages/notifications/src/providers/push/expo-fcm.provider.ts`
- **Endpoint**: `POST https://exp.host/--/api/v2/push/send`
- **Capabilities**:
  - Sanitizes recipient tokens (`ExponentPushToken[...]` format).
  - Supports automatic batching up to 100 notifications per HTTP request.
  - Passes Android channels (`default`, `visits`) and lock-screen sound triggers.

---

## 7. Operational Runbook & Commands

### 7.1 Running the Notification Worker
From the monorepo root:
```bash
# Development Mode (Runs with ts-node)
npm run dev:notifications

# Production Mode (Runs compiled JS from dist/)
npm run service:notifications
```

### 7.2 Redis Streams Diagnostic CLI Commands
Connect to your Redis instance using `redis-cli`:

```bash
# Check length of pending messages in each stream
XLEN stream:notifications:whatsapp
XLEN stream:notifications:push
XLEN stream:notifications:email
XLEN stream:notifications:dlq

# Inspect Consumer Group state
XINFO GROUPS stream:notifications:whatsapp

# Inspect unacknowledged pending messages (PEL)
XPENDING stream:notifications:whatsapp notification-workers

# View the last 5 messages in Dead Letter Queue (DLQ)
XREVRANGE stream:notifications:dlq + - COUNT 5
```

---

## 8. Environment Variables Reference

Add the following to your root `.env` or `apps/api/.env`:

```env
# ─── REDIS STREAMS BROKER ──────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379

# ─── MSG91 WHATSAPP GATEWAY ────────────────────────────────────────────────
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_WHATSAPP_NUMBER=your_whatsapp_number_here
MSG91_WHATSAPP_NAMESPACE=your_whatsapp_namespace_here
MSG91_WHATSAPP_OTP_TEMPLATE=otp

# ─── EXPO PUSH GATEWAY ─────────────────────────────────────────────────────
EXPO_PUSH_URL=https://exp.host/--/api/v2/push/send

# ─── AMAZON AWS SES EMAIL CONFIGURATION ────────────────────────────────────
EMAIL_PROVIDER=ses
AWS_SES_REGION=ap-south-1
AWS_SES_ACCESS_KEY_ID=             # <-- Paste your AWS Access Key ID here
AWS_SES_SECRET_ACCESS_KEY=         # <-- Paste your AWS Secret Key here
AWS_SES_FROM_EMAIL=info@maihoonna.com
AWS_SES_FROM_NAME="MaiHoonNa Care"

# ─── FALLBACK SMTP CONFIGURATION (ZOHO) ────────────────────────────────────
EMAIL_HOST=smtppro.zoho.in
EMAIL_PORT=465
EMAIL_USER=info@maihoonna.com
EMAIL_PASS=your_email_password_here
```

---

## 9. Business Event Hook Registry & Implementation Map

All notifications are wired using the non-blocking `< 2ms` Redis Streams Microservice contract via `notificationProducer.publish()`. Core database transactions never block or fail due to notification dispatch.

### 9.1 Visit & Encounter Lifecycle
- **Source File**: `apps/api/app/services/care_companion/visit_service.ts`
  - **`checkIn()`**:
    - `VISIT_STARTED` (NT-012): Dispatched to Subscriber with Care Mitra name, Beneficiary name, and arrival time.
    - `MANUAL_CHECKIN_FLAGGED` (NT-013): Dispatched to Field Manager if Care Mitra overrides GPS geofence with manual reason.
  - **`checkOut()`**:
    - `VISIT_COMPLETED` (NT-014): Dispatched to both Subscriber and Beneficiary with formatted duration (`1 hr 15 mins`).
    - `RATING_FEEDBACK_PROMPT` (NT-018): Dispatched to Subscriber prompting rating & feedback.
    - `MOOD_ALERT` (NT-020): Automatically triggers when mood is `sad`, `anxious`, or `depressed`.
    - `WELLBEING_CHECK_RECOMMENDED` (NT-021): Detects two consecutive negative mood check-outs and triggers clinical/tele-consult check-in.
    - `VITALS_ALERT` (NT-030): Inspects vitals against configured definitions and dispatches alert if readings are outside normal range.
    - `MEDICATION_MISSED` (NT-032): Flags untaken/missed medication adherence records to the Subscriber.
  - **`rateVisit()`**:
    - `CC_PERFORMANCE_RATING` (NT-065): Dispatches star rating and feedback comment to Care Mitra's phone.

### 9.2 Onboarding & Account Lifecycle
- **Source File**: `apps/api/app/services/auth/auth_service.ts`
  - **`register()` & `verifyOtp()`**:
    - `SUBSCRIBER_ACCOUNT_CREATED` (NT-002): Dispatches welcome WhatsApp message upon new account creation.

### 9.3 Beneficiary Profile Lifecycle
- **Source File**: `apps/api/app/services/subscriber/beneficiary_service.ts`
  - **`createBeneficiary()`**:
    - `BENEF_PROFILE_CREATED` (NT-005): Dispatches enrollment confirmation to the senior beneficiary's phone.

### 9.4 Subscription & Checkout Lifecycle
- **Source File**: `apps/api/app/api/subscriber/subscriptions.routes.ts`
  - **`POST /subscriber/subscriptions/purchase`**:
    - `PAYMENT_SUCCESS` (NT-044): Dispatched upon successful Razorpay capture with `subscriberName`, `amount`, and `transactionId`.
    - `SUBSCRIPTION_ACTIVATED` (NT-004): Dispatched confirming plan activation with start date.

### 9.5 Field Operations & Scheduling
- **Source File**: `apps/admin-backend/services/events/visit-event.dispatcher.js`
  - **`dispatchVisitScheduled()`**:
    - `VISIT_SCHEDULED` (NT-010): Dispatched via WhatsApp to both Subscriber and Care Mitra phone.

---

## 10. Resilient Circuit Breaker & Local Dev Fallback

To ensure the microservice architecture works seamlessly across both production (with Redis Cluster) and local development (where Redis might not be installed or running):

1. **Lazy Connection & Limited Retries (`redis.connection.ts`)**:
   - `lazyConnect: true` prevents Node.js processes from hanging on boot if Redis is offline.
   - `retryStrategy` caps at 2 attempts, preventing connection log spam.
2. **Circuit-Breaker Producer (`notification.producer.ts`)**:
   - `notificationProducer.publish()` attempts Redis Streams `XADD`.
   - If Redis is unreachable (`ECONNREFUSED` or connection closed), it logs a warning and automatically falls back to direct `notificationService.send()` without crashing or dropping the message.

---

## 11. Testing & Verification Runbook

### Comprehensive 64-Template Test
Run the full test suite against all registered MSG91 WhatsApp templates:
```bash
npx ts-node packages/notifications/test-all-whatsapp-templates.ts
```
- **Results**: 64 / 64 templates processed successfully (`status: sent`).

### End-to-End Real Code Actions Test
Run the end-to-end service simulation verifying real code functions (`createBeneficiary`, `rateVisit`, `purchase`):
```bash
npx ts-node packages/notifications/test-e2e-action.ts
```
- **Results**: Real code triggers executed, circuit-breaker fallback validated, and messages verified on live recipient WhatsApp.

