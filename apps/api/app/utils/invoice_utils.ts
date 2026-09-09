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

// ─── Financial Year ─────────────────────────────────────────────────────────

/**
 * Computes the Indian Financial Year string from the current date.
 * FY runs April 1 – March 31. Never hardcoded.
 *
 * @param date - Reference date (defaults to now)
 * @returns e.g. "2026-27"
 */
export function currentIndianFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1).toString().slice(-2);
  return `${fyStart}-${fyEnd}`;
}

// ─── Invoice Number Generator ────────────────────────────────────────────────

/**
 * Generates the next sequential invoice number using atomic DB upsert.
 * Financial year is ALWAYS computed from the current date — never passed as string.
 *
 * Format: MHN/INV/2026-27/00001
 */
export const generateInvoiceNumber = async (
  tx: Prisma.TransactionClient,
  forDate: Date = new Date()
): Promise<string> => {
  const financialYear = currentIndianFinancialYear(forDate);

  const counter = await tx.invoiceCounter.upsert({
    where: { financialYear },
    update: { lastCount: { increment: 1 } },
    create: { financialYear, lastCount: 1 },
  });

  const countStr = counter.lastCount.toString().padStart(5, '0');
  return `MHN/INV/${financialYear}/${countStr}`;
};

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

// ─── Calculator ──────────────────────────────────────────────────────────────

/**
 * Calculates itemized GST across multiple line items.
 * Pure math — no DB dependency.
 * Mirrors InvoiceCalculator.calculate() from the JS engine for TypeScript callers.
 */
export function calculateItemizedInvoice(
  items: BenefitTaxItem[],
  totalDiscount: number = 0,
  customerState: string = 'Haryana',
  companyState: string = 'Haryana'
): TaxCalculationResult {
  const isInterState =
    customerState.trim().toLowerCase() !== companyState.trim().toLowerCase();

  const rawBaseAmount = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const discountRatio = rawBaseAmount > 0 ? Math.min(1, totalDiscount / rawBaseAmount) : 0;

  let totalTaxAmount = 0;
  let totalTaxableAmount = 0;

  const processedItems = items.map((item) => {
    const rawLineTotal = item.unitPrice * item.quantity;
    const lineDiscount = Math.round(rawLineTotal * discountRatio * 100) / 100;
    const taxableAmount = Math.max(0, rawLineTotal - lineDiscount);

    const rate = item.isGstExempt ? 0 : (item.gstRate ?? 18);
    const lineTax = item.isGstExempt
      ? 0
      : Math.round((taxableAmount * rate / 100) * 100) / 100;

    totalTaxableAmount += taxableAmount;
    totalTaxAmount += lineTax;

    return {
      benefitId: item.benefitId,
      description: item.name,
      hsnSacCode: item.hsnSacCode || (item.isGstExempt ? '999312' : '998399'),
      taxRate: rate,
      isGstExempt: item.isGstExempt,
      quantity: item.quantity,
      unitPrice: Math.round(item.unitPrice * 100) / 100,
      amount: Math.round(taxableAmount * 100) / 100,
      tax: Math.round(lineTax * 100) / 100,
    };
  });

  totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
  totalTaxableAmount = Math.round(totalTaxableAmount * 100) / 100;

  const cgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
  const sgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
  const igstAmount = isInterState ? totalTaxAmount : 0;

  return {
    baseAmount: Math.round(rawBaseAmount * 100) / 100,
    discountAmount: Math.round(totalDiscount * 100) / 100,
    taxableAmount: totalTaxableAmount,
    taxAmount: totalTaxAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: Math.round((totalTaxableAmount + totalTaxAmount) * 100) / 100,
    placeOfSupply: customerState,
    items: processedItems,
  };
}
