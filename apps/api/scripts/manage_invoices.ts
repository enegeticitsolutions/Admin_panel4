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

  // Set lastCount to 9 for 2026-27
  const financialYear = '2026-27';
  const updatedCounter = await (prisma as any).invoiceCounter.upsert({
    where: { financialYear },
    update: { lastCount: 9 },
    create: { financialYear, lastCount: 9 },
  });
  console.log(`\nUpdated counter for ${financialYear}: lastCount = ${updatedCounter.lastCount} (Next will be MHN/INV/${financialYear}/00010)`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
