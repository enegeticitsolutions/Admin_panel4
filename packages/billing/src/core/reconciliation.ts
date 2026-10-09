import { Money } from './money';
import { InvoiceSnapshot } from '../types';

export interface ReconciliationResult {
  isValid: boolean;
  errors: string[];
}

export class InvoiceReconciler {
  /**
   * Strictly validates that the financial values of an InvoiceSnapshot satisfy all
   * accounting and statutory GST invariants down to the exact paisa.
   *
   * Central Invariant:
   * baseAmount - discountAmount + taxAmount + miscellaneousCost === totalAmount
   */
  static validate(snapshot: InvoiceSnapshot): ReconciliationResult {
    const errors: string[] = [];

    const basePaise = Money.toPaise(snapshot.baseAmount);
    const discountPaise = Money.toPaise(snapshot.discountAmount);
    const taxablePaise = Money.toPaise(snapshot.taxableAmount);
    const taxPaise = Money.toPaise(snapshot.taxAmount);
    const cgstPaise = Money.toPaise(snapshot.cgstAmount);
    const sgstPaise = Money.toPaise(snapshot.sgstAmount);
    const igstPaise = Money.toPaise(snapshot.igstAmount);
    const miscPaise = Money.toPaise(snapshot.miscellaneousCost);
    const totalPaise = Money.toPaise(snapshot.totalAmount);

    // 1. Header equation
    if (basePaise !== taxablePaise) {
      errors.push(
        `Header Taxable Value Mismatch: baseAmount (${snapshot.baseAmount}) = ${Money.toRupees(basePaise)}, expected taxableAmount (${snapshot.taxableAmount})`
      );
    }

    if (taxablePaise + taxPaise + miscPaise - discountPaise !== totalPaise) {
      errors.push(
        `Header Grand Total Mismatch: taxableAmount (${snapshot.taxableAmount}) + taxAmount (${snapshot.taxAmount}) + misc (${snapshot.miscellaneousCost}) - discount (${snapshot.discountAmount}) = ${Money.toRupees(taxablePaise + taxPaise + miscPaise - discountPaise)}, expected totalAmount (${snapshot.totalAmount})`
      );
    }

    // 2. GST State of Supply split
    if (snapshot.isInterState) {
      if (cgstPaise !== 0 || sgstPaise !== 0) {
        errors.push(`Inter-State Invariant Violated: CGST and SGST must be 0 for inter-state supply`);
      }
      if (igstPaise !== taxPaise) {
        errors.push(`Inter-State IGST Mismatch: IGST (${snapshot.igstAmount}) must equal total tax (${snapshot.taxAmount})`);
      }
    } else {
      if (igstPaise !== 0) {
        errors.push(`Intra-State Invariant Violated: IGST must be 0 for intra-state supply`);
      }
      if (cgstPaise + sgstPaise !== taxPaise) {
        errors.push(`Intra-State Split Mismatch: CGST (${snapshot.cgstAmount}) + SGST (${snapshot.sgstAmount}) must equal total tax (${snapshot.taxAmount})`);
      }
    }

    // 3. Line-item invariants and sum reconciliation
    let sumLineGrossPaise = 0;
    let sumLineDiscountPaise = 0;
    let sumLineTaxablePaise = 0;
    let sumLineTaxPaise = 0;
    let sumLineTotalPaise = 0;

    const items = snapshot.items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lineGross = Money.toPaise(item.grossAmount);
      const lineDiscount = Money.toPaise(item.allocatedDiscount);
      const lineTaxable = Money.toPaise(item.taxableAmount);
      const lineTax = Money.toPaise(item.taxAmount);
      const lineTotal = Money.toPaise(item.totalAmount);
      const lineCgst = Money.toPaise(item.cgstAmount);
      const lineSgst = Money.toPaise(item.sgstAmount);
      const lineIgst = Money.toPaise(item.igstAmount);

      // Line taxable equation
      if (lineGross !== lineTaxable) {
        errors.push(
          `Line ${i + 1} (${item.name}) Taxable Mismatch: gross (${item.grossAmount}) !== taxable (${item.taxableAmount})`
        );
      }

      // Line total equation
      if (lineTaxable + lineTax !== lineTotal) {
        errors.push(
          `Line ${i + 1} (${item.name}) Total Mismatch: taxable (${item.taxableAmount}) + tax (${item.taxAmount}) !== total (${item.totalAmount})`
        );
      }

      // Line tax split
      if (lineCgst + lineSgst + lineIgst !== lineTax) {
        errors.push(
          `Line ${i + 1} (${item.name}) Tax Split Mismatch: CGST + SGST + IGST !== line tax`
        );
      }

      sumLineGrossPaise += lineGross;
      sumLineDiscountPaise += lineDiscount;
      sumLineTaxablePaise += lineTaxable;
      sumLineTaxPaise += lineTax;
      sumLineTotalPaise += lineTotal;
    }

    // 4. Sums cross-check
    if (sumLineGrossPaise !== basePaise) {
      errors.push(`Sum of line gross amounts (${Money.toRupees(sumLineGrossPaise)}) does not equal baseAmount (${snapshot.baseAmount})`);
    }

    if (sumLineDiscountPaise !== discountPaise) {
      errors.push(`Sum of line discounts (${Money.toRupees(sumLineDiscountPaise)}) does not equal discountAmount (${snapshot.discountAmount})`);
    }

    if (sumLineTaxablePaise !== taxablePaise) {
      errors.push(`Sum of line taxable amounts (${Money.toRupees(sumLineTaxablePaise)}) does not equal taxableAmount (${snapshot.taxableAmount})`);
    }

    if (sumLineTaxPaise !== taxPaise) {
      errors.push(`Sum of line tax amounts (${Money.toRupees(sumLineTaxPaise)}) does not equal taxAmount (${snapshot.taxAmount})`);
    }

    if (sumLineTotalPaise + miscPaise - discountPaise !== totalPaise) {
      errors.push(`Sum of line totals + misc - discount does not equal totalAmount (${snapshot.totalAmount})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
