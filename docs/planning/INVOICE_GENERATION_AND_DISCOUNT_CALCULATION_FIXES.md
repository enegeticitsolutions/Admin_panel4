# Invoice Generation & Discount Calculation Architecture & Fixes

> **Status:** Production-Ready & Verified  
> **Last Updated:** November 2026  
> **Core Package:** `@maihoonna/billing` (v1.0.0)  
> **Target Platforms:** Admin Backend, Admin Frontend, Consumer API, Mobile App (React Native)

---

## 1. Executive Summary & Statutory Principles

The MaiHoonNa platform generates statutory Indian Goods and Services Tax (GST) invoices for eldercare subscription packages, renewal cycles, and healthcare add-on services.

To ensure 100% legal compliance with **Section 15 of the Central Goods and Services Tax (CGST) Act, 2017**, and match leading industry tax invoice standards (such as Amazon Tax Invoices), the platform strictly enforces the following accounting invariants:

1. **Pre-Tax Discount Deductions (CGST Act Section 15(3)):**
   Discounts (including duration discounts, promo coupon codes, volume discounts, and Saathi rewards) are deducted **from the base taxable value before GST is calculated**. Tax is assessed exclusively on the discounted **Net Taxable Amount**, never on the pre-discount gross MRP.
2. **Pro-Rata Line Item Allocation:**
   When an order-level coupon (e.g., ₹300 off) or tenure discount is applied, it is proportionally distributed across each included line item (package and individual add-ons) using the **Largest Remainder Method** to ensure zero paisa drift.
3. **Multi-Bracket & Exemption Support:**
   Invoices seamlessly support mixed tax rates within the same invoice (e.g., 0% exempt healthcare consults, 12% medical equipment, 18% care procedures).
4. **Place of Supply (POS) Determination:**
   In accordance with the IGST Act, the Place of Supply is determined by comparing the customer/service location state against the company operating state (`COMPANY_STATE`, default: **Haryana / Code 06**):
   - **Intra-State:** Equal split between **CGST** and **SGST** (e.g., 9% + 9% for an 18% rate).
   - **Inter-State:** Single **IGST** (e.g., 18%).
5. **Exact Mathematical Reconciliation:**
   $$\text{Total Gross Amount} - \text{Total Discount} = \text{Net Taxable Amount}$$
   $$\text{Net Taxable Amount} + \text{Total Tax (CGST + SGST or IGST)} = \text{Grand Total (Payable)}$$
   This equality must hold true across the Admin Checkout preview, the Mobile App summary, the database records, the HTML renderer, and the downloaded A4 PDF.

---

## 2. Architecture & File Structure

The invoicing and pricing system is organized across a shared core billing library and consumed by four distinct platform layers:

