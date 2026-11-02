/**
 * Sequential Invoice Number generator adhering to statutory Indian Financial Year format:
 * MHN/INV/{YYYY-YY}/{00001}
 */

export function currentIndianFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  // Jan, Feb, Mar belong to the FY that started in the previous year
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1).toString().slice(-2);

  return `${fyStart}-${fyEnd}`;
}

export async function generateInvoiceNumber(
  prismaClient: any,
  forDate: Date = new Date(),
  prefix: string = 'MHN/INV'
): Promise<string> {
  const financialYear = currentIndianFinancialYear(forDate);

  const counter = await prismaClient.invoiceCounter.upsert({
    where: { financialYear },
    update: { lastCount: { increment: 1 } },
    create: { financialYear, lastCount: 1 },
  });

  let nextCount = counter.lastCount;
  let candidate = `${prefix}/${financialYear}/${nextCount.toString().padStart(5, '0')}`;

  // Collision resilience: If the candidate already exists in the invoices table,
  // the sequence counter has drifted (e.g. from data migration, manual scripts, or seeding).
  // Dynamically synchronize the counter past the highest existing sequence.
  if (prismaClient.invoice && typeof prismaClient.invoice.findUnique === 'function') {
    const exists = await prismaClient.invoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });

    if (exists) {
      const latestInvoice = await prismaClient.invoice.findFirst({
        where: { invoiceNumber: { startsWith: `${prefix}/${financialYear}/` } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });

      if (latestInvoice?.invoiceNumber) {
        const match = latestInvoice.invoiceNumber.match(/\/(\d+)$/);
        const maxSeq = match ? parseInt(match[1], 10) : NaN;
        if (!isNaN(maxSeq) && maxSeq >= nextCount) {
          nextCount = maxSeq + 1;
        } else {
          nextCount++;
        }
      } else {
        nextCount++;
      }

      // Loop to guarantee zero collisions under any edge case
      while (true) {
        candidate = `${prefix}/${financialYear}/${nextCount.toString().padStart(5, '0')}`;
        const collision = await prismaClient.invoice.findUnique({
          where: { invoiceNumber: candidate },
          select: { id: true },
        });
        if (!collision) {
          break;
        }
        nextCount++;
      }

      // Fast-forward counter so subsequent invocations are immediately in sync
      await prismaClient.invoiceCounter.update({
        where: { financialYear },
        data: { lastCount: nextCount },
      });
    }
  }

  return candidate;
}

