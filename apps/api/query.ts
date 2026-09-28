import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const invoice = await prisma.invoice.findFirst({ orderBy: { issuedAt: 'desc' }, include: { items: true } });
  console.log(JSON.stringify(invoice, null, 2));
}
run();
