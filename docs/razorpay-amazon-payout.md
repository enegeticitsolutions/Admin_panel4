# Razorpay Amazon Payout Wallet Integration — Implementation Plan

> **Status**: Awaiting review and approval before any code changes.
> **Date**: 06 Oct 2026
> **Scope**: Amazon Pay Gift Card payout via RazorpayX for Saathi volunteer credits redemption.

---

## Current System Analysis

Before defining changes, here is what the existing codebase already does:

### Backend (`apps/api`)

| Component | Existing Path | Current State |
|---|---|---|
| Razorpay service | `app/services/razorpay_service.ts` | **Already exists.** Handles Razorpay Payment Gateway (orders, signature verification). Has test/live mode toggle via `RAZORPAY_TEST_MODE` env. Uses `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. |
| Redemption function | `app/services/sathi/sathi_service.ts` → `redeemVolunteerCredits()` | **Already exists.** Handles `GIFT_CARD`, `UPI_TRANSFER`, `DISCOUNT_COUPON` redeem types inside a `prisma.$transaction`. Deducts `totalCreditPoints`, creates `VolunteerCreditTransaction`, creates `VolunteerRewardCoupon`. |
| Redemption route | `app/api/sathi/visits.routes.ts` → `POST /credits/redeem` | **Already exists.** Calls `redeemVolunteerCredits()`. Protected by `authenticate` middleware. |
| Redeem validation schema | `app/schemas/sathi.ts` → `volunteerRedeemSchema` | **Already exists.** Accepts `points`, `redeemType` (`GIFT_CARD` \| `DISCOUNT_COUPON` \| `UPI_TRANSFER`), `details`. |
| Notification dispatcher | `app/services/sathi/sathi-notification.dispatcher.ts` | **Already exists.** Has `dispatchSaathiRedemptionRequested()` (ST-031), `dispatchSaathiGiftCardDelivered()` (ST-032), and `dispatchCoordinatorRedemptionAwaitingApproval()` (ST-061). Uses WhatsApp via `notificationProducer.publish()`. |
| Sathi router aggregator | `app/api/sathi/sathi.routes.ts` | **Already exists.** Mounts `auth`, `profile`, `matches`, `visits`, `visit-requests`. Amazon redemption route will plug in here. |
| Main entry | `app/main.ts` | **Already exists.** Mounts all routers at `app.use('/api/sathi', sathiRouter)`. |
| Payments proxy | `app/api/payments/payment.routes.ts` | **Already exists.** Proxies to `admin-backend` for subscriber payment flows. **Not to be touched.** |
| Webhook infrastructure | Proxied through payments route to `admin-backend` | **Exists for subscriber payments.** Need to verify webhook handling for RazorpayX payouts — see Section 9. |
| `.env.example` | `apps/api/.env.example` | **Already has** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` under section 6. |

### Mobile App (`apps/sathi-app`)

| Component | Existing Path | Current State |
|---|---|---|
| Credits & Redemption screen | `app/(sathi)/credits.tsx` | **Already exists.** Large screen (1423 lines) with tabs: `REDEEM`, `HISTORY`, `VOUCHERS`. Already handles `GIFT_CARD` and `UPI_TRANSFER` redemption types via `POST /api/sathi/credits/redeem`. Has `confirmModal`, `successModal`, `alertModal`. |

### Admin Panel (`apps/admin-frontend`)

| Component | Existing Path | Current State |
|---|---|---|
| Volunteers page | `src/app/pages/VolunteersPage.tsx` | **Already exists** (52KB). Contains the Saathi volunteer management page with a Saathi card. |
| Admin routes | `src/app/routes.tsx` | Route `/volunteers` → `VolunteersPage`. **No sub-routes for individual volunteer profiles yet.** |

### Database (`packages/database`)

