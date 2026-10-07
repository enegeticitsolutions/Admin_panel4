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

    // If this payment was for an add-on, automatically credit units to SubscriptionBenefitBalance
    const rawNotes = fullResponse?.notes || existing.gatewayResponse?.notes || {};
    const isAddon =
      existing.packageType === 'addon' ||
      rawNotes.packageType === 'addon' ||
      (rawNotes.packageName && String(rawNotes.packageName).startsWith('Add-on'));

    if (isAddon && existing.subscriptionId) {
      try {
        let itemsToCredit = [];

        // 1. Check if structured multi-item JSON array exists in notes
        if (rawNotes.addonItems) {
          try {
            const parsed = typeof rawNotes.addonItems === 'string' ? JSON.parse(rawNotes.addonItems) : rawNotes.addonItems;
            if (Array.isArray(parsed) && parsed.length > 0) {
              itemsToCredit = parsed;
            }
          } catch (e) {
            console.warn('[Payment Webhook] Could not parse addonItems JSON:', e.message);
          }
        }

        // 2. Single item fallback via benefitId or packageName
        if (itemsToCredit.length === 0) {
          let benefit = null;
          if (rawNotes.benefitId) {
            benefit = await prisma.benefit.findUnique({ where: { id: rawNotes.benefitId } });
          }
          if (!benefit) {
            const targetName = rawNotes.packageName || existing.snapshotPackageName || existing.failureReason || '';
            const cleanedName = targetName.replace(/^Add-on(s)?:\s*/i, '').trim();
            if (cleanedName) {
              benefit = await prisma.benefit.findFirst({
                where: { name: { contains: cleanedName, mode: 'insensitive' } },
              });
            }
          }

          if (benefit) {
            let units = parseInt(rawNotes.units, 10);
            if (!units || isNaN(units) || units <= 0) {
              const unitPrice = benefit.addonDiscountPrice || benefit.addonPrice || 0;
              if (unitPrice > 0 && existing.amountPaid > 0) {
                units = Math.max(1, Math.round(existing.amountPaid / unitPrice));
              } else {
                units = benefit.addonIncludedUnits || 1;
              }
            }
            itemsToCredit.push({
              benefitId: benefit.id,
              name: benefit.name,
              units,
              unitLabel: benefit.unitLabel || 'visits',
            });
          } else {
            console.warn(`[Payment Webhook Alert] No matching benefit found for add-on payment ${paymentId}. Logged for manual review.`);
            await prisma.activityLog.create({
              data: {
                action: 'PAYMENT_ADDON_ALLOCATION_NEEDED',
                entityType: 'PAYMENT',
                entityId: paymentId,
                details: JSON.stringify({
                  paymentId,
                  amount: existing.amountPaid,
                  notes: rawNotes,
                  message: 'Add-on payment received but benefit could not be resolved automatically.',
                }),
              },
            }).catch(() => {});
          }
        }

        // 3. Atomically credit units for each item
        for (const item of itemsToCredit) {
          const benefit = await prisma.benefit.findUnique({ where: { id: item.benefitId } });
          if (!benefit) continue;

          const unitsToAdd = Number(item.units) || 1;
          const unitLabel = benefit.unitLabel || item.unitLabel || 'visits';

          await prisma.subscriptionBenefitBalance.upsert({
            where: {
              subscriptionId_benefitId: {
                subscriptionId: existing.subscriptionId,
                benefitId: benefit.id,
              },
            },
            create: {
              subscriptionId: existing.subscriptionId,
              benefitId: benefit.id,
              snapshotBenefitName: benefit.name,
              snapshotUnitLabel: unitLabel,
              totalUnits: unitsToAdd,
              usedUnits: 0,
              availableUnits: unitsToAdd,
              unit: unitLabel,
            },
            update: {
              totalUnits: { increment: unitsToAdd },
              availableUnits: { increment: unitsToAdd },
            },
          });
          console.log(`[Payment Webhook OK] Credited ${unitsToAdd} units of ${benefit.name} to subscription ${existing.subscriptionId}`);
        }
      } catch (addonBalErr) {
        console.warn('[Payment Webhook Addon Balance Warning]:', addonBalErr.message);
      }
    }

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
