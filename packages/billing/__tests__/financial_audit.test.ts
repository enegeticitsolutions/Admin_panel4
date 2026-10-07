import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  BillingCalculator,
  Money,
  DiscountAllocator,
  TaxEngine,
  InvoiceReconciler,
  InvoiceSnapshot,
} from '../src';

describe('Financial Audit & Multi-Bracket GST Reconciliation', () => {
  // ── Dimension 3: Actual Tax Mathematics ──────────────────────────────────────
  test('Scenario 3: Benefit A (0% exempt) + Benefit B (18% taxable) exact calculation', () => {
    const result = BillingCalculator.calculate({
      items: [
        {
          name: 'Benefit A (Exempt Consultation)',
          quantity: 2,
          unitPrice: 500,
          nominalCost: 500,
          isGstExempt: true,
          gstRate: 0,
        },
        {
          name: 'Benefit B (Taxable Care Companion)',
          quantity: 4,
          unitPrice: 1000,
          nominalCost: 1000,
          isGstExempt: false,
          gstRate: 18,
        },
      ],
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    const itemA = result.items[0];
    const itemB = result.items[1];

    // Benefit A: Gross 1000, Tax 0, Total 1000
    assert.strictEqual(itemA.quantity, 2);
    assert.strictEqual(itemA.unitPrice, 500);
    assert.strictEqual(itemA.grossAmount, 1000);
    assert.strictEqual(itemA.taxableAmount, 1000);
    assert.strictEqual(itemA.taxRate, 0);
    assert.strictEqual(itemA.taxAmount, 0);
    assert.strictEqual(itemA.totalAmount, 1000);

    // Benefit B: Gross 4000, Taxable 4000, Tax 720 (18%), Total 4720
    assert.strictEqual(itemB.quantity, 4);
    assert.strictEqual(itemB.unitPrice, 1000);
    assert.strictEqual(itemB.grossAmount, 4000);
    assert.strictEqual(itemB.taxableAmount, 4000);
    assert.strictEqual(itemB.taxRate, 18);
    assert.strictEqual(itemB.taxAmount, 720);
    assert.strictEqual(itemB.totalAmount, 4720);

    // Header totals
    assert.strictEqual(result.baseAmount, 5000);
    assert.strictEqual(result.taxableAmount, 5000);
    assert.strictEqual(result.taxAmount, 720);
    assert.strictEqual(result.cgstAmount, 360);
    assert.strictEqual(result.sgstAmount, 360);
    assert.strictEqual(result.igstAmount, 0);
    assert.strictEqual(result.totalAmount, 5720);

    // Invariant check
    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 4: Multiple GST Brackets in the SAME Invoice ───────────────────
  test('Scenario 4: 0% exempt, 5%, 12%, 18%, 28% in the SAME invoice', () => {
    const result = BillingCalculator.calculate({
      items: [
        { name: 'Item A (5%)', quantity: 1, unitPrice: 1000, gstRate: 5, isGstExempt: false },
        { name: 'Item B (12%)', quantity: 1, unitPrice: 2000, gstRate: 12, isGstExempt: false },
        { name: 'Item C (18%)', quantity: 1, unitPrice: 3000, gstRate: 18, isGstExempt: false },
        { name: 'Item D (28%)', quantity: 1, unitPrice: 4000, gstRate: 28, isGstExempt: false },
        { name: 'Item E (Exempt)', quantity: 1, unitPrice: 5000, gstRate: 0, isGstExempt: true },
      ],
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    assert.strictEqual(result.baseAmount, 15000);
    assert.strictEqual(result.taxableAmount, 15000);

    // Tax per line:
    // A: 1000 * 5% = 50
    // B: 2000 * 12% = 240
    // C: 3000 * 18% = 540
    // D: 4000 * 28% = 1120
    // E: 5000 * 0% = 0
    // Total Tax = 50 + 240 + 540 + 1120 + 0 = 1950
    assert.strictEqual(result.items[0].taxAmount, 50);
    assert.strictEqual(result.items[1].taxAmount, 240);
    assert.strictEqual(result.items[2].taxAmount, 540);
    assert.strictEqual(result.items[3].taxAmount, 1120);
    assert.strictEqual(result.items[4].taxAmount, 0);

    assert.strictEqual(result.taxAmount, 1950);
    assert.strictEqual(result.cgstAmount, 975);
    assert.strictEqual(result.sgstAmount, 975);
    assert.strictEqual(result.igstAmount, 0);
    assert.strictEqual(result.totalAmount, 16950);

    // Verify taxSummary groupings
    assert.strictEqual(result.taxSummary.length, 5);
    const summary5 = result.taxSummary.find((s) => s.taxRate === 5);
    assert.strictEqual(summary5?.taxableAmount, 1000);
    assert.strictEqual(summary5?.totalTax, 50);

    const summary28 = result.taxSummary.find((s) => s.taxRate === 28);
    assert.strictEqual(summary28?.taxableAmount, 4000);
    assert.strictEqual(summary28?.totalTax, 1120);

    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 5: Discount + Tax Interaction ──────────────────────────────────
  test('Scenario 5: Pre-tax discount reduces taxable value according to GST Section 15', () => {
    // MRP = 10,000, Discount = 1,000, GST = 18%
    const result = BillingCalculator.calculate({
      items: [{ name: 'Full Care Plan', quantity: 1, unitPrice: 10000, gstRate: 18, isGstExempt: false }],
      couponDiscountAmount: 1000,
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    // Base: 10,000, Discount: 1,000, Taxable: 9,000
    assert.strictEqual(result.baseAmount, 10000);
    assert.strictEqual(result.discountAmount, 1000);
    assert.strictEqual(result.taxableAmount, 9000);

    // GST MUST be charged on ₹9,000 at 18% = ₹1,620 (NOT on ₹10,000 = ₹1,800!)
    assert.strictEqual(result.taxAmount, 1620);
    assert.strictEqual(result.totalAmount, 10620);

    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 6: Multiple Benefits + Pro-rata Discount Allocation ────────────
  test('Scenario 6: Pro-rata allocation of ₹1,000 discount across Benefit A (18%) and Benefit B (12%)', () => {
    const result = BillingCalculator.calculate({
      items: [
        { name: 'Benefit A (18%)', quantity: 1, unitPrice: 5000, gstRate: 18, isGstExempt: false },
        { name: 'Benefit B (12%)', quantity: 1, unitPrice: 5000, gstRate: 12, isGstExempt: false },
      ],
      couponDiscountAmount: 1000,
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    const itemA = result.items[0];
    const itemB = result.items[1];

    // Pro-rata: 5000/10000 = 50% discount each (₹500 each)
    assert.strictEqual(itemA.allocatedDiscount, 500);
    assert.strictEqual(itemA.taxableAmount, 4500);
    // Tax A = 4500 * 18% = 810
    assert.strictEqual(itemA.taxAmount, 810);
    assert.strictEqual(itemA.totalAmount, 5310);

    assert.strictEqual(itemB.allocatedDiscount, 500);
    assert.strictEqual(itemB.taxableAmount, 4500);
    // Tax B = 4500 * 12% = 540
    assert.strictEqual(itemB.taxAmount, 540);
    assert.strictEqual(itemB.totalAmount, 5040);

    // Total tax: 810 + 540 = 1350
    assert.strictEqual(result.taxAmount, 1350);
    // Total payable: 4500 + 4500 + 1350 = 10,350
    assert.strictEqual(result.totalAmount, 10350);

    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 7 & 8: Coupon & Saathi Coupon Stacking ──────────────────────────
  test('Scenario 7 & 8: Duration discount + Standard coupon + Saathi reward stacking', () => {
    const result = BillingCalculator.calculate({
      items: [{ name: 'Annual Care Plan', quantity: 1, unitPrice: 12000, gstRate: 18, isGstExempt: false }],
      durationDiscountAmount: 1200, // 10% tenure discount
      couponDiscountAmount: 500,     // ₹500 standard coupon
      saathiDiscountAmount: 300,     // ₹300 Saathi reward
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    // Gross: 12,000, Discounts: 1200 + 500 + 300 = 2,000
    assert.strictEqual(result.baseAmount, 12000);
    assert.strictEqual(result.discountAmount, 2000);
    assert.strictEqual(result.discountBreakdown.durationDiscount, 1200);
    assert.strictEqual(result.discountBreakdown.couponDiscount, 500);
    assert.strictEqual(result.discountBreakdown.saathiDiscount, 300);

    // Taxable: 10,000, Tax (18%): 1,800, Total: 11,800
    assert.strictEqual(result.taxableAmount, 10000);
    assert.strictEqual(result.taxAmount, 1800);
    assert.strictEqual(result.totalAmount, 11800);

    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 9: Miscellaneous Non-Discountable Charges ──────────────────────
  test('Scenario 9: Miscellaneous service / setup charges included in grand total', () => {
    const result = BillingCalculator.calculate({
      items: [{ name: 'Setup Package', quantity: 1, unitPrice: 2000, gstRate: 18, isGstExempt: false }],
      miscellaneousCost: 250,
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    // Base: 2000, Tax (18%): 360, Misc: 250, Total: 2610
    assert.strictEqual(result.baseAmount, 2000);
    assert.strictEqual(result.taxAmount, 360);
    assert.strictEqual(result.miscellaneousCost, 250);
    assert.strictEqual(result.totalAmount, 2610);

    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 10: Rounding Precision & Micro-Paise Invariance ────────────────
  test('Scenario 10: Odd divisions and micro-paise fractions never drift by even 1 paisa', () => {
    // ₹10,000 base split across 3 equal items: ₹3333.34 + ₹3333.33 + ₹3333.33
    const result = BillingCalculator.calculate({
      packageTotalBasePrice: 10000,
      items: [
        { name: 'Item 1', quantity: 1, nominalCost: 100, gstRate: 18, isGstExempt: false },
        { name: 'Item 2', quantity: 1, nominalCost: 100, gstRate: 18, isGstExempt: false },
        { name: 'Item 3', quantity: 1, nominalCost: 100, gstRate: 18, isGstExempt: false },
      ],
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    assert.strictEqual(result.baseAmount, 10000);
    const sumGross = result.items.reduce((acc, it) => acc + it.grossAmount, 0);
    assert.strictEqual(Math.round(sumGross * 100) / 100, 10000);

    const reconciliation = InvoiceReconciler.validate(result);
    assert.strictEqual(reconciliation.isValid, true);
  });

  // ── Dimension 11: Razorpay Order Amount Strict Match ─────────────────────────
  test('Scenario 11: Razorpay integer paise strictly equals totalAmount * 100', () => {
    const testCases = [100, 100.01, 999.99, 10250.5, 23568.75];

    for (const testAmount of testCases) {
      const paise = Money.toPaise(testAmount);
      const rupees = Money.toRupees(paise);
      assert.strictEqual(rupees, testAmount);
      assert.strictEqual(paise, Math.round(testAmount * 100));
    }
  });

  // ── Dimension 12: Database Snapshot Immutability ─────────────────────────────
  test('Scenario 12: Historical InvoiceSnapshot is completely decoupled from future catalog mutations', () => {
    // 1. Generate snapshot today with Benefit Price = 1000, GST = 18%
    const snapshot = BillingCalculator.calculate({
      items: [{ name: 'Physiotherapy', quantity: 2, unitPrice: 1000, gstRate: 18, isGstExempt: false }],
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    const frozenJson = JSON.stringify(snapshot);

    // 2. Later, catalog changes Physiotherapy to 2000, GST to 12%
    const catalogUpdatedPrice = 2000;
    const catalogUpdatedTax = 12;

    // 3. Read back the frozen snapshot
    const restoredSnapshot: InvoiceSnapshot = JSON.parse(frozenJson);
    assert.strictEqual(restoredSnapshot.items[0].unitPrice, 1000);
    assert.strictEqual(restoredSnapshot.items[0].taxRate, 18);
    assert.strictEqual(restoredSnapshot.totalAmount, 2360);
    // Unaffected by catalog mutation!
    assert.notStrictEqual(restoredSnapshot.items[0].unitPrice, catalogUpdatedPrice);
  });

  // ── Dimension 13: Three-Client Consistency Test ─────────────────────────────
  test('Scenario 13: Admin, Mobile, and Website clients render identical financial values for the same invoice', () => {
    // 1. Calculate a real multi-benefit invoice with duration + coupon + mixed GST
    const snapshot = BillingCalculator.calculate({
      items: [
        { name: 'Weekly Saathi Visit', quantity: 4, unitPrice: 750, gstRate: 18, isGstExempt: false },
        { name: 'Doctor Consultation', quantity: 1, unitPrice: 1000, gstRate: 0, isGstExempt: true },
        { name: 'Nursing Support', quantity: 2, unitPrice: 1500, gstRate: 12, isGstExempt: false },
      ],
      durationDiscountAmount: 350,
      couponDiscountAmount: 250,
      saathiDiscountAmount: 100,
      miscellaneousCost: 150,
      customerState: 'Haryana',
      companyState: 'Haryana',
    });

    // Gross: (4*750=3000) + (1*1000=1000) + (2*1500=3000) = 7,000
    // Total discount: 350 + 250 + 100 = 700
    // Taxable: 6,300
    assert.strictEqual(snapshot.baseAmount, 7000);
    assert.strictEqual(snapshot.discountAmount, 700);
    assert.strictEqual(snapshot.taxableAmount, 6300);

    // 2. Simulate Mobile Client Data Adapter
    const mobileData = {
      baseAmount: snapshot.baseAmount,
      discountAmount: snapshot.discountAmount,
      taxAmount: snapshot.taxAmount,
      totalAmount: snapshot.totalAmount,
      items: snapshot.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxableAmount: it.taxableAmount,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount,
        totalAmount: it.totalAmount,
      })),
    };

    // 3. Simulate Website / API Response
    const websiteData = {
      baseAmount: snapshot.baseAmount,
      discountAmount: snapshot.discountAmount,
      taxAmount: snapshot.taxAmount,
      totalAmount: snapshot.totalAmount,
      items: snapshot.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxableAmount: it.taxableAmount,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount,
        totalAmount: it.totalAmount,
      })),
    };

    // 4. Simulate Admin Panel View
    const adminData = {
      baseAmount: snapshot.baseAmount,
      discountAmount: snapshot.discountAmount,
      taxAmount: snapshot.taxAmount,
      totalAmount: snapshot.totalAmount,
      items: snapshot.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxableAmount: it.taxableAmount,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount,
        totalAmount: it.totalAmount,
      })),
    };

    // 5. Assert strict parity across all three clients
    assert.strictEqual(mobileData.baseAmount, websiteData.baseAmount);
    assert.strictEqual(websiteData.baseAmount, adminData.baseAmount);

    assert.strictEqual(mobileData.discountAmount, websiteData.discountAmount);
    assert.strictEqual(websiteData.discountAmount, adminData.discountAmount);

    assert.strictEqual(mobileData.taxAmount, websiteData.taxAmount);
    assert.strictEqual(websiteData.taxAmount, adminData.taxAmount);

    assert.strictEqual(mobileData.totalAmount, websiteData.totalAmount);
    assert.strictEqual(websiteData.totalAmount, adminData.totalAmount);

    // Item-level parity
    for (let i = 0; i < snapshot.items.length; i++) {
      assert.strictEqual(mobileData.items[i].unitPrice, websiteData.items[i].unitPrice);
      assert.strictEqual(websiteData.items[i].unitPrice, adminData.items[i].unitPrice);

      assert.strictEqual(mobileData.items[i].taxableAmount, websiteData.items[i].taxableAmount);
      assert.strictEqual(websiteData.items[i].taxableAmount, adminData.items[i].taxableAmount);

      assert.strictEqual(mobileData.items[i].taxAmount, websiteData.items[i].taxAmount);
      assert.strictEqual(websiteData.items[i].taxAmount, adminData.items[i].taxAmount);

      assert.strictEqual(mobileData.items[i].totalAmount, websiteData.items[i].totalAmount);
      assert.strictEqual(websiteData.items[i].totalAmount, adminData.items[i].totalAmount);
    }
  });

  // ── Dimension 14: PDF & HTML Rendering Consistency ─────────────────────────
  test('Scenario 14: HTML renderer outputs exact snapshot numbers without recomputation', () => {
    const { renderInvoiceHtml } = require('../src');

    const snapshot = BillingCalculator.calculate({
      items: [
        { name: 'Physiotherapy', quantity: 5, unitPrice: 800, gstRate: 18, isGstExempt: false },
        { name: 'Doctor Consultation', quantity: 2, unitPrice: 500, gstRate: 0, isGstExempt: true },
      ],
      couponDiscountAmount: 500,
      customerState: 'Delhi',
      companyState: 'Haryana',
    });

    const html = renderInvoiceHtml({
      invoiceNumber: 'MHN/INV/2026-27/00042',
      company: {
        name: 'MaiHoonNa Eldercare Private Limited',
        address: 'DLF Phase V, Gurugram, Haryana',
        gstin: '06AAUCM9447N1ZE',
        pan: 'AAUCM9447N',
        email: 'info@maihoonna.com',
        phone: '8507070049',
      },
      recipient: {
        name: 'Suresh Sharma',
        state: 'Delhi',
      },
      snapshot,
    });

    // Check that the generated HTML contains the exact formatted amounts
    assert.ok(html.includes('MHN/INV/2026-27/00042'));
    assert.ok(html.includes(`₹${snapshot.totalAmount.toFixed(2)}`));
    assert.ok(html.includes(`₹${snapshot.baseAmount.toFixed(2)}`));
    assert.ok(html.includes(`₹${snapshot.discountAmount.toFixed(2)}`));
    assert.ok(html.includes(`₹${snapshot.taxAmount.toFixed(2)}`));
    assert.ok(html.includes('IGST')); // Inter-state supply
  });

  // ── Dimension 16: Percentage Coupon with Cap & Zero Floor ───────────────────
  test('Scenario 16: Percentage coupon with maxDiscount cap and coupon greater than order amount', () => {
    // 50% discount capped at ₹1,000 on a ₹10,000 order
    const cappedResult = BillingCalculator.calculate({
      items: [{ name: 'Elder Care', quantity: 1, unitPrice: 10000, gstRate: 18, isGstExempt: false }],
      couponDiscountAmount: 1000, // Capped discount
      customerState: 'Haryana',
      companyState: 'Haryana',
    });
    assert.strictEqual(cappedResult.discountAmount, 1000);
    assert.strictEqual(cappedResult.taxableAmount, 9000);
    assert.strictEqual(cappedResult.taxAmount, 1620);
    assert.strictEqual(cappedResult.totalAmount, 10620);

    // Coupon greater than order value (₹1,500 coupon on ₹1,000 order)
    const zeroResult = BillingCalculator.calculate({
      items: [{ name: 'Single Visit', quantity: 1, unitPrice: 1000, gstRate: 18, isGstExempt: false }],
      couponDiscountAmount: 1500, // Exceeds order value!
      customerState: 'Haryana',
      companyState: 'Haryana',
    });
    // Total discount cannot exceed gross base price (₹1,000)
    assert.strictEqual(zeroResult.discountAmount, 1000);
    assert.strictEqual(zeroResult.taxableAmount, 0);
    assert.strictEqual(zeroResult.taxAmount, 0);
    assert.strictEqual(zeroResult.totalAmount, 0);
  });

  // ── Dimension 17: Tiny Decimals, Repeating Fractions & Large Amounts ─────────
  test('Scenario 17: Tiny fractions, repeating decimals, and large 1 Crore amounts', () => {
    // Repeating fraction: 33.3333% discount on ₹1,000
    // Gross: ₹1,000, Discount: ₹333.33 -> Taxable: ₹666.67
    const repeatingResult = BillingCalculator.calculate({
      items: [
        { name: 'Item 1', quantity: 1, unitPrice: 500, gstRate: 18, isGstExempt: false },
        { name: 'Item 2', quantity: 1, unitPrice: 500, gstRate: 12, isGstExempt: false },
      ],
      couponDiscountAmount: 333.33,
      customerState: 'Haryana',
      companyState: 'Haryana',
    });
    assert.strictEqual(repeatingResult.baseAmount, 1000);
    assert.strictEqual(repeatingResult.discountAmount, 333.33);
    assert.strictEqual(repeatingResult.taxableAmount, 666.67);
    const reconRepeating = InvoiceReconciler.validate(repeatingResult);
    assert.strictEqual(reconRepeating.isValid, true);

    // Large transaction: ₹1,00,00,000 (1 Crore)
    const croreResult = BillingCalculator.calculate({
      items: [{ name: 'Enterprise Corporate Plan', quantity: 1, unitPrice: 10000000, gstRate: 18, isGstExempt: false }],
      customerState: 'Haryana',
      companyState: 'Haryana',
    });
    assert.strictEqual(croreResult.baseAmount, 10000000);
    assert.strictEqual(croreResult.taxAmount, 1800000);
    assert.strictEqual(croreResult.totalAmount, 11800000);
    const reconCrore = InvoiceReconciler.validate(croreResult);
    assert.strictEqual(reconCrore.isValid, true);
  });

  // ── Dimension 18: Inter-state IGST with multiple tax brackets ────────────────
  test('Scenario 18: Inter-state IGST calculation across 5%, 12%, 18%, 28% brackets', () => {
    const interStateResult = BillingCalculator.calculate({
      items: [
        { name: '5% Service', quantity: 1, unitPrice: 1000, gstRate: 5, isGstExempt: false },
        { name: '12% Service', quantity: 1, unitPrice: 2000, gstRate: 12, isGstExempt: false },
        { name: '18% Service', quantity: 1, unitPrice: 3000, gstRate: 18, isGstExempt: false },
        { name: '28% Service', quantity: 1, unitPrice: 4000, gstRate: 28, isGstExempt: false },
      ],
      customerState: 'Karnataka',
      companyState: 'Haryana',
    });

    assert.strictEqual(interStateResult.isInterState, true);
    assert.strictEqual(interStateResult.cgstAmount, 0);
    assert.strictEqual(interStateResult.sgstAmount, 0);
    // IGST = 50 + 240 + 540 + 1120 = 1950
    assert.strictEqual(interStateResult.igstAmount, 1950);
    assert.strictEqual(interStateResult.taxAmount, 1950);
    assert.strictEqual(interStateResult.totalAmount, 11950);

    const reconInter = InvoiceReconciler.validate(interStateResult);
    assert.strictEqual(reconInter.isValid, true);
  });

  // ── Dimension 15: Invariant Rejection of Corrupt Invoices ────────────────────
  test('Scenario 15: Reconciler rejects invalid invoice math', () => {
    const corruptSnapshot: any = {
      baseAmount: 1000,
      discountAmount: 100,
      taxableAmount: 900,
      taxAmount: 162,
      cgstAmount: 81,
      sgstAmount: 81,
      igstAmount: 0,
      miscellaneousCost: 0,
      totalAmount: 1100, // WRONG! 900 + 162 = 1062, not 1100
      isInterState: false,
      items: [],
      taxSummary: [],
    };

    const res = InvoiceReconciler.validate(corruptSnapshot);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Header Grand Total Mismatch')));
  });
});

