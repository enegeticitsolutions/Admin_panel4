const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../api/.env') });
}
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}

const { prisma } = require('../lib/prisma');
const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

/**
 * 13 Official Historical Transactions (Ground-Truth Ledger from Razorpay & Cash records)
 */
const GROUND_TRUTH = [
  {
    seq: 1,
    date: '2026-09-30T14:23:00Z',
    subscriberPhone: '8826352088',
    subscriberName: 'Nidhi Kejriwal',
    city: 'Delhi',
    state: 'Delhi',
    beneficiaryName: 'VK Khullar',
    serviceDescription: 'GDA Support for Mr. Khullar (12 hrs)',
    hsnSacCode: '998399',
    amount: 2507.50,
    method: 'Razorpay UPI',
    razorpayPaymentId: 'pay_TiBnE9gdCfIjlg',
  },
  {
    seq: 2,
    date: '2026-10-04T18:55:00Z',
    subscriberPhone: '9220995005',
    subscriberName: 'Bhanu Kharbanda',
    city: 'Delhi',
    state: 'Delhi',
    beneficiaryName: 'Savita Kharbanda',
    serviceDescription: 'GDA 24 hrs package for Mrs Savita kharbanda',
    hsnSacCode: '998399',
    amount: 4600.01,
    method: 'Razorpay Card',
    razorpayPaymentId: 'pay_TjqYdZgwKWfIYf',
    notes: 'Re-link from misattributed test notes to Bhanu Kharbanda',
  },
  {
    seq: 3,
    date: '2026-10-07T10:40:00Z',
    subscriberPhone: '9220995005',
    subscriberName: 'Bhanu Kharbanda',
    city: 'Delhi',
    state: 'Delhi',
    beneficiaryName: 'Savita Kharbanda',
    serviceDescription: 'Add-on: Verified Daily Assistance Support 24hrs (on request)',
    hsnSacCode: '998399',
    amount: 11500.00,
    method: 'Razorpay Card',
    razorpayPaymentId: 'pay_Tktj7lJVNazP7i',
  },
  {
    seq: 4,
    date: '2026-10-07T18:11:00Z',
    subscriberPhone: '9911051264',
    subscriberName: 'Pushpa Virmani',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Pushpa Virmani',
    serviceDescription: 'Care Saathi and Rehab Intro',
    hsnSacCode: '998399',
    amount: 1224.40,
    method: 'Razorpay UPI',
    razorpayPaymentId: 'pay_Tl1Pczwqi7g4fJ',
  },
  {
    seq: 5,
    date: '2026-10-08T10:30:00Z',
    subscriberPhone: '9220995005',
    subscriberName: 'Bhanu Kharbanda',
    city: 'Delhi',
    state: 'Delhi',
    beneficiaryName: 'Savita Kharbanda',
    serviceDescription: 'Add-on: Catheterisation (1 unit)',
    hsnSacCode: '998399',
    amount: 2360.00,
    method: 'Razorpay Card',
    razorpayPaymentId: 'pay_TlI6Fjxjn3737M',
  },
  {
    seq: 6,
    date: '2026-10-13T14:32:00Z',
    subscriberPhone: '9911051264',
    subscriberName: 'Pushpa Virmani',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Pushpa Virmani',
    serviceDescription: 'Physio & Saathi Companionship Intro',
    hsnSacCode: '998399',
    amount: 2852.80,
    method: 'Razorpay UPI',
    razorpayPaymentId: 'pay_TnKtAHBBPe6mX0',
  },
  {
    seq: 7,
    date: '2026-10-15T12:00:00Z',
    subscriberPhone: '9810378069',
    subscriberName: 'Usha Bajaj',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Usha Bajaj',
    serviceDescription: 'Rehab Physio (5 visits)',
    hsnSacCode: '998399',
    amount: 4513.50,
    method: 'Cash',
  },
  {
    seq: 8,
    date: '2026-10-20T17:06:00Z',
    subscriberPhone: '9953064904',
    subscriberName: 'Indu Chopra',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Indu Chopra',
    serviceDescription: 'Care Mitra - Injection Visit',
    hsnSacCode: '998399',
    amount: 599.44,
    method: 'Razorpay UPI',
    razorpayPaymentId: 'pay_Tq9FtOkYeHe7Li',
  },
  {
    seq: 9,
    date: '2026-10-23T11:02:00Z',
    subscriberPhone: '9818146859',
    subscriberName: 'Manisha Chawla',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Kishan Narain Kapoor',
    serviceDescription: 'GDA 12 hrs package for Mr Kishan Narain Kapoor',
    hsnSacCode: '998399',
    amount: 1199.99,
    method: 'Razorpay UPI',
    razorpayPaymentId: 'pay_TrEei8bT8HW6rR',
  },
  {
    seq: 10,
    date: '2026-10-25T11:22:00Z',
    subscriberPhone: '9818146859',
    subscriberName: 'Manisha Chawla',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Kishan Narain Kapoor',
    serviceDescription: 'Add-on: Verified Daily Assistance Support 12hrs (7 units)',
    hsnSacCode: '998399',
    amount: 8399.92,
    method: 'Razorpay Card',
    razorpayPaymentId: 'pay_Ts23rCCxvp5oli',
  },
  {
    seq: 11,
    date: '2026-10-30T12:00:00Z',
    subscriberPhone: '9911220871',
    subscriberName: 'Pushkar Chopra',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Pushkar Chopra',
    serviceDescription: 'Rehab Physio',
    hsnSacCode: '998399',
    amount: 6999.76,
    method: 'Cash',
  },
  {
    seq: 12,
    date: '2026-10-31T11:00:00Z',
    subscriberPhone: '9811173993',
    subscriberName: 'Vidhya Gudwani',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Vidhya Gudwani',
    serviceDescription: 'Rehab Physio',
    hsnSacCode: '998399',
    amount: 5000.00,
    method: 'Cash',
  },
  {
    seq: 13,
    date: '2026-10-31T11:54:00Z',
    subscriberPhone: '9818146859',
    subscriberName: 'Manisha Chawla',
    city: 'Gurgaon',
    state: 'Haryana',
    beneficiaryName: 'Kishan Narain Kapoor',
    serviceDescription: 'Add-on: Verified Daily Assistance Support 12hrs (7 units)',
    hsnSacCode: '998399',
    amount: 8399.92,
    method: 'Razorpay UPI',
    razorpayPaymentId: 'pay_TuPoqZDePsAV92',
  },
];

