import { Money } from './money';

export interface CreditNoteTaxInput {
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}

export interface CreditNoteTaxBreakdown {
  baseAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

/**
 * Calculates proportional GST tax reversal for a Credit Note against an existing Invoice.
 * Invariant: baseAmount + taxAmount === totalAmount to the exact paisa.
 */
export function calculateCreditNoteTaxBreakdown(
  refundAmount: number,
  invoice: CreditNoteTaxInput
): CreditNoteTaxBreakdown {
  const refundPaise = Money.toPaise(refundAmount);
  const totalPaise = Money.toPaise(invoice.totalAmount);

  if (totalPaise <= 0 || refundPaise <= 0) {
    return {
      baseAmount: 0,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
    };
  }

  // Exact full refund: match original invoice values exactly
  if (refundPaise >= totalPaise) {
    return {
      baseAmount: invoice.baseAmount,
      taxAmount: invoice.taxAmount,
      cgstAmount: invoice.cgstAmount || 0,
      sgstAmount: invoice.sgstAmount || 0,
      igstAmount: invoice.igstAmount || 0,
      totalAmount: invoice.totalAmount,
    };
  }

  // Pro-rata proportional allocation
  const ratio = refundPaise / totalPaise;
  const cgstPaise = Math.round(Money.toPaise(invoice.cgstAmount || 0) * ratio);
  const sgstPaise = Math.round(Money.toPaise(invoice.sgstAmount || 0) * ratio);
  const igstPaise = Math.round(Money.toPaise(invoice.igstAmount || 0) * ratio);
  const taxPaise = cgstPaise + sgstPaise + igstPaise;
  const basePaise = refundPaise - taxPaise;

  return {
    baseAmount: Money.toRupees(basePaise),
    taxAmount: Money.toRupees(taxPaise),
    cgstAmount: Money.toRupees(cgstPaise),
    sgstAmount: Money.toRupees(sgstPaise),
    igstAmount: Money.toRupees(igstPaise),
    totalAmount: Money.toRupees(refundPaise),
  };
}

