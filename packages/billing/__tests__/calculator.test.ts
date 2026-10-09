import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  BillingCalculator,
  Money,
  DiscountAllocator,
  TaxEngine,
  numberToWords,
} from '../src';

describe('Billing Engine - Core Invariants', () => {
  test('Money.distribute should never lose a single paisa (Largest Remainder method)', () => {
    // Distribute 1000 paise (₹10) across 3 equal weights
    const distributed = Money.distribute(1000, [1, 1, 1]);
    const sum = distributed.reduce((a, b) => a + b, 0);
    assert.strictEqual(sum, 1000);
    assert.deepStrictEqual(distributed, [334, 333, 333]); // 334 + 333 + 333 = 1000
  });

  test('Number to words formats Indian currency correctly', () => {
    assert.strictEqual(
      numberToWords(125000),
      'One Lakh Twenty Five Thousand Rupees Only'
    );
    assert.strictEqual(
      numberToWords(1500.5),
      'One Thousand Five Hundred Rupees and Fifty Paise Only'
    );
  });

  test('BillingCalculator handles mixed tax brackets (0% exempt + 18% taxable) within the same package', () => {
    const result = BillingCalculator.calculate({
      packageTotalBasePrice: 2000,
      customerState: 'Haryana', // Intra-state
      companyState: 'Haryana',
      items: [
        {
          name: 'Doctor Consultation',
          quantity: 2,
          nominalCost: 500,
          isGstExempt: true,
          gstRate: 0,
        },
        {
          name: 'Care Companion Visit',
          quantity: 2,
          nominalCost: 500,
          isGstExempt: false,
          gstRate: 18,
        },
      ],
    });

    // ₹2000 base allocated 50/50: ₹1000 exempt, ₹1000 taxable at 18%
    assert.strictEqual(result.baseAmount, 2000);
    assert.strictEqual(result.taxableAmount, 2000);

    // Exempt item: ₹1000 base, ₹0 tax
    const exemptItem = result.items[0];
    assert.strictEqual(exemptItem.taxRate, 0);
    assert.strictEqual(exemptItem.taxAmount, 0);
    assert.strictEqual(exemptItem.taxableAmount, 1000);
    assert.strictEqual(exemptItem.unitPrice, 500); // 1000 / 2 units

    // Taxable item: ₹1000 base, ₹180 tax (18%)
    const taxableItem = result.items[1];
    assert.strictEqual(taxableItem.taxRate, 18);
    assert.strictEqual(taxableItem.taxAmount, 180);
    assert.strictEqual(taxableItem.taxableAmount, 1000);
    assert.strictEqual(taxableItem.unitPrice, 500); // 1000 / 2 units

    // Intra-state split: CGST 90, SGST 90, IGST 0
    assert.strictEqual(result.taxAmount, 180);
    assert.strictEqual(result.cgstAmount, 90);
    assert.strictEqual(result.sgstAmount, 90);
    assert.strictEqual(result.igstAmount, 0);

    // Total: ₹2000 + ₹180 = ₹2180 (NOT ₹2360 which flat 18% would produce!)
    assert.strictEqual(result.totalAmount, 2180);
  });

  test('BillingCalculator correctly splits IGST for Inter-state supply', () => {
    const result = BillingCalculator.calculate({
      packageTotalBasePrice: 1000,
      customerState: 'Karnataka', // Inter-state
      companyState: 'Haryana',
      items: [
        {
          name: 'Tech Subscription',
          quantity: 1,
          nominalCost: 1000,
          isGstExempt: false,
          gstRate: 18,
        },
      ],
    });

    assert.strictEqual(result.isInterState, true);
    assert.strictEqual(result.cgstAmount, 0);
    assert.strictEqual(result.sgstAmount, 0);
    assert.strictEqual(result.igstAmount, 180);
    assert.strictEqual(result.totalAmount, 1180);
  });

  test('Pre-tax discounts (duration + coupon) are allocated proportionally before GST', () => {
    const result = BillingCalculator.calculate({
      packageTotalBasePrice: 1000,
      durationDiscountAmount: 100, // 10%
      couponDiscountAmount: 100,   // ₹100 coupon
      customerState: 'Haryana',
      items: [
        {
          name: 'Physical Therapy',
          quantity: 1,
          nominalCost: 1000,
          isGstExempt: false,
          gstRate: 18,
        },
      ],
    });

    // Base: 1000, Discounts: 200, Taxable: 1000
    assert.strictEqual(result.baseAmount, 1000);
    assert.strictEqual(result.discountAmount, 200);
    assert.strictEqual(result.taxableAmount, 1000);

    // GST on 1000 at 18% = 180
    assert.strictEqual(result.taxAmount, 180);
    assert.strictEqual(result.totalAmount, 980);
  });
});
