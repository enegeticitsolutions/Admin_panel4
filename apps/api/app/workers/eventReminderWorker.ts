import prisma from '../core/database';
import { notificationProducer } from '@maihoonna/notifications';

/**
 * Event Reminder Worker
 * 
 * Periodically checks for upcoming community events and dispatches reminders to registered attendees:
 *  1. 24 Hours Before Start: "Reminder: Tomorrow's Session - {title}"
 *  2. 1 Hour Before Start:   "Starting in 1 Hour: {title}"
 *  3. At Event Start:        "Event Starting Now: {title}"
 */

let workerInterval: any = null;
let isProcessing = false;

export async function checkAndDispatchEventReminders() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();

    // ── 1. 24-HOUR REMINDERS (Window: 23h to 25h ahead) ──
    const h24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const h24End = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const due24h = await prisma.eventRegistration.findMany({
      where: {
        status: 'confirmed',
        reminder24hSentAt: null,
        event: {
          status: 'published',
          startDateTime: { gte: h24Start, lte: h24End },
        },
      },
      include: {
        event: true,
        user: { select: { id: true, name: true, phone: true, fcmToken: true } },
      },
      take: 50,
    });

    for (const reg of due24h) {
      try {
        const timeStr = reg.event.startDateTime.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Push notification
        if (reg.user.fcmToken) {
          await notificationProducer.publish({
            idempotencyKey: `ev-rem-24h-${reg.id}`,
            channel: 'push',
            event: 'COMMUNITY_EVENT_REMINDER_24H',
            recipient: { pushToken: reg.user.fcmToken, userId: reg.user.id },
            variables: {
              title: `Event Tomorrow: ${reg.event.title}`,
              body: `Your registered session begins tomorrow at ${timeStr}. We look forward to seeing you!`,
              eventId: reg.eventId,
            },
          });
        }

        // WhatsApp notification (if phone available)
        if (reg.user.phone) {
          await notificationProducer.publish({
            idempotencyKey: `ev-rem-24h-wa-${reg.id}`,
            channel: 'whatsapp',
            event: 'COMMUNITY_EVENT_REMINDER_24H',
            recipient: { phone: reg.user.phone },
            variables: {
              eventTitle: reg.event.title,
              time: timeStr,
              meetingUrl: reg.event.meetingUrl || 'In MaiHoonNa App',
            },
          });
        }

        await prisma.eventRegistration.update({
          where: { id: reg.id },
          data: { reminder24hSentAt: new Date() },
        });
      } catch (err) {
        console.warn(`[EventReminder] Failed to send 24h reminder for reg ${reg.id}:`, err);
      }
    }

    // ── 2. 1-HOUR REMINDERS (Window: 50m to 70m ahead) ──
    const m50 = new Date(now.getTime() + 50 * 60 * 1000);
    const m70 = new Date(now.getTime() + 70 * 60 * 1000);

    const due1h = await prisma.eventRegistration.findMany({
      where: {
        status: 'confirmed',
        reminder1hSentAt: null,
        event: {
          status: 'published',
          startDateTime: { gte: m50, lte: m70 },
        },
      },
      include: {
        event: true,
        user: { select: { id: true, name: true, phone: true, fcmToken: true } },
      },
      take: 50,
    });

    for (const reg of due1h) {
      try {
        if (reg.user.fcmToken) {
          await notificationProducer.publish({
            idempotencyKey: `ev-rem-1h-${reg.id}`,
            channel: 'push',
            event: 'COMMUNITY_EVENT_REMINDER_1H',
            recipient: { pushToken: reg.user.fcmToken, userId: reg.user.id },
            variables: {
              title: `Starting in 1 Hour: ${reg.event.title}`,
              body: `Your community session starts in 60 minutes. Tap to check details and join!`,
              eventId: reg.eventId,
            },
          });
        }

        if (reg.user.phone) {
          await notificationProducer.publish({
            idempotencyKey: `ev-rem-1h-wa-${reg.id}`,
            channel: 'whatsapp',
            event: 'COMMUNITY_EVENT_REMINDER_1H',
            recipient: { phone: reg.user.phone },
            variables: {
              eventTitle: reg.event.title,
              meetingUrl: reg.event.meetingUrl || 'In MaiHoonNa App',
            },
          });
        }

        await prisma.eventRegistration.update({
          where: { id: reg.id },
          data: { reminder1hSentAt: new Date() },
        });
      } catch (err) {
        console.warn(`[EventReminder] Failed to send 1h reminder for reg ${reg.id}:`, err);
      }
    }

    // ── 3. STARTING NOW REMINDERS (Event starting within last 15 mins or right now) ──
    const past15m = new Date(now.getTime() - 15 * 60 * 1000);

    const dueStart = await prisma.eventRegistration.findMany({
      where: {
        status: 'confirmed',
        reminderStartSentAt: null,
        event: {
          status: 'published',
          startDateTime: { lte: now, gte: past15m },
          endDateTime: { gt: now },
        },
      },
      include: {
        event: true,
        user: { select: { id: true, name: true, phone: true, fcmToken: true } },
      },
      take: 50,
    });

    for (const reg of dueStart) {
      try {
        if (reg.user.fcmToken) {
          await notificationProducer.publish({
            idempotencyKey: `ev-rem-start-${reg.id}`,
            channel: 'push',
            event: 'COMMUNITY_EVENT_STARTED',
            recipient: { pushToken: reg.user.fcmToken, userId: reg.user.id },
            variables: {
              title: `Happening Now: ${reg.event.title}`,
              body: `The session has just started! Tap here to join now.`,
              eventId: reg.eventId,
            },
          });
        }

        if (reg.user.phone) {
          await notificationProducer.publish({
            idempotencyKey: `ev-rem-start-wa-${reg.id}`,
            channel: 'whatsapp',
            event: 'COMMUNITY_EVENT_STARTED',
            recipient: { phone: reg.user.phone },
            variables: {
              eventTitle: reg.event.title,
              meetingUrl: reg.event.meetingUrl || 'In MaiHoonNa App',
            },
          });
        }

        await prisma.eventRegistration.update({
          where: { id: reg.id },
          data: { reminderStartSentAt: new Date() },
        });
      } catch (err) {
        console.warn(`[EventReminder] Failed to send start reminder for reg ${reg.id}:`, err);
      }
    }
  } catch (err) {
    console.error('❌ [EventReminderWorker] Error executing reminder cycle:', err);
  } finally {
    isProcessing = false;
  }
}

export function startEventReminderWorker() {
  if (workerInterval) {
    console.log('[EventReminderWorker] Worker already running.');
    return;
  }

  console.log('⏰ [EventReminderWorker] Background community event reminder worker started.');

  // Initial check
  checkAndDispatchEventReminders().catch((err) => {
    console.error('❌ [EventReminderWorker] Initial execution error:', err);
  });

  // Run every 60 seconds
  workerInterval = setInterval(async () => {
    try {
      await checkAndDispatchEventReminders();
    } catch (err) {
      console.error('❌ [EventReminderWorker] Scheduled execution error:', err);
    }
  }, 60 * 1000);
}

export function stopEventReminderWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[EventReminderWorker] Worker stopped.');
  }
}
