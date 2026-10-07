/**
 * Domain types for @maihoonna/billing
 */

export interface BenefitInputItem {
  benefitId?: string | null;
  name: string;
  description?: string;
  quantity: number;
  /** Nominal cost / weight used for pro-rata price allocation (e.g. from benefit.unitCost) */
  nominalCost?: number;
  /** Explicit unit price if not allocating from package lump sum */
  unitPrice?: number;
  /** Explicit GST percentage (e.g., 0, 5, 12, 18) */
  gstRate?: number;
  /** HSN/SAC statutory classification code (e.g. '999312' for healthcare, '998399' for tech/other) */
  hsnSacCode?: string;
  /** Whether explicitly exempt from GST */
  isGstExempt?: boolean;
}

export interface DiscountBreakdown {
  durationDiscount: number;
  couponDiscount: number;
  saathiDiscount: number;
  packageDiscount: number;
  totalDiscount: number;
}

export interface CalculatedLineItem {
  benefitId: string | null;
  name: string;
  description: string;
  hsnSacCode: string;
  quantity: number;
  /** Per-unit pre-tax rate: taxableAmount / quantity */
  unitPrice: number;
  /** Gross pre-discount amount for this line */
  grossAmount: number;
  /** Share of package/duration/coupon discounts allocated to this line */
  allocatedDiscount: number;
  /** Post-discount net taxable value */
  taxableAmount: number;
  /** Legacy alias for taxableAmount */
  amount: number;
  /** Applicable GST Rate percentage */
  taxRate: number;
  isGstExempt: boolean;
  /** Tax amount on this line */
  taxAmount: number;
  /** Legacy alias for taxAmount */
  tax: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** Total line item payable: taxableAmount + taxAmount */
  totalAmount: number;
}

export interface TaxGroupSummary {
  taxRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export interface BillingCalculationInput {
  items: BenefitInputItem[];
  /** Total package lump sum base price to allocate across items (if null, sum of line items used) */
  packageTotalBasePrice?: number;
  /** Duration discount (e.g., 10% for 6 months) */
  durationDiscountAmount?: number;
  /** Coupon discount */
  couponDiscountAmount?: number;
  /** Saathi referral discount */
  saathiDiscountAmount?: number;
  /** Any direct package manual discount override */
  packageDiscountAmount?: number;
  /** Any additional miscellaneous non-taxable / taxable fee */
  miscellaneousCost?: number;
  /** Customer's place of supply state */
  customerState?: string;
  /** Provider's registered state (defaults to 'Haryana') */
  companyState?: string;
}

export interface InvoiceSnapshot {
  /** Gross undiscounted base amount */
  baseAmount: number;
  /** Total discount deducted before tax */
  discountAmount: number;
  discountBreakdown: DiscountBreakdown;
  /** Post-discount taxable subtotal */
  taxableAmount: number;
  /** Total GST charged */
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** Miscellaneous cost */
  miscellaneousCost: number;
  /** Final grand total payable */
  totalAmount: number;
  /** Inter-state determination */
  isInterState: boolean;
  placeOfSupply: string;
  companyState: string;
  /** Itemized statutory line items */
  items: CalculatedLineItem[];
  /** Grouped summary by GST rate brackets */
  taxSummary: TaxGroupSummary[];
}

export interface StatutoryCompanyDetails {
  name: string;
  legalName?: string;
  address: string;
  gstin: string;
  pan: string;
  cin?: string;
  email: string;
  phone: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  upiId?: string;
}

export interface InvoiceRecipientDetails {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  state?: string;
}
