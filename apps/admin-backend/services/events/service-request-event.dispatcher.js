/**
 * Service Requests Event Dispatcher Service (`services/events/service-request-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel service request notifications:
 *   - Tele-consultation Scheduled (NT-080)
 *   - Lab Test Appointment Scheduled (NT-081)
 *   - Physiotherapy Appointment Scheduled (NT-082)
 *   - Medicine Order Placed (NT-083)
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
 * Helper to get beneficiary info
 */
async function getBeneficiary(beneficiaryId) {
  return prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      subscriber: { select: { id: true, name: true, phone: true, email: true } },
      user: { select: { id: true, name: true, phone: true, email: true } }
    }
  });
}

/**
 * Helper to notify subscriber and beneficiary
 */
async function notifyStakeholders(beneficiaryId, pushConfig, whatsappConfig, emailConfig = null) {
  const beneficiary = await getBeneficiary(beneficiaryId);
  if (!beneficiary) return;

  const notifyRoles = [];
  if (beneficiary.user?.id) {
    notifyRoles.push({ id: beneficiary.user.id, phone: beneficiary.user.phone, email: beneficiary.user.email });
  }
  
  if (beneficiary.subscriber?.id && beneficiary.subscriber.id !== beneficiary.user?.id) {
    notifyRoles.push({ id: beneficiary.subscriber.id, phone: beneficiary.subscriber.phone, email: beneficiary.subscriber.email });
  }

  for (const role of notifyRoles) {
    if (role.id) {
      notifyUser(prisma, {
        userId: role.id,
        ...pushConfig
      }).catch(err => console.error(`[ServiceRequestDispatcher] Push Error:`, err.message));
    }

    const validPhone = getValidPhone(role.phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        to: validPhone,
        ...whatsappConfig
      }).catch(err => console.error(`[ServiceRequestDispatcher] WhatsApp Error:`, err.message));
    }

    if (emailConfig && role.email && role.email.includes('@')) {
      notificationService.send({
        channel: 'email',
        to: role.email,
        ...emailConfig
      }).catch(err => console.error(`[ServiceRequestDispatcher] Email Error:`, err.message));
    }
  }
}

/**
 * 1. Dispatch TELECONSULTATION_REQUESTED (NT-080)
 */
async function dispatchTeleconsultationRequested({ beneficiaryId, dateTime, doctorName }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    await notifyStakeholders(
      beneficiaryId,
      {
        type: 'info',
        title: '📞 Tele-consultation Scheduled',
        body: `Your tele-consultation for ${beneficiaryName} is scheduled for ${dateTime} with Dr. ${doctorName}.`,
        data: { event: 'TELECONSULTATION_REQUESTED' }
      },
      {
        event: 'TELECONSULTATION_REQUESTED',
        variables: { beneficiaryName, dateTime, doctorName }
      },
      {
        event: 'APPOINTMENT_UPDATE',
        variables: {
          beneficiary_name: beneficiaryName,
          service_type: `Tele-consultation with Dr. ${doctorName}`,
          appointment_time: dateTime,
        }
      }
    );
  } catch (err) {
    console.error('[ServiceRequestDispatcher] dispatchTeleconsultationRequested Exception:', err.message);
  }
}

/**
 * 2. Dispatch LAB_TEST_SCHEDULED (NT-081)
 */
async function dispatchLabTestScheduled({ beneficiaryId, testName, dateTime, labLocation }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    await notifyStakeholders(
      beneficiaryId,
      {
        type: 'info',
        title: '🔬 Lab Appointment Confirmed',
        body: `${beneficiaryName}'s lab test (${testName}) is scheduled for ${dateTime} at ${labLocation}.`,
        data: { event: 'LAB_TEST_SCHEDULED' }
      },
      {
        event: 'LAB_TEST_SCHEDULED',
        variables: { beneficiaryName, testName, dateTime, labLocation }
      },
      {
        event: 'LAB_APPOINTMENT_SCHEDULED',
        variables: {
          beneficiary_name: beneficiaryName,
          lab_name: labLocation || testName || 'Diagnostic Lab',
          scheduled_time: dateTime,
        }
      }
    );
  } catch (err) {
    console.error('[ServiceRequestDispatcher] dispatchLabTestScheduled Exception:', err.message);
  }
}

/**
 * 3. Dispatch PHYSIOTHERAPY_SCHEDULED (NT-082)
 */
async function dispatchPhysiotherapyScheduled({ beneficiaryId, dateTime, center, therapistName }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    await notifyStakeholders(
      beneficiaryId,
      {
        type: 'info',
        title: '💪 Physiotherapy Appointment Confirmed',
        body: `${beneficiaryName}'s physiotherapy session is booked for ${dateTime} at ${center}.`,
        data: { event: 'PHYSIOTHERAPY_SCHEDULED' }
      },
      {
        event: 'PHYSIOTHERAPY_SCHEDULED',
        variables: { beneficiaryName, dateTime, center }
      },
      {
        event: 'PHYSIOTHERAPY_SCHEDULED',
        variables: {
          beneficiary_name: beneficiaryName,
          therapist_name: therapistName || center || 'Physiotherapist',
          scheduled_time: dateTime,
        }
      }
    );
  } catch (err) {
    console.error('[ServiceRequestDispatcher] dispatchPhysiotherapyScheduled Exception:', err.message);
  }
}

/**
 * 4. Dispatch MEDICINE_ORDER_PLACED (NT-083)
 */
async function dispatchMedicineOrderPlaced({ beneficiaryId, pharmacyPartner, deliveryDate }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    await notifyStakeholders(
      beneficiaryId,
      {
        type: 'info',
        title: '💊 Medicine Order Placed',
        body: `Your medicine order for ${beneficiaryName} has been placed with ${pharmacyPartner}. Expected delivery: ${deliveryDate}.`,
        data: { event: 'MEDICINE_ORDER_PLACED' }
      },
      {
        event: 'MEDICINE_ORDER_PLACED',
        variables: { beneficiaryName, pharmacyPartner, deliveryDate }
      }
    );
  } catch (err) {
    console.error('[ServiceRequestDispatcher] dispatchMedicineOrderPlaced Exception:', err.message);
  }
}

module.exports = {
  dispatchTeleconsultationRequested,
  dispatchLabTestScheduled,
  dispatchPhysiotherapyScheduled,
  dispatchMedicineOrderPlaced,
};
