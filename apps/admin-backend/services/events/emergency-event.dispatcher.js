/**
 * Emergency Event Dispatcher Service (`services/events/emergency-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel emergency notifications:
 *   - Emergency SOS Triggered (To Subscriber, Care Companions, & Emergency Control Radar)
 *   - Ambulance Dispatched (Status updates to Subscriber & Beneficiary)
 *   - Emergency Resolved (Outcome summaries)
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
 * 1. Dispatch EMERGENCY_TRIGGERED Alert
 */
async function dispatchEmergencyTriggered({ requestId, beneficiaryId, locationAddress, lat, lng }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true } },
        primaryCC: { select: { userId: true } },
        secondaryCC: { select: { userId: true } },
      }
    });

    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'Beneficiary';
    const timestampStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const location = locationAddress || 'GPS Location Tagged';

    // A. Notify Subscriber (High-Priority FCM Push + In-App Bell)
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'alert',
        title: '🚨 EMERGENCY SOS TRIGGERED!',
        body: `Emergency support triggered for ${beneficiaryName} at ${timestampStr}. Location: ${location}`,
        data: { requestId, beneficiaryId, screen: 'emergency', event: 'EMERGENCY_TRIGGERED' },
      }).catch(err => console.error('[EmergencyDispatcher] Subscriber Push Error:', err.message));
    }

    // B. Notify Primary & Secondary Care Companions
    const ccUserIds = [beneficiary.primaryCC?.userId, beneficiary.secondaryCC?.userId].filter(Boolean);
    for (const userId of ccUserIds) {
      notifyUser(prisma, {
        userId,
        type: 'alert',
        title: '🚨 EMERGENCY SOS ALERT',
        body: `URGENT: ${beneficiaryName} triggered emergency support. Check live emergency radar!`,
        data: { requestId, beneficiaryId, event: 'EMERGENCY_TRIGGERED' },
      }).catch(err => console.error('[EmergencyDispatcher] CC Push Error:', err.message));
    }

    // C. WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'EMERGENCY_TRIGGERED',
        to: subscriberPhone,
        variables: {
          beneficiaryName,
          timestamp: timestampStr,
          location,
        }
      }).catch(err => console.error('[EmergencyDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[EmergencyDispatcher] dispatchEmergencyTriggered Exception:', err.message);
  }
}

/**
 * 2. Dispatch AMBULANCE_DISPATCHED Update
 */
async function dispatchAmbulanceDispatched({ requestId, beneficiaryId, eta = '15 mins' }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        subscriber: { select: { id: true, name: true, phone: true } }
      }
    });

    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    // Notify Subscriber
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: '🚑 Ambulance Dispatched',
        body: `Emergency response ambulance has been dispatched for ${beneficiaryName}. ETA: ${eta}.`,
        data: { requestId, event: 'AMBULANCE_DISPATCHED' },
      }).catch(err => console.error('[EmergencyDispatcher] Subscriber Ambulance Push Error:', err.message));
    }

    // Notify Beneficiary
    if (beneficiary.user?.id) {
      notifyUser(prisma, {
        userId: beneficiary.user.id,
        type: 'info',
        title: '🚑 Help is on the way!',
        body: `An ambulance has been dispatched to your location. Estimated arrival in ${eta}.`,
        data: { requestId, event: 'AMBULANCE_DISPATCHED' },
      }).catch(err => console.error('[EmergencyDispatcher] Beneficiary Ambulance Push Error:', err.message));
    }

    // WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'AMBULANCE_DISPATCHED',
        to: subscriberPhone,
        variables: {
          beneficiaryName,
          eta,
        }
      }).catch(err => console.error('[EmergencyDispatcher] Ambulance WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[EmergencyDispatcher] dispatchAmbulanceDispatched Exception:', err.message);
  }
}

/**
 * 3. Dispatch EMERGENCY_RESOLVED Summary
 */
async function dispatchEmergencyResolved({ requestId, beneficiaryId, outcome = 'Safely Resolved' }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true } }
      }
    });

    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    // Notify Subscriber
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: '✅ Emergency Ticket Resolved',
        body: `The emergency ticket for ${beneficiaryName} has been closed. Status: ${outcome}`,
        data: { requestId, event: 'EMERGENCY_RESOLVED' },
      }).catch(err => console.error('[EmergencyDispatcher] Subscriber Resolved Push Error:', err.message));
    }

    // WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'EMERGENCY_RESOLVED',
        to: subscriberPhone,
        variables: {
          beneficiaryName,
          outcome,
        }
      }).catch(err => console.error('[EmergencyDispatcher] Resolved WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[EmergencyDispatcher] dispatchEmergencyResolved Exception:', err.message);
  }
}

/**
 * 4. Dispatch EMERGENCY_ACKNOWLEDGED (NT-051)
 */
async function dispatchEmergencyAcknowledged({ requestId, beneficiaryId }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true } }
      }
    });

    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'the beneficiary';

    // Notify Subscriber
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: '🚨 Emergency Being Handled',
        body: `We've received the emergency alert for ${beneficiaryName} and our team is responding. We'll update you shortly.`,
        data: { requestId, event: 'EMERGENCY_ACKNOWLEDGED' },
      }).catch(err => console.error('[EmergencyDispatcher] Subscriber Ack Push Error:', err.message));
    }

    // WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'EMERGENCY_ACKNOWLEDGED',
        to: subscriberPhone,
        variables: {
          beneficiaryName
        }
      }).catch(err => console.error('[EmergencyDispatcher] Ack WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[EmergencyDispatcher] dispatchEmergencyAcknowledged Exception:', err.message);
  }
}


/**
 * 5. Dispatch EMERGENCY_SUPPORT_ALERT / SAATHI_EMERGENCY_SUPPORT_ALERT (ST-051)
 */
async function dispatchEmergencySupportAlert({ volunteerPhone, volunteerUserId, beneficiaryName, coordinatorName }) {
  try {
    if (volunteerUserId) {
      notifyUser(prisma, {
        userId: volunteerUserId,
        type: 'alert',
        title: '🚨 Emergency Alert Received',
        body: `Your emergency alert regarding ${beneficiaryName} has been received. Program Coordinator ${coordinatorName} has been notified and will call you shortly.`,
        data: { event: 'SAATHI_EMERGENCY_SUPPORT_ALERT' },
      }).catch(err => console.error('[EmergencyDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_EMERGENCY_SUPPORT_ALERT',
        to: validPhone,
        variables: {
          beneficiaryName: beneficiaryName || 'the senior beneficiary',
          coordinatorName: coordinatorName || 'MaiHoonNa Operations'
        }
      }).catch(err => console.error('[EmergencyDispatcher] Emergency Support Alert WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[EmergencyDispatcher] dispatchEmergencySupportAlert Exception:', err.message);
  }
}

module.exports = {
  dispatchEmergencyTriggered,
  dispatchAmbulanceDispatched,
  dispatchEmergencyResolved,
  dispatchEmergencyAcknowledged,
  dispatchEmergencySupportAlert,
};

