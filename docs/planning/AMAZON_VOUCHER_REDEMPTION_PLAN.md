# Comprehensive R&D & Implementation Plan: Amazon Pay Voucher Redemption for Saathi App

**Author:** Engineering & Product R&D  
**Target Platform:** Mai-Hoonaa (Saathi App, API Backend, Admin Portal)  
**Date:** March 2025 / Local: September 2026  
**Status:** Proposal / Ready for Senior Review  

---

## 1. Executive Summary

In the **Mai-Hoonaa Saathi App**, volunteers ("Saathis") earn credits by performing companion visits and community care hours. Currently:
- The system values credits at **1 Credit = ₹10** (via `VOLUNTEER_CREDIT_CONVERSION_RATE`).
- Redemption is currently limited to UPI transfers and generic placeholder gift codes.

Introducing **Amazon Pay Gift Cards / Vouchers** provides the highest perceived value and instant utility for Saathis. Unlike standard shopping vouchers, Amazon Pay balance in India can be used for:
- Everyday essentials & grocery delivery (Amazon Fresh)
- Mobile recharges, DTH, utility bill payments (Electricity, Water, Gas Cylinder)
- Medicine purchases (Amazon Pharmacy)
- Millions of physical products on Amazon.in

This R&D document details the procurement models, business economics, minimum claim amounts, technical integration architecture, end-user redemption workflows, security/fraud controls, and a phased rollout plan.

---

## 2. Procurement Models: What We Need from Amazon / Partners

There are two primary approaches to procure and issue Amazon Pay Gift Vouchers programmatically:

### Option A: B2B Gift Card Aggregator APIs (Recommended for MVP & Fast Go-Live)
Partners like **Xoxoday (Plum API)**, **Qwikcilver / Pine Labs**, or **Woohoo / Gyftr**.

* **How it works:** You create a corporate account with the aggregator, deposit a prepaid wallet balance (float), and integrate their REST API. When a Saathi redeems credits, your backend calls their endpoint (`POST /v1/orders`) which instantly generates a valid Amazon Pay 16-character gift card claim code.
* **Requirements:**
  1. Company KYC: Certificate of Incorporation, Company PAN, GST Certificate, Authorized Signatory ID.
  2. Master Service Agreement (MSA) with the aggregator (turnaround: 2–4 business days).
  3. Pre-funded escrow/wallet deposit (e.g., initial float of ₹25,000 – ₹50,000).
* **Key Advantages:**
  - **No large annual commitment** (low entry barrier).
  - **Corporate discounts:** Typically 1.0% to 2.5% discount on face value (saving Mai-Hoonaa money).
  - Production-ready SDKs and sandbox environments for immediate developer testing.
  - Multi-brand option in the future (Flipkart, Swiggy, Zomato, Croma) via the same single API.

---

### Option B: Direct Amazon Pay Incentives API (Amazon Gift Code On Demand - AGCOD)
Direct partnership with Amazon India Corporate Gift Cards division.

* **Requirements:**
  1. Corporate Onboarding: High-volume enterprise contract with Amazon Seller Services / Amazon Pay India.
  2. Minimum Annual Commitment: Typically requires committing to high monthly volumes (often ₹5 Lakhs – ₹10 Lakhs+ per month).
  3. Dedicated Security Review & Brand Guidelines approval from Amazon before displaying their logo.
  4. Prepaid Account Float with Amazon India.
* **When to use:** Ideal when the Saathi ecosystem reaches scale (>5,000 monthly active Saathis redeeming >₹10 Lakhs/month).

---

### Option C: Bulk Offline Pre-purchase (Instant Pilot / No-Code Phase 1)
* Purchase a batch of 50–100 Amazon Pay vouchers in bulk from Amazon Corporate or an authorized distributor as an Excel/CSV file containing Voucher Codes.
* Upload the encrypted codes to Mai-Hoonaa database as an inventory pool.
* When a Saathi hits "Redeem", your backend picks an unused code from the pool and marks it `REDEEMED`.
* **Pros:** Can launch in 48 hours without waiting for API approval.

---

## 3. Economics, Denominations & Claim Rules

