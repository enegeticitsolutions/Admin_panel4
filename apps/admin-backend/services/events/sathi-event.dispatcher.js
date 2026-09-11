/**
 * Sathi Network Event Dispatcher Service (`apps/admin-backend/services/events/sathi-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel Sathi notifications:
 *   - ST-003: Saathi profile approved & activated
 *   - ST-010: New beneficiary match assigned
 *   - ST-011: Beneficiary reassigned / match removed
 *   - ST-032: Gift card issued & delivered
 *   - ST-052: Visit feedback flags a concern
 *   - ST-060: New Saathi volunteer registered
 *   - ST-061: Gift card redemption needs approval
 *   - ST-062: Volunteer inactive 30+ days
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
 * Ensures shadow User record exists for Volunteer so foreign keys in notifications table succeed
 */
async function resolveVolunteerUserId(volunteerId, fallbackPhone, fallbackName) {
  try {
    if (!volunteerId) return null;
    const existingUser = await prisma.user.findUnique({ where: { id: volunteerId } });
    if (existingUser) return existingUser.id;

    const vol = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
    const phone = vol?.phone || fallbackPhone;
    const name = vol?.name || fallbackName || 'Volunteer';

    if (!phone) return null;

    const userByPhone = await prisma.user.findUnique({ where: { phone } });
    if (userByPhone) return userByPhone.id;

    const created = await prisma.user.create({
      data: {
        id: volunteerId,
        phone,
        name,
        role: 'volunteer',
        fcmToken: vol?.fcmToken || null,
        isActive: vol?.isActive !== false,
      },
    });
    return created.id;
  } catch (err) {
    console.warn('[SathiAdminDispatcher] resolveVolunteerUserId warning:', err.message);
    return null;
  }
}

/**
 * ST-003: Saathi profile approved & activated
 */
