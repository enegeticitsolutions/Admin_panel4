/**
 * invoice_utils.ts — Thin TypeScript adapter bridging apps/api TypeScript
 * world with the JavaScript InvoiceEngine in admin-backend.
 *
 * OOP principle: Don't duplicate logic. All math lives in InvoiceEngine.
 * This file ONLY re-exports types and thin wrappers for TypeScript callers.
 *
 * @deprecated Direct callers in subscriptions.routes.ts should migrate to
 * using InvoiceService calls or the shared InvoiceEngine. Until that refactor,
 * these wrappers preserve the existing API surface.
 */

import { Prisma } from '@prisma/client';

export {
  currentIndianFinancialYear,
  generateInvoiceNumber,
} from '@maihoonna/billing';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BenefitTaxItem {
  benefitId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  hsnSacCode?: string | null;
  gstRate: number;       // Must be resolved from DB, not hardcoded
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
  placeOfSupply?: string;
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

import {
  BillingCalculator,
  BillingCalculationInput,
  BenefitInputItem,
} from '@maihoonna/billing';

// ─── Calculator ──────────────────────────────────────────────────────────────

/**
 * Calculates itemized GST across multiple line items.
 * Powered by canonical @maihoonna/billing engine.
 */
export function calculateItemizedInvoice(
  items: BenefitTaxItem[],
  totalDiscount: number = 0,
  customerState: string = '',
  companyState: string = process.env.COMPANY_STATE || 'Haryana',
  packageTotalBasePrice?: number
): TaxCalculationResult {
  const billingItems: BenefitInputItem[] = items.map((item) => ({
    benefitId: item.benefitId,
    name: item.name,
    description: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    nominalCost: item.unitPrice,
    gstRate: item.gstRate,
    hsnSacCode: item.hsnSacCode || undefined,
    isGstExempt: item.isGstExempt,
  }));

  const result = BillingCalculator.calculate({
    items: billingItems,
    couponDiscountAmount: totalDiscount,
    customerState,
    companyState,
    packageTotalBasePrice,
  });

  return {
    baseAmount: result.baseAmount,
    discountAmount: result.discountAmount,
    taxableAmount: result.taxableAmount,
    taxAmount: result.taxAmount,
    cgstAmount: result.cgstAmount,
    sgstAmount: result.sgstAmount,
    igstAmount: result.igstAmount,
    totalAmount: result.totalAmount,
    placeOfSupply: result.placeOfSupply,
    items: result.items.map((it) => ({
      benefitId: it.benefitId || undefined,
      description: it.description,
      hsnSacCode: it.hsnSacCode,
      taxRate: it.taxRate,
      isGstExempt: it.isGstExempt,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount: it.amount,
      tax: it.tax,
    })),
  };
}
