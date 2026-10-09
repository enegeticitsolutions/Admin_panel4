/**
 * Vitals Alert Event Dispatcher Service (`services/events/vitals-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel alerts when abnormal vitals are captured:
 *   - Blood Pressure alerts (High / Low)
 *   - Pulse Rate & SpO2 alerts
 *   - Blood Glucose alerts
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
 * Dispatch VITALS_ALERT when an abnormal reading is recorded
 */
async function dispatchVitalsAlert({ readingId, beneficiaryId, vitalName, readingValue, capturedByName }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true, email: true } },
        primaryCC: { select: { userId: true } }
      }
    });

    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'Beneficiary';
    const ccName = capturedByName || 'Care Companion';

    // A. Notify Subscriber (FCM Push + Bell)
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'alert',
        title: '⚠️ Abnormal Vitals Alert',
        body: `${vitalName} reading for ${beneficiaryName} was flagged as abnormal (${readingValue}). Logged by ${ccName}.`,
        data: { readingId, beneficiaryId, screen: 'vitals', event: 'VITALS_ALERT' },
      }).catch(err => console.error('[VitalsDispatcher] Subscriber Push Error:', err.message));
    }

    // B. Notify Care Companion
    if (beneficiary.primaryCC?.userId) {
      notifyUser(prisma, {
        userId: beneficiary.primaryCC.userId,
        type: 'alert',
        title: '⚠️ Abnormal Vitals Recorded',
        body: `${vitalName} (${readingValue}) recorded for ${beneficiaryName} is out of normal range.`,
        data: { readingId, beneficiaryId, event: 'VITALS_ALERT' },
      }).catch(err => console.error('[VitalsDispatcher] CC Push Error:', err.message));
    }

    // C. WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'VITALS_ALERT',
        to: subscriberPhone,
        variables: {
          beneficiaryName,
          vitalType: vitalName,
          reading: readingValue,
          ccName,
        }
      }).catch(err => console.error('[VitalsDispatcher] WhatsApp Error:', err.message));
    }

    // D. AWS SES Email to Subscriber
    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'VITALS_ALERT',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
          vital_type: vitalName,
          reading: String(readingValue),
          cc_name: ccName,
        }
      }).catch(err => console.error('[VitalsDispatcher] SES Email Error:', err.message));
    }
  } catch (err) {
    console.error('[VitalsDispatcher] dispatchVitalsAlert Exception:', err.message);
  }
}

/**
 * Dispatch EMR_VITALS_REPORT (NT-033)
 */
async function dispatchEMRVitalsReport({ beneficiaryId, month }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true, email: true } }
      }
    });

    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';

    // Notify Subscriber
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: `📊 ${beneficiaryName}'s Monthly Health Summary`,
        body: `Attached is ${beneficiaryName}'s vitals and medication adherence trend for ${month}.`,
        data: { beneficiaryId, event: 'EMR_VITALS_REPORT' },
      }).catch(err => console.error('[VitalsDispatcher] Subscriber EMR Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'EMR_VITALS_REPORT',
        to: subscriberPhone,
        variables: { beneficiaryName, month }
      }).catch(err => console.error('[VitalsDispatcher] EMR WhatsApp Error:', err.message));
    }

    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'MONTHLY_HEALTH_SUMMARY',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
          month: month || 'Current Month',
        }
      }).catch(err => console.error('[VitalsDispatcher] Monthly Summary Email Error:', err.message));
    }
  } catch (err) {
    console.error('[VitalsDispatcher] dispatchEMRVitalsReport Exception:', err.message);
  }
}

module.exports = {
  dispatchVitalsAlert,
  dispatchEMRVitalsReport,
};