| Entity | Current State |
|---|---|
| `Volunteer` | Has `totalCreditPoints`, `totalCreditHours`. **No `razorpayContactId` field yet.** |
| `VolunteerCreditTransaction` | **Already exists.** Types: `earned`, `redeemed`, `adjustment`, `expiry`. |
| `VolunteerRewardCoupon` | **Already exists.** Used for internal MHN gift cards. Status: `ACTIVE`, `CLAIMED`, `EXPIRED`, `CANCELLED`. |
| `VolunteerRedemption` | **Does NOT exist.** Must be created for Amazon payout tracking. |

---

## 1. Files to be Created

### Backend (`apps/api/app`)

- `services/razorpay_payout_service.ts`
  — A new, separate service file dedicated to RazorpayX Payout Wallet operations (Contact, Fund Account, Amazon payout).
  — This keeps RazorpayX payout logic completely separate from the existing `razorpay_service.ts` (which handles Payment Gateway orders/verification) to avoid any regression.
  — Internally reuses `getRazorpayCredentials()` from the existing `razorpay_service.ts`.

- `api/sathi/redemptions.routes.ts`
  — A new route file containing:
  - `POST /sathi/redemptions/amazon` — initiate Amazon payout.
  - `GET /sathi/redemptions` — fetch redemption history for the authenticated volunteer.
  — Will be registered into the existing `sathi.routes.ts` aggregator.

### Notifications (`packages/notifications` / `sathi-notification.dispatcher.ts`)

- A new dispatcher function `dispatchSaathiAmazonPayoutSuccess()` will be added to the **existing** `sathi-notification.dispatcher.ts` for the Amazon-specific WhatsApp + Email confirmation message.

---

## 2. Files to be Modified

### Backend (`apps/api/app`)

| File | Change | Risk |
|---|---|---|
| `api/sathi/sathi.routes.ts` | Add `router.use('/', redemptionsRouter)` to mount the new redemptions routes. One line addition. | Zero — existing routes untouched. |
| `schemas/sathi.ts` | Add `volunteerAmazonRedeemSchema` Joi schema for the new endpoint. Existing `volunteerRedeemSchema` stays unchanged. | Zero — additive only. |
| `services/sathi/sathi-notification.dispatcher.ts` | Add `dispatchSaathiAmazonPayoutSuccess()` function. Existing dispatchers (ST-031, ST-032, ST-061) stay unchanged. | Zero — additive only. |
| `app/main.ts` | **No changes needed.** The sathi router already mounts at `/api/sathi`. Adding routes inside it is automatic. | Zero. |
| `.env.example` | Add `RAZORPAY_X_ACCOUNT_NUMBER=` placeholder under section 6 (alongside existing Razorpay keys). | Zero. |

### Database (`packages/database/prisma/schema.prisma`)

| Change | Details |
|---|---|
| Add `razorpayContactId String?` to `Volunteer` model | New optional field. No effect on any existing query. |
| Add new `VolunteerRedemption` model | Completely new table. No existing model or relation modified. |

### Mobile App (`apps/sathi-app/app/(sathi)/credits.tsx`)

| Change | Details |
|---|---|
| Add a third redemption option card "Amazon Pay Gift Card" to the existing `REDEEM` tab. | Existing `GIFT_CARD` and `UPI_TRANSFER` UI cards remain untouched. New card added below them. |
| Add Amazon redemption history items to the existing `HISTORY` tab. | Fetched from the new `GET /api/sathi/redemptions` endpoint. Rendered alongside existing credit transaction history. |

### Admin Panel (`apps/admin-frontend/src/app/pages/VolunteersPage.tsx`)

| Change | Details |
|---|---|
| Inside the existing Saathi Card in `VolunteersPage.tsx`, add a "Redemptions" section below the existing credits/stats display. | Shows a read-only table of `VolunteerRedemption` records for the selected volunteer. No other section of the page is modified. |

---

## 3. Database / Schema Changes (Prisma)

**File**: `packages/database/prisma/schema.prisma`

**A. Extension to `Volunteer` model** — one field added:
```prisma
model Volunteer {
  // ... all existing fields unchanged ...
  razorpayContactId String?              // New: stored once, reused on every payout
  redemptions       VolunteerRedemption[] // New: back-relation
}
```

