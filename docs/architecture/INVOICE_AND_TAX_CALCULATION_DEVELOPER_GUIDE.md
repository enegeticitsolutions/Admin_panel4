# Developer Implementation Guide: Invoice Generation & GST Calculation Engine

> **Target Audience:** Backend Developers working on Invoice Generation, Checkout, & Payment Processing  
> **Repository:** MaiHoonNa Monorepo (`apps/api`, `packages/database`)  
> **Last Updated:** September 2026

---

## 1. Overview & Context

Previously, packages applied a flat 18% GST rate across the entire package. However, care packages bundle services with **different tax classifications under Indian GST law**:
- **Clinical & Doctor Consultations**: GST Exempt (0% GST, SAC `999312`).
- **Care Companion / Mitra Services**: Standard 18% GST (SAC `998399`).
- **Emergency Transport / Ambulance**: 5% GST (SAC `999333`).
- **Medical Goods & Supplies**: 12% GST (HSN `3004`).

Every benefit in the database now has its own **Tax Configuration** (`taxCategory`, `gstRate`, `hsnSacCode`, `isGstExempt`).

This guide explains:
1. How to fetch tax rates from the database.
2. How to calculate the itemized tax breakdown and the final payable amount.
3. How to split taxes (CGST + SGST vs IGST) based on Place of Supply (POS).
4. How to generate the `Invoice` and `InvoiceItem` records in PostgreSQL.
5. How to pass the exact final tax-inclusive amount to Razorpay.

---

## 2. Database Models & Relevant Fields

### A. Benefit Model (`packages/database/prisma/schema.prisma`)
Each benefit holds its default tax classification:
```prisma
model Benefit {
  id           String   @id @default(uuid())
  name         String
  unitLabel    String?  // e.g., "per hour", "per visit"
  unitCost     Float?   // Standalone retail price per unit
  
  // Tax Classification Fields
  taxCategory  String?  @default("GST_18") // e.g., "GST_18", "GST_EXEMPT", "GST_5"
  gstRate      Float?   @default(18.0)     // e.g., 18.0, 0.0, 5.0, 17.0
  hsnSacCode   String?                     // e.g., "998399", "999312"
  isGstExempt  Boolean  @default(false)    // true if clinical/exempt
}
```

### B. PackageVersionBenefit Model
When packages are published, their benefits and allocation rules are snapshotted:
```prisma
model PackageVersionBenefit {
  id                    String   @id @default(uuid())
  packageVersionId      String
  benefitId             String
  snapshotName          String
  snapshotUnitLabel     String?
  unitsIncluded         Int      @default(1)
  unitsPeriod           String   // "monthly" | "yearly" | "one_time" | "unlimited"
  allocationBasis       String?  // "per_billing_cycle" | "per_subscription_term" | "min_tenure_required"
  minSubscriptionMonths Int?     @default(1)
  allowRollover         Boolean  @default(false)
  maxRolloverUnits      Int?
  isUnlimited           Boolean  @default(false)
  
  benefit               Benefit  @relation(fields: [benefitId], references: [id])
}
```

### C. Invoice & InvoiceItem Models
```prisma
model Invoice {
  id             String        @id @default(uuid())
  invoiceNumber  String        @unique // e.g. "MHN/INV/2026-27/00042"
  invoiceType    InvoiceType   // "SUBSCRIPTION" | "ADDON" | "APPOINTMENT"
  status         InvoiceStatus @default(PAID)

  subscriberId   String
  beneficiaryId  String?
  subscriptionId String?

  baseAmount     Float         // Subtotal before GST
  discountAmount Float         @default(0.0) // Total discount applied
  taxAmount      Float         @default(0.0) // Total GST amount
  totalAmount    Float         // Final payable amount (Base - Discount + Tax)

  placeOfSupply  String?       // State name (e.g., "Delhi", "Haryana")
  cgstAmount     Float         @default(0.0) // 50% of GST (Intra-state)
  sgstAmount     Float         @default(0.0) // 50% of GST (Intra-state)
  igstAmount     Float         @default(0.0) // 100% of GST (Inter-state)

  issuedAt       DateTime      @default(now())
  paidAt         DateTime?

  items          InvoiceItem[]
}

model InvoiceItem {
  id          String   @id @default(uuid())
  invoiceId   String
  benefitId   String?

  description String   // e.g. "Sathi Care Mitra (10 hrs/month)"
  hsnSacCode  String?  // e.g. "998399"
  taxRate     Float?   // e.g. 18.0
  isGstExempt Boolean  @default(false)

  quantity    Int      @default(1)
  unitPrice   Float    // Price per unit before tax
  amount      Float    // Total taxable amount for this line item
}
```

---

## 3. GST Calculation Rules & Formulas

