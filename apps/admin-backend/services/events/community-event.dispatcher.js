/**
 * Community & Saathi Network Event Dispatcher Service (`services/events/community-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel community notifications:
 *   - Saathi Interaction Request (NT-070)
 *   - Saathi Visit Completed (NT-071)
 *   - Hobby Circle Message (NT-072)
 *   - Community Event Upcoming (NT-073)
 *   - Legacy Circle Bio Published (NT-074)
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
      subscriber: { select: { id: true, name: true, phone: true } },
      user: { select: { id: true, name: true, phone: true } }
    }
  });
}

/**
 * 1. Dispatch SAATHI_INTERACTION_REQUEST (NT-070)
 */
async function dispatchSaathiInteractionRequest({ volunteerUserId, volunteerPhone, beneficiaryName }) {
  try {
    if (volunteerUserId) {
      notifyUser(prisma, {
        userId: volunteerUserId,
        type: 'info',
        title: '🤝 New Saathi Request',
        body: `${beneficiaryName} has requested an interaction with you via Saathi Network. Tap to accept or view details.`,
        data: { event: 'SAATHI_INTERACTION_REQUEST' },
      }).catch(err => console.error('[CommunityDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_INTERACTION_REQUEST',
        to: validPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[CommunityDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[CommunityDispatcher] dispatchSaathiInteractionRequest Exception:', err.message);
  }
}

/**
 * 2. Dispatch SAATHI_VISIT_COMPLETED (NT-071)
 */
async function dispatchSaathiVisitCompleted({ volunteerUserId, volunteerPhone, beneficiaryName, credits }) {
  try {
    if (volunteerUserId) {
      notifyUser(prisma, {
        userId: volunteerUserId,
        type: 'info',
        title: '🎉 Saathi Credits Earned',
        body: `Thank you for spending time with ${beneficiaryName}! You've earned ${credits} Saathi credits.`,
        data: { event: 'SAATHI_VISIT_COMPLETED' },
      }).catch(err => console.error('[CommunityDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_VISIT_COMPLETED',
        to: validPhone,
        variables: { beneficiaryName, credits: credits.toString() }
      }).catch(err => console.error('[CommunityDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[CommunityDispatcher] dispatchSaathiVisitCompleted Exception:', err.message);
  }
}

/**
 * 3. Dispatch HOBBY_CIRCLE_MESSAGE (NT-072)
 */
async function dispatchHobbyCircleMessage({ beneficiaryId, senderName, hobby }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;

    if (beneficiary.user?.id) {
      notifyUser(prisma, {
        userId: beneficiary.user.id,
        type: 'info',
        title: '🎨 New Message in Hobby Circle',
        body: `${senderName} sent you a message about a shared interest in ${hobby}. Tap to view.`,
        data: { event: 'HOBBY_CIRCLE_MESSAGE' },
      }).catch(err => console.error('[CommunityDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(beneficiary.user?.phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'HOBBY_CIRCLE_MESSAGE',
        to: validPhone,
        variables: { senderName, hobby }
      }).catch(err => console.error('[CommunityDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[CommunityDispatcher] dispatchHobbyCircleMessage Exception:', err.message);
  }
}

/**
 * 4. Dispatch COMMUNITY_EVENT_UPCOMING (NT-073)
 */
async function dispatchCommunityEventUpcoming({ beneficiaryId, eventName, date, venue }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;

    if (beneficiary.user?.id) {
      notifyUser(prisma, {
        userId: beneficiary.user.id,
        type: 'info',
        title: '📅 Upcoming Community Event',
        body: `${eventName} is happening on ${date} at ${venue}. Tap to RSVP.`,
        data: { event: 'COMMUNITY_EVENT_UPCOMING' },
      }).catch(err => console.error('[CommunityDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(beneficiary.user?.phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'COMMUNITY_EVENT_UPCOMING',
        to: validPhone,
        variables: { eventName, date, venue }
      }).catch(err => console.error('[CommunityDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[CommunityDispatcher] dispatchCommunityEventUpcoming Exception:', err.message);
  }
}

/**
 * 5. Dispatch LEGACY_CIRCLE_BIO_PUBLISHED (NT-074)
 */
async function dispatchLegacyCircleBioPublished({ beneficiaryId }) {
  try {
    const beneficiary = await getBeneficiary(beneficiaryId);
    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';

    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: '📖 Legacy Circle Bio Published',
        body: `${beneficiaryName}'s Legacy Circle bio is now live and visible to the community.`,
        data: { event: 'LEGACY_CIRCLE_BIO_PUBLISHED' },
      }).catch(err => console.error('[CommunityDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'LEGACY_CIRCLE_BIO_PUBLISHED',
        to: validPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[CommunityDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[CommunityDispatcher] dispatchLegacyCircleBioPublished Exception:', err.message);
  }
}

/**
 * 6. Dispatch SAATHI_PROFILE_APPROVED (ST-003) — WhatsApp template: saathi_volunteer
 */
async function dispatchSaathiProfileApproved({ volunteerName, volunteerPhone, volunteerUserId }) {
  try {
    if (volunteerUserId) {
      notifyUser(prisma, {
        userId: volunteerUserId,
        type: 'success',
        title: '🎉 Welcome to the Saathi Network!',
        body: `Congratulations ${volunteerName}! Your Saathi profile is approved. Head to the Match tab to view beneficiaries near you.`,
        data: { event: 'SAATHI_PROFILE_APPROVED' },
      }).catch(err => console.error('[CommunityDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_PROFILE_APPROVED',
        to: validPhone,
        variables: { volunteerName: volunteerName || 'Volunteer' }
      }).catch(err => console.error('[CommunityDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[CommunityDispatcher] dispatchSaathiProfileApproved Exception:', err.message);
  }
}

module.exports = {
  dispatchSaathiInteractionRequest,
  dispatchSaathiVisitCompleted,
  dispatchHobbyCircleMessage,
  dispatchCommunityEventUpcoming,
  dispatchLegacyCircleBioPublished,
  dispatchSaathiProfileApproved,
};