```
MaiHoonNa Monorepo
├── packages/
│   └── billing/                             # Canonical Single Source of Truth
│       ├── src/core/
│       │   ├── calculator.ts                # Canonical BillingCalculator orchestrator
│       │   ├── discount.ts                  # DiscountAllocator (Pro-rata Largest Remainder)
│       │   ├── tax.ts                       # TaxEngine (CGST, SGST, IGST split & rules)
│       │   ├── money.ts                     # Money utility (Integer paise precision)
│       │   └── reconciliation.ts            # Invariant validator (strict validation)
│       ├── src/resolvers/
│       │   ├── tax-resolver.ts              # Tax category & HSN/SAC resolution
│       │   └── invoice-number.ts            # Indian FY sequential invoice generator
│       └── src/templates/
│           ├── invoice-html.ts              # Amazon 10-column statutory HTML layout
│           └── number-to-words.ts           # Indian currency to words (Crore/Lakh/Rupees)
│
├── apps/admin-backend/                      # Operations & CSA Enrollment Backend
│   ├── modules/invoices/
│   │   ├── invoice.engine.js                # Core invoice orchestration & persistence
│   │   ├── invoice.service.js               # Service façade (enrollment, renewal, top-ups)
│   │   ├── invoice.html.renderer.js         # Amazon-style 10-column HTML renderer
│   │   ├── invoice.pdf.service.js           # Headless Chrome (Puppeteer) A4 PDF generation
│   │   └── invoice.routes.js                # Secure invoice download & view routes
│   └── routes/subscriptions.js              # /calculate-price, /admin-enroll, /:id/renew
│
├── apps/admin-frontend/                     # Operations Web Portal
│   ├── src/app/utils/pricing.ts             # Client-side mirror calculation engine
│   ├── src/app/pages/EnrollmentWizardPage.tsx# Step 5 Checkout Wizard with discount table
│   ├── src/app/pages/RenewalWizardPage.tsx  # Renewal wizard with itemized discount table
│   └── src/services/api.ts                  # API contract typing (discounts & pricing)
│
├── apps/api/                                # Consumer & Mobile REST API
│   ├── app/services/subscriber/
│   │   └── subscription_service.ts          # Mobile purchase & renewal invoice generation
│   ├── app/services/invoice/
│   │   └── invoice_pdf.service.ts           # Customer PDF generation & presigned URLs
│   ├── app/services/invoice.html.renderer.ts# 10-column Amazon GST HTML renderer
│   └── app/services/storage/index.ts        # Cloud Storage abstraction (Supabase / AWS S3)
│
└── apps/mobile-app/                         # React Native (Expo) Mobile Client
    ├── app/(setup)/checkout.tsx             # Mobile checkout screen with pre-tax GST breakdown
    └── components/invoice/
        └── InvoiceGenerator.ts              # Client-side 10-column PDF preview generator
```

---

## 3. The 9-Step Calculation Workflow

Every calculation—whether rendered in the Admin Checkout screen, calculated on the mobile app, or written into the database during subscription enrollment—follows this deterministic pipeline:

```
Package Base Rate + Multi-Month Duration
                ↓
    Resolve Add-on Benefits (Qty, Rate, GST%)
                ↓
      Determine Gross Order Base Amount
                ↓
Calculate Total Pre-Tax Discounts (Coupons / Duration)
                ↓
  Allocate Discount Pro-Rata Across Line Items
                ↓
  Calculate Net Taxable Amount per Line Item
                ↓
  Compute GST (CGST/SGST or IGST based on State POS)
                ↓
Aggregate Multi-Bracket Tax Rows & Round to Paisa
                ↓
Enforce Invariant: Gross - Discount + Tax = Grand Total
```

### Step 1: Base Rate & Duration Discount
- For monthly subscriptions, `packageBasePrice` = base monthly rate of the package version.
- For multi-month packages (3, 6, 12 months):
  - If a package has an explicit override price (`priceThreeMonths`, `priceSixMonths`, `priceTwelveMonths`), that price is used directly.
  - Otherwise, proportional base = $\text{baseRate} \times \text{months}$, and the percentage duration discount is calculated:
    - 3 Months: 5% (or `discountThreeMonths`)
    - 6 Months: 10% (or `discountSixMonths`)
    - 12 Months: 20% (or `discountAnnual`)
  - The duration discount is subtracted from the proportional base to produce `finalBaseRateToDistribute` (net package base).

### Step 2: Add-on Benefits Resolution
- Each selected add-on benefit is resolved against the database:
  - Unit price: `addonDiscountPrice` ?? `addonPrice` ?? `0`.
  - Base amount: $\text{unitPrice} \times \text{units}$.
  - GST Rate: Configured rate from `Benefit` or its linked `TaxCategory` (default: 18%, or 0% if `isGstExempt`).
  - HSN/SAC Code: SAC `998399` (General) or `999312` (Healthcare services).

### Step 3: Gross Order Value Determination
$$\text{Gross Order Total} = \text{Package Base Price} + \sum \text{Addon Base Amounts}$$

