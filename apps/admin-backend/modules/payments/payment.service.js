const { v4: uuidv4 } = require('uuid');
const razorpayService = require('./razorpay.service');
const webhookService = require('./webhook.service');
const paymentRepository = require('./payment.repository');
const subscriptionService = require('./subscription.service');
const { prisma } = require('../../lib/prisma');
const { dispatchPaymentLinkGenerated } = require('../../services/notification.dispatcher');

/**
 * Orchestrates payment link generation, DB persistence, and prefilled WhatsApp text.
 */
async function generatePaymentLink(params) {
  const {
    subscriberId,
    beneficiaryId,
    subscriptionId,
    packageType,
    packageName,
    amount,
    subscriberPhone,
    subscriberEmail,
    subscriberName,
  } = params;

  if (!amount) {
    throw new Error('amount is required');
  }

  const validSubscriberId = await paymentRepository.resolveSubscriberId(
    subscriberId,
    subscriberPhone,
    subscriberName,
    subscriberEmail
  );

  const orderId = `order_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  const uniqueTxnId = `txn_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  const numericAmount = parseFloat(amount);
  const amountInPaise = Math.round(numericAmount * 100);

  const cleanPhoneDigits = subscriberPhone ? subscriberPhone.replace(/\D/g, '').slice(-10) : '';
  const validPhone = cleanPhoneDigits.length === 10 ? cleanPhoneDigits : '9876543210';
  const validEmail = subscriberEmail && subscriberEmail.includes('@') ? subscriberEmail : 'customer@maihoonna.com';

  let paymentLinkUrl = '';
  let razorpayLinkId = null;
  let rawRazorpayResponse = null;

  const resolvedPackageType = packageType || packageName || 'gold';

  if (razorpayService.isConfigured()) {
    const linkResult = await razorpayService.createPaymentLink({
      amountInPaise,
      description: `MaiHoonNa ${packageName || resolvedPackageType} Subscription`,
      customerName: subscriberName || 'Valued Subscriber',
      customerContact: validPhone,
      customerEmail: validEmail,
      notes: {
        subscriberId: validSubscriberId,
        beneficiaryId: beneficiaryId || '',
        subscriptionId: subscriptionId || '',
        packageType: resolvedPackageType,
        packageName: packageName || resolvedPackageType,
        orderId,
      },
    });

    if (linkResult && linkResult.short_url) {
      paymentLinkUrl = linkResult.short_url;
      razorpayLinkId = linkResult.id;
      rawRazorpayResponse = linkResult;
    }
  }

  // Fallback URL for offline sandbox environment
  if (!paymentLinkUrl) {
    const frontendOrigin = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0].trim() : 'http://localhost:5173';
    paymentLinkUrl = `${frontendOrigin}/pay/${orderId}`;
  }

  // Persist pending Payment record in DB
  const paymentRecord = await paymentRepository.createPendingPaymentRecord({
    subscriberId: validSubscriberId,
    beneficiaryId,
    subscriptionId,
    packageType: resolvedPackageType,
    amount: numericAmount,
    gatewayOrderId: razorpayLinkId || orderId,
    transactionId: razorpayLinkId || uniqueTxnId,
    gatewayResponse: rawRazorpayResponse,
  });

  // Prefilled WhatsApp Web sharing link
  const cleanPhone = subscriberPhone ? subscriberPhone.replace(/\D/g, '') : '';
  const whatsappMsg = encodeURIComponent(
    `Hi ${subscriberName || 'there'},\n\nYour MaiHoonNa ${packageName || resolvedPackageType} payment link is ready.\n\nAmount: ₹${numericAmount}\n\nPay securely here:\n${paymentLinkUrl}\n\nThank you!`
  );
  const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${whatsappMsg}`;

  // Automatically trigger backend notification (via MSG91 SDK) if phone is valid
  dispatchPaymentLinkGenerated(subscriberPhone, {
    beneficiaryName: beneficiaryId ? 'your beneficiary' : 'you', // ideally fetch the real beneficiary name
    packageName: packageName || resolvedPackageType,
    paymentLink: paymentLinkUrl
  });

  return {
    paymentId: paymentRecord?.id || uuidv4(),
    orderId: razorpayLinkId || orderId,
    shortUrl: paymentLinkUrl,
    whatsappUrl,
    amount: numericAmount,
    status: 'pending',
  };
}

/**
 * Handles Webhook event: Verifies HMAC signature, extracts payload, and executes idempotent state update.
 */
async function processWebhook(signature, bodyBuffer, bodyPayload) {
  const isValid = webhookService.verifySignature(bodyBuffer, signature);
  if (!isValid) {
    throw new Error('Invalid signature');
  }

  const normalized = webhookService.extractWebhookData(bodyPayload);
  if (!normalized || !normalized.linkId) {
    return { processed: false, message: 'Unhandled or missing event details' };
  }

  console.log(`[Payment Service Webhook] Event: ${normalized.event}, Status: ${normalized.status}, LinkId: ${normalized.linkId}`);

  if (normalized.status === 'PAID') {
    let payment = await paymentRepository.findPaymentByOrderId(normalized.linkId);
    
    // Auto-heal for mobile app webhooks: create dummy record if missing
    if (!payment && normalized.rawEntity?.notes?.subscriberId) {
      const notes = normalized.rawEntity.notes;
      payment = await paymentRepository.createPendingPaymentRecord({
        subscriberId: notes.subscriberId,
        packageType: notes.packageType || notes.packageId || 'silver',
        amount: (normalized.rawEntity.amount || 0) / 100,
        gatewayOrderId: normalized.linkId,
        transactionId: normalized.gatewayPaymentId || normalized.linkId,
        gatewayResponse: normalized.rawEntity
      });
    }

    if (payment) {
      await paymentRepository.markPaymentSuccessfulTransaction(
        payment.id,
        normalized.gatewayPaymentId,
        new Date(),
        normalized.rawEntity
      );
      return { processed: true, message: 'Payment marked as PAID and subscription activated' };
    }
  }

  return { processed: true, event: normalized.event };
}

/**
 * Checks live payment status by Order ID. Queries DB first; if PENDING, checks Razorpay API directly.
 */
async function checkLiveStatus(orderId) {
  let payment = await paymentRepository.findPaymentByOrderId(orderId);

  // Auto-heal: If payment record is not in DB yet, query Razorpay API directly by plink_ ID
  if (!payment && razorpayService.isConfigured() && orderId && orderId.startsWith('plink_')) {
    try {
      const liveRzpData = await razorpayService.fetchPaymentLink(orderId);
      if (liveRzpData) {
        const isPaid = liveRzpData.status === 'paid';
        const gatewayPaymentId = liveRzpData.payments && liveRzpData.payments.length > 0 ? liveRzpData.payments[0].payment_id : null;
        const notes = liveRzpData.notes || {};
        const resolvedPackageType = notes.packageType || notes.packageName || 'gold';

        payment = await paymentRepository.createPendingPaymentRecord({
          subscriberId: notes.subscriberId || '',
          beneficiaryId: notes.beneficiaryId || '',
          subscriptionId: notes.subscriptionId || '',
          packageType: resolvedPackageType,
          amount: (liveRzpData.amount || 0) / 100,
          gatewayOrderId: liveRzpData.id,
          transactionId: liveRzpData.id,
          gatewayResponse: liveRzpData,
        });

        if (payment && isPaid) {
          await paymentRepository.markPaymentSuccessfulTransaction(
            payment.id,
            gatewayPaymentId,
            new Date(),
            liveRzpData
          );
          payment.paymentStatus = 'success';
          payment.isSubscriptionActive = true;
        }
      }
    } catch (autoHealErr) {
      console.warn('[Payments checkLiveStatus] Auto-heal warning:', autoHealErr.message);
    }
  }

  if (!payment) {
    return {
      paymentId: orderId,
      orderId: orderId,
      status: 'pending',
      amount: 0,
      isSubscriptionActive: false,
    };
  }

  // If status is pending, perform direct live API status check with Razorpay SDK
  if (payment.paymentStatus === 'pending' && razorpayService.isConfigured() && payment.gatewayOrderId?.startsWith('plink_')) {
    try {
      const liveRzpData = await razorpayService.fetchPaymentLink(payment.gatewayOrderId);
      if (liveRzpData && liveRzpData.status === 'paid') {
        const gatewayPaymentId = liveRzpData.payments && liveRzpData.payments.length > 0 ? liveRzpData.payments[0].payment_id : null;
        await paymentRepository.markPaymentSuccessfulTransaction(
          payment.id,
          gatewayPaymentId,
          new Date(),
          liveRzpData
        );
        payment.paymentStatus = 'success';
        payment.isSubscriptionActive = true;
        payment.paidAt = new Date();
      } else if (liveRzpData && (liveRzpData.status === 'expired' || liveRzpData.status === 'cancelled')) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { paymentStatus: liveRzpData.status },
        }).catch(() => {});
        payment.paymentStatus = liveRzpData.status;
      }
    } catch (rzpErr) {
      console.warn('[Payments checkLiveStatus] Razorpay check warning:', rzpErr.message);
    }
  }

  return {
    paymentId: payment.id,
    orderId: payment.gatewayOrderId || payment.transactionId || payment.id,
    status: payment.paymentStatus === 'success' ? 'paid' : payment.paymentStatus,
    amount: payment.amountPaid,
    packageType: payment.packageType,
    paidAt: payment.paidAt,
    isSubscriptionActive: payment.isSubscriptionActive,
    subscriberName: payment.subscriber?.name || 'Valued Subscriber',
    subscriberPhone: payment.subscriber?.phone || '',
    beneficiaryName: payment.beneficiary?.name || '',
  };
}

/**
 * Simulates online payment completion (for test mode / local sandbox checkout page).
 */
async function simulatePay(orderId, paymentMethod = 'razorpay_online', customPaymentId) {
  const payment = await paymentRepository.findPaymentByOrderId(orderId);
  if (!payment) {
    throw new Error('Payment record not found');
  }

  const gatewayPaymentId = customPaymentId || `pay_${uuidv4().replace(/-/g, '').substring(0, 10)}`;
  const updated = await paymentRepository.markPaymentSuccessfulTransaction(
    payment.id,
    gatewayPaymentId,
    new Date(),
    { simulation: true, method: paymentMethod }
  );

  return updated;
}

/**
 * Marks payment as completed offline (cash, bank transfer, cheque).
 */
async function markOffline(paymentId, method = 'Cash', note) {
  const payment = await paymentRepository.findPaymentByOrderId(paymentId);
  if (!payment) {
    throw new Error('Payment record not found');
  }

  const updated = await paymentRepository.markPaymentSuccessfulTransaction(
    payment.id,
    `offline_${uuidv4().substring(0, 8)}`,
    new Date(),
    { offlineMethod: method, note }
  );

  return updated;
}

module.exports = {
  generatePaymentLink,
  processWebhook,
  checkLiveStatus,
  simulatePay,
  markOffline,
};
