# Invoice Generation & Discount Calculation Architecture & Fixes

## 1. Executive Summary & Problem Analysis

### 1.1 The Issue
Subscribers completing package checkout observed a discrepancy between the amounts displayed on the checkout screen and the generated PDF/HTML invoice:
- **Checkout Screen**:
  - Package Base + Tax: ₹15,000 + ₹2,700 = ₹17,700.00
  - Duration Discount (3 Months / 5%): -₹885.00
  - Promo Coupon: -₹300.00
  - Total Discount: -₹1,185.00
  - Saathi Discount: -₹1,000.00
  - Combined Discount: -₹2,185.00
  - Add-ons + Tax: Included
  - Total Payable: Exact net payable
- **Generated Invoice (Prior to Fix)**:
  - Total Discount showed **-₹1,050.00** instead of -₹1,185.00 or -₹2,185.00.
  - Line items had strange fractional prices (e.g. ₹15,000 showed as ₹14,003.80).
  - Tax Amount was under-reported (₹2,520.68 instead of ₹2,700.00+).
  - Saathi Discount of ₹1,000.00 was completely absent from the calculation.

---

## 2. Root Cause Analysis

### 2.1 Math Desync: Pre-Tax vs. Post-Tax Discounts
1. **Frontend (`checkout.tsx`)**:
   - Computes package price **post-tax** (MRP/Gross including GST).
   - Applies the duration discount (5% for 3 months) on the gross package price:
     $$\text{Duration Discount} = \frac{17,700 \times 5}{100} = 885.00$$
   - Promo coupon (`₹300.00`) is subtracted directly from gross payable.
   - Total Discount = $885 + 300 = 1,185.00$.

2. **Backend Engine (`subscription_service.ts` - Previous)**:
   - Passed `discountAmount` (which had pre-tax duration $15,000 - 14,250 = 750$ plus promo coupon $300 = 1,050$) into `calculateItemizedInvoice(taxItems, discountAmount, ...)`.
   - `calculateItemizedInvoice` distributed the ₹1,050 discount proportionally across the item unit prices *before* calculating GST.
   - This caused:
     - Base item price dropped: $15,000 \to 14,003.80$.
     - GST dropped from 18% of 15,000 (₹2,700) to 18% of 14,003.80 (₹2,520.68).
     - The invoice total discount printed ₹1,050 instead of ₹1,185.

### 2.2 Ignored Saathi Coupon in `/purchase`
- In `subscriptions.routes.ts`, `saathiCouponCode` was not extracted from `req.body` in the `/purchase` endpoint, causing the Saathi discount to be omitted when creating the invoice and payment records.

### 2.3 Stale Backend In-Memory Process
- The API process was running `node dist/app/run.js` (PID `24199`) loaded in memory since 2:59 PM.
- An attempted `npm run restart` failed because `package.json` had no `restart` script. As a result, the old process continued serving HTTP requests without picking up updated TypeScript changes.

---

## 3. Architecture & Implementation Fixes

### 3.1 Backend Tax & Discount Engine (`subscription_service.ts`)

#### 1. Full Pre-Tax Preservation
Items are sent to `calculateItemizedInvoice` with **0 initial discount**. This ensures:
- Full line-item unit prices are preserved (e.g. ₹15,000.00, ₹498.00, ₹100.00).
- Legally compliant SAC/HSN GST calculation across all items without artificial rounding distortions.

```typescript
// Calculate raw itemized invoice at 0 discount first
const invoiceCalc = calculateItemizedInvoice(taxItems, 0, customerState, 'Haryana');
```

