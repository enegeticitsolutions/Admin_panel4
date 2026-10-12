/**
 * Visit Event Dispatcher Service (`services/events/visit-event.dispatcher.js`)
 *
 * Enterprise event-driven dispatcher that handles multi-stakeholder omnichannel
 * notification delivery (In-App Bell Tray, Expo FCM Push, and WhatsApp via MSG91)
 * for all visit lifecycle events:
 *   - Visit Scheduled
 *   - Visit Rescheduled / Updated
 *   - Visit Cancelled
 *   - Visit Started (Check-In)
 *   - Visit Completed (Check-Out)
 *
 * Safe & Asynchronous: Executes notification tasks asynchronously without blocking core DB transactions.
 */

const { prisma } = require('../../lib/prisma');
const { notifyUser } = require('../notifications');
const { notificationService, notificationProducer } = require('@maihoonna/notifications');

/**
 * Helper to get clean 10-digit phone number
 */
function getValidPhone(phone) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 ? cleanPhone : null;
}

/**
 * Format Date & Time cleanly for notifications
 */
function formatVisitTime(scheduledTime) {
  const d = new Date(scheduledTime);
  if (isNaN(d.getTime())) return { formattedDate: 'Scheduled Date', formattedTime: 'Scheduled Time', fullString: 'Scheduled Date' };
  
  const formattedDate = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  const fullString = `${formattedDate} at ${formattedTime}`;

  return { formattedDate, formattedTime, fullString };
}

/**
 * Helper to fetch complete visit details with all relations if only ID or partial object is provided
 */
async function fetchFullVisit(visitOrId) {
  if (
    typeof visitOrId === 'object' &&
    visitOrId?.beneficiary?.userId &&
    visitOrId?.careCompanion?.userId
  ) {
    return visitOrId;
  }

  const visitId = typeof visitOrId === 'string' ? visitOrId : visitOrId?.id;
  if (!visitId) return null;

  return prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      beneficiary: {
        select: {
          id: true,
          name: true,
          userId: true,
          subscriberId: true,
          address: true,
          subscriber: {
            select: { id: true, name: true, phone: true, email: true }
          },
          user: {
            select: { id: true, name: true, phone: true, email: true }
          }
        }
      },
      careCompanion: {
        select: {
          id: true,
          name: true,
          userId: true,
          user: {
            select: { id: true, name: true, phone: true, email: true }
          }
        }
      }
    }
  });
}

/**
 * 1. Dispatch VISIT_SCHEDULED event to Beneficiary, Subscriber, and Care Companion
 */
