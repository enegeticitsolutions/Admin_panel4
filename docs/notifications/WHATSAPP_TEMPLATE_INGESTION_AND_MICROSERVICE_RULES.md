# WhatsApp Template Ingestion & Microservice Integration Rules

> **File Path**: `.claude/WHATSAPP_TEMPLATE_INGESTION_AND_MICROSERVICE_RULES.md`  
> **Target Package**: `packages/notifications`  
> **Registry File**: `packages/notifications/src/registry/whatsapp.registry.ts`  
> **Workflow**: Batch Ingestion (5 Templates per turn)

---

## 1. Objective & Operating Model

This document serves as the **strict, immutable rulebook** for ingesting MSG91 WhatsApp template JSONs into the MaiHoonNa Notification Microservice. 

Whenever the user pastes a batch of 5 template JSONs, the AI Agent **MUST** follow the exact procedures, validation steps, and coding patterns outlined below to ensure:
1. Zero runtime failures or Meta template rejections.
2. 100% type-safety and variable order alignment.
3. Decoupled, non-blocking Redis Streams event delivery.

---

## 2. Anatomy of an Incoming MSG91 Template JSON

Each template JSON provided by the user follows this standard structure:

```json
{
  "integrated_number": "918527070049",
  "content_type": "template",
  "payload": {
    "messaging_product": "whatsapp",
    "type": "template",
    "template": {
      "name": "cc_performance_rating_received",
      "language": {
        "code": "en",
        "policy": "deterministic"
      },
      "namespace": "bf28acb3_8719_4168_9ed4_bc225dcfe30d",
      "to_and_components": [
        {
          "to": ["<list_of_phone_numbers>"],
          "components": {
            "body_1": { "type": "text", "value": "value1" },
            "body_2": { "type": "text", "value": "value1" },
            "body_3": { "type": "text", "value": "value1" }
          }
        }
      ]
    }
  }
}
```

---

## 3. Mandatory Extraction & Parsing Rules

For every template JSON in the batch, the Agent MUST extract:

| Extracted Field | Rule | Example |
|---|---|---|
| **1. Template Slug (`template.name`)** | **Exact character-for-character string**. Never alter casing, underscores, or suffixes. | `"cc_performance_rating_received"` (NOT `"cc_performance_rating"`) |
| **2. Language Code (`language.code`)** | Must match the approved language. Default is `'en'`. If `'en_US'` or `'en_GB'`, record it explicitly. | `'en'` |
| **3. Body Components (`body_1` ... `body_n`)** | Count total number of body variables. The count in registry MUST equal the count in the template JSON. | 3 body components = exactly 3 variable keys |
| **4. Button / Header Components** | If `button_1` or `header_1` exists (e.g. OTP copy button or URL parameter), record it in the template configuration. | `button_1: { subtype: 'url', type: 'text', value: 'otp' }` |

---

## 4. Coding Standard for `whatsapp.registry.ts`

### 4.1 Interface Definition
The registry entry in `packages/notifications/src/registry/whatsapp.registry.ts` MUST conform to:

```typescript
export interface WhatsAppTemplateConfig {
  template: string;            // Exact MSG91 template name slug
  body: string[];              // Ordered variable keys mapping 1-to-1 with body_1, body_2, ...
  language?: string;           // Defaults to 'en' if omitted
  hasButtons?: boolean;        // True if template contains dynamic URL/copy buttons
  buttonKey?: string;          // Key for dynamic button variable (e.g. 'otpCode' or 'paymentLink')
  templateId?: string;         // E.g. 'NT-001', 'NT-065' from Master Excel
  description?: string;        // Human-readable trigger event
}
```

### 4.2 Registry Mapping Pattern
All keys in `WhatsAppRegistry` MUST:
1. Use uppercase semantic event keys (e.g. `CC_PERFORMANCE_RATING` or `NT_065_CC_PERFORMANCE_RATING`).
2. Provide **meaningful, self-documenting camelCase variable names** matching the business context (e.g. `['rating', 'beneficiaryName', 'comment']`, NOT `['var1', 'var2', 'var3']`).
3. Preserve strict positional ordering:
   - Index `0` ➔ `body_1` (`{{1}}`)
   - Index `1` ➔ `body_2` (`{{2}}`)
   - Index `2` ➔ `body_3` (`{{3}}`)