#### 2. Exact Post-Tax Duration Discount Calculation
```typescript
// Calculate the post-tax package total (gross)
const packageItems = invoiceCalc.items.filter(i => !i.description.startsWith('Add-on:'));
const packageGrossPrice = packageItems.reduce((acc, curr) => acc + curr.amount + curr.tax, 0);

let durationDiscountPct = 0;
if (!(subPackage as any).isFreeTrial) {
  if (months === 3) durationDiscountPct = Number(subPackage.discountThreeMonths ?? 5);
  else if (months === 6) durationDiscountPct = Number(subPackage.discountSixMonths ?? 10);
  else if (months >= 12) durationDiscountPct = Number(subPackage.discountAnnual ?? 20);
}

// Exact match for frontend duration discount
const durationDiscount = Math.round((packageGrossPrice * durationDiscountPct) / 100 * 100) / 100;

// Extract coupon discount
const preTaxDuration = Math.max(0, (subPackage.basePrice * months) - packageBasePrice);
const couponDiscount = Math.max(0, discountAmount - preTaxDuration);

// Combine duration + coupon
const finalDiscountAmount = durationDiscount + couponDiscount;
```

#### 3. Total Amount Enforced
```typescript
totalAmount: Math.max(0, invoiceCalc.totalAmount - finalDiscountAmount - saathiDiscountAmount)
```

---

### 3.2 Invoice PDF & HTML Renderers

Both `InvoiceGenerator.ts` (React Native mobile PDF renderer) and `invoice.html.renderer.ts` (API HTML renderer) were updated with an explicit discount breakdown:

```html
<table class="totals-table">
  <tr>
    <td>Total Amount</td>
    <td>₹${totalBeforeDiscount.toFixed(2)}</td>
  </tr>
  ${discountAmount > 0 ? `
  <tr>
    <td>Discount</td>
    <td>-₹${discountAmount.toFixed(2)}</td>
  </tr>
  ` : ''}
  ${saathiDiscountAmount > 0 ? `
  <tr>
    <td>Saathi Discount</td>
    <td>-₹${saathiDiscountAmount.toFixed(2)}</td>
  </tr>
  ` : ''}
  ${(discountAmount > 0 && saathiDiscountAmount > 0) ? `
  <tr>
    <td style="font-weight: 600;">Total Discount</td>
    <td style="font-weight: 600;">-₹${(discountAmount + saathiDiscountAmount).toFixed(2)}</td>
  </tr>
  ` : (discountAmount > 0 || saathiDiscountAmount > 0) ? `
  <tr>
    <td>Total Discount</td>
    <td>-₹${(discountAmount + saathiDiscountAmount).toFixed(2)}</td>
  </tr>
  ` : ''}
  <tr class="bold">
    <td>Total Payable Amount</td>
    <td>₹${totalAmount.toFixed(2)}</td>
  </tr>
</table>
```

### Key UI Benefit:
Subscribers and auditors can immediately see:
1. Nominal gross amount before discount.
2. Standard package & promo discount.
3. Dedicated **Saathi Discount** line.
4. Total Discount summing both deductions.
5. Final Net Payable Amount matching Razorpay receipts.

---

## 4. Retroactive Database Reconciliation

Existing test invoices (`00063`, `00064`, `00065`, `00066`, and `00067`) and their respective line items in `invoice_items` were reconciled directly in PostgreSQL:
- Line item `amount` values restored to full nominal rates (₹15,000, ₹498, ₹300, ₹12).
- `discountAmount` aligned to ₹1,185.00 (`885 + 300`).
- `saathiDiscountAmount` aligned to ₹1,000.00.
- `totalAmount` aligned to ₹16,452.68.
- `taxAmount` set to ₹2,827.68.

This ensures existing downloads from the user's Order History immediately render with 100% accurate accounting.

---

## 5. Process & Deployment Commands

To ensure no stale processes remain bound:

```bash
# 1. Kill any zombie API processes on port 8001
kill -9 $(lsof -t -i :8001) 2>/dev/null || true

# 2. Navigate to API workspace
cd /Users/puneet/Desktop/MHN/apps/api

# 3. Development Mode (hot reloading TypeScript directly)
npm run dev

# 4. Production Mode (clean build & launch)
npm run build && npm run start
```