**B. New Model `VolunteerRedemption`:**
```prisma
model VolunteerRedemption {
  id                    String    @id @default(uuid())
  volunteerId           String
  type                  String    @default("AMAZON_PAY_GIFT_CARD")  // extensible for future types
  amount                Float                                        // INR value e.g. 500
  creditsUsed           Float                                        // points deducted
  currency              String    @default("INR")
  status                String    @default("PENDING")
  // Status lifecycle: PENDING → PROCESSING → SUCCESS | FAILED | CANCELLED

  razorpayContactId     String?   // Razorpay Contact ID (may differ from Volunteer.razorpayContactId in edge cases)
  razorpayFundAccountId String?   // Razorpay Fund Account ID for Amazon wallet
  razorpayPayoutId      String?   // Razorpay Payout ID (set after payout API call)
  razorpayEventId       String?   @unique // Webhook event ID for idempotency
  idempotencyKey        String?   @unique // e.g. saathi-amazon-{uuid}
  failureReason         String?           // User-friendly failure message

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  completedAt           DateTime?

  volunteer             Volunteer @relation(fields: [volunteerId], references: [id])

  @@index([volunteerId, status])
  @@index([razorpayPayoutId])
  @@map("volunteer_redemptions")
}
```

**Prisma Migration**: Run `prisma migrate dev --name add_volunteer_redemption_amazon_payout` to generate and apply the migration.

---

## 4. API Endpoints to be Added

All new endpoints are mounted under `app.use('/api/sathi', sathiRouter)` which already exists in `main.ts`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/sathi/redemptions/amazon` | `authenticate` (Volunteer JWT) | Validates balance, atomically reserves credits, creates `VolunteerRedemption`, calls RazorpayX. Returns `{ status: 'PROCESSING', redemptionId }`. |
| `GET` | `/api/sathi/redemptions` | `authenticate` (Volunteer JWT) | Returns the volunteer's `VolunteerRedemption` history, sorted by `createdAt` desc. |
| `POST` | `/api/sathi/webhooks/razorpay-payout` | None (Razorpay signature verified internally) | Receives `payout.processed`, `payout.reversed`, `payout.failed` events. Updates redemption status and releases credits if failed. |

**Request body for `POST /api/sathi/redemptions/amazon`:**
```json
{ "amount": 500 }
```
Backend derives `creditsUsed` from `amount` using the existing `VOLUNTEER_CREDIT_CONVERSION_RATE` system config.

**Validation rules** (server-side only, mobile not trusted):
- `amount` must be a positive integer.
- `amount` must be ≤ ₹10,000.
- Volunteer's `totalCreditPoints` × conversion rate must cover `amount`.
- A volunteer cannot have more than one active `PENDING` or `PROCESSING` redemption at a time (enforced by DB check + unique constraint on `idempotencyKey`).

---

## 5. Mobile Screens / Components to be Changed

**File**: `apps/sathi-app/app/(sathi)/credits.tsx` (the **only** file to modify in the mobile app)

### 5A. REDEEM Tab — New Amazon Pay Gift Card card
- Placed below the existing `GIFT_CARD` and `UPI_TRANSFER` redemption cards.
- The form collects only the `amount` in ₹ (phone number is pre-filled from the volunteer's profile).
- Calls `POST /api/sathi/redemptions/amazon`.
- Reuses existing `confirmModal`, `successModal`, and `alertModal` state already in the screen.
- **No new state variables or modals needed.** The existing modal pattern handles confirmation and result display.

### 5B. HISTORY Tab — Amazon redemption history items
- The existing `HISTORY` tab already shows `VolunteerCreditTransaction` records.
- A new sub-section "Razorpay Payouts" is added to the same tab, rendering items from `GET /api/sathi/redemptions`.
- Each item displays: Amazon Pay Gift Card label, ₹Amount, Status badge (Processing / Successful / Failed), and Date.
- **No new tab created.** Seamlessly integrated into the existing History tab.

---

## 6. Admin Panel Changes

**File**: `apps/admin-frontend/src/app/pages/VolunteersPage.tsx` (the **only** file to modify in the admin panel)

### Change: Redemptions Section inside the existing Saathi Card

When an admin opens a volunteer's details in the `VolunteersPage.tsx` Saathi card, a new **"Redemptions"** accordion/section will appear below the existing credits and visit history sections.

**Section Title**: "Amazon Pay Redemption History"

**Table Columns (read-only)**:

| Column | Source |
|---|---|
| Redemption ID | `VolunteerRedemption.id` (short) |
| Date | `VolunteerRedemption.createdAt` |
| Amount | `VolunteerRedemption.amount` (e.g. ₹500) |
| Credits Used | `VolunteerRedemption.creditsUsed` |
| Status | `VolunteerRedemption.status` badge (PROCESSING / SUCCESS / FAILED / CANCELLED) |
| Razorpay Payout ID | `VolunteerRedemption.razorpayPayoutId` |
| Completed At | `VolunteerRedemption.completedAt` |
| Failure Reason | `VolunteerRedemption.failureReason` |

**Permissions**: Read-only. No admin action buttons on this table (consistent with the requirement that payout status must come only from Razorpay webhooks).

---

## 7. Environment Variables Required

The existing `apps/api/.env.example` already has the following under **section 6**:
```env
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

