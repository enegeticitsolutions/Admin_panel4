# Promo Coupon & Saathi Coupon Implementation Plan & Documentation

## 1. Overview
This document outlines the planning, architecture, user experience, and technical implementation for both **Regular Promo Coupons** and **Saathi (Volunteer Reward) Coupons** across the mobile subscriber app and the backend API.

---

## 2. Business Requirements & User Experience

### 2.1 Regular Promo Coupons
- Subscribers can enter promotional discount codes (e.g., `WELCOME10`, `FLAT300`) during package checkout.
- Coupons are validated against database eligibility rules:
  - First-time subscriber checks.
  - Expiry dates (`validFrom`, `validTo`).
  - Minimum purchase thresholds and maximum discount caps.
  - Package type restrictions.

### 2.2 Saathi (Volunteer Reward) Coupons
- Community volunteers/Saathis earn reward points through activities and can redeem them for cash-value gift coupons (`MHN-GIFT-XXXX-XXXX`).
- These coupons are stored in `volunteer_reward_coupons` with:
  - `valueRs`: Flat rupee discount (e.g., ₹50, ₹100, ₹1000).
  - `status`: `'ACTIVE' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'`.
- Subscribers can apply a Saathi Coupon in addition to their package duration discount and promo coupon.

### 2.3 Mobile App Checkout UI/UX Requirements (`checkout.tsx`)
1. **Orange Hyperlink Toggle**:
   - Replaced default purple/button styling with an **orange hyperlink text**: `"Have a Saathi Coupon?"`.
   - Tapping the hyperlink reveals the input container with an input box and an "Apply" button.
2. **Confidentiality / Labeling**:
   - Once applied, the coupon code string is masked from the price summary.
   - It is explicitly labeled as **`Saathi Discount`** (with a green `-₹1000.00` badge) rather than displaying raw internal codes.
3. **No State Overwrites**:
   - Separated `durationDiscount`, `couponDiscount`, and `saathiDiscountApplied` in `checkout.tsx` state so multi-month discounts (e.g. 5% = ₹885) are not overwritten by promo discounts (e.g. ₹300).

---

## 3. Database Schema

### 3.1 `VolunteerRewardCoupon` Model (`schema.prisma`)
```prisma
model VolunteerRewardCoupon {
  id              String                 @id @default(uuid())
  code            String                 @unique // e.g. MHN-GIFT-4F01-6922
  volunteerId     String                 // FK -> Volunteer.id
  rewardOptionId  String?                // FK -> VolunteerRewardOption.id
  pointsRedeemed  Int
  valueRs         Float
  status          String                 @default("ACTIVE") // 'ACTIVE' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'
  claimedAt       DateTime?
  claimedByUserId String?                // FK to User who redeemed it
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt
  volunteer       Volunteer              @relation(fields: [volunteerId], references: [id])
  rewardOption    VolunteerRewardOption? @relation(fields: [rewardOptionId], references: [id])

  @@map("volunteer_reward_coupons")
}
```

### 3.2 Invoice & Payment Linkage
- `Invoice`: Added `saathiCouponCode String?` and `saathiDiscountAmount Float @default(0)`.
- `Payment`: Added `saathiCouponCode String?` and `saathiDiscountAmount Float @default(0)`.

---

## 4. Backend Implementation

### 4.1 Subscription Routes (`apps/api/app/api/subscriber/subscriptions.routes.ts`)

#### 1. `calculatePricing` Function
- Extended signature to accept `saathiCouponCode?: string`.
- Queries `volunteer_reward_coupons` for `code.trim().toUpperCase()`.
- Validates:
  - Existence of coupon.
  - Status must be `'ACTIVE'`.
- Deducts `Math.min(coupon.valueRs, subtotalPayable)` from payable amount.
- Returns `saathiDiscountApplied`, `saathiCouponValid`, and `saathiCouponMessage`.

#### 2. `POST /subscriber/subscriptions/checkout/preview`
- Parses `saathiCouponCode` from `req.body`.
- Passes to `calculatePricing`.
- Sends back real-time validation response and discount amounts to the mobile app.

#### 3. `POST /subscriber/subscriptions/create-order`
- Includes `saathiCouponCode` in pricing calculation to generate the Razorpay Order with the exact net payable amount.

#### 4. `POST /subscriber/subscriptions/purchase`
- Extracts `saathiCouponCode` from `req.body`.
- Forwards to `subscriptionService.purchaseSubscription`.

---

### 4.2 Subscription Service (`apps/api/app/services/subscriber/subscription_service.ts`)

#### 1. Pre-Payment Validation
```typescript
let saathiDiscountAmount = 0;
if (saathiCouponCode) {
  const code = saathiCouponCode.trim().toUpperCase();
  const saathiCoupon = await prisma.volunteerRewardCoupon.findUnique({
    where: { code }
  });
  if (saathiCoupon && saathiCoupon.status === 'ACTIVE') {
    saathiDiscountAmount = Math.min(saathiCoupon.valueRs, finalAmountPaid);
    finalAmountPaid -= saathiDiscountAmount;
  }
}
```

#### 2. Atomic Coupon Claiming inside `$transaction`
Upon successful subscription creation:
```typescript
if (saathiCouponCode && saathiDiscountAmount > 0) {
  const code = saathiCouponCode.trim().toUpperCase();
  await tx.volunteerRewardCoupon.update({
    where: { code },
    data: {
      status: 'CLAIMED',
      claimedByUserId: userId,
      claimedAt: new Date()
    }
  });
}
```

#### 3. Audit Trails
- Recorded `saathiCouponCode` and `saathiDiscountAmount` on both the `Invoice` and `Payment` records for accounting and reconciliation.

---

## 5. Verification & Testing Checklist

- [x] **Saathi Code Validation**: Active code applies full rupee value (e.g. ₹1,000).
- [x] **Negative Balance Prevention**: If coupon value exceeds total payable amount, total floors at ₹0.
- [x] **Double-Redemption Protection**: After purchase, coupon status transitions to `'CLAIMED'`, rejecting subsequent redemption attempts.
- [x] **Combined Stacking**: Multi-month duration discount (e.g. ₹885) + Promo code (e.g. ₹300) + Saathi discount (e.g. ₹1,000) correctly sum to total discount (₹2,185).
- [x] **Mobile UI Display**: "Have a Saathi Coupon?" orange hyperlink opens input; badge displays "Saathi Discount" without showing code.
