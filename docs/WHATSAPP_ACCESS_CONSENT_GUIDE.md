# WhatsApp Profile Access Consent — Developer Setup & Template Guide

> **Applies To:** `packages/notifications`, `apps/api` (`/api/access/request`, `/api/webhooks/whatsapp`)  
> **Architecture:** Two-way (Outbound + Inbound) via `@maihoonna/notifications` (Redis Streams → Worker → MSG91 WhatsApp API) & Inbound Webhook (`POST /api/webhooks/whatsapp`).

---

## 1. End-to-End Flow (Outbound + Inbound)

```text
[User B taps "Ask for Access" in Mobile App]
    ↓ POST /api/access/request
[ProfileAccessService creates PENDING CareAccessRequest]
    ↓ dispatchAccessRequestWhatsApp(requestId)
[@maihoonna/notifications -> Redis Stream -> Notification Worker -> MSG91 Outbound API]
    ↓
[OUTBOUND WhatsApp sent to Mom (SELF) & Son A (MANAGER)]
    Body: "Hi {{1}}, {{2}} ({{3}}) has requested {{4}} access..."
    Button 1: [Approve Access] -> payload: ACCESS_APPROVE:<requestId>:<hmac>
    Button 2: [Decline]        -> payload: ACCESS_REJECT:<requestId>:<hmac>
    ↓
[Mom or Son A taps "Approve Access" or "Decline" on WhatsApp]
    ↓ MSG91 / Meta POSTs webhook to https://<API_DOMAIN>/api/webhooks/whatsapp
[INBOUND Webhook verifies:]
    Layer 0: X-Hub-Signature-256 (Meta App Secret)
    Layer 1: Cryptographic HMAC-SHA256 on (requestId + action)
    Layer 2: Sender phone matches registered SELF or MANAGER user in DB
    Layer 3: Atomic idempotent transaction -> updates CareAccessRequest + upserts CareCircleMember
    Layer 4: DPDP Act ActivityLog audit entry + Outbound confirmation to User B
```

---

## 2. Exact WhatsApp Templates to Submit on MSG91 / Meta

### Template 1: Outbound Access Consent Request (`profile_access_request`)
*Submit this in **MSG91 WhatsApp Dashboard → Templates → Create Template** (or Meta Business Manager):*

- **Template Name:** `profile_access_request`
- **Category:** `UTILITY` *(Important: Utility templates get faster Meta approval and lower cost; do NOT pick Marketing.)*
- **Language:** `English (en)`
- **Header:** None *(or Text: `MaiHoonNa Care Access Request`)*
- **Body:**
  ```text
  Namaste {{1}},

  {{2}} ({{3}}) has requested *{{4}}* access to view and support care updates on MaiHoonNa.

  Please confirm below whether you would like to grant this access. This request expires in 7 days.
  ```
- **Footer (Optional):** `MaiHoonNa Eldercare • Reply using buttons below`
- **Interactive Buttons (Type: Quick Reply — Add 2 Buttons in Exact Order):**
  1. **Button 1 Text:** `Approve Access` *(Dynamic payload mapped by backend to `button_1`)*
  2. **Button 2 Text:** `Decline` *(Dynamic payload mapped by backend to `button_2`)*
- **Sample Values for Meta Review:**
  - `{{1}}`: `Sunita Sharma`
  - `{{2}}`: `Rahul Sharma`
  - `{{3}}`: `Son`
  - `{{4}}`: `View Only`

---

### Template 2: Outbound Decision Confirmation (`profile_access_decision`)
*Sent automatically to the requester once approved or declined (works for both In-App and WhatsApp approvals):*

- **Template Name:** `profile_access_decision`
- **Category:** `UTILITY`
- **Language:** `English (en)`
- **Body:**
  ```text
  Namaste {{1}},

  Your access request for {{2}}'s Care Profile on MaiHoonNa has been *{{3}}*.

  Open the MaiHoonNa app to check your updated Care Circle status.
  ```
- **Buttons:** None
- **Sample Values for Meta Review:**
  - `{{1}}`: `Rahul Sharma`
  - `{{2}}`: `Sunita Sharma`
  - `{{3}}`: `Approved`

---

## 3. Developer Checklist — Step-by-Step Setup

### Part A: Environment Variables (`apps/api/.env` & `packages/notifications/.env`)
Ensure these variables are set on **both** the API server and the Notification Worker server:

```env
# ── MSG91 Outbound WhatsApp ─────────────────────────────────────────────
MSG91_AUTH_KEY=<your_msg91_auth_key>
MSG91_WHATSAPP_NUMBER=<your_integrated_91xxxxxxxxxx_number>
MSG91_WHATSAPP_NAMESPACE=<your_meta_template_namespace>

# Template names (override here if Meta approves under a slightly different slug)
MSG91_WHATSAPP_ACCESS_REQUEST_TEMPLATE=profile_access_request
MSG91_WHATSAPP_ACCESS_DECISION_TEMPLATE=profile_access_decision

# ── Inbound Webhook Security (CRITICAL: Must match across API & Webhook) ─
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<strong_random_32_char_secret>
WHATSAPP_APP_SECRET=<meta_app_secret_for_X_Hub_Signature_256>

# ── Redis (for Async Streams Worker) ────────────────────────────────────
REDIS_HOST=<redis_host>
REDIS_PORT=6379
```

> **Important:** `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is used both for the Meta `GET` verification handshake AND to sign/verify the HMAC-SHA256 button callback payloads (`ACCESS_APPROVE:<requestId>:<hmac>`). Make sure the **exact same value** is deployed on `apps/api`.

---

### Part B: Configure OUTBOUND Delivery (Notification Engine)
1. Confirm both templates (`profile_access_request` and `profile_access_decision`) show **Approved** in MSG91 / Meta.
2. Start (or restart) the `@maihoonna/notifications` Redis worker process (`npm run worker`) so it loads the newly compiled `WhatsAppRegistry` entries from `packages/notifications/dist`.
3. Verify Redis health:
   ```bash
   curl https://<YOUR_API_DOMAIN>/api/health/redis
   ```
   *(Even if Redis is temporarily unreachable in local dev, `whatsapp_access_consent.ts` automatically falls back to direct `notificationService.send()`).*

---

### Part C: Configure INBOUND Webhook (MSG91 / Meta Dashboard)
Without Inbound configured, clicking **Approve Access** or **Decline** on WhatsApp will never reach your backend!

1. **Expose Public HTTPS Endpoint:**
   - Your inbound endpoint is already live in `apps/api` at:
     ```text
     https://<YOUR_API_DOMAIN>/api/webhooks/whatsapp
     ```
   - Verify it responds to `GET` in a browser (should return `{ "status": "online", "service": "MaiHoonNa WhatsApp Webhook" }`).
2. **In MSG91 Dashboard → WhatsApp → Webhook Settings:**
   - **Inbound / Incoming Message Webhook URL:** `https://<YOUR_API_DOMAIN>/api/webhooks/whatsapp`
   - **Method:** `POST` (JSON)
   - **Enable Events:** Incoming Messages / Button Replies / Quick Replies.
   - Ensure MSG91 forwards the Quick Reply `payload` / `buttonPayload` and `sender` / `mobile` fields.
3. **If Connecting Directly via Meta Developer Console (Cloud API):**
   - **Callback URL:** `https://<YOUR_API_DOMAIN>/api/webhooks/whatsapp`
   - **Verify Token:** Exact value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from `.env`.
   - Click **Verify and Save** (`GET /api/webhooks/whatsapp` handles `hub.challenge` automatically).
   - Subscribe to the **`messages`** webhook field.
   - Add your Meta App Secret to `WHATSAPP_APP_SECRET` in `.env` so Layer 0 (`X-Hub-Signature-256`) validates every inbound POST.

---

### Part D: How the Developer Can Test Both Directions Locally / On Staging

1. **Test Outbound + DB Creation:**
   - User B logs into Mobile App (or calls `POST /api/access/request` with `{ "targetPhone": "<MomPhone>", "requestedRole": "VIEWER", "relationship": "Son" }`).
   - Check worker logs:
     `✅ [NotificationConsumer] Successfully delivered PROFILE_ACCESS_REQUEST to <MomPhone>`
   - Confirm Mom (and any `MANAGER`) receives the WhatsApp message with **[Approve Access]** and **[Decline]** buttons.
2. **Test Inbound Callback (Real Phone):**
   - Tap **Approve Access** on WhatsApp.
   - Check `apps/api` logs:
     `✅ [WhatsApp Access Webhook] Request <requestId> APPROVED by user <momUserId> (Phone: <MomPhone>)`
   - Verify:
     - `care_access_requests.status` is now `APPROVED`.
     - `care_circle_members` now has an `active` row for User B.
     - `activity_logs` contains `WHATSAPP_ACCESS_CONSENT_APPROVED`.
     - User B receives the `profile_access_decision` WhatsApp confirmation and sees the Care Profile in the app!
3. **Test Security Guards (Negative Tests):**
   - Re-tap the same button a second time → logs `already processed. Idempotent check satisfied.` (no error, no duplicate row).
   - Forward the message to an unauthorized phone and tap Approve → rejected at Layer 2 (`Unrecognized sender phone` or `Only the profile owner or a Care Manager can approve`).
   - Tamper with 1 character of the HMAC signature → rejected at Layer 1 (`Invalid HMAC rejected`).
