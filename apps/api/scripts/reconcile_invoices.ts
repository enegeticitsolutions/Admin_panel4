import prisma from '../app/core/database';
import { InvoicePdfService } from '../app/services/invoice/invoice_pdf.service';
import crypto from 'crypto';

function generateUUID(): string {
  return crypto.randomUUID();
}

export async function reconcileInvoices(dryRun = false) {
  console.log(`\n======================================================`);
  console.log(`  STARTING INVOICE RECONCILIATION (dryRun = ${dryRun})`);
  console.log(`======================================================\n`);

  // 1. Fetch all successful payments chronologically
  const payments = await prisma.payment.findMany({
    where: { paymentStatus: 'success' },
    include: {
      subscription: {
        include: {
          package: true,
          beneficiary: true,
        },
      },
      subscriber: true,
    },
    orderBy: [
      { paidAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  console.log(`Total successful payments found: ${payments.length}`);

  const totalPayments = payments.length;
  if (totalPayments === 0) {
    console.log('No payments found.');
    return;
  }

  // 2. Identify payments with and without invoices
  const paymentInvoiceMap: Array<{
    paymentId: string;
    invoiceId: string;
    paidAt: Date;
    isNewlyCreated: boolean;
  }> = [];

  for (const p of payments) {
    const paymentDate = p.paidAt || p.createdAt || new Date();
    let invoiceId = p.invoiceId;

    if (!invoiceId) {
      // Check if an invoice exists matching payment.invoiceNumber
      if (p.invoiceNumber) {
        const existingInv = await prisma.invoice.findFirst({
          where: { invoiceNumber: p.invoiceNumber },
          select: { id: true },
        });
        if (existingInv) {
          invoiceId = existingInv.id;
        }
      }
    }

    if (!invoiceId) {
      // Must create an Invoice record for this payment
      if (dryRun) {
        paymentInvoiceMap.push({
          paymentId: p.id,
          invoiceId: `mock-new-inv-${p.id}`,
          paidAt: paymentDate,
          isNewlyCreated: true,
        });
        continue;
      }

      // Calculate statutory breakdown for standard 18% Eldercare GST (preserving payment.amountPaid exact total)
      const totalAmount = p.amountPaid;
      const baseAmount = Math.round((totalAmount / 1.18) * 100) / 100;
      const taxAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
      const customerState = p.subscription?.beneficiary?.state || p.subscriber?.state || 'Haryana';
      const isHaryana = customerState.trim().toLowerCase() === 'haryana';

      const cgstAmount = isHaryana ? Math.round((taxAmount / 2) * 100) / 100 : 0;
      const sgstAmount = isHaryana ? Math.round((taxAmount - cgstAmount) * 100) / 100 : 0;
      const igstAmount = isHaryana ? 0 : taxAmount;

      const packageName = p.subscription?.package?.name || 'MaiHoonNa Eldercare Subscription Plan';
      const newInvoiceId = generateUUID();
      const tempNumber = `TEMP-NEW-${p.id}`;

      const createdInvoice = await prisma.invoice.create({
        data: {
          id: newInvoiceId,
          invoiceNumber: tempNumber,
          invoiceType: 'SUBSCRIPTION',
          status: 'PAID',
          subscriberId: p.subscriberId,
          beneficiaryId: p.subscription?.beneficiaryId || null,
          subscriptionId: p.subscriptionId || null,
          baseAmount,
          discountAmount: 0,
          saathiDiscountAmount: 0,
          taxAmount,
          totalAmount,
          placeOfSupply: customerState,
          cgstAmount,
          sgstAmount,
          igstAmount,
          issuedAt: paymentDate,
          paidAt: paymentDate,
          items: {
            create: [
              {
                id: generateUUID(),
                description: packageName,
                hsnSacCode: '998399',
                taxRate: 18,
                isGstExempt: false,
                quantity: 1,
                unitPrice: baseAmount,
                amount: baseAmount,
              },
            ],
          },
        },
      });

      // Link payment to this newly created invoice
      await prisma.payment.update({
        where: { id: p.id },
        data: {
          invoiceId: createdInvoice.id,
        },
      });

      paymentInvoiceMap.push({
        paymentId: p.id,
        invoiceId: createdInvoice.id,
        paidAt: paymentDate,
        isNewlyCreated: true,
      });
    } else {
      paymentInvoiceMap.push({
        paymentId: p.id,
        invoiceId,
        paidAt: paymentDate,
        isNewlyCreated: false,
      });
    }
  }

  console.log(`\nReconciled all payments to invoice records.`);
  console.log(`Newly created invoices count: ${paymentInvoiceMap.filter((x) => x.isNewlyCreated).length}`);
  console.log(`Existing invoices count: ${paymentInvoiceMap.filter((x) => !x.isNewlyCreated).length}`);

  if (dryRun) {
    console.log(`[DRY RUN] Would assign sequential numbers MHN/INV/2026-27/00001 to 00${String(totalPayments).padStart(3, '0')}`);
    return;
  }

  // 3. Rename all invoices and payments to temporary values to prevent unique constraint collisions
  console.log(`\nApplying temporary numbering to prevent unique constraint collisions...`);
  for (let i = 0; i < paymentInvoiceMap.length; i++) {
    const item = paymentInvoiceMap[i];
    await prisma.invoice.update({
      where: { id: item.invoiceId },
      data: { invoiceNumber: `TEMP-RENUM-INV-${i + 1}-${item.invoiceId}` },
    });
    await prisma.payment.update({
      where: { id: item.paymentId },
      data: {
        invoiceNumber: `TEMP-RENUM-PAY-${i + 1}-${item.paymentId}`,
        invoiceId: item.invoiceId,
      },
    });
  }

  // 4. Assign canonical sequential invoice numbers (MHN/INV/2026-27/00001 onwards)
  console.log(`\nAssigning canonical sequential numbers MHN/INV/2026-27/00001 to ${totalPayments}...`);
  const financialYear = '2026-27';

  for (let i = 0; i < paymentInvoiceMap.length; i++) {
    const item = paymentInvoiceMap[i];
    const seq = i + 1;
    const seqStr = String(seq).padStart(5, '0');
    const canonicalInvoiceNumber = `MHN/INV/${financialYear}/${seqStr}`;

    await prisma.invoice.update({
      where: { id: item.invoiceId },
      data: {
        invoiceNumber: canonicalInvoiceNumber,
        issuedAt: item.paidAt,
        paidAt: item.paidAt,
      },
    });

    await prisma.payment.update({
      where: { id: item.paymentId },
      data: {
        invoiceNumber: canonicalInvoiceNumber,
        invoiceId: item.invoiceId,
      },
    });

    if (seq % 25 === 0 || seq === totalPayments) {
      console.log(`  Renumbered up to ${seq} / ${totalPayments}: ${canonicalInvoiceNumber}`);
    }
  }

  // 5. Update invoice_counters table to match the highest sequence
  console.log(`\nUpdating invoice_counters for ${financialYear} to ${totalPayments}...`);
  await (prisma as any).invoiceCounter.upsert({
    where: { financialYear },
    update: { lastCount: totalPayments },
    create: { financialYear, lastCount: totalPayments },
  });

  console.log(`Invoice counter updated to ${totalPayments}.`);

  // 6. Generate and upload statutory PDFs in batches
  console.log(`\nGenerating and uploading statutory PDFs to S3 in batches...`);
  const allInvoices = await prisma.invoice.findMany({
    include: {
      subscriber: true,
      beneficiary: true,
      items: true,
      payments: true,
    },
    orderBy: { invoiceNumber: 'asc' },
  });

  const BATCH_SIZE = 5;
  for (let b = 0; b < allInvoices.length; b += BATCH_SIZE) {
    const batch = allInvoices.slice(b, b + BATCH_SIZE);
    await Promise.all(
      batch.map(async (inv) => {
        try {
          const s3Key = await InvoicePdfService.generateAndUploadInvoicePdf(inv);
          console.log(`  ✓ PDF uploaded for ${inv.invoiceNumber} -> ${s3Key}`);
        } catch (err: any) {
          console.error(`  ✗ Error uploading PDF for ${inv.invoiceNumber}:`, err.message);
        }
      })
    );
  }

  console.log(`\n======================================================`);
  console.log(`  INVOICE RECONCILIATION COMPLETED SUCCESSFULLY`);
  console.log(`======================================================\n`);
}

// Allow direct execution via CLI
if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  reconcileInvoices(isDryRun)
    .catch((err) => {
      console.error('Fatal error during reconciliation:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