### Step 4: Pre-Tax Order Discount (Coupons & Rewards)
- Coupons (e.g. `WELCOME20`, flat ₹300 or percentage capped) are validated against eligibility, expiration, and minimum order requirements.
- The validated coupon value represents the order-level pre-tax discount:
  $$\text{Total Order Discount} = \text{Coupon Discount Amount} + \text{Saathi Reward Amount}$$

### Step 5: Pro-Rata Pre-Tax Discount Allocation
In accordance with Section 15 of the CGST Act, order-level discounts must be apportioned among all chargeable line items so that GST is assessed on the true transaction value of each service:
$$\text{Item Weight} = \frac{\text{Item Gross Amount}}{\text{Gross Order Total}}$$
$$\text{Tentative Discount} = \text{Item Weight} \times \text{Total Order Discount}$$
The `DiscountAllocator` in `@maihoonna/billing` uses the **Largest Remainder Method (Hamilton/Hare)** with integer paise arithmetic:
1. Converts all rupees to integer paise (`amount * 100`).
2. Allocates integer paise based on the floor of the quotient.
3. Distributes any remaining fractional paise to the items with the largest fractional remainders.
4. Guarantees: $\sum \text{Item Allocated Discounts} \equiv \text{Total Order Discount}$ to the exact paisa.

### Step 6: Net Taxable Amount
For each line item:
$$\text{Net Taxable Amount} = \text{Gross Amount} - \text{Allocated Discount}$$

### Step 7: GST Assessment & State Splitting
Tax is computed on the **Net Taxable Amount**:
- If `isGstExempt` is true or `taxRate === 0`: Tax = ₹0.00.
- Otherwise:
  $$\text{Line Tax Amount} = \text{round}\left(\text{Net Taxable Amount} \times \frac{\text{GST Rate}}{100}\right)$$
- **Place of Supply (POS) Split:**
  - **Intra-State Supply** (`customerState.trim().toLowerCase() === companyState.toLowerCase()`):
    $$\text{CGST} = \text{round}\left(\frac{\text{Line Tax Amount}}{2}\right), \quad \text{SGST} = \text{Line Tax Amount} - \text{CGST}$$
    $$\text{IGST} = 0$$
  - **Inter-State Supply** (`customerState.trim().toLowerCase() !== companyState.toLowerCase()`):
    $$\text{IGST} = \text{Line Tax Amount}, \quad \text{CGST} = 0, \quad \text{SGST} = 0$$

### Step 8: Multi-Bracket Tax Aggregation
The engine groups items by their respective GST rate (0%, 5%, 12%, 18%, 28%) and aggregates the taxable amounts and taxes for the tax summary section.

### Step 9: Grand Total & Invariant Validation
$$\text{Grand Total} = \sum \text{Net Taxable Amount} + \sum \text{Line Tax Amount}$$
Before an invoice record is stored in PostgreSQL or returned to the client, `InvoiceReconciler.validate(snapshot)` executes an invariant audit:
- Total Gross − Total Discount == Net Taxable Amount
- Net Taxable Amount + CGST + SGST + IGST == Grand Total
- Razorpay integer paise == Grand Total × 100

---

## 4. Key Bug Fixes & Lessons Learned

### 4.1 Bug 1: The Double-Counting Discount Bug (₹554.24 instead of ₹300.00)

#### Symptoms:
A subscriber enrolled with package `Rehab physio` (₹10,000.00) and two add-ons (`+ Nursing procedure` ₹800.00 and `+ amlodipin` ₹1,000.00), applying promo coupon `WELCOME20` (₹300.00 discount).  
- On the **Admin Checkout Screen**, the total discount was correctly displayed as **-₹300.00** and Total Payable was **₹13,570.00**.
- But the **Generated Invoice** showed **Discount: -₹554.24**, Net Taxable ₹11,245.76, and Grand Total ₹13,270.01.

