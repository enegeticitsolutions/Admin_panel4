# Invoice Generation: Pricing Rules & Mandatory Fields Guide

> **Scope:** Definitive specification for calculating invoice amounts, selecting the correct pricing basis, and generating statutory tax invoices across MaiHoonNa (`apps/api`, `apps/admin-backend`, `packages/billing`, `packages/database`).  
> **Statutory Compliance:** Compliant with Indian Goods and Services Tax (GST) — CGST Act 2017 Section 15 (Valuation of Taxable Supply), Rule 46 (Tax Invoice), and Circular No. 92/11/2019-GST.

---

## 1. Which Price to Take for Invoice Generation?

In subscription and care package e-commerce, multiple price figures exist in the database. Taking the wrong price leads to legal tax notices, customer overbilling, or lost margins.

### Price Taxonomy in the System

| Price Field | Example Value | Description | Use in Invoice? |
| :--- | :--- | :--- | :--- |
| **`mrp` / Catalog Total** | ₹45,000 | Maximum Retail Price or sum of individual benefit catalog costs. | **No** (Informational only / anchor price). |
| **`undiscountedBase`** | ₹39,528 | Monthly rate multiplied by duration (e.g. ₹3,294 × 12). | **No** (Do not tax before tenure discount). |
| **`packageBasePrice`**<br>`overridePrice` / `priceTwelveMonths` | **₹29,999**<br>(or ₹9,999) | **The chosen tenure cycle base price** (pre-tax). Contains the tenure package discount. | **YES — Primary Package Base Rate.** |
| **`durationDiscount`** | ₹9,529 | Rupee savings between undiscounted base and package base. | **Recorded as Line Item Tenure Discount.** |
| **`addonsTotalPrice`** | ₹899 | Pre-tax sum of all optional addon services selected at checkout. | **YES — Addon Line Items Base Rate.** |
| **`couponDiscount`** | ₹500 | Promotional coupon or Saathi reward voucher applied pre-tax. | **YES — Deducted Pre-Tax from Taxable Base.** |
| **`netTaxableAmount`** | **₹30,398**<br>(₹29,999 + 899 - 500) | **Net Transaction Value** on which statutory GST is levied. | **YES — Statutory Taxable Value.** |
| **`totalTaxAmount`** | ₹5,471.64 | CGST (9%) + SGST (9%) or IGST (18%) on `netTaxableAmount`. | **YES — Total Tax.** |
| **`totalAmount` (Total Payable)** | **₹35,869.64** | Net Taxable Value + Total Tax. Matches Razorpay transaction. | **YES — Invoice Grand Total.** |

---

### The Golden Rule for Tax Invoices

$$\mathbf{Taxable\ Value} = \mathbf{Package\ Cycle\ Base\ Price} + \mathbf{Add\text{-}on\ Base\ Price} - \mathbf{Pre\text{-}Tax\ Coupon\ Discounts}$$

$$\mathbf{GST\ (18\%)} = \mathbf{Taxable\ Value} \times 18\%$$

$$\mathbf{Total\ Invoice\ Amount} = \mathbf{Taxable\ Value} + \mathbf{GST}$$

> **Statutory Requirement (CGST Section 15):**  
> Discounts offered before or at the time of supply (tenure bundle discounts, promo codes, referral credits) **must be deducted from the gross price before computing GST**. You must NEVER charge 18% GST on the undiscounted rate and then subtract the discount post-tax.

---

## 2. Complete Checklist of Everything Needed for Invoice Generation

An invoice is a legal tax document and a customer receipt. Below is the comprehensive checklist of fields grouped by responsibility:

### A. Supplier Details (MaiHoonNa / Company)
* [ ] **Legal Entity Name**: e.g. `Energetic IT Solutions Private Limited` / `MaiHoonNa Care Services Pvt Ltd`
* [ ] **Trade Name**: `MaiHoonNa`
* [ ] **Registered Office Address**: Full registered address in Haryana
* [ ] **GSTIN**: 15-digit GST identification number of the company (e.g., `06AAAAA0000A1Z5`)
* [ ] **PAN**: Corporate PAN
* [ ] **State & State Code**: `Haryana (Code 06)`
* [ ] **Corporate Identity Number (CIN)**: If applicable
* [ ] **Support Email & Helpline Phone**: Displayed in invoice header/footer

