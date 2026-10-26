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

  // Synchronize lastCount for 2026-27 to the highest existing sequence
  const financialYear = '2026-27';
  const latestInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `MHN/INV/${financialYear}/` } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  if (latestInvoice?.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split('/');
    const parsed = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(parsed)) maxSeq = parsed;
  }

  const updatedCounter = await (prisma as any).invoiceCounter.upsert({
    where: { financialYear },
    update: { lastCount: maxSeq },
    create: { financialYear, lastCount: maxSeq },
  });
  console.log(`\nUpdated counter for ${financialYear}: lastCount = ${updatedCounter.lastCount} (Next will be MHN/INV/${financialYear}/${String(maxSeq + 1).padStart(5, '0')})`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
