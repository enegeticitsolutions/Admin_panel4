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

  const countStr = counter.lastCount.toString().padStart(5, '0');
  return `${prefix}/${financialYear}/${countStr}`;
}
