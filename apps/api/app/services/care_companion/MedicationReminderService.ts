import prisma from '../../core/database';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { PushNotificationDispatcher } from '../notifications/PushNotificationDispatcher';

export interface NormalizedSlot {
  slotText: string;
  timeDate: Date;
  hours: number;
  minutes: number;
}

/**
 * Object-Oriented Medication Reminder Service
 * 
 * Manages daily medication schedule analysis, recipient resolution,
 * on-time dose evaluation, and multi-channel push notification dispatching.
 */
export class MedicationReminderService {
  private static instance: MedicationReminderService;
  private dispatcher: PushNotificationDispatcher;

  private constructor() {
    this.dispatcher = PushNotificationDispatcher.getInstance();
  }

  public static getInstance(): MedicationReminderService {
    if (!MedicationReminderService.instance) {
      MedicationReminderService.instance = new MedicationReminderService();
    }
    return MedicationReminderService.instance;
  }

  /**
   * Main cron/worker execution loop.
   * Inspects all active medication schedules and dispatches push notifications
   * for matching time slots right on time.
   */
  public async checkAndDispatchReminders(): Promise<number> {
    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // 1. Query active medications covering today with reminders enabled
      const activeMedications = await prisma.medication.findMany({
        where: {
          isActive: true,
          setReminders: true,
          startDate: { lte: todayEnd },
          OR: [
            { endDate: null },
            { endDate: { gte: todayStart } },
          ],
        },

        include: {
          beneficiary: {
            select: {
              id: true,
              userId: true,
              subscriberId: true,
              user: {
                select: { id: true, name: true, phone: true, fcmToken: true },
              },
              subscriber: {
                select: {
                  id: true,
                  phone: true,
                  name: true,
                  fcmToken: true,
                },
              },
            },
          },
        },
      });

      if (activeMedications.length === 0) {
        return 0;
      }

      let dispatchCount = 0;

      for (const med of activeMedications) {
        const beneficiary = med.beneficiary;
        if (!beneficiary) continue;

        // Resolve recipients: Beneficiary user + Managing subscriber user
        const recipientUserIds = this.resolveRecipientUserIds(beneficiary);
        if (recipientUserIds.length === 0) continue;

        // Parse and normalize time slots for this medication
        const slots = this.normalizeTimeSlots(med.timeSlots || [], med.frequency, now);

        for (const slot of slots) {
          // Compare current hour and minute
          const isExactMatch = currentHours === slot.hours && currentMinutes === slot.minutes;

          if (isExactMatch) {
            for (const userId of recipientUserIds) {
              const alreadyDispatched = await this.hasDispatchedToday(
                userId,
                med.id,
                slot.slotText,
                todayStart,
                todayEnd
              );

              if (!alreadyDispatched) {
                const title = `💊 Medication Reminder: ${med.name}`;
                const body = `Time to take ${med.dosage ? `${med.dosage} of ` : ''}${med.name} (${slot.slotText}). ${
                  med.instructions ? `${med.instructions}` : ''
                }`.trim();

                const sendResult = await this.dispatcher.send({
                  userId,
                  title,
                  body,
                  type: NotificationType.medication_reminder,
                  channel: NotificationChannel.push,
                  data: {
                    medicationId: med.id,
                    medicationName: med.name,
                    dosage: med.dosage,
                    timeSlot: slot.slotText,
                    scheduledTimeIso: slot.timeDate.toISOString(),
                    beneficiaryId: beneficiary.id,
                  },
                });

                if (sendResult.success) {
                  dispatchCount++;
                  console.log(
                    `⏰ [MedicationReminderService] Dispatched push for "${med.name}" (${slot.slotText}) to user ${userId}`
                  );
                }
              }
            }
          }
        }
      }

      return dispatchCount;
    } catch (error: any) {
      if (
        error?.code === 'P2039' ||
        error?.message?.includes('57P01') ||
        error?.message?.includes('terminating connection')
      ) {
        console.warn('⚠️ [MedicationReminderService] DB connection reset detected. Reconnecting on next tick.');
        return 0;
      }
      console.error('❌ [MedicationReminderService] Error during checkAndDispatchReminders:', error);
      return 0;
    }
  }

  /**
   * Resolves target user IDs for a beneficiary.
   * Direct beneficiary account and/or subscriber guardian account.
   */
  private resolveRecipientUserIds(beneficiary: any): string[] {
    const ids = new Set<string>();

    if (beneficiary.userId) {
      ids.add(beneficiary.userId);
    }
    if (beneficiary.user?.id) {
      ids.add(beneficiary.user.id);
    }

    // If beneficiary does not have an independent user account, notify subscriber
    if (ids.size === 0 && beneficiary.subscriberId) {
      ids.add(beneficiary.subscriberId);
    }

    return Array.from(ids);
  }

  /**
   * Checks if this notification was already dispatched today for this user + medication + slot
   */
  private async hasDispatchedToday(
    userId: string,
    medicationId: string,
    slotText: string,
    todayStart: Date,
    todayEnd: Date
  ): Promise<boolean> {
    const existing = await prisma.notification.findMany({
      where: {
        userId,
        type: NotificationType.medication_reminder,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { data: true },
    });

    return existing.some((n: any) => {
      const dataObj = n.data as any;
      return (
        dataObj &&
        dataObj.medicationId === medicationId &&
        dataObj.timeSlot === slotText
      );
    });
  }

  /**
   * Normalizes raw slot strings into structured NormalizedSlot objects.
   */
  public normalizeTimeSlots(rawSlots: string[], frequency: string, referenceDate: Date): NormalizedSlot[] {
    let slots = [...rawSlots];

    if (slots.length === 0) {
      if (frequency === 'once_daily') slots = ['08:00 AM'];
      else if (frequency === 'twice_daily') slots = ['08:00 AM', '08:00 PM'];
      else if (frequency === 'thrice_daily') slots = ['08:00 AM', '02:00 PM', '08:00 PM'];
      else slots = ['08:00 AM'];
    }

    return slots.map((slot) => {
      const parsedDate = this.parseTimeSlotToDate(slot, referenceDate);
      return {
        slotText: slot,
        timeDate: parsedDate,
        hours: parsedDate.getHours(),
        minutes: parsedDate.getMinutes(),
      };
    });
  }

  /**
   * Converts slot strings (e.g. "morning", "08:00 AM", "2:00 PM") to exact Date objects
   */
  private parseTimeSlotToDate(slot: string, referenceDate: Date): Date {
    const date = new Date(referenceDate);
    let hours = 8;
    let minutes = 0;

    const cleaned = slot.trim().toUpperCase();

    if (cleaned === 'MORNING') {
      hours = 8;
      minutes = 0;
    } else if (cleaned === 'AFTERNOON') {
      hours = 14;
      minutes = 0;
    } else if (cleaned === 'EVENING') {
      hours = 18;
      minutes = 0;
    } else if (cleaned === 'NIGHT') {
      hours = 21;
      minutes = 30;
    } else {
      const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const meridiem = match[3]?.toUpperCase();

        if (meridiem === 'PM' && h < 12) h += 12;
        if (meridiem === 'AM' && h === 12) h = 0;

        hours = h;
        minutes = m;
      }
    }

    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}
