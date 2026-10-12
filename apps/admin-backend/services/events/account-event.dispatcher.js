/**
 * Account & Onboarding Event Dispatcher Service (`services/events/account-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel account and onboarding notifications:
 *   - Subscriber Account Created (NT-002)
 *   - Subscription Request Submitted (NT-003)
 *   - Beneficiary Profile Created (NT-005)
 *   - Care Mitra Onboarding Cleared (NT-006)
 *   - Care Mitra Training Reminder (NT-007)
 *   - Password Reset Request (NT-008)
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
 * 1. Dispatch SUBSCRIBER_ACCOUNT_CREATED (NT-002)
 */
async function dispatchSubscriberAccountCreated({ subscriberId }) {
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: subscriberId },
      select: { id: true, name: true, phone: true, email: true }
    });

    if (!subscriber) return;
    const subscriberName = subscriber.name || 'Subscriber';

    // A. Notify Subscriber (Push + In-App)
    notifyUser(prisma, {
      userId: subscriber.id,
      type: 'info',
      title: '🎉 Welcome to MaiHoonNa!',
      body: `Hi ${subscriberName}, your account is ready. Add your first beneficiary to get started.`,
      data: { event: 'SUBSCRIBER_ACCOUNT_CREATED' },
    }).catch(err => console.error('[AccountDispatcher] Subscriber Push Error:', err.message));

    // B. WhatsApp Notification
    const subscriberPhone = getValidPhone(subscriber.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIBER_ACCOUNT_CREATED',
        to: subscriberPhone,
        variables: { subscriberName }
      }).catch(err => console.error('[AccountDispatcher] WhatsApp Error:', err.message));
    }

    // C. AWS SES Email Notification
    if (subscriber.email && subscriber.email.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'SUBSCRIBER_ACCOUNT_CREATED',
        to: subscriber.email,
        variables: { subscriber_name: subscriberName }
      }).catch(err => console.error('[AccountDispatcher] SES Email Error:', err.message));
    }
  } catch (err) {
    console.error('[AccountDispatcher] dispatchSubscriberAccountCreated Exception:', err.message);
  }
}

/**
 * 2. Dispatch SUBSCRIPTION_REQUEST_SUBMITTED (NT-003)
 */
async function dispatchSubscriptionRequestSubmitted({ subscriberId, beneficiaryName, packageName }) {
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: subscriberId },
      select: { id: true, name: true, phone: true, email: true }
    });

    if (!subscriber) return;
    const subscriberName = subscriber.name || 'Subscriber';

    // A. Notify Subscriber (Push + In-App)
    notifyUser(prisma, {
      userId: subscriber.id,
      type: 'info',
      title: '📝 Subscription Request Received',
      body: `We've received your subscription request for ${beneficiaryName} (${packageName} plan). Our team will confirm within 24 hours.`,
      data: { event: 'SUBSCRIPTION_REQUEST_SUBMITTED' },
    }).catch(err => console.error('[AccountDispatcher] Subscriber Push Error:', err.message));

    // B. WhatsApp Notification
    const subscriberPhone = getValidPhone(subscriber.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIPTION_REQUEST_SUBMITTED',
        to: subscriberPhone,
        variables: { subscriberName, beneficiaryName, packageName }
      }).catch(err => console.error('[AccountDispatcher] WhatsApp Error:', err.message));
    }

    // C. AWS SES Email Notification
    if (subscriber.email && subscriber.email.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'SUBSCRIPTION_REQUEST_SUBMITTED',
        to: subscriber.email,
        variables: { subscriber_name: subscriberName, beneficiary_name: beneficiaryName, package_name: packageName }
      }).catch(err => console.error('[AccountDispatcher] SES Email Error:', err.message));
    }
  } catch (err) {
    console.error('[AccountDispatcher] dispatchSubscriptionRequestSubmitted Exception:', err.message);
  }
}

/**
 * 3. Dispatch BENEF_PROFILE_CREATED (NT-005)
 */
