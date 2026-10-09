/**
 * Roster & Care Team Event Dispatcher Service (`services/events/roster-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling roster management and care team allocations:
 *   - Care Companion Allocated / Reallocated
 *   - New Care Companion assigned to Field Manager
 *   - Roster Approved for a zone/period
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
 * 1. Dispatch CC Allocation / Assignment to Subscriber & Beneficiary
 */
async function dispatchCareCompanionAssigned({ beneficiaryId, ccName, primaryOrSecondary = 'Primary' }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        subscriber: { select: { id: true, name: true, phone: true, email: true } }
      }
    });

    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'your beneficiary';

    // A. Notify Beneficiary (Push)
    if (beneficiary.user?.id) {
      notifyUser(prisma, {
        userId: beneficiary.user.id,
        type: 'info',
        title: '🤝 Care Companion Assigned',
        body: `${ccName} has been assigned as your ${primaryOrSecondary} Care Companion.`,
        data: { screen: 'team', event: 'CC_ASSIGNED' },
      }).catch(err => console.error('[RosterDispatcher] Beneficiary Push Error:', err.message));
    }

    // B. Notify Subscriber (Push + WhatsApp)
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: '🤝 Care Companion Assigned',
        body: `${ccName} has been assigned as ${primaryOrSecondary} Care Companion for ${beneficiaryName}.`,
        data: { beneficiaryId, screen: 'team', event: 'CC_ASSIGNED' },
      }).catch(err => console.error('[RosterDispatcher] Subscriber Push Error:', err.message));
    }

    // WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'CC_ASSIGNED',
        to: subscriberPhone,
        variables: {
          ccName,
          beneficiaryName,
          primaryOrSecondary,
        }
      }).catch(err => console.error('[RosterDispatcher] WhatsApp Error:', err.message));
    }

    // AWS SES Email to Subscriber
    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'CARE_MITRA_ASSIGNED',
        to: subscriberEmail,
        variables: {
          cc_name: ccName,
          beneficiary_name: beneficiaryName,
          contact_number: 'Contact Support',
        }
      }).catch(err => console.error('[RosterDispatcher] Email Error:', err.message));
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchCareCompanionAssigned Exception:', err.message);
  }
}

/**
 * 2. Dispatch Temporary CC Reallocation Alert
 */
async function dispatchCCReallocated({ beneficiaryId, tempCcName, originalCcName }) {
  try {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true } }
      }
    });

    if (!beneficiary) return;
    const beneficiaryName = beneficiary.name || 'your beneficiary';

    // Notify Subscriber
    if (beneficiary.subscriber?.id) {
      notifyUser(prisma, {
        userId: beneficiary.subscriber.id,
        type: 'info',
        title: '🔄 Temporary Care Companion Reassigned',
        body: `${tempCcName} will temporarily visit ${beneficiaryName} in place of ${originalCcName}.`,
        data: { beneficiaryId, event: 'CC_REALLOCATED' },
      }).catch(err => console.error('[RosterDispatcher] Reallocation Push Error:', err.message));
    }

    // WhatsApp to Subscriber
    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'CC_REALLOCATED',
        to: subscriberPhone,
        variables: {
          tempCcName,
          beneficiaryName,
          originalCcName,
        }
      }).catch(err => console.error('[RosterDispatcher] Reallocation WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchCCReallocated Exception:', err.message);
  }
}

/**
 * 3. Dispatch Roster Approved Notification to Field Manager & CCs
 */
async function dispatchRosterApproved({ zoneId, date, periodType, approvedByName }) {
  try {
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        fieldManagerUser: { select: { id: true } },
        teams: {
          include: {
            careCompanions: { select: { userId: true } }
          }
        }
      }
    });

    if (!zone) return;

    const formattedDate = new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const zoneName = zone.name || 'Zone';

    // Notify Field Manager
    const fmUserId = zone.fieldManagerUser?.id;
    if (fmUserId) {
      notifyUser(prisma, {
        userId: fmUserId,
        type: 'info',
        title: '📋 Roster Approved',
        body: `The ${periodType} roster for ${zoneName} (${formattedDate}) has been approved by ${approvedByName}.`,
        data: { zoneId, event: 'ROSTER_APPROVED' },
      }).catch(err => console.error('[RosterDispatcher] FM Push Error:', err.message));
    }

    // Notify all CCs in zone
    const ccUserIds = new Set();
    zone.teams.forEach(t => t.careCompanions.forEach(cc => cc.userId && ccUserIds.add(cc.userId)));

    for (const userId of ccUserIds) {
      notifyUser(prisma, {
        userId,
        type: 'info',
        title: '📋 Work Roster Finalized',
        body: `Your schedule for ${formattedDate} in ${zoneName} has been approved. Check your roster!`,
        data: { event: 'ROSTER_APPROVED' },
      }).catch(err => console.error('[RosterDispatcher] CC Roster Push Error:', err.message));
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchRosterApproved Exception:', err.message);
  }
}