#### Root Cause:
1. `POST /api/subscriptions/calculate-price` computed the pro-rata allocation of the ₹300 coupon:
   - Rehab physio share: **₹254.24** ($10,000 / 11,800 \times 300$).
   - Nursing procedure share: **₹20.34**.
   - amlodipin share: **₹25.42**.
   - It returned `packageDiscount: 254.24` and `couponDiscount: 300.00`.
2. When the enrollment wizard submitted the form to `admin-enroll`, it forwarded both properties:
   `{ packageDiscount: 254.24, couponDiscount: 300.00 }`.
3. In `apps/admin-backend/routes/subscriptions.js`, the enrollment endpoint previously contained:
   ```javascript
   // BROKEN: Added the package's portion of the coupon to the coupon itself!
   discount = Math.round((explicitPackageDiscount + explicitCouponDiscount) * 100) / 100;
   // 254.24 + 300.00 = 554.24!
   ```
4. This ₹554.24 was passed to `generateSubscriptionInvoice`, which allocated ₹554.24 across all line items, causing the invoice to show ₹554.24 total discount instead of ₹300.00.

#### Solution:
- In `subscriptions.js` (`admin-enroll` and `renewal`), the logic was fixed:
  ```javascript
  let discount;
  if (isFree) {
    discount = 0;
  } else if (explicitTotalDiscount !== null) {
    discount = explicitTotalDiscount;
  } else if (explicitCouponDiscount > 0) {
    // The coupon discount applies across the order as a whole.
    // explicitPackageDiscount is already the package's pro-rata share of this coupon discount;
    // do NOT add explicitPackageDiscount + explicitCouponDiscount as that double-counts!
    discount = explicitCouponDiscount;
  } else if (explicitPackageDiscount !== null) {
    discount = explicitPackageDiscount;
  } else {
    discount = Math.round((computedDurDiscount + explicitCouponDiscount) * 100) / 100;
  }
  ```
- Both frontend wizard pages (`EnrollmentWizardPage.tsx` and `RenewalWizardPage.tsx`) now explicitly pass `totalDiscount: serverPricing.totalDiscount ?? couponDiscount`.

---

### 4.2 Bug 2: Post-Tax vs. Pre-Tax GST Calculation Distortion

#### Symptoms:
Earlier implementations calculated GST on the gross base amount and then subtracted discounts at the very end after tax:
$$\text{Gross Tax} = 10,000 \times 18\% = 1,800 \implies \text{Total} = 11,800 - 300 = 11,500$$
This caused tax under-reporting and violated Section 15 of the CGST Act, which mandates that GST must only be levied on the transaction value actually received.

#### Solution:
Standardized all engines (`@maihoonna/billing`, `subscriptions.js`, `pricing.ts`, and `subscription_service.ts`) to calculate GST strictly on the **discounted net taxable base**:
$$\text{Net Taxable} = 10,000 - 254.24 = 9,745.76$$
$$\text{GST (18%)} = 9,745.76 \times 18\% = 1,754.24$$
$$\text{Total Price} = 9,745.76 + 1,754.24 = 11,500.00$$

---

### 4.3 Bug 3: Missing Price in Admin Checkout Table (`₹ `)

#### Symptoms:
On the Admin Checkout summary table, the package row showed an empty `₹ ` without a price value.

#### Root Cause:
`subscriptions.js` returned the property as `totalPackageBase` instead of `packageBasePrice`, whereas the frontend component expected `pricing.packageBasePrice`.

#### Solution:
- `subscriptions.js` now returns both `packageBasePrice` and `totalPackageBase`.
- The frontend was updated with safe fallback: `pricing.packageBasePrice ?? pricing.totalPackageBase ?? 0`.

---

### 4.4 Bug 4: Duplicate "Rupees Only Rupees Only" in Words

#### Symptoms:
The amount in words printed:  
`Eighteen Thousand Two Hundred Ninety Rupees Only Rupees Only`.

#### Root Cause:
The `@maihoonna/billing` `numberToWords` function already appends `Rupees Only` (or `Rupees and XX Paise Only`). The HTML renderers were redundantly appending `${amountInWords} Rupees Only`.

