import { Money } from './money';
import { TaxGroupSummary } from '../types';

export interface TaxResolutionOptions {
  customerState?: string;
  companyState?: string;
}

export class TaxEngine {
  /**
   * Evaluates whether a transaction is Inter-State (IGST) or Intra-State (CGST + SGST).
   */
  static isInterState(customerState?: string, companyState: string = 'Haryana'): boolean {
    const trimmedCust = (customerState || '').trim().toLowerCase();
    const trimmedComp = (companyState || 'Haryana').trim().toLowerCase();
    return Boolean(trimmedCust) && trimmedCust !== trimmedComp;
  }

  /**
   * Computes GST tax in paise for a line item.
   */
  static computeLineTax(
    taxablePaise: number,
    gstRate: number,
    isGstExempt: boolean,
    isInterState: boolean
  ): {
    taxAmountPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
  } {
    if (isGstExempt || gstRate <= 0 || taxablePaise <= 0) {
      return { taxAmountPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    }

    const taxAmountPaise = Math.round((taxablePaise * gstRate) / 100);

    if (isInterState) {
      return {
        taxAmountPaise,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: taxAmountPaise,
      };
    }

    // Intra-state split: half to CGST, half to SGST
    // Ensure exact equality: cgst + sgst === taxAmountPaise
    const cgstPaise = Math.floor(taxAmountPaise / 2);
    const sgstPaise = taxAmountPaise - cgstPaise;

    return {
      taxAmountPaise,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
    };
  }

  /**
   * Groups calculated line items by tax rate to produce the statutory GST summary schedule.
   */
  static buildTaxSummary(
    lineItems: Array<{
      taxRate: number;
      taxableAmountPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      taxAmountPaise: number;
    }>
  ): TaxGroupSummary[] {
    const groups = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number }>();

    for (const item of lineItems) {
      const rate = item.taxRate;
      const current = groups.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };

      current.taxable += item.taxableAmountPaise;
      current.cgst += item.cgstPaise;
      current.sgst += item.sgstPaise;
      current.igst += item.igstPaise;
      current.total += item.taxAmountPaise;

      groups.set(rate, current);
    }

    const result: TaxGroupSummary[] = [];
    const sortedRates = Array.from(groups.keys()).sort((a, b) => a - b);

    for (const rate of sortedRates) {
      const g = groups.get(rate)!;
      result.push({
        taxRate: rate,
        taxableAmount: Money.toRupees(g.taxable),
        cgstAmount: Money.toRupees(g.cgst),
        sgstAmount: Money.toRupees(g.sgst),
        igstAmount: Money.toRupees(g.igst),
        totalTax: Money.toRupees(g.total),
      });
    }

    return result;
  }
}