/**
 * 4. Dispatch NEW_CC_ASSIGNED_TO_FM (NT-062)
 */
async function dispatchNewCCAssignedToFM({ fmUserId, fmPhone, ccName, date }) {
  try {
    if (fmUserId) {
      notifyUser(prisma, {
        userId: fmUserId,
        type: 'info',
        title: '👤 New Team Member',
        body: `${ccName} has been added to your team, effective ${date}.`,
        data: { event: 'NEW_CC_ASSIGNED_TO_FM' },
      }).catch(err => console.error('[RosterDispatcher] FM Push Error:', err.message));
    }

    const validPhone = getValidPhone(fmPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'NEW_CC_ASSIGNED_TO_FM',
        to: validPhone,
        variables: { ccName, date }
      }).catch(err => console.error('[RosterDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchNewCCAssignedToFM Exception:', err.message);
  }
}

/**
 * 5. Dispatch CC_DEACTIVATED (NT-063)
 */
async function dispatchCCDeactivated({ fmUserId, omUserId, fmPhone, omPhone, ccName, lastWorkingDate, reason }) {
  try {
    const notifyRoles = [
      { id: fmUserId, phone: fmPhone },
      { id: omUserId, phone: omPhone },
    ];

    for (const role of notifyRoles) {
      if (role.id) {
        notifyUser(prisma, {
          userId: role.id,
          type: 'alert',
          title: '🚫 Care Mitra Deactivated',
          body: `${ccName} has been deactivated effective ${lastWorkingDate}. Reason: ${reason}. Please reassign.`,
          data: { event: 'CC_DEACTIVATED' },
        }).catch(err => console.error('[RosterDispatcher] Push Error:', err.message));
      }

      const validPhone = getValidPhone(role.phone);
      if (validPhone) {
        notificationService.send({
          channel: 'whatsapp',
          event: 'CC_DEACTIVATED',
          to: validPhone,
          variables: { ccName, lastWorkingDate, reason }
        }).catch(err => console.error('[RosterDispatcher] WhatsApp Error:', err.message));
      }
    }

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.AWS_SES_FROM_EMAIL;
    if (adminEmail && adminEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'CARE_MITRA_DEACTIVATED',
        to: adminEmail,
        variables: {
          cc_name: ccName,
          reason: reason || 'Operations Update',
        }
      }).catch(err => console.error('[RosterDispatcher] Deactivation Email Error:', err.message));
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchCCDeactivated Exception:', err.message);
  }
}

/**
 * 6. Dispatch BIRTHDAY_REMINDER (NT-064)
 */
async function dispatchBirthdayReminder({ ccUserId, fmUserId, ccPhone, fmPhone, beneficiaryName, date }) {
  try {
    const notifyRoles = [
      { id: ccUserId, phone: ccPhone },
      { id: fmUserId, phone: fmPhone },
    ];

    for (const role of notifyRoles) {
      if (role.id) {
        notifyUser(prisma, {
          userId: role.id,
          type: 'reminder',
          title: '🎂 Celebration Reminder',
          body: `Reminder: it's ${beneficiaryName}'s birthday on ${date}! Plan a small celebration during your visit.`,
          data: { event: 'BIRTHDAY_REMINDER' },
        }).catch(err => console.error('[RosterDispatcher] Push Error:', err.message));
      }

      const validPhone = getValidPhone(role.phone);
      if (validPhone) {
        notificationService.send({
          channel: 'whatsapp',
          event: 'BIRTHDAY_REMINDER',
          to: validPhone,
          variables: { beneficiaryName, date }
        }).catch(err => console.error('[RosterDispatcher] WhatsApp Error:', err.message));
      }
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchBirthdayReminder Exception:', err.message);
  }
}

/**
 * 7. Dispatch CC_PERFORMANCE_RATING (NT-065)
 */
async function dispatchCCPerformanceRating({ ccUserId, ccPhone, rating, beneficiaryName, comment }) {
  try {
    if (ccUserId) {
      notifyUser(prisma, {
        userId: ccUserId,
        type: 'info',
        title: '⭐ New Feedback Received',
        body: `You received a ${rating}-star rating from ${beneficiaryName}'s family. Comment: "${comment}"`,
        data: { event: 'CC_PERFORMANCE_RATING' },
      }).catch(err => console.error('[RosterDispatcher] Push Error:', err.message));
    }

    const validPhone = getValidPhone(ccPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'CC_PERFORMANCE_RATING',
        to: validPhone,
        variables: { rating: rating.toString(), beneficiaryName, comment }
      }).catch(err => console.error('[RosterDispatcher] WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[RosterDispatcher] dispatchCCPerformanceRating Exception:', err.message);
  }
}


module.exports = {
  dispatchCareCompanionAssigned,
  dispatchCCReallocated,
  dispatchRosterApproved,
  dispatchNewCCAssignedToFM,
  dispatchCCDeactivated,
  dispatchBirthdayReminder,
  dispatchCCPerformanceRating,
};