#### Solution:
In all four renderers:
```javascript
let amountInWordsDisplay = numberToWords(payableAmount);
if (!amountInWordsDisplay.endsWith('Only')) {
  amountInWordsDisplay = `${amountInWordsDisplay} Rupees Only`;
}
```

---

### 4.5 Bug 5: AWS Access Key Error in Local Development

#### Symptoms:
Clicking "Download Invoice" on the mobile simulator produced an alert:  
`The AWS Access Key Id you provided does not exist in our records.`

#### Root Cause:
`apps/api/app/services/storage/index.ts` defaulted to AWS S3 even in local environments where only Supabase was configured.

#### Solution:
Added runtime provider detection in `storage/index.ts`:
If `STORAGE_PROVIDER=supabase` or if AWS credentials are not set, the storage service automatically utilizes Supabase Storage buckets, bypassing AWS authentication completely.

---

## 5. Amazon-Style 10-Column Tax Invoice Layout

All invoice renderers (`apps/admin-backend`, `apps/api`, `packages/billing`, and `apps/mobile-app`) adhere to the standard 10-column Indian GST Tax Invoice specification:

### Header Section
- **Document Title:** `Tax Invoice / Bill of Supply / Cash Memo`
- **Sub-Title:** `(Original for Recipient)`
- **Header Layout:** 2-column header with company logo and business details on the left, invoice type and copy designation on the right.

### Seller Information (Left Column)
- **Sold By:** `MaiHoonNa Eldercare Private Limited`
- **Registered Address:** Dynamic from config (e.g. Gurugram, Haryana)
- **PAN Number:** Dynamic from config (e.g. `AAECM1234F`)
- **GST Registration Number:** Dynamic from config (e.g. `06AAECM1234F1Z5`)
- **State/UT Code:** `06` (Haryana)

### Customer Information (Right Column)
- **Billing Address:** Customer Name, Complete Address, City, State, PIN, Country, State/UT Code.
- **Service Address:** Beneficiary Name & Delivery Address (if distinct from Billing Address).
- **Place of Supply:** Customer State name & 2-digit Indian State code.
- **Place of Delivery:** Service location state name & 2-digit Indian State code.

### Order & Invoice Details Table
- **Left Column:** Order Number, Order Date.
- **Right Column:** Invoice Number (`MHN/YYYY-YY/XXXXX`), Invoice Details, Invoice Date.

### Itemized Tax Table (10 Columns)
| Col # | Column Header | Description / Format |
| :---: | :--- | :--- |
| **1** | `SL. NO.` | Sequential line counter (1, 2, 3...) |
| **2** | `DESCRIPTION` | Service / package / add-on name with SAC/HSN code (`SAC / HSN: 998399`) |
| **3** | `UNIT PRICE` | Nominal gross unit price in ₹ |
| **4** | `DISCOUNT` | Pre-tax pro-rata discount allocated to this item in ₹ |
| **5** | `QTY` | Integer quantity of units |
| **6** | `NET AMOUNT` | Net taxable value: $(\text{Unit Price} \times \text{Qty}) - \text{Discount}$ |
| **7** | `TAX RATE` | Percentage tax bracket (e.g. `18%`, `0%`) |
| **8** | `TAX TYPE` | Tax split label (`CGST (9%) + SGST (9%)` or `IGST (18%)`) |
| **9** | `TAX AMOUNT` | Calculated GST amount for this line item in ₹ |
| **10**| `TOTAL AMOUNT`| Final line total: $\text{Net Amount} + \text{Tax Amount}$ |

### Totals Summary Box
```
Total Gross Amount:                                 ₹11,800.00
Discount:                                              -₹300.00
Net Taxable Amount:                                 ₹11,500.00
Total CGST:                                          ₹1,035.00
Total SGST:                                          ₹1,035.00
--------------------------------------------------------------
Grand Total:                                        ₹13,570.00
```