async function dispatchSaathiProfileApproved({ volunteerId, volunteerName, volunteerPhone, volunteerUserId }) {
  try {
    const userId = volunteerUserId || (await resolveVolunteerUserId(volunteerId, volunteerPhone, volunteerName));
    if (userId) {
      notifyUser(prisma, {
        userId,
        type: 'system',
        title: 'Welcome to the Saathi Network!',
        body: `Congratulations ${volunteerName}! Your Saathi profile is approved. Head to the Match tab to view beneficiaries near you.`,
        data: {
          templateId: 'ST-003',
          screen: '/(sathi)/match',
          volunteerName,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-003:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_PROFILE_APPROVED',
        to: validPhone,
        variables: { volunteerName: volunteerName || 'Volunteer' },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchSaathiProfileApproved Exception:', err.message);
  }
}

/**
 * ST-010: New beneficiary match assigned
 */
async function dispatchSaathiBeneficiaryMatched({ volunteerId, volunteerName, volunteerPhone, beneficiaryName, distanceKm = '2.5' }) {
  try {
    const userId = await resolveVolunteerUserId(volunteerId, volunteerPhone, volunteerName);
    if (userId) {
      notifyUser(prisma, {
        userId,
        type: 'system',
        title: 'New Beneficiary Match',
        body: `Hi ${volunteerName}, you've been matched with ${beneficiaryName}, a senior beneficiary ${distanceKm} km away. Review their profile and schedule your first visit.`,
        data: {
          templateId: 'ST-010',
          screen: '/(sathi)/match',
          volunteerName,
          beneficiaryName,
          distanceKm: String(distanceKm),
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-010:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_BENEFICIARY_MATCHED',
        to: validPhone,
        variables: {
          volunteerName: volunteerName || 'Volunteer',
          beneficiaryName,
          distanceKm: String(distanceKm),
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchSaathiBeneficiaryMatched Exception:', err.message);
  }
}

/**
 * ST-011: Beneficiary reassigned / match removed
 */
async function dispatchSaathiBeneficiaryUnmatched({ volunteerId, volunteerName, volunteerPhone, beneficiaryName }) {
  try {
    const userId = await resolveVolunteerUserId(volunteerId, volunteerPhone, volunteerName);
    if (userId) {
      notifyUser(prisma, {
        userId,
        type: 'system',
        title: 'Match Update',
        body: `Hi ${volunteerName}, ${beneficiaryName} is no longer in your assigned beneficiary list.`,
        data: {
          templateId: 'ST-011',
          screen: '/(sathi)/match',
          volunteerName,
          beneficiaryName,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-011:', err.message));
    }

    const validPhone = getValidPhone(volunteerPhone);
    if (validPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'SAATHI_BENEFICIARY_UNMATCHED',
        to: validPhone,
        variables: { volunteerName: volunteerName || 'Volunteer', beneficiaryName },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchSaathiBeneficiaryUnmatched Exception:', err.message);
  }
}

/**
 * ST-032: Gift card issued & delivered
 */
async function dispatchSaathiGiftCardDelivered({ volunteerId, volunteerName, volunteerPhone, amount, giftCardBrand = 'MaiHoonNa', recipientContact }) {
  try {
    const userId = await resolveVolunteerUserId(volunteerId, volunteerPhone, volunteerName);
    const contact = recipientContact || volunteerPhone || 'your contact';
    if (userId) {
      notifyUser(prisma, {
        userId,
        type: 'system',
        title: 'Your Gift Card is Ready',
        body: `Your ₹${amount} ${giftCardBrand} Gift Card has been sent to ${contact}. Check your email/SMS for the code.`,
        data: {
          templateId: 'ST-032',
          screen: '/(sathi)/credits',
          amount: String(amount),
          giftCardBrand,
          recipientContact: contact,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-032:', err.message));
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchSaathiGiftCardDelivered Exception:', err.message);
  }
}

/**
 * ST-052: Visit feedback flags a concern (To Coordinator)
 */
async function dispatchSaathiFeedbackConcernFlagged({ coordinatorUserId, volunteerName, beneficiaryName, feedbackExcerpt }) {
  try {
    if (coordinatorUserId) {
      notifyUser(prisma, {
        userId: coordinatorUserId,
        type: 'alert',
        title: 'Feedback Flagged for Review',
        body: `${volunteerName} left a concern in visit feedback for ${beneficiaryName}: "${feedbackExcerpt}". Please review and follow up.`,
        data: {
          templateId: 'ST-052',
          screen: '/(sathi)/notifications',
          volunteerName,
          beneficiaryName,
          feedbackExcerpt,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-052:', err.message));
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchSaathiFeedbackConcernFlagged Exception:', err.message);
  }
}

/**
 * ST-060: New Saathi volunteer registered (To Coordinator)
 */
async function dispatchCoordinatorNewVolunteerRegistered({ coordinatorUserId, volunteerName, zoneCity }) {
  try {
    if (coordinatorUserId) {
      notifyUser(prisma, {
        userId: coordinatorUserId,
        type: 'info',
        title: 'New Volunteer Registration',
        body: `${volunteerName} has registered as a Saathi volunteer in ${zoneCity}. Review and approve their profile.`,
        data: {
          templateId: 'ST-060',
          screen: '/(sathi)/notifications',
          volunteerName,
          zoneCity,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-060:', err.message));
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchCoordinatorNewVolunteerRegistered Exception:', err.message);
  }
}

/**
 * ST-061: Gift card redemption needs approval (To Coordinator)
 */
async function dispatchCoordinatorRedemptionAwaitingApproval({ coordinatorUserId, volunteerName, credits, estimatedValue, giftCardBrand }) {
  try {
    if (coordinatorUserId) {
      notifyUser(prisma, {
        userId: coordinatorUserId,
        type: 'info',
        title: 'Redemption Awaiting Approval',
        body: `${volunteerName} has requested ${credits} credits (~₹${estimatedValue}) as a ${giftCardBrand} Gift Card. Approve or reject in the admin console.`,
        data: {
          templateId: 'ST-061',
          screen: '/(sathi)/notifications',
          volunteerName,
          credits: String(credits),
          estimatedValue: String(estimatedValue),
          giftCardBrand,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-061:', err.message));
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchCoordinatorRedemptionAwaitingApproval Exception:', err.message);
  }
}

/**
 * ST-062: Volunteer inactive 30+ days (To Coordinator)
 */
async function dispatchCoordinatorVolunteerInactiveAlert({ coordinatorUserId, volunteerName }) {
  try {
    if (coordinatorUserId) {
      notifyUser(prisma, {
        userId: coordinatorUserId,
        type: 'alert',
        title: 'Inactive Volunteer Alert',
        body: `${volunteerName} has logged no companion hours in 30 days. Consider a check-in call or reassigning their beneficiaries.`,
        data: {
          templateId: 'ST-062',
          screen: '/(sathi)/notifications',
          volunteerName,
        },
      }).catch(err => console.error('[SathiAdminDispatcher] Push Error ST-062:', err.message));
    }
  } catch (err) {
    console.error('[SathiAdminDispatcher] dispatchCoordinatorVolunteerInactiveAlert Exception:', err.message);
  }
}

module.exports = {
  dispatchSaathiProfileApproved,
  dispatchSaathiBeneficiaryMatched,
  dispatchSaathiBeneficiaryUnmatched,
  dispatchSaathiGiftCardDelivered,
  dispatchSaathiFeedbackConcernFlagged,
  dispatchCoordinatorNewVolunteerRegistered,
  dispatchCoordinatorRedemptionAwaitingApproval,
  dispatchCoordinatorVolunteerInactiveAlert,
};
