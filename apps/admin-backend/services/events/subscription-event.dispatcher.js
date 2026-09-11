/**
 * Subscription & Scheduling Event Dispatcher Service (`services/events/subscription-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel subscription notifications:
 *   - Schedule Change Request (NT-040)
 *   - Subscription Renewal Reminder (NT-042)
 *   - Payment Failed (NT-045)
 *   - Subscription Hours Low (NT-046)
 *   - Subscription Hours Exhausted (NT-047)
 *   - Subscription Terminated (NT-048)
 *   - Free Trial Ending (NT-049)
 */

const { prisma } = require('../../lib/prisma');
const { notifyUser } = require('../notifications');
const { notificationService } = require('@maihoonna/notifications');

function getValidPhone(phone) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 ? cleanPhone : null;
}

/**
 * 1. Dispatch SCHEDULE_CHANGE_REQUEST (NT-040)
 */
async function dispatchScheduleChangeRequest({ subscriberId, beneficiaryName, requestedDate, omUserId, omPhone }) {
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: subscriberId },
      select: { name: true }
    });
    
    const subscriberName = subscriber?.name || 'Subscriber';

    // A. Notify OM (Push)
    if (omUserId) {
      notifyUser(prisma, {
        userId: omUserId,
        type: 'alert',
        title: '📅 Schedule Change Request',
        body: `${subscriberName} has requested a schedule change for ${beneficiaryName}, effective ${requestedDate}. Please review and respond.`,
        data: { event: 'SCHEDULE_CHANGE_REQUEST' },
      }).catch(err => console.error('[SubscriptionDispatcher] OM Push Error:', err.message));
    }

    // B. WhatsApp Notification to OM
    const omValidPhone = getValidPhone(omPhone);
    if (omValidPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SCHEDULE_CHANGE_REQUEST',
        to: omValidPhone,
        variables: { subscriberName, beneficiaryName, requestedDate }
      }).catch(err => console.error('[SubscriptionDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchScheduleChangeRequest Exception:', err.message);
  }
}

/**
 * 2. Dispatch SUBSCRIPTION_RENEWAL_REMINDER (NT-042)
 */
async function dispatchSubscriptionRenewalReminder({ subscriberId, phone, subscriberName, packageName, beneficiaryName, expiryDate }) {
  try {
    // A. Notify Subscriber (Push)
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'reminder',
        title: '⏳ Plan Expires Soon',
        body: `Hi ${subscriberName}, your ${packageName} subscription for ${beneficiaryName} expires on ${expiryDate}. Renew now to avoid a gap in care.`,
        data: { event: 'SUBSCRIPTION_RENEWAL_REMINDER' },
      }).catch(err => console.error('[SubscriptionDispatcher] Push Error:', err.message));
    }

    // B. WhatsApp Notification
    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIPTION_RENEWAL_REMINDER',
        to: validPhone,
        variables: { subscriberName, packageName, beneficiaryName, expiryDate }
      }).catch(err => console.error('[SubscriptionDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchSubscriptionRenewalReminder Exception:', err.message);
  }
}

/**
 * 3. Dispatch PAYMENT_FAILED (NT-045)
 */
async function dispatchPaymentFailed({ subscriberId, phone, subscriberName, amount, beneficiaryName, paymentLink }) {
  try {
    let name = subscriberName;
    if (!name && subscriberId) {
      const user = await prisma.user.findUnique({ where: { id: subscriberId }, select: { name: true } });
      name = user?.name || 'Valued Subscriber';
    }
    if (!name) name = 'Valued Subscriber';

    // A. Notify Subscriber (Push)
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'alert',
        title: '❌ Payment Unsuccessful',
        body: `Your payment of ${amount} for ${beneficiaryName}'s renewal could not be processed. Please retry.`,
        data: { event: 'PAYMENT_FAILED', paymentLink },
      }).catch(err => console.error('[SubscriptionDispatcher] Push Error:', err.message));
    }

    // B. WhatsApp Notification
    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'PAYMENT_FAILED',
        to: validPhone,
        variables: { subscriberName: name, amount: amount.toString(), beneficiaryName, paymentLink }
      }).catch(err => console.error('[SubscriptionDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchPaymentFailed Exception:', err.message);
  }
}

