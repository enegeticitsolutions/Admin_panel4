const crypto = require('crypto');
const clean = (s) => (s || '').toString().replace(/^["']|["']$/g, '').trim();

function getWebhookSecret() {
  return clean(process.env.RAZORPAY_WEBHOOK_SECRET);
}

/**
 * Verifies Razorpay Webhook HMAC SHA-256 Signature.
 */
function verifySignature(bodyBuffer, signature) {
  const secret = getWebhookSecret();
  if (!secret) {
    console.error('[Webhook Service] CRITICAL: RAZORPAY_WEBHOOK_SECRET is not configured in environment.');
    return false;
  }
  if (!signature || !bodyBuffer) {
    console.warn('[Webhook Service] Webhook rejected: missing signature or empty payload body.');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    console.error('[Webhook Signature Error]:', err.message);
    return false;
  }
}

/**
 * Normalizes webhook payload to extract event type, linkId, gatewayPaymentId, and status.
 */
function extractWebhookData(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const event = payload.event;
  const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity;
  const paymentLinkEntity = payload.payload?.payment_link?.entity;

  const linkId = paymentLinkEntity?.id || paymentEntity?.order_id || paymentEntity?.id;
  const gatewayPaymentId = paymentEntity?.id;

  let normalizedStatus = 'PENDING';
  if (event === 'payment_link.paid' || event === 'payment.captured' || event === 'order.paid') {
    normalizedStatus = 'PAID';
  } else if (event === 'payment_link.expired') {
    normalizedStatus = 'EXPIRED';
  } else if (event === 'payment_link.cancelled' || event === 'payment.failed') {
    normalizedStatus = 'FAILED';
  }

  return {
    event,
    linkId,
    gatewayPaymentId,
    status: normalizedStatus,
    rawEntity: paymentEntity || payload,
  };
}

module.exports = {
  verifySignature,
  extractWebhookData,
};
