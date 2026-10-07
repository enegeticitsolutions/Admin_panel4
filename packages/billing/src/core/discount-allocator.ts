import { Money } from './money';
import { DiscountBreakdown } from '../types';

export interface DiscountAllocationResult {
  discountsBreakdown: DiscountBreakdown;
  totalDiscountPaise: number;
  lineDiscountPaise: number[];
  lineTaxablePaise: number[];
}

export class DiscountAllocator {
  /**
   * Deterministically distributes discounts across line items.
   * Discounts are applied against the PRE-TAX base value (complying with
   * statutory GST rules under Section 15 of CGST Act).
   *
   * @param lineGrossPaise - Array of gross base amounts in paise per line
   * @param discounts - Breakdown of duration, coupon, saathi, and package discounts
   */
  static allocate(
    lineGrossPaise: number[],
    discounts: {
      durationDiscountAmount?: number;
      couponDiscountAmount?: number;
      saathiDiscountAmount?: number;
      packageDiscountAmount?: number;
    }
  ): DiscountAllocationResult {
    const totalGrossPaise = lineGrossPaise.reduce((acc, p) => acc + p, 0);

    const durationDiscountPaise = Money.toPaise(discounts.durationDiscountAmount || 0);
    const couponDiscountPaise = Money.toPaise(discounts.couponDiscountAmount || 0);
    const saathiDiscountPaise = Money.toPaise(discounts.saathiDiscountAmount || 0);
    const packageDiscountPaise = Money.toPaise(discounts.packageDiscountAmount || 0);

    const sumDiscountPaise =
      durationDiscountPaise +
      couponDiscountPaise +
      saathiDiscountPaise +
      packageDiscountPaise;

    // Total discount is capped at gross base amount (cannot be negative)
    const effectiveTotalDiscountPaise = Math.min(totalGrossPaise, Math.max(0, sumDiscountPaise));

    // Allocate discount proportionally across line gross values
    const lineDiscountPaise = Money.distribute(effectiveTotalDiscountPaise, lineGrossPaise);

    // Compute net taxable paise per line
    const lineTaxablePaise = lineGrossPaise.map((gross, idx) => {
      const discount = lineDiscountPaise[idx];
      return Math.max(0, gross - discount);
    });

    const breakdown: DiscountBreakdown = {
      durationDiscount: Money.toRupees(durationDiscountPaise),
      couponDiscount: Money.toRupees(couponDiscountPaise),
      saathiDiscount: Money.toRupees(saathiDiscountPaise),
      packageDiscount: Money.toRupees(packageDiscountPaise),
      totalDiscount: Money.toRupees(effectiveTotalDiscountPaise),
    };

    return {
      discountsBreakdown: breakdown,
      totalDiscountPaise: effectiveTotalDiscountPaise,
      lineDiscountPaise,
      lineTaxablePaise,
    };
  }
}