#### Example:
```typescript
export const WhatsAppRegistry: Record<string, WhatsAppTemplateConfig> = {
  // NT-065: CC performance rating received
  CC_PERFORMANCE_RATING: {
    templateId: 'NT-065',
    template: 'cc_performance_rating_received',
    body: ['rating', 'beneficiaryName', 'comment'],
    description: 'Rating received from beneficiary family',
  },

  // NT-046: Subscription hours running low
  SUBSCRIPTION_HOURS_LOW: {
    templateId: 'NT-046',
    template: 'subscription_hours_running_down',
    body: ['beneficiaryName', 'percentConsumed'],
    description: 'Alert sent when beneficiary hours exceed warning threshold',
  },
};
```

---

## 5. Microservice Execution Pipeline (How It Runs at Runtime)

The microservice processes incoming events through three decoupled layers:

### Layer 1: Producer (`NotificationProducer`)
- Called inside `apps/api` or `apps/admin-backend` route handlers.
- **Rules**:
  1. Never make HTTP calls to MSG91 here.
  2. Perform 60-second atomic deduplication (`SET idemp:notif:<key> 1 NX EX 60`).
  3. `XADD` to `stream:notifications:whatsapp` in `< 2ms`.
  ```typescript
  await notificationProducer.publish({
    idempotencyKey: `rating-${feedbackId}`,
    channel: 'whatsapp',
    event: 'CC_PERFORMANCE_RATING',
    recipient: { phone: '91XXXXXXXXXX' },
    variables: {
      rating: '5',
      beneficiaryName: 'Mr. Sharma',
      comment: 'Excellent care.'
    }
  });
  ```

### Layer 2: Redis Stream Broker
- Stream: `stream:notifications:whatsapp`
- Consumer Group: `notification-workers`

### Layer 3: Worker Daemon (`NotificationConsumer`)
- Runs continuously in background via `npm run dev:notifications`.
- **Rules**:
  1. Polls stream via `XREADGROUP`.
  2. Resolves template config from `WhatsAppRegistry[event.event]`.
  3. Validates that every key in `templateConfig.body` is present in `event.variables`. If missing, throws descriptive error before hitting MSG91.
  4. Dynamically builds the MSG91 outbound payload:
     - `integrated_number`: from `process.env.MSG91_WHATSAPP_NUMBER`
     - `namespace`: from `process.env.MSG91_WHATSAPP_NAMESPACE`
     - `template.name`: `templateConfig.template`
     - `components`: `body_1` through `body_n`.
  5. Sends HTTP POST to MSG91.
  6. On HTTP 200 / `status === 'success'` ➔ Executes `redis.xack(stream, group, messageId)`.
  7. On error ➔ Increments retry count. If `>= 5`, moves to `stream:notifications:dlq`.

---

## 6. Step-by-Step Batch Ingestion Workflow (Every Turn)

When the user pastes 5 template JSONs in a prompt, the Agent MUST execute these exact steps:

```
[ Step 1: Parse 5 JSONs ]
        │ Extract exact slug, language, component count
        ▼
[ Step 2: Cross-Reference with Master List ]
        │ Match with NT-XXX IDs and Excel variables
        ▼
[ Step 3: Update `whatsapp.registry.ts` ]
        │ Add/update the 5 template entries with exact slugs & typed keys
        ▼
[ Step 4: Compile & Validate Build ]
        │ Execute `npm run build` in packages/notifications (0 TypeScript errors)
        ▼
[ Step 5: Generate Test Verification Script ]
        │ Provide clean test payload for physical phone verification
```

---

## 7. Golden Quality Checks (Before Reporting Completion)

- [ ] **Exact Slug Check**: Did we copy the `name` string verbatim without guessing?
- [ ] **Variable Count Check**: Does `body.length` in the registry equal the count of `body_` items in the JSON?
- [ ] **Positional Order Check**: Does `body[0]` correspond to `{{1}}`, `body[1]` to `{{2}}`, etc.?
- [ ] **Build Validation**: Did `npm run build` succeed with exit code `0`?
- [ ] **No Hardcoded Numbers/Keys**: Are `integrated_number`, `namespace`, and `authkey` loaded from `.env`?

---

## 8. Troubleshooting & Meta Rejection Guide

| Issue | Root Cause | Fix |
|---|---|---|
| **MSG91 returns 200, but message never arrives on phone** | Template slug mismatch (e.g. `rating` vs `rating_received`) | Check exact slug in MSG91 dashboard. Meta rejects mismatched slugs post-queuing. |
| **Meta Error: Number of parameters does not match template** | Sent 3 variables when Meta template expects 2 | Check `body` array length in `whatsapp.registry.ts`. |
| **Meta Error: Template does not exist for language 'en'** | Template approved in `en_US` instead of `en` | Set `language: 'en_US'` in the template registry. |
| **MSG91 Error: Insufficient Balance** | MSG91 WhatsApp wallet empty | Top up wallet balance in MSG91 dashboard. |