### Footer & Statutory Declarations
- **Amount in Words:** `Thirteen Thousand Five Hundred Seventy Rupees Only`
- **Reverse Charge Declaration:** `Whether tax is payable under reverse charge: No`
- **Signature Box:** `For MaiHoonNa Eldercare Private Limited:` with Authorized Signatory notation.
- **Computer-Generated Note:** `This is a computer-generated statutory tax invoice and does not require a physical signature.`

---

## 6. Real-World Worked Numerical Examples

### Scenario A: Monthly Package + 2 Add-ons + ₹300 Promo Coupon (Intra-State)
- **Customer State:** Haryana (Company State: Haryana $\implies$ Intra-State supply)
- **Package:** `Rehab physio v1` (1 Mo) — Base Rate: ₹10,000.00 (GST 18%)
- **Add-on 1:** `Nursing procedure` — Qty: 1, Price: ₹800.00 (GST 18%)
- **Add-on 2:** `amlodipin` — Qty: 2, Unit Price: ₹500.00, Gross: ₹1,000.00 (GST 18%)
- **Coupon Applied:** `WELCOME20` (₹300.00 off)

#### Mathematical Resolution:
1. **Gross Order Total:**
   $$\text{Gross} = 10,000 + 800 + 1,000 = ₹11,800.00$$
2. **Pro-Rata Discount Distribution:**
   - Package: $\frac{10,000}{11,800} \times 300 = ₹254.24$
   - Add-on 1: $\frac{800}{11,800} \times 300 = ₹20.34$
   - Add-on 2: $\frac{1,000}{11,800} \times 300 = ₹25.42$
   $$\text{Sum of discounts} = 254.24 + 20.34 + 25.42 = ₹300.00$$
3. **Net Taxable Values:**
   - Package: $10,000 - 254.24 = ₹9,745.76$
   - Add-on 1: $800 - 20.34 = ₹779.66$
   - Add-on 2: $1,000 - 25.42 = ₹974.58$
   $$\text{Net Taxable Total} = 9,745.76 + 779.66 + 974.58 = ₹11,500.00$$
4. **GST Assessment (Intra-State: CGST 9% + SGST 9%):**
   - Package Tax: $9,745.76 \times 18\% = ₹1,754.24$ (CGST ₹877.12 + SGST ₹877.12)
   - Add-on 1 Tax: $779.66 \times 18\% = ₹140.34$ (CGST ₹70.17 + SGST ₹70.17)
   - Add-on 2 Tax: $974.58 \times 18\% = ₹175.42$ (CGST ₹87.71 + SGST ₹87.71)
   $$\text{Total Tax} = 1,754.24 + 140.34 + 175.42 = ₹2,070.00$$
   $$\text{Total CGST} = ₹1,035.00, \quad \text{Total SGST} = ₹1,035.00$$
5. **Grand Total:**
   $$\text{Grand Total} = 11,500.00 + 2,070.00 = \mathbf{₹13,570.00}$$

---

### Scenario B: 3-Month Subscription with 5% Duration Discount (Inter-State)
- **Customer State:** Karnataka (Company State: Haryana $\implies$ Inter-State supply: IGST 18%)
- **Package:** Base Rate ₹5,000.00/month.
- **Duration:** 3 Months.
- **Proportional Base:** $5,000 \times 3 = ₹15,000.00$.
- **Duration Discount (5%):** $\frac{15,000 \times 5}{100} = ₹750.00$.
- **Net Package Base (`finalBaseRateToDistribute`):** $15,000 - 750 = ₹14,250.00$.
- **Coupon Applied:** None.

#### Mathematical Resolution:
1. **Net Taxable Amount:** ₹14,250.00
2. **IGST (18%):**
   $$\text{IGST} = 14,250.00 \times 18\% = ₹2,565.00$$
3. **Grand Total:**
   $$\text{Grand Total} = 14,250.00 + 2,565.00 = \mathbf{₹16,815.00}$$