### B. Recipient Details (Subscriber / Buyer)
* [ ] **Subscriber Name**: Legal name of the subscriber (purchaser)
* [ ] **Billing Address**: Street, flat/house no., landmark, city, state, pincode
* [ ] **Place of Supply (POS)**: Customer's billing state (e.g. `Delhi (07)`, `Haryana (06)`)
  * If POS == `Haryana`: Tax split into **CGST (9%) + SGST (9%)**
  * If POS != `Haryana`: Tax charged as **IGST (18%)**
* [ ] **Phone Number & Email**: For digital delivery and receipt verification
* [ ] **Customer GSTIN**: If B2B purchase (corporate eldercare subscription); left blank for B2C

### C. Beneficiary & Service Details (The Senior Receiving Care)
* [ ] **Beneficiary Name & Age**: The parent/senior for whom care is provided
* [ ] **Activation / Coverage Period**:
  * If linked: `Plan Start Date: DD/MM/YYYY` to `Plan End Date: DD/MM/YYYY`
  * If unlinked at purchase: Explicitly marked: **`Unassigned / Starts upon Beneficiary Activation in App`**
* [ ] **Subscription Plan Name & Tier**: e.g., `Gold Care Plan (12 Months Annual)`

### D. Invoice Metadata
* [ ] **Invoice Number**: Unique, sequential, fiscal-year prefixed number (e.g., `MHN/2026-27/00142`)
* [ ] **Invoice Date (`issuedAt`)**: Timestamp when the order was paid/placed
* [ ] **Invoice Type**: `SUBSCRIPTION` | `ADDON_PURCHASE` | `RENEWAL`
* [ ] **Payment Status**: `PAID`
* [ ] **Payment Transaction Reference**:
  * Razorpay Payment ID (`pay_XXXXX`)
  * Razorpay Order ID (`order_XXXXX`)
  * Payment Method (`UPI`, `NetBanking`, `Credit Card`, `Debit Card`)
  * Payment Timestamp (`paidAt`)
* [ ] **Reverse Charge Applicable (RCM)**: `No`

---

### E. Itemized Line Items Table (`InvoiceItem`)

Each line item on the invoice must clearly state:

| Column | Description | Example 1 (Package) | Example 2 (Addon) |
| :--- | :--- | :--- | :--- |
| **Item Description** | Clear service name with duration | Gold Care Package (12 Months) | Add-on: Evening Mitra Companion Visit |
| **HSN / SAC Code** | Service Accounting Code | `998399` (Social care / companion) | `998399` (Social care assistance) |
| **Quantity & Unit** | Volume of service | `1 Year` (or `1 Term`) | `2 Visits` |
| **Unit Price (Gross)** | Gross base rate per unit | ₹29,999.00 | ₹449.50 |
| **Pre-tax Discount** | Proportionate coupon discount | - ₹485.50 | - ₹14.50 |
| **Taxable Amount** | Unit Price $\times$ Qty $-$ Discount | ₹29,513.50 | ₹884.50 |
| **GST Rate** | Statutory tax rate | `18%` | `18%` |
| **CGST Amount** | 9% (if intra-state) | ₹2,656.22 | ₹79.61 |
| **SGST Amount** | 9% (if intra-state) | ₹2,656.22 | ₹79.61 |
| **IGST Amount** | 18% (if inter-state) | ₹5,312.43 | ₹159.21 |
| **Line Total** | Taxable Amount + Tax | ₹34,825.93 | ₹1,043.71 |

*(Note: For clinical/doctor consultations that are GST-exempt under SAC `999312`, GST Rate is `0%` and `isGstExempt: true`)*

---

### F. Financial Summary Block

* [ ] **Gross Taxable Subtotal**: Sum of all line item base amounts
* [ ] **Tenure Savings Breakdown**: Transparently shows undiscounted rate vs tenure price (`You saved ₹9,529 on Annual Plan`)
* [ ] **Promotional Coupon Discount**: Discount code applied (e.g., `SUMMER500: - ₹500.00`)
* [ ] **Saathi Reward Discount**: If redeemed (e.g., `SAATHI100: - ₹100.00`)
* [ ] **Net Taxable Base Value**: Total amount subject to tax
* [ ] **Tax Breakdown Summary Table**:
  * `CGST @ 9%`: ₹X.XX
  * `SGST @ 9%`: ₹X.XX
  * `IGST @ 18%`: ₹X.XX