### Current System Baseline
- Base Rate: **1 Credit = ₹10** (Configurable in `system_config` table).
- Saathi earning rate: Typically 10–20 credits per completed visit/milestone (equivalent to ₹100–₹200).

### Recommended Denomination Structure
To optimize API transaction fees and provide realistic, motivating milestones:

| Tier | Required Credits | Voucher Value | Recommended Use Case |
| :--- | :--- | :--- | :--- |
| **Starter** | **10 Credits** | **₹100** | Quick gratification milestone (e.g., mobile recharge) |
| **Standard** | **25 Credits** | **₹250** | Common monthly redemption |
| **Popular** | **50 Credits** | **₹500** | Most popular household shopping denomination |
| **Super Saathi** | **100 Credits** | **₹1,000** | For high-engagement/star companions |

### Minimum Claim Threshold
- **Recommended Minimum:** **10 Credits (₹100 voucher)**.
- *Rationale:* Issuing ₹10 or ₹20 vouchers creates micro-transaction overhead and high API per-call costs. ₹100 is standard across Indian reward platforms (Google Pay, Cred, PhonePe) and ensures meaningful utility for the Saathi.

### Validity & Expiry
- Amazon Pay Gift Cards issued in India are governed by RBI Prepaid Payment Instrument (PPI) regulations and have a validity of **365 days (1 year)** from the date of issuance.
- Once added to the user's Amazon account, the balance stays valid for 1 year from the addition date.

---

## 4. End-to-End User Experience (How Saathis Claim & Use)

### Step 1: In-App Claim Flow (Saathi App)
1. Saathi navigates to **Credits** tab in the Saathi App (`credits.tsx`).
2. Sees their available balance (e.g., `45 Credits = ₹450 available`).
3. Selects **Amazon Pay Gift Card** card.
4. Chooses an active denomination chip: `₹100 (10 pts)` or `₹250 (25 pts)`.
5. Taps **Redeem Now**.
6. Confirmation modal summarizes: *"Redeem 25 credits for a ₹250 Amazon Pay Gift Card? Delivered instantly."*
7. On confirmation, credits are deducted, and the voucher is generated in real-time.

### Step 2: Instant Receipt & Multi-Channel Delivery
1. **On-Screen Modal:** Displays the 16-character alphanumeric claim code (e.g., `E3R9-K98X2P-74QL`) with a **"Tap to Copy"** button and an **"Add directly to Amazon"** button.
2. **Push & In-App Notification:** ST-032 notification sent to their Saathi app inbox.
3. **SMS / WhatsApp Message:** Triggered via existing notification dispatcher:
   > *"Congratulations [Name]! Here is your ₹250 Amazon Pay Voucher: E3R9-K98X2P-74QL. Click to add to Amazon: https://amazon.in/addgiftcard. Thank you for your service with Mai-Hoonaa!"*
4. **Vouchers History Tab:** The code and date remain visible in the Saathi app under the **Vouchers** tab so they can never lose it.

### Step 3: How the Saathi Adds & Spends the Voucher on Amazon
1. Open the Amazon app on their phone or go to `amazon.in/addgiftcard`.
2. Tap **Amazon Pay** -> **Add a Gift Card**.
3. Paste the 16-digit Claim Code and tap **Add to your balance**.
4. Balance instantly updates.
5. Saathi can immediately spend this balance at checkout for groceries, utility payments, or shopping.

---

## 5. Technical Implementation Architecture

### A. Database Modifications (`packages/database/prisma/schema.prisma`)

Enhance `VolunteerRewardCoupon` and `VolunteerRewardOption`:

```prisma
// Expand VolunteerRewardCoupon to store external voucher attributes
model VolunteerRewardCoupon {
  id              String                 @id @default(uuid())
  code            String                 @unique // Voucher Claim Code (Encrypted at rest if sensitive)
  provider        String                 @default("INTERNAL") // 'INTERNAL' | 'AMAZON_DIRECT' | 'XOXODAY' | 'PINE_LABS'
  referenceId     String?                // Partner order/transaction ID
  pin             String?                // Gift card PIN if provider requires PIN
  expiryDate      DateTime?
  volunteerId     String
  rewardOptionId  String?
  pointsRedeemed  Int
  valueRs         Float
  status          String                 @default("ACTIVE") // 'ACTIVE' | 'CLAIMED' | 'FAILED' | 'REVOKED'
  claimUrl        String?                // Direct deep link to add to Amazon
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  volunteer       Volunteer              @relation(fields: [volunteerId], references: [id])
  rewardOption    VolunteerRewardOption? @relation(fields: [rewardOptionId], references: [id])

  @@map("volunteer_reward_coupons")
}
```