4. **Invoice Tax Column:** Shows `IGST (18%)` with ₹2,565.00. CGST and SGST remain ₹0.00.

---

### Scenario C: Mixed-Tax Order (0% Exempt Healthcare + 18% Standard)
- **Package:** `Basic Elder Care` (0% GST Exempt, SAC 999312) — Base Price: ₹4,000.00
- **Add-on:** `Physiotherapy Equipment Rental` (18% GST, SAC 998399) — Base Price: ₹1,000.00
- **Coupon Applied:** ₹250.00 discount

#### Mathematical Resolution:
1. **Gross Order Total:** $4,000 + 1,000 = ₹5,000.00$.
2. **Pro-Rata Discount Allocation:**
   - Package (80% weight): $250 \times 80\% = ₹200.00$
   - Equipment (20% weight): $250 \times 20\% = ₹50.00$
3. **Net Taxable Amounts:**
   - Package: $4,000 - 200 = ₹3,800.00$ (Exempt)
   - Equipment: $1,000 - 50 = ₹950.00$ (Taxable at 18%)
4. **GST Computation:**
   - Package Tax (0%): ₹0.00
   - Equipment Tax (18%): $950 \times 18\% = ₹171.00$
5. **Grand Total:**
   $$\text{Grand Total} = 3,800.00 + 950.00 + 171.00 = \mathbf{₹4,921.00}$$

---

## 7. Verification & Audit Testing Guide

### 7.1 Running the `@maihoonna/billing` Invariant Test Suite
The package includes 24 automated unit tests covering the Largest Remainder Method, multi-bracket GST reconciliation, Section 15 pre-tax discount deductions, and invoice numbering:

```bash
cd packages/billing
npm test
```

Expected output:
```
▶ Billing Engine - Core Invariants
  ✔ Money.distribute should never lose a single paisa (Largest Remainder method)
  ✔ Number to words formats Indian currency correctly
  ✔ BillingCalculator handles mixed tax brackets (0% exempt + 18% taxable) within the same package
  ✔ BillingCalculator correctly splits IGST for Inter-state supply
  ✔ Pre-tax discounts (duration + coupon) are allocated proportionally before GST
✔ Billing Engine - Core Invariants (pass)
▶ Financial Audit & Multi-Bracket GST Reconciliation
  ✔ Scenario 3: Benefit A (0% exempt) + Benefit B (18% taxable) exact calculation
  ✔ Scenario 4: 0% exempt, 5%, 12%, 18%, 28% in the SAME invoice
  ✔ Scenario 5: Pre-tax discount reduces taxable value according to GST Section 15
  ✔ Scenario 6: Pro-rata allocation of ₹1,000 discount across Benefit A (18%) and Benefit B (12%)
  ✔ Scenario 7 & 8: Duration discount + Standard coupon + Saathi reward stacking
  ✔ Scenario 9: Miscellaneous service / setup charges included in grand total
  ✔ Scenario 10: Odd divisions and micro-paise fractions never drift by even 1 paisa
  ✔ Scenario 11: Razorpay integer paise strictly equals totalAmount * 100
  ✔ Scenario 12: Historical InvoiceSnapshot is completely decoupled from future catalog mutations
  ✔ Scenario 13: Admin, Mobile, and Website clients render identical financial values for the same invoice
  ✔ Scenario 14: HTML renderer outputs exact snapshot numbers without recomputation
  ✔ Scenario 16: Percentage coupon with maxDiscount cap and coupon greater than order amount
  ✔ Scenario 17: Tiny fractions, repeating decimals, and large 1 Crore amounts
  ✔ Scenario 18: Inter-state IGST calculation across 5%, 12%, 18%, 28% brackets
  ✔ Scenario 15: Reconciler rejects invalid invoice math
✔ Financial Audit & Multi-Bracket GST Reconciliation (pass)
▶ Invoice Number Generator
  ✔ currentIndianFinancialYear calculates FY correctly
  ✔ generates sequential numbers in normal conditions
  ✔ self-heals and jumps past existing invoices when counter is behind
✔ Invoice Number Generator (pass)
ℹ tests 24 | pass 24 | fail 0
```