async function dispatchVisitScheduled(visitOrId, metadata = {}) {
  try {
    const visit = await fetchFullVisit(visitOrId);
    if (!visit) return;

    const { formattedDate, formattedTime, fullString } = formatVisitTime(visit.scheduledTime);
    const ccName = visit.careCompanion?.name || 'Your Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';
    const address = visit.beneficiary?.address || 'the registered address';

    // A. Notify Care Companion (Push + Bell)
    if (visit.careCompanion?.userId) {
      notifyUser(prisma, {
        userId: visit.careCompanion.userId,
        type: 'visit_reminder',
        title: '📅 New Visit Assigned',
        body: `You are scheduled to visit ${beneficiaryName} on ${fullString}.`,
        data: { visitId: visit.id, screen: 'schedule', event: 'VISIT_SCHEDULED' },
      }).catch(err => console.error('[VisitDispatcher] CC Push Error:', err.message));
    }

    // B. Notify Beneficiary (Push + Bell)
    if (visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: visit.beneficiary.userId,
        type: 'visit_reminder',
        title: '📅 Care Visit Scheduled',
        body: `${ccName} is scheduled to visit you on ${fullString}.`,
        data: { visitId: visit.id, screen: 'schedule', event: 'VISIT_SCHEDULED' },
      }).catch(err => console.error('[VisitDispatcher] Beneficiary Push Error:', err.message));
    }

    // C. Notify Subscriber (Push + Bell + WhatsApp)
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId && subscriberId !== visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'visit_reminder',
        title: '📅 Care Visit Scheduled',
        body: `A visit for ${beneficiaryName} with ${ccName} is scheduled for ${fullString}.`,
        data: { visitId: visit.id, beneficiaryId: visit.beneficiaryId, screen: 'index', event: 'VISIT_SCHEDULED' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Push Error:', err.message));
    }

    // Send WhatsApp to Care Mitra (NT-010 CC)
    const ccPhone = getValidPhone(visit.careCompanion?.user?.phone || visit.careCompanion?.phone);
    if (ccPhone) {
      if (notificationProducer && typeof notificationProducer.publish === 'function') {
        notificationProducer.publish({
          idempotencyKey: `visit-${visit.id}-scheduled-cc`,
          channel: 'whatsapp',
          event: 'VISIT_SCHEDULED',
          recipient: { phone: ccPhone },
          variables: {
            ccName,
            beneficiaryName,
            date: formattedDate,
            time: formattedTime,
            address,
          },
        }).catch(err => console.error('[VisitDispatcher] CC WhatsApp Error:', err.message));
      } else {
        notificationService.send({
          channel: 'whatsapp',
          event: 'VISIT_SCHEDULED',
          to: ccPhone,
          variables: { ccName, beneficiaryName, date: formattedDate, time: formattedTime, address }
        }).catch(err => console.error('[VisitDispatcher] CC WhatsApp Error:', err.message));
      }
    }

    // Send WhatsApp to Subscriber (NT-010 Subscriber)
    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      if (notificationProducer && typeof notificationProducer.publish === 'function') {
        notificationProducer.publish({
          idempotencyKey: `visit-${visit.id}-scheduled-sub`,
          channel: 'whatsapp',
          event: 'VISIT_SCHEDULED',
          recipient: { phone: subscriberPhone },
          variables: {
            ccName,
            beneficiaryName,
            date: formattedDate,
            time: formattedTime,
            address,
          },
        }).catch(err => console.error('[VisitDispatcher] Subscriber WhatsApp Error:', err.message));
      } else {
        notificationService.send({
          channel: 'whatsapp',
          event: 'VISIT_SCHEDULED',
          to: subscriberPhone,
          variables: {
            ccName,
            beneficiaryName,
            date: formattedDate,
            time: formattedTime,
            address,
          }
        }).catch(err => console.error('[VisitDispatcher] WhatsApp Error:', err.message));
      }
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchVisitScheduled Exception:', err.message);
  }
}

/**
 * 2. Dispatch VISIT_RESCHEDULED event to Beneficiary, Subscriber, and Care Companion
 */
async function dispatchVisitRescheduled(visitOrId, oldTime, metadata = {}) {
  try {
    const visit = await fetchFullVisit(visitOrId);
    if (!visit) return;

    const { formattedDate, formattedTime, fullString } = formatVisitTime(visit.scheduledTime);
    const ccName = visit.careCompanion?.name || 'Your Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';

    // A. Notify Care Companion
    if (visit.careCompanion?.userId) {
      notifyUser(prisma, {
        userId: visit.careCompanion.userId,
        type: 'visit_reminder',
        title: '⏰ Visit Rescheduled',
        body: `Your visit with ${beneficiaryName} has been rescheduled to ${fullString}.`,
        data: { visitId: visit.id, screen: 'schedule', event: 'VISIT_RESCHEDULED' },
      }).catch(err => console.error('[VisitDispatcher] CC Reschedule Push Error:', err.message));
    }

    // B. Notify Beneficiary
    if (visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: visit.beneficiary.userId,
        type: 'visit_reminder',
        title: '⏰ Visit Rescheduled',
        body: `Your visit with ${ccName} has been rescheduled to ${fullString}.`,
        data: { visitId: visit.id, screen: 'schedule', event: 'VISIT_RESCHEDULED' },
      }).catch(err => console.error('[VisitDispatcher] Beneficiary Reschedule Push Error:', err.message));
    }

    // C. Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId && subscriberId !== visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'visit_reminder',
        title: '⏰ Visit Rescheduled',
        body: `The visit for ${beneficiaryName} with ${ccName} has been rescheduled to ${fullString}.`,
        data: { visitId: visit.id, beneficiaryId: visit.beneficiaryId, screen: 'index', event: 'VISIT_RESCHEDULED' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Reschedule Push Error:', err.message));
    }

    // WhatsApp Notification
    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'APPOINTMENT_RESCHEDULED_CANCELLED',
        to: subscriberPhone,
        variables: {
          appointmentType: 'Care Visit',
          status: 'rescheduled',
          newDetails: `${beneficiaryName} with ${ccName} on ${fullString}`,
        }
      }).catch(err => console.error('[VisitDispatcher] Reschedule WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchVisitRescheduled Exception:', err.message);
  }
}

