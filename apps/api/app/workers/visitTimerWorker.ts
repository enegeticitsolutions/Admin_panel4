import prisma from '../core/database';
import { notificationProducer } from '@maihoonna/notifications';
import {
  DEFAULT_BASE_VISIT_MINUTES,
  DEFAULT_OVERTIME_BUFFER_MINUTES,
} from '../services/benefit/visitBillingCalculator';

let workerInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

async function getBufferMinutes(): Promise<number> {
  try {
    const cfg = await prisma.systemConfig.findUnique({
      where: { key: 'VISIT_OVERTIME_BUFFER_MINUTES' },
    });
    const parsed = cfg ? parseInt(cfg.value, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_OVERTIME_BUFFER_MINUTES;
  } catch {
    return DEFAULT_OVERTIME_BUFFER_MINUTES;
  }
}

async function dispatchVisitTimerPush(params: {
  visitId: string;
  milestone: '15m' | '5m' | 'complete' | 'overtime';
  event: string;
  title: string;
  body: string;
  recipients: Array<{ userId: string; fcmToken?: string | null; role: string }>;
}) {
  const { visitId, milestone, event, title, body, recipients } = params;

  for (const r of recipients) {
    if (!r.fcmToken) continue;
    try {
      await notificationProducer.publish({
        idempotencyKey: `visit-timer-${visitId}-${milestone}-${r.role}`,
        channel: 'push',
        event,
        recipient: { pushToken: r.fcmToken, userId: r.userId },
        variables: {
          title,
          body,
          visitId,
          milestone,
        },
      });
    } catch (err) {
      console.error(`[VisitTimerWorker] Failed publishing ${milestone} push to ${r.role} (${r.userId}):`, err);
    }
  }
}

export async function checkAndDispatchVisitTimers() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const bufferMinutes = await getBufferMinutes();

    const activeVisits = await prisma.visit.findMany({
      where: {
        status: 'in_progress',
        checkInTime: { not: null },
        OR: [
          { reminder15mSentAt: null },
          { reminder5mSentAt: null },
          { timeCompleteSentAt: null },
          { overtimeStartedSentAt: null },
        ],
      },
      include: {
        beneficiary: {
          include: {
            user: { select: { id: true, name: true, fcmToken: true } },
            subscriber: { select: { id: true, name: true, fcmToken: true } },
          },
        },
        careCompanion: {
          include: {
            user: { select: { id: true, name: true, fcmToken: true } },
          },
        },
      },
      take: 100,
    });

    for (const visit of activeVisits) {
      if (!visit.checkInTime) continue;

      const scheduledMinutes = Math.max(
        DEFAULT_BASE_VISIT_MINUTES,
        visit.durationMinutes || DEFAULT_BASE_VISIT_MINUTES
      );
      const elapsedMinutes = Math.floor(
        (now.getTime() - visit.checkInTime.getTime()) / 60000
      );
      const remainingMinutes = scheduledMinutes - elapsedMinutes;

      const beneficiaryName = visit.beneficiary?.name || 'Beneficiary';
      const ccName = visit.careCompanion?.name || visit.careCompanion?.user?.name || 'Care Mitra';

      const recipients: Array<{ userId: string; fcmToken?: string | null; role: string }> = [];
      if (visit.careCompanion?.user?.id) {
        recipients.push({
          userId: visit.careCompanion.user.id,
          fcmToken: visit.careCompanion.user.fcmToken,
          role: 'cc',
        });
      }
      if (visit.beneficiary?.user?.id) {
        recipients.push({
          userId: visit.beneficiary.user.id,
          fcmToken: visit.beneficiary.user.fcmToken,
          role: 'beneficiary',
        });
      }
      if (
        visit.beneficiary?.subscriber?.id &&
        visit.beneficiary.subscriber.id !== visit.beneficiary?.user?.id
      ) {
        recipients.push({
          userId: visit.beneficiary.subscriber.id,
          fcmToken: visit.beneficiary.subscriber.fcmToken,
          role: 'subscriber',
        });
      }

      const updateData: Record<string, Date> = {};

      // 1. 15 minutes before scheduled end (e.g. 45 min of 60 min visit)
      if (!visit.reminder15mSentAt && remainingMinutes <= 15 && remainingMinutes > 5) {
        await dispatchVisitTimerPush({
          visitId: visit.id,
          milestone: '15m',
          event: 'VISIT_ENDING_15M',
          title: '15 Minutes Left in Visit',
          body: `15 minutes remaining in the scheduled visit with ${beneficiaryName} (${ccName}).`,
          recipients,
        });
        updateData.reminder15mSentAt = now;
      }

      // 2. 5 minutes before scheduled end (e.g. 55 min of 60 min visit)
      if (!visit.reminder5mSentAt && remainingMinutes <= 5 && remainingMinutes > 0) {
        await dispatchVisitTimerPush({
          visitId: visit.id,
          milestone: '5m',
          event: 'VISIT_ENDING_5M',
          title: '5 Minutes Left in Visit',
          body: `5 minutes remaining in your scheduled visit with ${beneficiaryName}. Please wrap up.`,
          recipients,
        });
        updateData.reminder5mSentAt = now;
      }

      // 3. Scheduled duration completed (0m left -> grace buffer starts)
      if (!visit.timeCompleteSentAt && elapsedMinutes >= scheduledMinutes) {
        const hrs = Math.round((scheduledMinutes / 60) * 10) / 10;
        const durationLabel = hrs === 1 ? '1-hour' : `${hrs}-hour`;
        await dispatchVisitTimerPush({
          visitId: visit.id,
          milestone: 'complete',
          event: 'VISIT_TIME_COMPLETE',
          title: 'Scheduled Visit Time Complete',
          body: `Your ${durationLabel} visit is complete. You have a ${bufferMinutes}-minute buffer to close the visit.`,
          recipients,
        });
        updateData.timeCompleteSentAt = now;
      }

      // 4. Buffer expired -> overtime started
      if (
        !visit.overtimeStartedSentAt &&
        elapsedMinutes > scheduledMinutes + bufferMinutes
      ) {
        await dispatchVisitTimerPush({
          visitId: visit.id,
          milestone: 'overtime',
          event: 'VISIT_OVERTIME_STARTED',
          title: 'Overtime Started',
          body: `${bufferMinutes}-minute buffer has ended for ${beneficiaryName}'s visit. Overtime is now being deducted from the package.`,
          recipients,
        });
        updateData.overtimeStartedSentAt = now;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.visit.update({
          where: { id: visit.id },
          data: updateData,
        });
      }
    }
  } catch (err) {
    console.error('❌ [VisitTimerWorker] Error executing visit timer cycle:', err);
  } finally {
    isProcessing = false;
  }
}

export function startVisitTimerWorker() {
  if (workerInterval) {
    console.log('[VisitTimerWorker] Worker already running.');
    return;
  }

  console.log('⏱️ [VisitTimerWorker] Background visit timer & overtime worker started.');
  checkAndDispatchVisitTimers().catch((err) => {
    console.error('❌ [VisitTimerWorker] Initial execution error:', err);
  });

  workerInterval = setInterval(() => {
    checkAndDispatchVisitTimers().catch((err) => {
      console.error('❌ [VisitTimerWorker] Scheduled execution error:', err);
    });
  }, 60 * 1000);
}

export function stopVisitTimerWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[VisitTimerWorker] Worker stopped.');
  }
}