### B. Backend Voucher Service (`apps/api/app/services/rewards/amazon_voucher_service.ts`)

Implements:
1. **Idempotency Check:** Prevents duplicate issuance if user double-taps or network retries.
2. **Provider Dispatcher:** Calls Aggregator API (e.g. Xoxoday/Pine Labs) or pulls from local secure inventory.
3. **Credit Balance Deduction:** Wrapped in `prisma.$transaction` to guarantee financial safety.
4. **Failure Recovery:** If the external API fails, the transaction rolls back and the user's credits are not lost.

### C. Admin Portal Controls (`apps/admin-frontend` & `apps/admin-backend`)
- **Float Balance Tracker:** Displays current available wallet balance in the partner API account with an alert when the float drops below ₹5,000.
- **Redemption Logs:** Filter vouchers by Saathi, denomination, date, and status.
- **Manual Resend Tool:** Ability for coordinators to resend voucher details to Saathi via SMS/WhatsApp in case of phone change.

---

## 6. Security, Risk & Fraud Controls

1. **KYC & Volunteer Status Validation:** Only Saathis with `status = 'APPROVED'` and completed background verification can redeem gift cards.
2. **Velocity Limits (Anti-Draining):**
   - Maximum 1 redemption per 24 hours per Saathi.
   - Maximum ₹2,000 total voucher claims per month without coordinator manual review.
3. **Idempotency Keys:** Unique UUID per redemption attempt to prevent race conditions.
4. **Secret Storage:** Provider API Keys and float credentials stored securely in environment secrets (`.env`), never exposed to frontend clients.
5. **Code Obfuscation:** Mask claim codes in logs (`E3R9-****-****-74QL`).

---

## 7. Phased Implementation Roadmap

### Phase 1: Rapid Pilot (Days 1 – 5)
- Purchase ₹10,000 worth of Amazon Pay voucher codes in denominations of ₹100, ₹250, and ₹500.
- Store codes in an encrypted inventory table in Mai-Hoonaa database.
- Update `credits.tsx` in Saathi App with Amazon Pay option.
- Test end-to-end claim and copy flow with 5–10 active Saathis.

### Phase 2: Production API Automation (Week 2 – 3)
- Complete commercial onboarding with B2B aggregator (Xoxoday Plum / Qwikcilver).
- Implement automated API order dispatching in `sathi_service.ts`.
- Integrate deep-link URL (`amazon://` and `https://amazon.in/addgiftcard?claimCode=...`).
- Enable automated low-float alerts for the admin finance team.

### Phase 3: Scale & Multi-Brand Rewards (Month 2+)
- Expand options based on Saathi feedback (Flipkart, BigBasket, Swiggy).
- Evaluate Direct Amazon Incentives API agreement once monthly volume crosses ₹5,00,000.

---

## 8. Summary Checklist to Present to Senior

| Item | Proposal Detail |
| :--- | :--- |
| **Partner Needed** | Xoxoday Plum API or Qwikcilver (Phase 1/2) -> Direct Amazon AGCOD (Phase 3) |
| **Procurement Model** | Corporate pre-funded float account with 1.5–2% corporate discount |
| **Starting Minimum** | **10 Credits = ₹100** voucher |
| **Denominations** | ₹100, ₹250, ₹500, ₹1,000 |
| **Delivery Channels** | Instant In-App Copy + WhatsApp/SMS notification + Persistent Vouchers Tab |
| **How Saathi Uses It**| Directly paste 16-digit code into Amazon App -> Amazon Pay Balance (valid 365 days) |
| **Tech Readiness** | Leverages existing `VolunteerRewardOption` and `VolunteerRewardCoupon` schema |