/**
 * 3. Dispatch VISIT_CANCELLED event to Beneficiary, Subscriber, and Care Companion
 */
async function dispatchVisitCancelled(visitOrId, reason = 'Cancelled by operations team', metadata = {}) {
  try {
    const visit = await fetchFullVisit(visitOrId);
    if (!visit) return;

    const { fullString } = formatVisitTime(visit.scheduledTime);
    const ccName = visit.careCompanion?.name || 'the Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';

    // A. Notify Care Companion
    if (visit.careCompanion?.userId) {
      notifyUser(prisma, {
        userId: visit.careCompanion.userId,
        type: 'visit_cancelled',
        title: '❌ Visit Cancelled',
        body: `Your visit with ${beneficiaryName} on ${fullString} has been cancelled.`,
        data: { visitId: visit.id, screen: 'schedule', event: 'VISIT_CANCELLED' },
      }).catch(err => console.error('[VisitDispatcher] CC Cancel Push Error:', err.message));
    }

    // B. Notify Beneficiary
    if (visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: visit.beneficiary.userId,
        type: 'visit_cancelled',
        title: '❌ Visit Cancelled',
        body: `Your scheduled visit with ${ccName} on ${fullString} has been cancelled.`,
        data: { visitId: visit.id, screen: 'schedule', event: 'VISIT_CANCELLED' },
      }).catch(err => console.error('[VisitDispatcher] Beneficiary Cancel Push Error:', err.message));
    }

    // C. Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId && subscriberId !== visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'visit_cancelled',
        title: '❌ Visit Cancelled',
        body: `The visit for ${beneficiaryName} on ${fullString} has been cancelled.`,
        data: { visitId: visit.id, beneficiaryId: visit.beneficiaryId, screen: 'index', event: 'VISIT_CANCELLED' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Cancel Push Error:', err.message));
    }

    // WhatsApp Notification
    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'APPOINTMENT_RESCHEDULED_CANCELLED',
        to: subscriberPhone,
        variables: {
          appointmentType: 'Care Visit',
          status: 'cancelled',
          newDetails: `Visit for ${beneficiaryName} on ${fullString}`,
        }
      }).catch(err => console.error('[VisitDispatcher] Cancel WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchVisitCancelled Exception:', err.message);
  }
}

/**
 * 4. Dispatch VISIT_STARTED event when Care Companion checks in
 */
