import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateInvoiceNumber, currentIndianFinancialYear } from '../src/core/invoice-number';

test('Invoice Number Generator', async (t) => {
  await t.test('currentIndianFinancialYear calculates FY correctly', () => {
    assert.equal(currentIndianFinancialYear(new Date('2026-04-01')), '2026-27');
    assert.equal(currentIndianFinancialYear(new Date('2026-10-26')), '2026-27');
    assert.equal(currentIndianFinancialYear(new Date('2027-03-31')), '2026-27');
    assert.equal(currentIndianFinancialYear(new Date('2027-04-01')), '2027-28');
  });

  await t.test('generates sequential numbers in normal conditions', async () => {
    let mockCounter = { financialYear: '2026-27', lastCount: 0 };
    const mockPrisma = {
      invoiceCounter: {
        upsert: async ({ create, update }: any) => {
          mockCounter.lastCount += 1;
          return { ...mockCounter };
        },
        update: async ({ data }: any) => {
          mockCounter.lastCount = data.lastCount;
          return { ...mockCounter };
        },
      },
      invoice: {
        findUnique: async () => null,
      },
    };

    const num1 = await generateInvoiceNumber(mockPrisma, new Date('2026-10-26'));
    assert.equal(num1, 'MHN/INV/2026-27/00001');

    const num2 = await generateInvoiceNumber(mockPrisma, new Date('2026-10-26'));
    assert.equal(num2, 'MHN/INV/2026-27/00002');
  });

  await t.test('self-heals and jumps past existing invoices when counter is behind', async () => {
    // Counter is stuck at 9, but invoices up to 262 exist in DB
    let mockCounter = { financialYear: '2026-27', lastCount: 9 };
    const existingInvoices = new Set<string>();
    for (let i = 1; i <= 262; i++) {
      existingInvoices.add(`MHN/INV/2026-27/${String(i).padStart(5, '0')}`);
    }

    const mockPrisma = {
      invoiceCounter: {
        upsert: async () => {
          mockCounter.lastCount += 1;
          return { ...mockCounter };
        },
        update: async ({ data }: any) => {
          mockCounter.lastCount = data.lastCount;
          return { ...mockCounter };
        },
      },
      invoice: {
        findUnique: async ({ where }: any) => {
          if (existingInvoices.has(where.invoiceNumber)) {
            return { id: 'exists' };
          }
          return null;
        },
        findFirst: async () => {
          return { invoiceNumber: 'MHN/INV/2026-27/00262' };
        },
      },
    };

    // When generateInvoiceNumber runs, it will detect that 00010 exists,
    // find max sequence 262, and jump to 263!
    const num = await generateInvoiceNumber(mockPrisma, new Date('2026-10-26'));
    assert.equal(num, 'MHN/INV/2026-27/00263');
    assert.equal(mockCounter.lastCount, 263);

    // Next call should normally increment from 263 to 264
    const numNext = await generateInvoiceNumber(mockPrisma, new Date('2026-10-26'));
    assert.equal(numNext, 'MHN/INV/2026-27/00264');
    assert.equal(mockCounter.lastCount, 264);
  });
});