async function dispatchBeneficiaryProfileCreated({ beneficiaryUserId, beneficiaryName, subscriberName, subscriberEmail }) {
  try {
    const beneficiaryUser = await prisma.user.findUnique({
      where: { id: beneficiaryUserId },
      select: { id: true, phone: true, email: true }
    });

    if (!beneficiaryUser) return;

    // A. Notify Beneficiary (Push + In-App)
    notifyUser(prisma, {
      userId: beneficiaryUser.id,
      type: 'info',
      title: '🌟 Welcome to MaiHoonNa Care',
      body: `Hello ${beneficiaryName}, you've been enrolled in MaiHoonNa care by ${subscriberName}. Your Care Mitra will be assigned shortly.`,
      data: { event: 'BENEF_PROFILE_CREATED' },
    }).catch(err => console.error('[AccountDispatcher] Beneficiary Push Error:', err.message));

    // B. WhatsApp Notification
    const beneficiaryPhone = getValidPhone(beneficiaryUser.phone);
    if (beneficiaryPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'BENEF_PROFILE_CREATED',
        to: beneficiaryPhone,
        variables: { beneficiaryName, subscriberName }
      }).catch(err => console.error('[AccountDispatcher] WhatsApp Error:', err.message));
    }

    // C. AWS SES Email Notification (To Subscriber or Beneficiary)
    const targetEmail = subscriberEmail || beneficiaryUser.email;
    if (targetEmail && targetEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'BENEFICIARY_PROFILE_CREATED',
        to: targetEmail,
        variables: { beneficiary_name: beneficiaryName, subscriber_name: subscriberName }
      }).catch(err => console.error('[AccountDispatcher] SES Email Error:', err.message));
    }
  } catch (err) {
    console.error('[AccountDispatcher] dispatchBeneficiaryProfileCreated Exception:', err.message);
  }
}

/**
 * 4. Dispatch CM_ONBOARDING_CLEARED (NT-006)
 */
async function dispatchCMOnboardingCleared({ ccUserId, ccName, fmName }) {
  try {
    const ccUser = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { id: true, phone: true, email: true }
    });

    if (!ccUser) return;

    // A. Notify Care Companion (Push + In-App)
    notifyUser(prisma, {
      userId: ccUser.id,
      type: 'info',
      title: '✅ Welcome to the MaiHoonNa Team',
      body: `Congratulations ${ccName}! Your onboarding is complete and you're cleared for deployment. Your Field Manager is ${fmName}.`,
      data: { event: 'CM_ONBOARDING_CLEARED' },
    }).catch(err => console.error('[AccountDispatcher] CC Push Error:', err.message));

    // B. WhatsApp Notification
    const ccPhone = getValidPhone(ccUser.phone);
    if (ccPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'CM_ONBOARDING_CLEARED',
        to: ccPhone,
        variables: { ccName, fmName }
      }).catch(err => console.error('[AccountDispatcher] WhatsApp Error:', err.message));
    }

    // C. AWS SES Email Notification
    if (ccUser.email && ccUser.email.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'CARE_MITRA_ONBOARDING_APPROVED',
        to: ccUser.email,
        variables: { cc_name: ccName }
      }).catch(err => console.error('[AccountDispatcher] SES Email Error:', err.message));
    }
  } catch (err) {
    console.error('[AccountDispatcher] dispatchCMOnboardingCleared Exception:', err.message);
  }
}

/**
 * 5. Dispatch CM_TRAINING_REMINDER (NT-007)
 */
async function dispatchCMTrainingReminder({ ccUserId, ccName, moduleName, date, timeLocation }) {
  try {
    const ccUser = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { id: true, phone: true }
    });

    if (!ccUser) return;

    // A. Notify Care Companion (Push + In-App)
    notifyUser(prisma, {
      userId: ccUser.id,
      type: 'reminder',
      title: '📚 Training Session Reminder',
      body: `Hi ${ccName}, reminder: your ${moduleName} training session is scheduled for ${date} at ${timeLocation}.`,
      data: { event: 'CM_TRAINING_REMINDER' },
    }).catch(err => console.error('[AccountDispatcher] CC Push Error:', err.message));

    // B. WhatsApp Notification
    const ccPhone = getValidPhone(ccUser.phone);
    if (ccPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'CM_TRAINING_REMINDER',
        to: ccPhone,
        variables: { ccName, moduleName, date, timeLocation }
      }).catch(err => console.error('[AccountDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[AccountDispatcher] dispatchCMTrainingReminder Exception:', err.message);
  }
}

/**
 * 6. Dispatch PASSWORD_RESET_REQUEST (NT-008)
 */
async function dispatchPasswordResetRequest({ userId, phone, resetCode }) {
  try {
    // Notify User (Push) if they have a valid session/token, though usually this is via SMS/WhatsApp
    if (userId) {
      notifyUser(prisma, {
        userId,
        type: 'alert',
        title: '🔐 Password Reset',
        body: `Your password reset code is ${resetCode}. If you didn't request this, please contact support.`,
        data: { event: 'PASSWORD_RESET_REQUEST' },
      }).catch(err => console.error('[AccountDispatcher] User Push Error:', err.message));
    }

    // B. WhatsApp Notification
    const validPhone = getValidPhone(phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'PASSWORD_RESET_REQUEST',
        to: validPhone,
        variables: { resetCode }
      }).catch(err => console.error('[AccountDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[AccountDispatcher] dispatchPasswordResetRequest Exception:', err.message);
  }
}

module.exports = {
  dispatchSubscriberAccountCreated,
  dispatchSubscriptionRequestSubmitted,
  dispatchBeneficiaryProfileCreated,
  dispatchCMOnboardingCleared,
  dispatchCMTrainingReminder,
  dispatchPasswordResetRequest,
};