async function dispatchVisitStarted(visitOrId, checkInTime = new Date()) {
  try {
    const visit = await fetchFullVisit(visitOrId);
    if (!visit) return;

    const formattedCheckIn = new Date(checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const ccName = visit.careCompanion?.name || 'Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';

    // A. Notify Beneficiary
    if (visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: visit.beneficiary.userId,
        type: 'info',
        title: '🚪 Care Companion Arrived',
        body: `${ccName} has checked in and started your care visit at ${formattedCheckIn}.`,
        data: { visitId: visit.id, event: 'VISIT_STARTED' },
      }).catch(err => console.error('[VisitDispatcher] Beneficiary Start Push Error:', err.message));
    }

    // B. Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId && subscriberId !== visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: '🚪 Care Visit Started',
        body: `${ccName} has checked in for ${beneficiaryName}'s visit at ${formattedCheckIn}.`,
        data: { visitId: visit.id, beneficiaryId: visit.beneficiaryId, event: 'VISIT_STARTED' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Start Push Error:', err.message));
    }

    // WhatsApp Notification
    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'VISIT_STARTED',
        to: subscriberPhone,
        variables: {
          ccName,
          beneficiaryName,
          checkInTime: formattedCheckIn,
        }
      }).catch(err => console.error('[VisitDispatcher] Visit Started WhatsApp Error:', err.message));
    }

    // AWS SES Email Notification to Subscriber
    const subscriberEmail = visit.beneficiary?.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'VISIT_STARTED',
        to: subscriberEmail,
        variables: {
          cc_name: ccName,
          beneficiary_name: beneficiaryName,
          checkin_time: formattedCheckIn,
        }
      }).catch(err => console.error('[VisitDispatcher] Visit Started Email Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchVisitStarted Exception:', err.message);
  }
}

/**
 * 5. Dispatch VISIT_COMPLETED event when visit checkout is complete
 */
async function dispatchVisitCompleted(visitOrId, durationMinutes = 60) {
  try {
    const visit = await fetchFullVisit(visitOrId);
    if (!visit) return;

    const ccName = visit.careCompanion?.name || 'Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';
    const durationText = `${durationMinutes} minutes`;

    // A. Notify Beneficiary
    if (visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: visit.beneficiary.userId,
        type: 'info',
        title: '✅ Visit Completed',
        body: `Your care visit with ${ccName} has been completed.`,
        data: { visitId: visit.id, event: 'VISIT_COMPLETED' },
      }).catch(err => console.error('[VisitDispatcher] Beneficiary Complete Push Error:', err.message));
    }

    // B. Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId && subscriberId !== visit.beneficiary?.userId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: '✅ Care Visit Completed',
        body: `The visit for ${beneficiaryName} with ${ccName} has been completed (${durationText}).`,
        data: { visitId: visit.id, beneficiaryId: visit.beneficiaryId, event: 'VISIT_COMPLETED' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Complete Push Error:', err.message));
    }

    // WhatsApp Notification
    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'VISIT_COMPLETED',
        to: subscriberPhone,
        variables: {
          ccName,
          beneficiaryName,
          duration: durationText,
        }
      }).catch(err => console.error('[VisitDispatcher] Visit Completed WhatsApp Error:', err.message));
    }

    // AWS SES Email Notification to Subscriber
    const subscriberEmail = visit.beneficiary?.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'VISIT_COMPLETED',
        to: subscriberEmail,
        variables: {
          cc_name: ccName,
          beneficiary_name: beneficiaryName,
          duration: durationText,
        }
      }).catch(err => console.error('[VisitDispatcher] Visit Completed Email Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchVisitCompleted Exception:', err.message);
  }
}

/**
 * 6. Dispatch VISIT_REMINDER (NT-011)
 */
async function dispatchVisitReminder({ visitId }) {
  try {
    const visit = await fetchFullVisit(visitId);
    if (!visit) return;

    const { formattedTime } = formatVisitTime(visit.scheduledTime);
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';

    // A. Notify Care Companion (Push)
    if (visit.careCompanion?.userId) {
      notifyUser(prisma, {
        userId: visit.careCompanion.userId,
        type: 'reminder',
        title: '⏰ Upcoming Visit Reminder',
        body: `Reminder: your visit with ${beneficiaryName} starts at ${formattedTime}. Tap to view directions.`,
        data: { visitId: visit.id, event: 'VISIT_REMINDER' },
      }).catch(err => console.error('[VisitDispatcher] CC Reminder Push Error:', err.message));
    }

    // B. WhatsApp Notification (To Care Companion)
    const ccPhone = getValidPhone(visit.careCompanion?.user?.phone);
    if (ccPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'VISIT_REMINDER',
        to: ccPhone,
        variables: { beneficiaryName, time: formattedTime }
      }).catch(err => console.error('[VisitDispatcher] Visit Reminder WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchVisitReminder Exception:', err.message);
  }
}

