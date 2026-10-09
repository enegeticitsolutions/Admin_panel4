/**
 * Mood & Happiness Score Event Dispatcher Service (`services/events/mood-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher handling omnichannel mood and wellbeing notifications:
 *   - Mood Alert (NT-020)
 *   - Wellbeing Check Recommended (NT-021)
 *   - Happiness Score Update (NT-022)
 *   - Weekly Wellbeing Digest (NT-023)
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
 * Helper to fetch beneficiary relations
 */
async function getBeneficiaryWithSubscriber(beneficiaryId) {
  return prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      subscriber: { select: { id: true, name: true, phone: true, email: true } }
    }
  });
}

/**
 * 1. Dispatch MOOD_ALERT (NT-020)
 */
async function dispatchMoodAlert({ beneficiaryId, mood, ccName }) {
  try {
    const beneficiary = await getBeneficiaryWithSubscriber(beneficiaryId);
    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';
    const subscriberId = beneficiary.subscriber?.id;

    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'alert',
        title: `⚠️ Mood Alert for ${beneficiaryName}`,
        body: `${beneficiaryName} appeared ${mood} during today's visit. ${ccName} has added notes — tap to view and respond.`,
        data: { beneficiaryId, event: 'MOOD_ALERT' },
      }).catch(err => console.error('[MoodDispatcher] Subscriber Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'MOOD_ALERT',
        to: subscriberPhone,
        variables: { beneficiaryName, mood, ccName }
      }).catch(err => console.error('[MoodDispatcher] WhatsApp Error:', err.message));
    }

    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'MOOD_ALERT',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
          mood: mood || 'Concerned',
          cc_name: ccName || 'Care Companion',
        }
      }).catch(err => console.error('[MoodDispatcher] Email Error:', err.message));
    }
  } catch (err) {
    console.error('[MoodDispatcher] dispatchMoodAlert Exception:', err.message);
  }
}

/**
 * 2. Dispatch WELLBEING_CHECK_RECOMMENDED (NT-021)
 */
async function dispatchWellbeingCheckRecommended({ beneficiaryId }) {
  try {
    const beneficiary = await getBeneficiaryWithSubscriber(beneficiaryId);
    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';
    const subscriberId = beneficiary.subscriber?.id;

    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'alert',
        title: `⚠️ Wellbeing Check Recommended for ${beneficiaryName}`,
        body: `${beneficiaryName} has shown a low mood across two consecutive visits. We recommend a check-in call — would you like us to arrange a tele-consult?`,
        data: { beneficiaryId, event: 'WELLBEING_CHECK_RECOMMENDED' },
      }).catch(err => console.error('[MoodDispatcher] Subscriber Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'WELLBEING_CHECK_RECOMMENDED',
        to: subscriberPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[MoodDispatcher] WhatsApp Error:', err.message));
    }

    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'CONSECUTIVE_NEGATIVE_MOOD',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
        }
      }).catch(err => console.error('[MoodDispatcher] Consecutive Negative Mood Email Error:', err.message));
    }
  } catch (err) {
    console.error('[MoodDispatcher] dispatchWellbeingCheckRecommended Exception:', err.message);
  }
}

/**
 * 3. Dispatch HAPPINESS_SCORE_UPDATE (NT-022)
 */
async function dispatchHappinessScoreUpdate({ beneficiaryId, newScore }) {
  try {
    const beneficiary = await getBeneficiaryWithSubscriber(beneficiaryId);
    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';
    const subscriberId = beneficiary.subscriber?.id;

    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: `📈 Happiness Score Update for ${beneficiaryName}`,
        body: `${beneficiaryName}'s Happiness Score has changed to ${newScore}. Our care team has been notified and will follow up.`,
        data: { beneficiaryId, event: 'HAPPINESS_SCORE_UPDATE' },
      }).catch(err => console.error('[MoodDispatcher] Subscriber Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'HAPPINESS_SCORE_UPDATE',
        to: subscriberPhone,
        variables: { beneficiaryName, newScore: newScore.toString() }
      }).catch(err => console.error('[MoodDispatcher] WhatsApp Error:', err.message));
    }

    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'HAPPINESS_SCORE_DROPPED',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
          new_score: String(newScore),
        }
      }).catch(err => console.error('[MoodDispatcher] Happiness Score Email Error:', err.message));
    }
  } catch (err) {
    console.error('[MoodDispatcher] dispatchHappinessScoreUpdate Exception:', err.message);
  }
}

/**
 * 4. Dispatch WEEKLY_WELLBEING_DIGEST (NT-023)
 */
async function dispatchWeeklyWellbeingDigest({ beneficiaryId }) {
  try {
    const beneficiary = await getBeneficiaryWithSubscriber(beneficiaryId);
    if (!beneficiary) return;

    const beneficiaryName = beneficiary.name || 'the beneficiary';
    const subscriberId = beneficiary.subscriber?.id;

    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: `📊 ${beneficiaryName}'s Weekly Wellbeing Summary`,
        body: `Here's how ${beneficiaryName} has been doing this week — mood trend, visit highlights, and hours used.`,
        data: { beneficiaryId, event: 'WEEKLY_WELLBEING_DIGEST' },
      }).catch(err => console.error('[MoodDispatcher] Subscriber Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(beneficiary.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'WEEKLY_WELLBEING_DIGEST',
        to: subscriberPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[MoodDispatcher] WhatsApp Error:', err.message));
    }

    const subscriberEmail = beneficiary.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'WEEKLY_WELLBEING_DIGEST',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
        }
      }).catch(err => console.error('[MoodDispatcher] Weekly Digest Email Error:', err.message));
    }
  } catch (err) {
    console.error('[MoodDispatcher] dispatchWeeklyWellbeingDigest Exception:', err.message);
  }
}

module.exports = {
  dispatchMoodAlert,
  dispatchWellbeingCheckRecommended,
  dispatchHappinessScoreUpdate,
  dispatchWeeklyWellbeingDigest,
};