### Rule 1: Place of Supply (POS) Split
- **Company Registered State:** `Haryana` (State Code `06`).
- **If Customer/Beneficiary State == "Haryana" (Intra-State):**
  - $\text{IGST} = 0$
  - $\text{CGST} = \text{Tax Amount} / 2$
  - $\text{SGST} = \text{Tax Amount} / 2$
- **If Customer/Beneficiary State != "Haryana" (Inter-State, e.g. Delhi, UP):**
  - $\text{IGST} = \text{Tax Amount}$
  - $\text{CGST} = 0$
  - $\text{SGST} = 0$

### Rule 2: Item-Level Tax Calculation
For any item $i$:
$$\text{Taxable Amount}_i = \text{Quantity}_i \times \text{Unit Price}_i - \text{Item Discount}_i$$

$$\text{Item Tax}_i = \begin{cases} 0 & \text{if isGstExempt is true or gstRate } = 0 \\ \dfrac{\text{Taxable Amount}_i \times \text{gstRate}_i}{100} & \text{otherwise} \end{cases}$$

### Rule 3: Invoice Aggregation
$$\text{Total Base Amount} = \sum \text{Item Amount}_i$$
$$\text{Total Tax Amount} = \sum \text{Item Tax}_i$$
$$\text{Final Total Payable} = \text{Total Base Amount} - \text{Total Discount} + \text{Total Tax Amount}$$

---

## 4. End-to-End Code Implementation

Create or replace your invoice calculation helper in `apps/api/app/utils/invoice_utils.ts`:

```typescript
import { Prisma } from '@prisma/client';

export interface BenefitTaxItem {
  benefitId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  hsnSacCode?: string | null;
  gstRate: number;
  isGstExempt: boolean;
}

export interface TaxCalculationResult {
  baseAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  items: Array<{
    benefitId?: string;
    description: string;
    hsnSacCode: string;
    taxRate: number;
    isGstExempt: boolean;
    quantity: number;
    unitPrice: number;
    amount: number;
    tax: number;
  }>;
}

/**
 * Calculates itemized GST across multiple benefits or package components
 */
export function calculateItemizedInvoice(
  items: BenefitTaxItem[],
  totalDiscount: number = 0,
  customerState: string = 'Haryana',
  companyState: string = 'Haryana'
): TaxCalculationResult {
  const isInterState = customerState.trim().toLowerCase() !== companyState.trim().toLowerCase();

  // 1. Calculate raw total base amount
  const rawBaseAmount = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);

  // 2. Distribute discount proportionally across items (or apply to base)
  const discountRatio = rawBaseAmount > 0 ? Math.min(1, totalDiscount / rawBaseAmount) : 0;

  let totalTaxAmount = 0;
  let totalTaxableAmount = 0;

  const processedItems = items.map(item => {
    const rawLineTotal = item.unitPrice * item.quantity;
    const lineDiscount = rawLineTotal * discountRatio;
    const taxableAmount = Math.max(0, rawLineTotal - lineDiscount);

    const rate = item.isGstExempt ? 0 : (item.gstRate ?? 18);
    const lineTax = item.isGstExempt ? 0 : Math.round((taxableAmount * rate) / 100 * 100) / 100;

    totalTaxableAmount += taxableAmount;
    totalTaxAmount += lineTax;

    return {
      benefitId: item.benefitId,
      description: item.name,
      hsnSacCode: item.hsnSacCode || (item.isGstExempt ? '999312' : '998399'),
      taxRate: rate,
      isGstExempt: item.isGstExempt,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: Math.round(taxableAmount * 100) / 100,
      tax: lineTax,
    };
  });

  totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
  totalTaxableAmount = Math.round(totalTaxableAmount * 100) / 100;

  const cgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
  const sgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
  const igstAmount = isInterState ? totalTaxAmount : 0;

  const finalTotalAmount = Math.round((totalTaxableAmount + totalTaxAmount) * 100) / 100;

  return {
    baseAmount: Math.round(rawBaseAmount * 100) / 100,
    discountAmount: Math.round(totalDiscount * 100) / 100,
    taxableAmount: totalTaxableAmount,
    taxAmount: totalTaxAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: finalTotalAmount,
    items: processedItems,
  };
}
```

---

## 5. Integrating with Package Checkout & Payment

When a user purchases a package in `apps/api/app/services/subscriber/subscription_service.ts`:

### Step 1: Build the Items List from PackageVersionBenefits
```typescript
// 1. Fetch package version with its benefits and benefit tax records
const packageVersion = await tx.packageVersion.findUnique({
  where: { id: packageVersionId },
  include: {
    versionBenefits: {
      include: {
        benefit: true, // Contains gstRate, hsnSacCode, isGstExempt, unitCost
      },
    },
  },
});

// 2. Prepare items for tax engine
const taxItems: BenefitTaxItem[] = packageVersion.versionBenefits.map((vb) => {
  const b = vb.benefit;
  const quantity = vb.isUnlimited ? 1 : vb.unitsIncluded;
  
  // Standalone retail price or proportion
  const unitPrice = b.unitCost || (packageVersion.basePrice / packageVersion.versionBenefits.length);

  return {
    benefitId: b.id,
    name: `${b.name} (${vb.unitsIncluded} ${vb.snapshotUnitLabel || 'units'} / ${vb.unitsPeriod})`,
    quantity: 1,
    unitPrice: unitPrice,
    gstRate: b.gstRate ?? 18,
    hsnSacCode: b.hsnSacCode || '998399',
    isGstExempt: b.isGstExempt || false,
  };
});

// 3. If user selected add-on benefits, push them as well
if (selectedAddons && selectedAddons.length > 0) {
  for (const addon of selectedAddons) {
    const b = await tx.benefit.findUnique({ where: { id: addon.benefitId } });
    if (b) {
      taxItems.push({
        benefitId: b.id,
        name: `Add-on: ${b.name}`,
        quantity: addon.quantity || 1,
        unitPrice: b.addonPrice || b.unitCost || 500,
        gstRate: b.gstRate ?? 18,
        hsnSacCode: b.hsnSacCode || '998399',
        isGstExempt: b.isGstExempt || false,
      });
    }
  }
}

// 4. Calculate invoice and tax amounts
const customerState = beneficiary?.state || subscriber?.state || 'Haryana';
const invoiceCalc = calculateItemizedInvoice(taxItems, discountAmount, customerState, 'Haryana');
```

### Step 2: Create the Invoice Record in PostgreSQL
```typescript
const invoiceNumber = await generateInvoiceNumber(tx);

const invoice = await tx.invoice.create({
  data: {
    invoiceNumber,
    invoiceType: 'SUBSCRIPTION',
    status: 'PAID',
    subscriberId: userId,
    beneficiaryId: beneficiary?.id || null,
    subscriptionId: subscription.id,
    baseAmount: invoiceCalc.baseAmount,
    discountAmount: invoiceCalc.discountAmount,
    taxAmount: invoiceCalc.taxAmount,
    totalAmount: invoiceCalc.totalAmount, // Final amount paid by customer
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

### Step 3: Razorpay Payment Gateway Order Amount
When creating the Razorpay Order:
```typescript
// Razorpay expects the final tax-inclusive amount in paise (1 INR = 100 paise)
const razorpayOrder = await razorpay.orders.create({
  amount: Math.round(invoiceCalc.totalAmount * 100), // e.g. ₹7,431.00 -> 743100
  currency: 'INR',
  receipt: invoiceNumber,
  notes: {
    subscriptionId: subscription.id,
    subscriberId: userId,
    taxAmount: invoiceCalc.taxAmount,
  },
});
```

---

## 6. Example Numerical Walkthrough for QA

Assume a **3-Month Subscription** with 3 benefits:

| Component | Quantity & Cadence | Unit Price | Line Base | GST Rate | Tax Status | GST Amount |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sathi Companion** | 10 hrs/month $\times$ 3 mo = 30 hrs | ₹500/hr | ₹15,000 | **18%** | Taxable (SAC `998399`) | ₹2,700 |
| **General Physician**| 1 visit/month $\times$ 3 mo = 3 visits| ₹1,000/visit| ₹3,000 | **0%** | **GST Exempt** (SAC `999312`) | ₹0 |
| **Emergency Support**| 5 uses/year | ₹3,000/yr | ₹3,000 | **18%** | Taxable (SAC `998399`) | ₹540 |
| **Totals** | — | — | **₹21,000** | — | — | **₹3,240** |

- **If Customer is in Haryana (Intra-State):**
  - CGST (9% on taxable ₹18,000): **₹1,620**
  - SGST (9% on taxable ₹18,000): **₹1,620**
  - IGST: **₹0**
- **If Customer is in Delhi (Inter-State):**
  - CGST: **₹0** | SGST: **₹0**
  - IGST (18% on taxable ₹18,000): **₹3,240**
- **Final Amount Charged to Customer:**
  $$\text{Total Payable} = ₹21,000 + ₹3,240 = \mathbf{₹24,240}$$

---

## 7. Developer Checklist for Sign-Off
- [ ] Ensure `benefit.gstRate` and `benefit.isGstExempt` are read directly from the database, not hardcoded to 18%.
- [ ] For clinical/exempt benefits, verify `taxRate` is set to `0` and `isGstExempt: true` in `InvoiceItem`.
- [ ] Verify `hsnSacCode` is populated (`998399` for companion, `999312` for healthcare).
- [ ] Verify `cgstAmount + sgstAmount` equals `taxAmount` for intra-state, or `igstAmount` equals `taxAmount` for inter-state.
- [ ] Pass `totalAmount * 100` in paise to Razorpay order creation so the collected payment matches the invoice total.
