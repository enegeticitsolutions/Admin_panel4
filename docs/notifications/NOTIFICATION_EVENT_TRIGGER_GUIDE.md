# Developer Guide: Notification Event & MSG91 Template Automation

> **Module**: `@maihoonna/notifications` | **Worker Command**: `npm run dev:notifications`  
> **Related Architecture**: [Redis Streams Microservice](.claude/REDIS_STREAMS_NOTIFICATION_MICROSERVICE.md)

---

## 💡 How It Works

Whenever you need a new notification event (WhatsApp template, Push, or Email) triggered in the app, you **do not need to write long prompts**.

You only need to provide two things to the AI assistant or team developer:
1. **The Code Marker**: Where the event takes place (e.g. `@checkout.tsx:L669` or `@subscriptions.routes.ts:L550`).
2. **The MSG91 Payload**: The template JSON or cURL received from MSG91 / Meta Business Manager.

The system rule automatically configures:
1. The template registry in `packages/notifications/src/registry/whatsapp.registry.ts`.
2. The producer trigger (`notificationProducer.publish`) at the event point with idempotency.
3. The Redis Streams background worker execution (`stream:notifications:whatsapp` ➔ MSG91 Bulk API).

---

## 📋 Copy-Paste Template for Developers

When requesting a new notification integration, paste this block:

```markdown
Hey, please configure this notification event:
Code location: @[apps/mobile-app/app/(setup)/checkout.tsx:L669] (or backend payment confirmation)
MSG91 Template:
```json
{
  "integrated_number": "918527070049",
  "content_type": "template",
  "payload": {
    "messaging_product": "whatsapp",
    "type": "template",
    "template": {
      "name": "payment_success",
      "language": {
        "code": "en",
        "policy": "deterministic"
      },
      "namespace": "bf28acb3_8719_4168_9ed4_bc225dcfe30d",
      "to_and_components": [
        {
          "to": ["<phone_number>"],
          "components": {
            "body_1": { "type": "text", "value": "value1" },
            "body_2": { "type": "text", "value": "value2" },
            "body_3": { "type": "text", "value": "value3" }
          }
        }
      ]
    }
  }
}
```
```

---

## 🛠️ Step-by-Step Architecture Reference

### 1. Template Registry (`packages/notifications/src/registry/whatsapp.registry.ts`)
Each WhatsApp template requires an entry in `WhatsAppRegistry`:

```typescript
export const WhatsAppRegistry: Record<string, WhatsAppTemplateConfig> = {
  // Key = Event constant passed to producer
  PAYMENT_SUCCESS: {
    template: 'payment_success',                     // Exact MSG91 template name
    body: ['amount', 'beneficiaryName', 'packageName'] // Maps 1:1 to body_1, body_2, body_3
  },
};
```

### 2. Event Ingestion (`notificationProducer.publish`)
In your API route, controller, or webhook:

```typescript
import { notificationProducer } from '@maihoonna/notifications';

await notificationProducer.publish({
  idempotencyKey: `payment-${orderId}-success`, // Prevents duplicate delivery if called multiple times
  channel: 'whatsapp',
  event: 'PAYMENT_SUCCESS',
  recipient: {
    phone: subscriber.phone, // Formats to 91XXXXXXXXXX
  },
  variables: {
    amount: '₹4,999',
    beneficiaryName: 'Mr. Sharma',
    packageName: 'Gold Care Package',
  },
});
```

### 3. Asynchronous Worker Execution
The API call to `notificationProducer.publish` executes a Redis `XADD` command in **< 2ms** and does **not** block the HTTP request cycle.

The notification worker polls the stream:
```bash
# Start worker daemon in development
npm run dev:notifications

# Start worker daemon in production
npm run service:notifications
```

---

## 🔍 Verification Commands

To check the status of enqueued and processed messages:

```bash
# Check how many messages are in the WhatsApp stream
redis-cli XLEN stream:notifications:whatsapp

# Check the Dead Letter Queue for any failed jobs
redis-cli XLEN stream:notifications:dlq

# View the last message in the DLQ
redis-cli XREVRANGE stream:notifications:dlq + - COUNT 1
```