/**
 * 4. Dispatch SUBSCRIPTION_HOURS_LOW (NT-046)
 */
async function dispatchSubscriptionHoursLow({ subscriberId, phone, beneficiaryName, percentConsumed }) {
  try {
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'alert',
        title: `⚠️ Hours Running Low for ${beneficiaryName}`,
        body: `${beneficiaryName} has used ${percentConsumed}% of this period's hours. Consider upgrading or topping up.`,
        data: { event: 'SUBSCRIPTION_HOURS_LOW' },
      }).catch(err => console.error('[SubscriptionDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIPTION_HOURS_LOW',
        to: validPhone,
        variables: { beneficiaryName, percentConsumed: percentConsumed.toString() }
      }).catch(err => console.error('[SubscriptionDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchSubscriptionHoursLow Exception:', err.message);
  }
}

/**
 * 5. Dispatch SUBSCRIPTION_HOURS_EXHAUSTED (NT-047)
 */
async function dispatchSubscriptionHoursExhausted({ subscriberId, phone, beneficiaryName, csaUserId, csaPhone }) {
  try {
    // Subscriber
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'alert',
        title: `🛑 Hours Exhausted for ${beneficiaryName}`,
        body: `${beneficiaryName}'s subscription hours for this period are fully used. Renew or upgrade to continue care.`,
        data: { event: 'SUBSCRIPTION_HOURS_EXHAUSTED' },
      }).catch(err => console.error('[SubscriptionDispatcher] Subscriber Push Error:', err.message));
    }

    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIPTION_HOURS_EXHAUSTED',
        to: validPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[SubscriptionDispatcher] Subscriber WhatsApp Error:', err.message));
    }

    // CSA
    if (csaUserId) {
      notifyUser(prisma, {
        userId: csaUserId,
        type: 'alert',
        title: `🛑 Hours Exhausted: ${beneficiaryName}`,
        body: `Action required: ${beneficiaryName}'s hours are exhausted. Follow up for renewal.`,
        data: { event: 'SUBSCRIPTION_HOURS_EXHAUSTED' },
      }).catch(err => console.error('[SubscriptionDispatcher] CSA Push Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchSubscriptionHoursExhausted Exception:', err.message);
  }
}

/**
 * 6. Dispatch SUBSCRIPTION_TERMINATED (NT-048)
 */
async function dispatchSubscriptionTerminated({ subscriberId, phone, beneficiaryName, effectiveDate }) {
  try {
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: `🛑 Subscription Ended`,
        body: `Your subscription for ${beneficiaryName} has been terminated as requested, effective ${effectiveDate}.`,
        data: { event: 'SUBSCRIPTION_TERMINATED' },
      }).catch(err => console.error('[SubscriptionDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIPTION_TERMINATED',
        to: validPhone,
        variables: { beneficiaryName, effectiveDate }
      }).catch(err => console.error('[SubscriptionDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchSubscriptionTerminated Exception:', err.message);
  }
}

/**
 * 7. Dispatch FREE_TRIAL_ENDING (NT-049)
 */
async function dispatchFreeTrialEnding({ subscriberId, phone, subscriberName, beneficiaryName, endDate }) {
  try {
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'reminder',
        title: `⏳ Free Trial Ends Soon`,
        body: `Hi ${subscriberName}, your free trial for ${beneficiaryName} ends on ${endDate}. Subscribe now to continue care.`,
        data: { event: 'FREE_TRIAL_ENDING' },
      }).catch(err => console.error('[SubscriptionDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'FREE_TRIAL_ENDING',
        to: validPhone,
        variables: { subscriberName, beneficiaryName, endDate }
      }).catch(err => console.error('[SubscriptionDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[SubscriptionDispatcher] dispatchFreeTrialEnding Exception:', err.message);
  }
}

module.exports = {
  dispatchScheduleChangeRequest,
  dispatchSubscriptionRenewalReminder,
  dispatchPaymentFailed,
  dispatchSubscriptionHoursLow,
  dispatchSubscriptionHoursExhausted,
  dispatchSubscriptionTerminated,
  dispatchFreeTrialEnding,
};
