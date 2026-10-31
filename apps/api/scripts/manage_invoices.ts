import prisma from '../app/core/database';

async function main() {
  console.log('=== CURRENT INVOICE COUNTERS ===');
  const counters = await (prisma as any).invoiceCounter.findMany();
  console.log(counters);

  console.log('\n=== INVOICES WITH TEMP-OLD OR SIMILAR ===');
  const tempInvoices = await prisma.invoice.findMany({
    where: {
      invoiceNumber: {
        contains: 'TEMP',
      },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      subscriber: { select: { id: true, name: true, phone: true } },
      beneficiary: { select: { id: true, name: true } },
      issuedAt: true,
    },
  });
  console.log(`Found ${tempInvoices.length} TEMP invoices:`);
  console.log(JSON.stringify(tempInvoices, null, 2));

  // Synchronize lastCount for 2026-27 to the highest existing sequence (at least 10 for older manual invoices)
  const financialYear = '2026-27';
  const existingInvoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: `MHN/INV/${financialYear}/` } },
    select: { invoiceNumber: true, totalAmount: true, createdAt: true },
    orderBy: { invoiceNumber: 'asc' },
  });

  console.log(`\nFound ${existingInvoices.length} existing invoices for ${financialYear}:`);
  existingInvoices.forEach((inv) => console.log(` - ${inv.invoiceNumber} (${inv.createdAt.toISOString()})`));

  let maxSeq = 10; // Default minimum: 1..10 reserved for manual older invoices
  for (const inv of existingInvoices) {
    if (!inv.invoiceNumber) continue;
    const match = inv.invoiceNumber.match(/\/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const updatedCounter = await (prisma as any).invoiceCounter.upsert({
    where: { financialYear },
    update: { lastCount: maxSeq },
    create: { financialYear, lastCount: maxSeq },
  });
  console.log(`\n======================================================`);
  console.log(`Updated counter for ${financialYear}: lastCount = ${updatedCounter.lastCount}`);
  console.log(`Next automatic invoice will be: MHN/INV/${financialYear}/${String(maxSeq + 1).padStart(5, '0')}`);
  console.log(`(Invoices 00001 to 00010 remain safely reserved for manual management)`);
  console.log(`======================================================\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