* [ ] **Round Off**: Any fractional paise adjustment (e.g., `+ ₹0.36`)
* [ ] **Total Invoice Value (Grand Total)**: Exact rupees and paise paid
* [ ] **Amount in Words**: Mandatory under GST rules (e.g. *"INR Thirty-Five Thousand Eight Hundred Seventy Only"*)

---

### G. Legal Disclaimers & Signatures
* [ ] **Electronic Invoice Declaration**: *"This is a computer-generated invoice and does not require a physical signature."*
* [ ] **Jurisdiction**: *"Subject to Gurugram/Haryana Jurisdiction."*
* [ ] **Terms & Conditions**: Standard refund and service terms link

---

## 3. Reference Implementation: Data Mapping in Code

When generating the invoice in `apps/api/app/services/subscriber/subscription_service.ts`:

```typescript
// 1. Determine exact Base Price for the cycle
const packageBasePrice = 
  durationMonths === 12 && subPackage.priceTwelveMonths 
    ? Number(subPackage.priceTwelveMonths)
    : durationMonths === 6 && subPackage.priceSixMonths
    ? Number(subPackage.priceSixMonths)
    : durationMonths === 3 && subPackage.priceThreeMonths
    ? Number(subPackage.priceThreeMonths)
    : Math.round(Number(subPackage.basePrice) * durationMonths * (1 - durationDiscountPct / 100));

// 2. Build invoice line items with proper HSN/SAC
const taxItems: BenefitTaxItem[] = [
  {
    name: `${subPackage.name} (${durationMonths} Month${durationMonths > 1 ? 's' : ''})`,
    quantity: 1,
    unitPrice: packageBasePrice, // EXACT tenure cycle price
    gstRate: subPackage.gstRate ?? 18,
    hsnSacCode: subPackage.hsnSacCode || '998399',
    isGstExempt: subPackage.isGstExempt || false,
  }
];

// Add selected addons
if (selectedAddons?.length) {
  for (const addon of selectedAddons) {
    taxItems.push({
      benefitId: addon.benefitId,
      name: `Add-on: ${addon.name}`,
      quantity: addon.quantity,
      unitPrice: addon.addonDiscountPrice ?? addon.addonPrice,
      gstRate: addon.gstRate ?? 18,
      hsnSacCode: addon.hsnSacCode || '998399',
      isGstExempt: addon.isGstExempt || false,
    });
  }
}

// 3. Pre-tax Coupon Deduction (CGST Section 15 compliant)
const totalDiscounts = (couponDiscount || 0) + (saathiDiscountAmount || 0);

// 4. Canonical Tax Calculation Engine
const invoiceCalc = calculateItemizedInvoice(
  taxItems,
  totalDiscounts,
  customerState,
  'Haryana'
);

// 5. Save to PostgreSQL
const invoice = await tx.invoice.create({
  data: {
    invoiceNumber: await generateInvoiceNumber(tx),
    invoiceType: 'SUBSCRIPTION',
    status: 'PAID',
    subscriberId: userId,
    beneficiaryId: beneficiary?.id || null,
    subscriptionId: subscription.id,
    baseAmount: invoiceCalc.baseAmount,
    discountAmount: invoiceCalc.discountAmount,
    taxAmount: invoiceCalc.taxAmount,
    totalAmount: invoiceCalc.totalAmount, // Grand Total Paid
    placeOfSupply: customerState,
    cgstAmount: invoiceCalc.cgstAmount,
    sgstAmount: invoiceCalc.sgstAmount,
    igstAmount: invoiceCalc.igstAmount,
    issuedAt: new Date(),
    paidAt: new Date(),
    items: {
      create: invoiceCalc.items.map((item) => ({
        benefitId: item.benefitId,
        description: item.description,
        hsnSacCode: item.hsnSacCode,
        taxRate: item.taxRate,
        isGstExempt: item.isGstExempt,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    },
  },
});
```