**Only one new variable** needs to be added to `.env.example`:
```env
# Required for RazorpayX Payouts — your current account number on RazorpayX
RAZORPAY_X_ACCOUNT_NUMBER=
```

You will paste real values into the server's `.env` file manually. Nothing is committed to Git.

---

## 8. Razorpay Configuration Required

1. **Existing Razorpay credentials** (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`) will be reused by `razorpay_payout_service.ts` for basic auth to the RazorpayX APIs. No new API keys needed — same credentials work for both Payment Gateway and RazorpayX.
2. **Amazon Pay Wallet enablement**: Verify in the RazorpayX Dashboard under **Payout Wallets** that Amazon Pay wallet payouts are activated for the account.
3. **RazorpayX Account Number**: Copy the current account number from the RazorpayX Dashboard → **My Account → Current Account**. Add to `.env` as `RAZORPAY_X_ACCOUNT_NUMBER`.

### RazorpayX API Flow (Amazon Payout):
1. `POST https://api.razorpay.com/v1/contacts` → create Contact (stored as `Volunteer.razorpayContactId`)
2. `POST https://api.razorpay.com/v1/fund_accounts` → create Fund Account with `account_type: 'wallet'`, `wallet: { provider: 'amazonpay', phone: '<volunteer_phone>' }` (stored on the `VolunteerRedemption` record)
3. `POST https://api.razorpay.com/v1/payouts` → create Payout with `fund_account_id`, `amount` in paise, `currency: 'INR'`, `mode: 'amazonpay'`, `purpose: 'payout'`, and `X-Payout-Idempotency: saathi-amazon-{redemptionId}` header.

---

## 9. Webhook Configuration Required

A new dedicated webhook endpoint is required for RazorpayX payout events. The existing payments webhook (`/api/payments/...`) is proxied to `admin-backend` for subscriber payment gateway events and **must not be reused** (different secrets, different handlers).

1. Go to **RazorpayX Dashboard → Webhooks → Create new webhook**.
2. Set URL to: `https://<YOUR_API_DOMAIN>/api/sathi/webhooks/razorpay-payout`
3. Add a Webhook Secret (store as `RAZORPAY_WEBHOOK_SECRET` in `.env`).
4. Subscribe to events:
   - `payout.processed`
   - `payout.reversed`
   - `payout.failed`

**Webhook Handler Behaviour**:
- Verify `x-razorpay-signature` using `RAZORPAY_WEBHOOK_SECRET`.
- Extract `razorpayEventId` from the event payload.
- Look up `VolunteerRedemption` by `razorpayPayoutId`.
- **Idempotency check**: If `VolunteerRedemption.razorpayEventId === incomingEventId`, respond with `200 OK` and skip processing.
- `payout.processed` → set `status = SUCCESS`, set `completedAt`, send WhatsApp + Email notification.
- `payout.reversed` or `payout.failed` → set `status = FAILED`, set `failureReason`, run `prisma.$transaction` to restore `totalCreditPoints` and log a `VolunteerCreditTransaction` (type: `adjustment`, description: `Amazon payout failed — credits restored`). Send WhatsApp notification.

---

## 10. Notifications Plan (WhatsApp + Email)

Leverages the **existing notification infrastructure** (`notificationProducer.publish()` + `sathi-notification.dispatcher.ts`).

| Trigger | Channel | Message |
|---|---|---|
| `POST /redemptions/amazon` received | In-App + Push (ST-031 already exists) | "Your Amazon Pay Gift Card redemption for ₹X is being processed." |
| `payout.processed` webhook | **WhatsApp** + **Email** (new dispatcher `dispatchSaathiAmazonPayoutSuccess`) | "₹[Amount] has been credited to your Amazon Pay Gift Card wallet linked to [Phone]. Saathi Credits redeemed: [Credits]." |
| `payout.failed` webhook | **WhatsApp** + In-App | "We couldn't process your Amazon Pay Gift Card redemption. Your [Credits] credits have been restored to your account." |
| Admin alert | In-App (ST-061 already exists) | "Saathi [Name] redeemed [Credits] credits for Amazon Pay Gift Card (₹[Value])." |

---

## 11. Tests to be Performed

Using Razorpay Test API Keys and test Amazon Pay wallet phone number:

- [ ] Backend loads `razorpay_payout_service.ts` without errors on startup.
- [ ] `POST /api/sathi/redemptions/amazon` with invalid JWT returns `401`.
- [ ] `POST /api/sathi/redemptions/amazon` with `amount: 0` returns `400`.
- [ ] `POST /api/sathi/redemptions/amazon` with amount exceeding credit balance returns `400`.
- [ ] `POST /api/sathi/redemptions/amazon` with `amount > 10000` returns `400`.
- [ ] Valid request creates `VolunteerRedemption` with `status: PROCESSING` and deducts `totalCreditPoints` atomically.
- [ ] Submitting duplicate request while first is `PROCESSING` returns a graceful error (no second payout created).
- [ ] Razorpay Contact is **reused** if `Volunteer.razorpayContactId` already exists.
- [ ] Fund Account is created per redemption (Amazon wallet is linked to volunteer's phone number).
- [ ] Idempotency key sent to Razorpay is `saathi-amazon-{redemptionId}`.
- [ ] Simulated network timeout retry reuses same idempotency key and does not create a duplicate payout.
- [ ] Webhook with valid signature and `payout.processed` updates `status: SUCCESS`, fires WhatsApp notification.
- [ ] Webhook with valid signature and `payout.failed` updates `status: FAILED`, restores credits, fires WhatsApp notification.
- [ ] Duplicate webhook (same `razorpayEventId`) is safely ignored (returns `200`, no state change).
- [ ] Webhook with invalid signature returns `400` (rejected).
- [ ] `GET /api/sathi/redemptions` returns correct history for the authenticated volunteer only.
- [ ] Admin panel Saathi card correctly shows redemption history table for a selected volunteer.
- [ ] No Razorpay secrets are present in any API response body or log output.
- [ ] All existing `POST /api/sathi/credits/redeem` (GIFT_CARD, UPI_TRANSFER) flows continue to work unchanged.

---

## 12. Test Results

*(To be populated after implementation and testing phase.)*

---

## 13. Remaining Manual Setup

After implementation is complete, the following manual steps are required before going live:

1. **Paste credentials** into the server's `.env` file:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET` (from RazorpayX Webhook creation step)
   - `RAZORPAY_X_ACCOUNT_NUMBER` (from RazorpayX Dashboard → My Account)
2. **Activate Amazon Pay wallet payouts** in the RazorpayX Dashboard.
3. **Register the webhook URL** in the RazorpayX Dashboard (see Section 9).
4. **Run the Prisma migration** on the production database: `prisma migrate deploy`.
5. **Ensure the RazorpayX account has sufficient balance** to service incoming payout requests.
