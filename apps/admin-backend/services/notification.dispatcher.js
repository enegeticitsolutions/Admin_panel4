const { notificationService } = require('@maihoonna/notifications');

/**
 * Clean phone number to ensure it has 10 digits
 */
function getValidPhone(phone) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 ? cleanPhone : null;
}

/**
 * Dispatches RENEWAL_PAYMENT_LINK notification
 */
async function dispatchPaymentLinkGenerated(phone, variables) {
  const cleanPhone = getValidPhone(phone);
  if (cleanPhone) {
    notificationService.send({
      channel: 'whatsapp',
      event: 'RENEWAL_PAYMENT_LINK',
      to: cleanPhone,
      variables: {
        beneficiaryName: variables.beneficiaryName || 'you',
        packageName: variables.packageName,
        paymentLink: variables.paymentLink
      }
    }).catch(err => console.error('[Notification Dispatcher] Payment Link WhatsApp error:', err.message));
  }

  const email = variables.email || variables.subscriberEmail;
  if (email && email.includes('@')) {
    notificationService.send({
      channel: 'email',
      event: 'RENEWAL_PAYMENT_LINK',
      to: email,
      variables: {
        beneficiary_name: variables.beneficiaryName || 'you',
        package_name: variables.packageName,
        payment_link: variables.paymentLink || '',
      }
    }).catch(err => console.error('[Notification Dispatcher] Payment Link Email error:', err.message));
  }
}

/**
 * Dispatches PAYMENT_SUCCESSFUL and SUBSCRIPTION_ACTIVATED notifications
 */
async function dispatchPaymentSuccessful(phone, variables) {
  const cleanPhone = getValidPhone(phone);
  const email = variables.email || variables.subscriberEmail;

  // 1. Payment Receipt WhatsApp
  if (cleanPhone) {
    notificationService.send({
      channel: 'whatsapp',
      event: 'PAYMENT_SUCCESSFUL',
      to: cleanPhone,
      variables: {
        amount: variables.amount,
        beneficiaryName: variables.beneficiaryName || 'you',
        packageName: variables.packageName,
      }
    }).catch(err => console.error('[Notification Dispatcher] Payment Receipt WhatsApp error:', err.message));
  }

  // 1b. Payment Receipt Email (SES)
  if (email && email.includes('@')) {
    notificationService.send({
      channel: 'email',
      event: 'PAYMENT_SUCCESSFUL',
      to: email,
      variables: {
        amount: String(variables.amount),
        beneficiary_name: variables.beneficiaryName || 'you',
        package_name: variables.packageName,
      }
    }).catch(err => console.error('[Notification Dispatcher] Payment Receipt Email error:', err.message));
  }

  // 2. Subscription Activated (if applicable)
  if (variables.isSubscriptionActive) {
    if (cleanPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SUBSCRIPTION_ACTIVATED',
        to: cleanPhone,
        variables: {
          subscriberName: variables.subscriberName || 'Subscriber',
          packageName: variables.packageName,
          beneficiaryName: variables.beneficiaryName || 'your beneficiary',
          startDate: variables.startDate,
        }
      }).catch(err => console.error('[Notification Dispatcher] Subscription Activated WhatsApp error:', err.message));
    }

    if (email && email.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'SUBSCRIPTION_ACTIVATED',
        to: email,
        variables: {
          subscriber_name: variables.subscriberName || 'Subscriber',
          package_name: variables.packageName,
          beneficiary_name: variables.beneficiaryName || 'your beneficiary',
          start_date: variables.startDate,
        }
      }).catch(err => console.error('[Notification Dispatcher] Subscription Activated Email error:', err.message));
    }
  }
}

/**
 * Dispatches VISIT_SCHEDULED notification
 */
async function dispatchVisitScheduled(phone, variables) {
  const cleanPhone = getValidPhone(phone);
  if (!cleanPhone) return;

  return notificationService.send({
    channel: 'whatsapp',
    event: 'VISIT_SCHEDULED',
    to: cleanPhone,
    variables: {
      ccName: variables.ccName || 'Your Care Companion',
      beneficiaryName: variables.beneficiaryName || 'the beneficiary',
      date: variables.date,
      time: variables.time,
      address: variables.address || 'the registered address',
    }
  }).catch(err => console.error('[Notification Dispatcher] Visit Scheduled error:', err.message));
}

/**
 * Dispatches CC_ASSIGNED notification
 */
async function dispatchCareCompanionAssigned(phone, variables) {
  const cleanPhone = getValidPhone(phone);
  if (cleanPhone) {
    notificationService.send({
      channel: 'whatsapp',
      event: 'CC_ASSIGNED',
      to: cleanPhone,
      variables: {
        ccName: variables.ccName || 'Your Care Companion',
        beneficiaryName: variables.beneficiaryName || 'your beneficiary',
        primaryOrSecondary: variables.primaryOrSecondary || 'Primary'
      }
    }).catch(err => console.error('[Notification Dispatcher] CC Assigned WhatsApp error:', err.message));
  }

  const email = variables.email || variables.subscriberEmail;
  if (email && email.includes('@')) {
    notificationService.send({
      channel: 'email',
      event: 'CARE_MITRA_ASSIGNED',
      to: email,
      variables: {
        cc_name: variables.ccName || 'Your Care Companion',
        beneficiary_name: variables.beneficiaryName || 'your beneficiary',
        contact_number: variables.ccPhone || variables.contactNumber || 'Contact Support',
      }
    }).catch(err => console.error('[Notification Dispatcher] CC Assigned Email error:', err.message));
  }
}

const domainEvents = require('./events');

module.exports = {
  dispatchPaymentLinkGenerated,
  dispatchPaymentSuccessful,
  dispatchVisitScheduled,
  dispatchCareCompanionAssigned,
  // Domain Event Registry
  ...domainEvents,
  domainEvents,
};
