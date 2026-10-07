import { Money } from './money';
import { DiscountAllocator } from './discount-allocator';
import { TaxEngine } from './tax-engine';
import { InvoiceReconciler } from './reconciliation';
import {
  BillingCalculationInput,
  CalculatedLineItem,
  InvoiceSnapshot,
} from '../types';

export class BillingCalculator {
  /**
   * Deterministic, pure calculation engine for subscription package billing,
   * benefit-level GST, and statutory invoices.
   */
  static calculate(input: BillingCalculationInput): InvoiceSnapshot {
    const companyState = input.companyState || 'Haryana';
    const isInterState = TaxEngine.isInterState(input.customerState, companyState);
    const rawItems = input.items || [];

    // 1. Determine gross paise per line item
    let lineGrossPaise: number[] = [];

    if (input.packageTotalBasePrice !== undefined && input.packageTotalBasePrice !== null) {
      // Allocate package lump sum base across benefits using their relative weights
      const totalPkgPaise = Money.toPaise(input.packageTotalBasePrice);
      const weights = rawItems.map((item) => {
        const qty = Math.max(1, item.quantity || 1);
        const weight = item.nominalCost !== undefined ? item.nominalCost : (item.unitPrice || 100);
        return Math.max(1, weight * qty);
      });

      lineGrossPaise = Money.distribute(totalPkgPaise, weights);
    } else {
      // Direct sum from item unit prices
      lineGrossPaise = rawItems.map((item) => {
        const qty = Math.max(1, item.quantity || 1);
        const unitPaise = Money.toPaise(item.unitPrice || 0);
        return unitPaise * qty;
      });
    }

    // 2. Pro-rata discount allocation across items (Pre-tax)
    const discountResult = DiscountAllocator.allocate(lineGrossPaise, {
      durationDiscountAmount: input.durationDiscountAmount,
      couponDiscountAmount: input.couponDiscountAmount,
      saathiDiscountAmount: input.saathiDiscountAmount,
      packageDiscountAmount: input.packageDiscountAmount,
    });

    // 3. Line-by-line tax computation
    const calculatedItems: CalculatedLineItem[] = [];
    const taxSummaryRows: Array<{
      taxRate: number;
      taxableAmountPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      taxAmountPaise: number;
    }> = [];

    let totalGrossPaise = 0;
    let totalTaxablePaise = 0;
    let totalTaxPaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const qty = Math.max(1, raw.quantity || 1);
      const grossPaise = lineGrossPaise[i] || 0;
      const discountPaise = discountResult.lineDiscountPaise[i] || 0;
      const taxablePaise = discountResult.lineTaxablePaise[i] || 0;

      const isExempt = Boolean(raw.isGstExempt);
      const rate = isExempt ? 0 : (raw.gstRate !== undefined && raw.gstRate !== null ? raw.gstRate : 18);
      const hsnSacCode = raw.hsnSacCode || (isExempt ? '999312' : '998399');

      const taxSplit = TaxEngine.computeLineTax(taxablePaise, rate, isExempt, isInterState);
      const lineTotalPaise = taxablePaise + taxSplit.taxAmountPaise;

      // Statutory per-unit gross base price: gross value divided by quantity
      const unitPriceRupees = Money.toRupees(Math.round(grossPaise / qty));

      totalGrossPaise += grossPaise;
      totalTaxablePaise += taxablePaise;
      totalTaxPaise += taxSplit.taxAmountPaise;
      totalCgstPaise += taxSplit.cgstPaise;
      totalSgstPaise += taxSplit.sgstPaise;
      totalIgstPaise += taxSplit.igstPaise;

      calculatedItems.push({
        benefitId: raw.benefitId || null,
        name: raw.name,
        description: raw.description || raw.name,
        hsnSacCode,
        quantity: qty,
        unitPrice: unitPriceRupees,
        grossAmount: Money.toRupees(grossPaise),
        allocatedDiscount: Money.toRupees(discountPaise),
        taxableAmount: Money.toRupees(taxablePaise),
        amount: Money.toRupees(taxablePaise),
        taxRate: rate,
        isGstExempt: isExempt,
        taxAmount: Money.toRupees(taxSplit.taxAmountPaise),
        tax: Money.toRupees(taxSplit.taxAmountPaise),
        cgstAmount: Money.toRupees(taxSplit.cgstPaise),
        sgstAmount: Money.toRupees(taxSplit.sgstPaise),
        igstAmount: Money.toRupees(taxSplit.igstPaise),
        totalAmount: Money.toRupees(lineTotalPaise),
      });

      taxSummaryRows.push({
        taxRate: rate,
        taxableAmountPaise: taxablePaise,
        cgstPaise: taxSplit.cgstPaise,
        sgstPaise: taxSplit.sgstPaise,
        igstPaise: taxSplit.igstPaise,
        taxAmountPaise: taxSplit.taxAmountPaise,
      });
    }

    const miscPaise = Money.toPaise(input.miscellaneousCost || 0);
    const grandTotalPaise = totalTaxablePaise + totalTaxPaise + miscPaise;

    const taxSummary = TaxEngine.buildTaxSummary(taxSummaryRows);

    const snapshot: InvoiceSnapshot = {
      baseAmount: Money.toRupees(totalGrossPaise),
      discountAmount: discountResult.discountsBreakdown.totalDiscount,
      discountBreakdown: discountResult.discountsBreakdown,
      taxableAmount: Money.toRupees(totalTaxablePaise),
      taxAmount: Money.toRupees(totalTaxPaise),
      cgstAmount: Money.toRupees(totalCgstPaise),
      sgstAmount: Money.toRupees(totalSgstPaise),
      igstAmount: Money.toRupees(totalIgstPaise),
      miscellaneousCost: Money.toRupees(miscPaise),
      totalAmount: Money.toRupees(grandTotalPaise),
      isInterState,
      placeOfSupply: input.customerState || '',
      companyState,
      items: calculatedItems,
      taxSummary,
    };

    // Strict invariant reconciliation check
    const reconciliation = InvoiceReconciler.validate(snapshot);
    if (!reconciliation.isValid) {
      throw new Error(
        `[InvoiceReconciliationError] Invariant check failed: ${reconciliation.errors.join('; ')}`
      );
    }

    return snapshot;
  }
}