async function main() {
  const isExecute = process.argv.includes('--execute');
  const isDryRun = !isExecute;

  console.log('\n' + '='.repeat(90));
  console.log(`   MAIHOONNA PRODUCTION LEDGER RECONCILIATION & INVOICE NUMBERING`);
  console.log(`   MODE: ${isDryRun ? '🔍 [DRY RUN - Safe Preview, Zero DB writes]' : '🚀 [EXECUTE - Live Database Update]'}`);
  console.log('='.repeat(90) + '\n');

  // 1. Fetch current database state
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, phone: true, role: true, state: true, city: true, flatPlot: true, streetArea: true, landmark: true, pincode: true },
  });
  const userByPhone = new Map();
  for (const u of allUsers) {
    if (u.phone) {
      const clean = u.phone.replace(/\D/g, '').slice(-10);
      userByPhone.set(clean, u);
    }
  }

  const allBeneficiaries = await prisma.beneficiary.findMany({
    select: { id: true, name: true, subscriberId: true, address: true, city: true, state: true, pincode: true },
  });

  const allPayments = await prisma.payment.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      subscriber: true,
      beneficiary: true,
      subscription: true,
    },
  });

  const allInvoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      items: true,
      subscriber: true,
      beneficiary: true,
    },
  });

  console.log(`Fetched ${allUsers.length} users, ${allBeneficiaries.length} beneficiaries, ${allPayments.length} payments, and ${allInvoices.length} invoices from DB.`);

  // 2. Perform Automatic Backup before executing
  if (!isDryRun) {
    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `backup_before_reconcile_${Date.now()}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          payments: allPayments,
          invoices: allInvoices,
        },
        null,
        2
      )
    );
    console.log(`\n🛡️ Safety Backup created at: ${backupPath}\n`);
  }

  // 3. Reconcile each Ground Truth Item
  const financialYear = '2026-27';
  const prefix = 'MHN/INV';
  const matchedPaymentIds = new Set();
  const actionsSummary = [];

  for (const item of GROUND_TRUTH) {
    const canonicalInvoiceNumber = `${prefix}/${financialYear}/${String(item.seq).padStart(5, '0')}`;
    const cleanPhone = item.subscriberPhone.slice(-10);
    const subscriber = userByPhone.get(cleanPhone);

    if (!subscriber) {
      throw new Error(`CRITICAL: Subscriber with phone ${item.subscriberPhone} (${item.subscriberName}) not found in users table!`);
    }

    // Find the single real payment record in DB
    let payment = allPayments.find((p) => {
      if (item.razorpayPaymentId) {
        if (p.gatewayPaymentId === item.razorpayPaymentId || p.transactionId === item.razorpayPaymentId) {
          return true;
        }
      }
      const pPhone = (p.subscriber?.phone || '').replace(/\D/g, '').slice(-10);
      const isSamePhone = pPhone === cleanPhone || p.subscriberId === subscriber.id;
      const isSameAmount = Math.abs(p.amountPaid - item.amount) < 1.0;
      return isSamePhone && isSameAmount && !matchedPaymentIds.has(p.id);
    });

    // Special case for Bhanu Kharbanda's misattributed payment (pay_TjqYdZgwKWfIYf)
    if (!payment && item.razorpayPaymentId === 'pay_TjqYdZgwKWfIYf') {
      payment = allPayments.find(
        (p) =>
          p.transactionId === 'pay_TjqYdZgwKWfIYf' ||
          p.gatewayPaymentId === 'pay_TjqYdZgwKWfIYf' ||
          Math.abs(p.amountPaid - 4600.01) < 0.1
      );
    }

    if (payment) {
      matchedPaymentIds.add(payment.id);
    }

    // 1. Resolve State & City: Check DB address first (User -> Beneficiary), fallback to Ground Truth from Excel
    const ben = allBeneficiaries.find((b) => b.subscriberId === subscriber.id);
    const dbCity = (subscriber.city || ben?.city || '').trim();
    const dbState = (subscriber.state || ben?.state || '').trim();

    let rawCity = dbCity || item.city || 'Gurgaon';
    let rawState = dbState || item.state || 'Haryana';

    let resolvedCity = rawCity;
    let resolvedState = rawState;

    // Normalization rule:
    // If city or state contains 'delhi' -> State is Delhi -> Inter-state supply -> IGST 18%
    // Otherwise (blank / Gurgaon / Haryana / other) -> Gurgaon, Haryana -> Intra-state supply -> CGST 9% + SGST 9%
    if (rawCity.toLowerCase().includes('delhi') || rawState.toLowerCase().includes('delhi')) {
      resolvedCity = 'Delhi';
      resolvedState = 'Delhi';
    } else {
      resolvedCity = 'Gurgaon';
      resolvedState = 'Haryana';
    }

    const isHaryana = resolvedState.toLowerCase() === 'haryana';
    const totalAmount = item.amount;
    const baseAmount = Math.round((totalAmount / 1.18) * 100) / 100;
    const taxAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
    const cgstAmount = isHaryana ? Math.round((taxAmount / 2) * 100) / 100 : 0;
    const sgstAmount = isHaryana ? Math.round((taxAmount - cgstAmount) * 100) / 100 : 0;
    const igstAmount = isHaryana ? 0 : taxAmount;

    actionsSummary.push({
      seq: item.seq,
      invoiceNumber: canonicalInvoiceNumber,
      subscriberName: item.subscriberName,
      subscriberId: subscriber.id,
      paymentId: payment ? payment.id : 'TO_CREATE',
      currentPaymentStatus: payment ? payment.paymentStatus : 'NEW',
      currentInvoiceNumber: payment?.invoiceNumber || 'NONE',
      amount: item.amount,
      baseAmount,
      taxAmount,
      igstAmount,
      cgstAmount,
      sgstAmount,
      customerCity: resolvedCity,
      customerState: resolvedState,
      taxType: isHaryana ? 'CGST(9%)+SGST(9%)' : 'IGST(18%)',
      serviceDescription: item.serviceDescription,
      date: item.date,
      razorpayId: item.razorpayPaymentId || 'CASH',
    });
  }

  // Identify duplicate/phantom payments to void
  const phantomPayments = allPayments.filter((p) => {
    const isTest =
      (p.subscriber?.phone || '').includes('8585858585') ||
      (p.subscriber?.name || '').toLowerCase().includes('anirudh');
    if (isTest) return false;
    if (matchedPaymentIds.has(p.id)) return false;

    const cleanPhone = (p.subscriber?.phone || '').replace(/\D/g, '').slice(-10);
    const isRealSubscriber = GROUND_TRUTH.some((g) => g.subscriberPhone.slice(-10) === cleanPhone);

    return isRealSubscriber;
  });

  // Display Table Preview
  console.log('='.repeat(115));
  console.log('   CANONICAL STATUTORY 13 INVOICE MAPPING (PREVIEW)');
  console.log('='.repeat(115));
  actionsSummary.forEach((a) => {
    console.log(
      `[${String(a.seq).padStart(2, '0')}] ${a.invoiceNumber} | ₹${a.amount.toFixed(2).padStart(8)} | ${a.subscriberName.padEnd(16)} | City: ${a.customerCity.padEnd(8)} | State: ${a.customerState.padEnd(7)} | ${a.taxType.padEnd(18)} | Base: ₹${a.baseAmount.toFixed(2)} | Tax: ₹${a.taxAmount.toFixed(2)}`
    );
  });

  console.log('\n' + '-'.repeat(100));
  console.log(`   IDENTIFIED PHANTOM / DUPLICATE PAYMENTS TO SOFT-VOID (${phantomPayments.length}):`);
  console.log('-'.repeat(100));
  phantomPayments.forEach((p) => {
    console.log(
      ` - Payment ID: ${p.id} | ₹${p.amountPaid} [${p.paymentStatus}] on ${p.createdAt.toISOString().slice(0, 10)} | Subscriber: ${p.subscriber?.name || p.subscriberId} | Method: ${p.paymentMethod}`
    );
  });

  if (isDryRun) {
    console.log('\n' + '='.repeat(100));
    console.log('   DRY RUN COMPLETE: No data was written to the database.');
    console.log('   To apply these changes, execute:');
    console.log('   node scripts/reconcile_production_ledger.js --execute');
    console.log('='.repeat(100) + '\n');
    return;
  }

  // 4. EXECUTION PHASE (Inside atomic prisma transaction)
  console.log('\nApplying changes to production database in an atomic transaction...');

  await prisma.$transaction(
    async (tx) => {
      // Step A: Free up canonical invoice number sequence
      console.log('  1. Freeing up canonical invoice number sequence...');
      await tx.$executeRawUnsafe(`
        UPDATE invoices 
        SET "invoiceNumber" = 'TEMP-RENAMED-' || id 
        WHERE "invoiceNumber" LIKE 'MHN/INV/%'
      `);
      await tx.$executeRawUnsafe(`
        UPDATE payments 
        SET "invoiceNumber" = 'TEMP-RENAMED-' || id 
        WHERE "invoiceNumber" LIKE 'MHN/INV/%'
      `);

      // Step B: Soft-void all phantom duplicate payments
      console.log(`  2. Soft-voiding ${phantomPayments.length} duplicate payments...`);
      for (const p of phantomPayments) {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            paymentStatus: 'failed',
            invoiceNumber: null,
            invoiceId: null,
            failureReason: 'System Audit: Duplicate webhook / payment link entry safely voided in reconciliation',
          },
        });
      }

      // Step C: Mark test payments (pay_TfRjVjuRmWFoe4)
      console.log('  3. Isolating test payments...');
      await tx.payment.updateMany({
        where: {
          OR: [
            { transactionId: 'pay_TfRjVjuRmWFoe4' },
            { gatewayOrderId: 'order_TfRjSJQpZwfymo' },
          ],
        },
        data: {
          paymentStatus: 'refunded',
          invoiceNumber: null,
          invoiceId: null,
        },
      });

      // Step D: Apply the 13 Canonical Statutory Invoices & Payments
      console.log('  4. Creating/Updating 13 canonical invoices and linking payments...');
      for (const item of actionsSummary) {
        const itemDate = new Date(item.date);

        let invoice = await tx.invoice.findFirst({
          where: {
            subscriberId: item.subscriberId,
            totalAmount: item.amount,
            issuedAt: {
              gte: new Date(itemDate.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(itemDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        // Ensure subscriber has valid city and state recorded
        await tx.user.update({
          where: { id: item.subscriberId },
          data: {
            city: item.customerCity,
            state: item.customerState,
          },
        });

        if (!invoice) {
          invoice = await tx.invoice.create({
            data: {
              id: generateUUID(),
              invoiceNumber: item.invoiceNumber,
              invoiceType: 'SUBSCRIPTION',
              status: 'PAID',
              subscriberId: item.subscriberId,
              baseAmount: item.baseAmount,
              discountAmount: 0,
              saathiDiscountAmount: 0,
              taxAmount: item.taxAmount,
              totalAmount: item.amount,
              placeOfSupply: item.customerState,
              cgstAmount: item.cgstAmount,
              sgstAmount: item.sgstAmount,
              igstAmount: item.igstAmount,
              issuedAt: itemDate,
              paidAt: itemDate,
            },
          });
        } else {
          invoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              invoiceNumber: item.invoiceNumber,
              status: 'PAID',
              baseAmount: item.baseAmount,
              taxAmount: item.taxAmount,
              totalAmount: item.amount,
              placeOfSupply: item.customerState,
              cgstAmount: item.cgstAmount,
              sgstAmount: item.sgstAmount,
              igstAmount: item.igstAmount,
              issuedAt: itemDate,
              paidAt: itemDate,
            },
          });
        }

        // Recreate clean statutory invoice item
        await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoiceItem.create({
          data: {
            id: generateUUID(),
            invoiceId: invoice.id,
            description: item.serviceDescription,
            hsnSacCode: '998399',
            taxRate: 18,
            isGstExempt: false,
            quantity: 1,
            unitPrice: item.baseAmount,
            amount: item.baseAmount,
          },
        });

        // Link payment to this invoice
        if (item.paymentId !== 'TO_CREATE') {
          await tx.payment.update({
            where: { id: item.paymentId },
            data: {
              subscriberId: item.subscriberId,
              invoiceNumber: item.invoiceNumber,
              invoiceId: invoice.id,
              amountPaid: item.amount,
              baseAmount: item.baseAmount,
              taxAmount: item.taxAmount,
              paidAt: itemDate,
              paymentStatus: 'success',
            },
          });
        }
      }

      // Step E: Update invoiceCounter for 2026-27 to 13
      console.log('  5. Synchronizing invoiceCounter table to 13...');
      await tx.invoiceCounter.upsert({
        where: { financialYear },
        update: { lastCount: 13 },
        create: { financialYear, lastCount: 13 },
      });
    },
    { timeout: 45000 }
  );

  console.log('✓ Transaction committed successfully.');

  console.log('\n' + '='.repeat(90));
  console.log('   🎉 RECONCILIATION & STATUTORY INVOICE NUMBERING COMPLETED!');
  console.log('   Invoices MHN/INV/2026-27/00001 to 00013 are now assigned.');
  console.log('   invoiceCounter table synchronized to 13.');
  console.log('   Next automatic customer purchase will issue: MHN/INV/2026-27/00014');
  console.log('='.repeat(90) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