/**
 * 7. Dispatch MANUAL_CHECKIN_FLAGGED (NT-013)
 */
async function dispatchManualCheckinFlagged({ visitId, fmUserId, fmPhone, remarks }) {
  try {
    const visit = await fetchFullVisit(visitId);
    if (!visit) return;

    const ccName = visit.careCompanion?.name || 'Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';
    const reason = remarks || 'Outside geo-fence';

    // A. Notify Field Manager (Push)
    if (fmUserId) {
      notifyUser(prisma, {
        userId: fmUserId,
        type: 'alert',
        title: '⚠️ Manual Check-in Alert',
        body: `${ccName} performed a manual check-in for ${beneficiaryName} (outside geo-fence). Reason: ${reason}.`,
        data: { visitId: visit.id, event: 'MANUAL_CHECKIN_FLAGGED' },
      }).catch(err => console.error('[VisitDispatcher] FM Alert Push Error:', err.message));
    }

    // B. WhatsApp Notification (To FM)
    const fmValidPhone = getValidPhone(fmPhone);
    if (fmValidPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'MANUAL_CHECKIN_FLAGGED',
        to: fmValidPhone,
        variables: { ccName, beneficiaryName, remarks: reason }
      }).catch(err => console.error('[VisitDispatcher] Manual Check-in WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchManualCheckinFlagged Exception:', err.message);
  }
}

/**
 * 8. Dispatch DAILY_VISIT_SUMMARY (NT-015)
 */
async function dispatchDailyVisitSummary({ visitId, mood, notes }) {
  try {
    const visit = await fetchFullVisit(visitId);
    if (!visit) return;

    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';
    const subscriberName = visit.beneficiary?.subscriber?.name || 'Subscriber';
    
    // Notify Subscriber (Push + WhatsApp)
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: `📄 Today's Visit Summary for ${beneficiaryName}`,
        body: `Hi ${subscriberName}, here's today's update for ${beneficiaryName}: Mood — ${mood}. Notes: ${notes}`,
        data: { visitId: visit.id, event: 'DAILY_VISIT_SUMMARY' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Summary Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'DAILY_VISIT_SUMMARY',
        to: subscriberPhone,
        variables: { subscriberName, beneficiaryName, mood, notes }
      }).catch(err => console.error('[VisitDispatcher] Summary WhatsApp Error:', err.message));
    }

    // AWS SES Email Notification
    const subscriberEmail = visit.beneficiary?.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'DAILY_VISIT_SUMMARY_DIGEST',
        to: subscriberEmail,
        variables: {
          subscriber_name: subscriberName,
          beneficiary_name: beneficiaryName,
          mood: mood || 'Good',
          visit_notes: notes || 'Visit completed smoothly',
        }
      }).catch(err => console.error('[VisitDispatcher] Summary Email Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchDailyVisitSummary Exception:', err.message);
  }
}

/**
 * 9. Dispatch MISSED_VISIT (NT-016)
 */
