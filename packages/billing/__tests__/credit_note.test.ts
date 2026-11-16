import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreditNoteNumber } from '../src/core/invoice-number';
import { calculateCreditNoteTaxBreakdown } from '../src/core/credit-note-calculator';
import { renderCreditNoteHtml } from '../src/templates/credit-note-html';

test('Credit Note System & Tax Reversal', async (t) => {
  await t.test('calculates exact full refund tax breakdown', () => {
    const invoice = {
      baseAmount: 10000,
      taxAmount: 1800,
      totalAmount: 11800,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
    };

    const result = calculateCreditNoteTaxBreakdown(11800, invoice);
    assert.equal(result.totalAmount, 11800);
    assert.equal(result.baseAmount, 10000);
    assert.equal(result.taxAmount, 1800);
    assert.equal(result.cgstAmount, 900);
    assert.equal(result.sgstAmount, 900);
    assert.equal(result.igstAmount, 0);
  });

  await t.test('calculates 50% partial refund tax breakdown with exact paisa balance', () => {
    const invoice = {
      baseAmount: 10000,
      taxAmount: 1800,
      totalAmount: 11800,
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
    };

    const result = calculateCreditNoteTaxBreakdown(5900, invoice);
    assert.equal(result.totalAmount, 5900);
    assert.equal(result.baseAmount, 5000);
    assert.equal(result.taxAmount, 900);
    assert.equal(result.cgstAmount, 450);
    assert.equal(result.sgstAmount, 450);
    assert.equal(result.baseAmount + result.taxAmount, result.totalAmount);
  });

  await t.test('calculates inter-state IGST refund breakdown', () => {
    const invoice = {
      baseAmount: 20000,
      taxAmount: 3600,
      totalAmount: 23600,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 3600,
    };

    const result = calculateCreditNoteTaxBreakdown(5000, invoice);
    assert.equal(result.totalAmount, 5000);
    assert.equal(result.cgstAmount, 0);
    assert.equal(result.sgstAmount, 0);
    assert.ok(result.igstAmount > 0);
    assert.equal(result.baseAmount + result.taxAmount, result.totalAmount);
  });

  await t.test('generates sequential Credit Note numbers with MHN/CN prefix', async () => {
    let mockCounter = { financialYear: '2026-27', lastCount: 0 };
    const mockPrisma = {
      creditNoteCounter: {
        upsert: async () => {
          mockCounter.lastCount += 1;
          return { ...mockCounter };
        },
        update: async ({ data }: any) => {
          mockCounter.lastCount = data.lastCount;
          return { ...mockCounter };
        },
      },
      creditNote: {
        findUnique: async () => null,
      },
    };

    const cn1 = await generateCreditNoteNumber(mockPrisma, new Date('2026-11-16'));
    assert.equal(cn1, 'MHN/CN/2026-27/00001');

    const cn2 = await generateCreditNoteNumber(mockPrisma, new Date('2026-11-16'));
    assert.equal(cn2, 'MHN/CN/2026-27/00002');
  });

  await t.test('renders statutory Credit Note HTML with all required fields', () => {
    const html = renderCreditNoteHtml({
      creditNoteNumber: 'MHN/CN/2026-27/00001',
      originalInvoiceNumber: 'MHN/INV/2026-27/00045',
      originalInvoiceDate: new Date('2026-11-01'),
      reason: 'Customer requested cancellation within 7 days',
      company: {
        name: 'MaiHoonNa Eldercare Private Limited',
        address: 'Gurugram, Haryana',
        gstin: '06AAGCM1234F1Z1',
        pan: 'AAGCM1234F',
        email: 'care@maihoonna.com',
        phone: '+91 8826280049',
      },
      recipient: {
        name: 'Rajesh Sharma',
        phone: '9876543210',
        email: 'rajesh@example.com',
        state: 'Haryana',
      },
      breakdown: {
        baseAmount: 10000,
        taxAmount: 1800,
        cgstAmount: 900,
        sgstAmount: 900,
        igstAmount: 0,
        totalAmount: 11800,
      },
      refundDetails: {
        refundMode: 'GATEWAY_ONLINE',
        gatewayRefundId: 'rfnd_test123',
      },
    });

    assert.ok(html.includes('TAX CREDIT NOTE'));
    assert.ok(html.includes('MHN/CN/2026-27/00001'));
    assert.ok(html.includes('MHN/INV/2026-27/00045'));
    assert.ok(html.includes('rfnd_test123'));
    assert.ok(html.includes('Rajesh Sharma'));
  });
});

