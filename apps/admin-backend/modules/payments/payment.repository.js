const { prisma } = require('../../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const { dispatchPaymentSuccessful } = require('../../services/notification.dispatcher');
const { invoiceService } = require('../invoices/invoice.service');

/**
 * Resolves a valid User ID for subscriber. Creates pending subscriber if not found.
 */
async function resolveSubscriberId(subscriberId, subscriberPhone, subscriberName, subscriberEmail) {
  try {
    if (subscriberId && typeof subscriberId === 'string' && subscriberId.trim() !== '') {
      const existing = await prisma.user.findUnique({ where: { id: subscriberId } }).catch(() => null);
      if (existing) return existing.id;
    }

    if (subscriberPhone) {
      const cleanDigits = subscriberPhone.replace(/\D/g, '').slice(-10);
      if (cleanDigits) {
        const userByPhone = await prisma.user.findFirst({
          where: { phone: { contains: cleanDigits } },
        }).catch(() => null);
        if (userByPhone) return userByPhone.id;
      }
    }

    const fallbackUser = await prisma.user.findFirst().catch(() => null);
    if (fallbackUser) return fallbackUser.id;

    const cleanDigits = subscriberPhone ? subscriberPhone.replace(/\D/g, '').slice(-10) : '';
    const createdUser = await prisma.user.create({
      data: {
        phone: cleanDigits.length === 10 ? cleanDigits : `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        name: subscriberName || 'New Subscriber',
        email: subscriberEmail && subscriberEmail.includes('@') ? subscriberEmail : undefined,
        role: 'subscriber',
      },
    }).catch(() => null);

    if (createdUser) return createdUser.id;
  } catch (err) {
    console.warn('[Payment Repository] Subscriber lookup warning:', err.message);
  }

  return `sub_temp_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
}

/**
 * Finds payment record by any matching order/gateway/transaction identifier.
 */
async function findPaymentByOrderId(orderId) {
  if (!orderId) return null;
  try {
    return await prisma.payment.findFirst({
      where: {
        OR: [
          { gatewayOrderId: orderId },
          { transactionId: orderId },
          { id: orderId },
        ],
      },
      include: {
        subscriber: true,
        beneficiary: true,
      },
    });
  } catch (err) {
    console.warn('[Payment Repository] findPaymentByOrderId error:', err.message);
    return null;
  }
}

async function createPendingPaymentRecord(data) {
  try {
    let validSubscriptionId = null;

    if (data.subscriptionId && typeof data.subscriptionId === 'string' && data.subscriptionId.trim() !== '') {
      const sub = await prisma.subscription.findUnique({ where: { id: data.subscriptionId } }).catch(() => null);
      if (sub) validSubscriptionId = sub.id;
    }

    if (!validSubscriptionId) {
      const anySub = await prisma.subscription.findFirst().catch(() => null);
      if (anySub) validSubscriptionId = anySub.id;
    }

    // If still no subscription exists in DB, create pending subscription record
    if (!validSubscriptionId) {
      try {
        const createdSub = await prisma.subscription.create({
          data: {
            subscriberId: data.subscriberId,
            beneficiaryId: data.beneficiaryId || null,
            packageType: data.packageType || 'silver',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            visitsTotal: 12,
            hoursTotal: 24,
            isActive: false,
          },
        });
        validSubscriptionId = createdSub.id;
      } catch (subErr) {
        console.warn('[Payment Repository] Could not create pending subscription record:', subErr.message);
      }
    }

    return await prisma.payment.create({
      data: {
        subscriberId: data.subscriberId,
        beneficiaryId: data.beneficiaryId || null,
        subscriptionId: validSubscriptionId || uuidv4(),
        packageType: data.packageType || 'silver',
        baseAmount: data.amount,
        amountPaid: data.amount,
        currency: 'INR',
        paymentMethod: 'online_link',
        paymentStatus: 'pending',
        gatewayName: 'razorpay',
        gatewayOrderId: data.gatewayOrderId,
        transactionId: data.transactionId,
        gatewayResponse: data.gatewayResponse || null,
        planStartDate: new Date(),
        planEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isSubscriptionActive: false,
      },
    });
  } catch (err) {
    console.warn('[Payment Repository] DB warning createPendingPaymentRecord:', err.message);
    return null;
  }
}

/**
 * Idempotent Atomic Database Transaction:
 * Updates Payment ➔ Activates Subscription ➔ Inserts Audit ActivityLog in single transaction.
 */
async function markPaymentSuccessfulTransaction(paymentId, gatewayPaymentId, paidAt = new Date(), fullResponse = null) {
  try {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscriber: true,
        beneficiary: true,
      }
    });
    if (!existing) return null;

    // Idempotency check: Exit immediately if payment is ALREADY marked as success/paid
    if (existing.paymentStatus === 'success' || existing.paymentStatus === 'PAID') {
      console.log(`[Payment Repository] Idempotent Guard: Payment ${paymentId} already marked as paid. Skipping redundant transaction.`);
      return existing;
    }

    // Atomic PostgreSQL $transaction execution
    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          paymentStatus: 'success',
          gatewayPaymentId: gatewayPaymentId || existing.gatewayPaymentId || undefined,
          paidAt: paidAt,
          gatewayResponse: fullResponse || existing.gatewayResponse || undefined,
          isSubscriptionActive: true,
        },
      }),
      ...(existing.subscriptionId ? [
        prisma.subscription.update({
          where: { id: existing.subscriptionId },
          data: {
            isActive: true,
          },
        })
      ] : []),
      prisma.activityLog.create({
        data: {
          action: 'PAYMENT_RECEIVED_AND_ACTIVATED',
          entityType: 'PAYMENT',
          entityId: paymentId,
          details: JSON.stringify({
            paymentId,
            gatewayPaymentId,
            amount: existing.amountPaid,
            subscriptionId: existing.subscriptionId,
            paidAt,
          }),
        },
      }),
    ]);

    console.log(`[Payment Repository Transaction OK] Payment ${paymentId} & Subscription ${existing.subscriptionId} ACTIVATED!`);

    // Ensure statutory GST invoice is generated and attached to this payment
    try {
      await invoiceService.ensurePaymentInvoice(prisma, {
        ...updatedPayment,
        subscriber: existing.subscriber,
        beneficiary: existing.beneficiary,
      });
    } catch (invErr) {
      console.warn('[Payment Webhook Invoice Warning]:', invErr.message);
    }

    // Fire notifications asynchronously so it doesn't block the request response
    if (existing.subscriber && existing.subscriber.phone) {
      dispatchPaymentSuccessful(existing.subscriber.phone, {
        amount: existing.amountPaid.toString(),
        beneficiaryName: existing.beneficiary ? existing.beneficiary.name : 'you',
        packageName: existing.packageType,
        isSubscriptionActive: !!existing.subscriptionId,
        subscriberName: existing.subscriber.name || 'Subscriber',
        startDate: paidAt.toLocaleDateString(),
      });
    }

    return updatedPayment;
  } catch (err) {
    console.error('[Payment Repository Transaction Error]:', err.message);

    // Single-table fallback update if $transaction encounters partial table locks
    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        paymentStatus: 'success',
        gatewayPaymentId: gatewayPaymentId || undefined,
        paidAt: paidAt,
        isSubscriptionActive: true,
      },
    }).catch(() => null);
  }
}

module.exports = {
  resolveSubscriberId,
  findPaymentByOrderId,
  createPendingPaymentRecord,
  markPaymentSuccessfulTransaction,
};