async function dispatchMissedVisit({ visitId, fmUserId, fmPhone }) {
  try {
    const visit = await fetchFullVisit(visitId);
    if (!visit) return;

    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';
    
    // Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'alert',
        title: '⚠️ Visit Not Completed',
        body: `We're sorry — today's scheduled visit for ${beneficiaryName} could not be completed. Our team is following up.`,
        data: { visitId: visit.id, event: 'MISSED_VISIT' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Missed Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'MISSED_VISIT',
        to: subscriberPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[VisitDispatcher] Subscriber Missed WhatsApp Error:', err.message));
    }

    const subscriberEmail = visit.beneficiary?.subscriber?.email;
    if (subscriberEmail && subscriberEmail.includes('@')) {
      notificationService.send({
        channel: 'email',
        event: 'MISSED_VISIT',
        to: subscriberEmail,
        variables: {
          beneficiary_name: beneficiaryName,
        }
      }).catch(err => console.error('[VisitDispatcher] Missed Visit Email Error:', err.message));
    }

    // Notify Field Manager (WhatsApp only or Push if needed)
    const fmValidPhone = getValidPhone(fmPhone);
    if (fmValidPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'MISSED_VISIT',
        to: fmValidPhone,
        variables: { beneficiaryName }
      }).catch(err => console.error('[VisitDispatcher] FM Missed WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchMissedVisit Exception:', err.message);
  }
}

/**
 * 10. Dispatch CLINIC_VISIT_STARTED (NT-017)
 */
async function dispatchClinicVisitStarted({ visitId, clinicName }) {
  try {
    const visit = await fetchFullVisit(visitId);
    if (!visit) return;

    const ccName = visit.careCompanion?.name || 'Care Companion';
    const beneficiaryName = visit.beneficiary?.name || 'the beneficiary';

    // Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: '🏥 Clinic Visit Started',
        body: `${ccName} is accompanying ${beneficiaryName} to ${clinicName}. We'll update you when the visit concludes.`,
        data: { visitId: visit.id, event: 'CLINIC_VISIT_STARTED' },
      }).catch(err => console.error('[VisitDispatcher] Subscriber Clinic Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'CLINIC_VISIT_STARTED',
        to: subscriberPhone,
        variables: { ccName, beneficiaryName, clinicName }
      }).catch(err => console.error('[VisitDispatcher] Clinic WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchClinicVisitStarted Exception:', err.message);
  }
}

/**
 * 11. Dispatch RATING_FEEDBACK_PROMPT (NT-018)
 */
async function dispatchRatingFeedbackPrompt({ visitId }) {
  try {
    const visit = await fetchFullVisit(visitId);
    if (!visit) return;

    const ccName = visit.careCompanion?.name || 'Care Companion';
    
    // Notify Subscriber
    const subscriberId = visit.beneficiary?.subscriberId || visit.beneficiary?.subscriber?.id;
    if (subscriberId) {
      notifyUser(prisma, {
        userId: subscriberId,
        type: 'info',
        title: '⭐ Rate Today\'s Visit',
        body: `How was today's visit with ${ccName}? Tap to rate and share feedback.`,
        data: { visitId: visit.id, event: 'RATING_FEEDBACK_PROMPT' },
      }).catch(err => console.error('[VisitDispatcher] Rating Push Error:', err.message));
    }

    const subscriberPhone = getValidPhone(visit.beneficiary?.subscriber?.phone);
    if (subscriberPhone) {
      notificationService.send({
        channel: 'whatsapp',
        event: 'RATING_FEEDBACK_PROMPT',
        to: subscriberPhone,
        variables: { ccName }
      }).catch(err => console.error('[VisitDispatcher] Rating WhatsApp Error:', err.message));
    }
  } catch (err) {
    console.error('[VisitDispatcher] dispatchRatingFeedbackPrompt Exception:', err.message);
  }
}


module.exports = {
  dispatchVisitScheduled,
  dispatchVisitRescheduled,
  dispatchVisitCancelled,
  dispatchVisitStarted,
  dispatchVisitCompleted,
  dispatchVisitReminder,
  dispatchManualCheckinFlagged,
  dispatchDailyVisitSummary,
  dispatchMissedVisit,
  dispatchClinicVisitStarted,
  dispatchRatingFeedbackPrompt,
};