### 7.2 Building the Billing Library
Whenever modifications are made to `@maihoonna/billing`:
```bash
cd packages/billing
npm run build
```

### 7.3 TypeScript Verification Across All Workspaces
Ensure strict type checking across all client and server codebases:
```bash
# 1. Admin Frontend
cd apps/admin-frontend && npx tsc --noEmit

# 2. Consumer & Mobile API
cd apps/api && npx tsc --noEmit

# 3. Mobile App (React Native / Expo)
cd apps/mobile-app && npx tsc --noEmit
```
All workspaces must complete with zero errors.

---

## 8. Summary of Active File Responsibilities

| File Path | Primary Responsibility |
| :--- | :--- |
| `packages/billing/src/core/calculator.ts` | **Canonical Billing Engine:** Computes gross, pro-rata pre-tax discounts, line item GST, multi-bracket tax summaries, and reconciles totals. |
| `packages/billing/src/core/discount.ts` | **Pro-Rata Discount Allocator:** Largest Remainder Method distributing order discounts across line items with zero paisa drift. |
| `packages/billing/src/core/tax.ts` | **GST Engine:** Splits CGST/SGST (Intra-state) vs IGST (Inter-state) and aggregates multi-bracket tax tables. |
| `packages/billing/src/templates/invoice-html.ts` | **Amazon-Style HTML Template:** 10-column layout with statutory seller/buyer details, totals box, and reverse charge declaration. |
| `packages/billing/src/templates/number-to-words.ts` | **Indian Currency Formatter:** Converts numbers to words using Lakh/Crore and standard "Rupees Only" format. |
| `apps/admin-backend/routes/subscriptions.js` | **Admin Endpoints:** `/calculate-price` (pricing API), `/admin-enroll` (enrollment), and `/:id/renew` (renewals) with non-double-counting discount pass-through. |
| `apps/admin-backend/modules/invoices/invoice.engine.js` | **Backend Invoicing Adapter:** Bridges database transactions with `BillingCalculator` and sequential invoice persistence. |
| `apps/admin-backend/modules/invoices/invoice.service.js` | **Invoice Service Layer:** Dispatches statutory invoice generation for enrollments, renewals, and add-on purchases. |
| `apps/admin-backend/modules/invoices/invoice.html.renderer.js` | **Admin HTML Invoice Renderer:** 10-column A4 HTML template generator used by admin download endpoints. |
| `apps/admin-frontend/src/app/utils/pricing.ts` | **Frontend Mirror Calculator:** Performs identical pro-rata discount allocation and tax calculation for UI checkout preview. |
| `apps/admin-frontend/src/app/pages/EnrollmentWizardPage.tsx` | **Admin Enrollment Wizard:** Displays line-item Discount column and forwards `totalDiscount` to backend. |
| `apps/admin-frontend/src/app/pages/RenewalWizardPage.tsx` | **Admin Renewal Wizard:** Displays line-item Discount column and forwards `totalDiscount` to backend. |
| `apps/api/app/services/subscriber/subscription_service.ts` | **Consumer Subscription Service:** Generates statutory invoices for mobile subscribers upon payment confirmation. |
| `apps/api/app/services/invoice.html.renderer.ts` | **Consumer HTML Invoice Renderer:** Synchronized 10-column layout for subscriber invoice views. |
| `apps/api/app/services/storage/index.ts` | **Storage Provider:** Manages S3 and Supabase Storage uploads, preventing AWS key errors in local environments. |
| `apps/mobile-app/app/(setup)/checkout.tsx` | **Mobile Checkout Screen:** Itemized pre-tax checkout breakdown and Razorpay integration. |
| `apps/mobile-app/components/invoice/InvoiceGenerator.ts` | **Mobile Invoice Generator:** Synchronized React Native HTML/PDF generator. |
