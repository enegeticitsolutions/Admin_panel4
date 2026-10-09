/**
 * Medication Event Dispatcher Service (`services/events/medication-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel notifications for:
 *   - Medication Reminders (To Beneficiaries)
 *   - Missed Medication Alerts (To Subscriber & Care Companion)
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
 * 1. Dispatch Medication Reminder to Beneficiary
 */
async function dispatchMedicationReminder({ beneficiaryId, medicationName, dosage, time }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        user: { select: { id: true, name: true, phone: true } }
      }
    });

    if (!beneficiary) return;

    // A. Notify Beneficiary (FCM Push + Bell Tray)
    if (beneficiary.user?.id) {
      notifyUser(prisma, {
        userId: beneficiary.user.id,
        type: 'reminder',
        title: '💊 Medication Reminder',
        body: `It is time to take ${medicationName} (${dosage || 'as prescribed'}) scheduled for ${time}.`,
        data: { screen: 'meds', event: 'MEDICATION_REMINDER' },
      }).catch(err => console.error('[MedicationDispatcher] Beneficiary Push Error:', err.message));
    }

    // B. Send WhatsApp to Beneficiary
    const beneficiaryPhone = getValidPhone(beneficiary.user?.phone);
    if (beneficiaryPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'MEDICATION_REMINDER',
        to: beneficiaryPhone,
        variables: {
          beneficiaryName: beneficiary.name || 'there',
          medicationName,
          dosage: dosage || 'as prescribed',
        }
      }).catch(err => console.error('[MedicationDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[MedicationDispatcher] dispatchMedicationReminder Exception:', err.message);
  }
}

/**
 * 2. Dispatch Missed Medication Alert to Subscriber & Care Companion
 */
async function dispatchMedicationMissed({ beneficiaryId, medicationName, scheduledTime }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true, email: true } },
        primaryCC: { select: { userId: true } }
      }
    });

    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';

    // A. Notify Subscriber (Push + Bell)
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'alert',
        title: '⚠️ Missed Medication Alert',
        body: `${beneficiaryName} missed taking ${medicationName} scheduled for ${scheduledTime}.`,
        data: { beneficiaryId, screen: 'index', event: 'MEDICATION_MISSED' },
      }).catch(err => console.error('[MedicationDispatcher] Subscriber Push Error:', err.message));
    }

    // B. Notify Primary Care Companion
    if (beneficiary.primaryCC?.userId) {
      notifyUser(prisma, {
        userId: beneficiary.primaryCC.userId,
        type: 'alert',
        title: '⚠️ Missed Medication Alert',
        body: `${beneficiaryName} missed their scheduled dose of ${medicationName}. Please follow up.`,
        data: { beneficiaryId, event: 'MEDICATION_MISSED' },
      }).catch(err => console.error('[MedicationDispatcher] CC Push Error:', err.message));
    }

    // C. WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'MEDICATION_MISSED',
        to: subscriberPhone,
        variables: {
          beneficiaryName,
          medicationName,
          scheduledTime,
        }
      }).catch(err => console.error('[MedicationDispatcher] Missed Dose WhatsApp Error:', err.message));
    }

    // D. AWS SES Email to Subscriber
    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'MEDICATION_MISSED',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
          medication_name: medicationName,
          scheduled_time: scheduledTime,
        }
      }).catch(err => console.error('[MedicationDispatcher] Missed Dose Email Error:', err.message));
    }
  } catch (err) {
    console.error('[MedicationDispatcher] dispatchMedicationMissed Exception:', err.message);
  }
}

module.exports = {
  dispatchMedicationReminder,
  dispatchMedicationMissed,
};
