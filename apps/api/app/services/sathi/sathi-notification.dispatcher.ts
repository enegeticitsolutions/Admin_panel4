import prisma from '../../core/database';
import { NotificationType, NotificationChannel } from '@prisma/client';
import {
  SathiTemplates,
  SathiTemplateDefinition,
  formatSathiTemplateText,
  SathiNotificationPayloads,
  notificationProducer,
} from '@maihoonna/notifications';
import { PushNotificationDispatcher } from '../notifications/PushNotificationDispatcher';

export interface SathiDispatcherTarget {
  volunteerId?: string;
  userId?: string;
  phone?: string;
  email?: string;
}

/**
 * Ensures a matching User record exists for a Volunteer ID so foreign key
 * constraints in notifications table (userId -> User.id) are always satisfied.
 */
export async function ensureVolunteerShadowUser(volunteerId: string) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: volunteerId },
    });

    if (existingUser) {
      return existingUser;
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { id: volunteerId },
    });

    if (!volunteer) {
      return null;
    }

    // Check if a user with this phone exists under a different ID
    const userByPhone = await prisma.user.findUnique({
      where: { phone: volunteer.phone },
    });

    if (userByPhone) {
      // Sync FCM token if needed
      if (volunteer.fcmToken && userByPhone.fcmToken !== volunteer.fcmToken) {
        await prisma.user.update({
          where: { id: userByPhone.id },
          data: { fcmToken: volunteer.fcmToken },
        });
      }
      return userByPhone;
    }

    // Create shadow user with the volunteer's ID
    const newUser = await prisma.user.create({
      data: {
        id: volunteer.id,
        phone: volunteer.phone,
        name: volunteer.name,
        role: 'volunteer',
        fcmToken: volunteer.fcmToken,
        isActive: volunteer.isActive,
      },
    });

    return newUser;
  } catch (err: any) {
    console.warn(`[SathiDispatcher] ensureVolunteerShadowUser warning (${volunteerId}):`, err.message);
    return null;
  }
}

/**
 * Core internal dispatcher function:
 * 1. Formats template
 * 2. Persists DB Notification record
 * 3. Sends Expo Push notification to physical/virtual device via FCM
 */
export async function dispatchSathiNotification<K extends keyof SathiNotificationPayloads>(
  eventKey: K,
  target: SathiDispatcherTarget,
  variables: SathiNotificationPayloads[K],
  extraData: Record<string, any> = {}
) {
  const template: SathiTemplateDefinition = SathiTemplates[eventKey];
  if (!template) {
    console.error(`[SathiDispatcher] Unknown template event: ${eventKey}`);
    return { success: false, error: `Unknown template event: ${eventKey}` };
  }

  const title = template.subject;
  const body = formatSathiTemplateText(template.bodyTemplate, variables as any);
  const targetScreen = template.targetScreen || '/(sathi)/notifications';

  let recipientUserId: string | null = null;
  let pushToken: string | null = null;

  // 1. Resolve Recipient User ID and Device Token
  if (target.volunteerId) {
    const user = await ensureVolunteerShadowUser(target.volunteerId);
    if (user) {
      recipientUserId = user.id;
      pushToken = user.fcmToken;
    } else {
      const vol = await prisma.volunteer.findUnique({
        where: { id: target.volunteerId },
        select: { fcmToken: true },
      });
      pushToken = vol?.fcmToken || null;
    }
  } else if (target.userId) {
    recipientUserId = target.userId;
    const user = await prisma.user.findUnique({
      where: { id: target.userId },
      select: { fcmToken: true },
    });
    pushToken = user?.fcmToken || null;
  }

  const dataPayload = {
    templateId: template.id,
    eventKey,
    screen: targetScreen,
    ...variables,
    ...extraData,
  };

  try {
    // Map Prisma NotificationType enum
    let notifType: NotificationType = NotificationType.system;
    if (eventKey === 'SAATHI_EMERGENCY_ACKNOWLEDGED' || eventKey === 'SAATHI_FEEDBACK_CONCERN_FLAGGED') {
      notifType = NotificationType.emergency_alert;
    } else if (
      eventKey === 'SAATHI_FEEDBACK_REMINDER' ||
      eventKey === 'SAATHI_VISIT_NOT_CHECKED_OUT' ||
      eventKey === 'SAATHI_VISIT_INACTIVE_NUDGE'
    ) {
      notifType = NotificationType.visit_reminder;
    } else if (eventKey === 'SAATHI_CHECKIN_CONFIRMED' || eventKey === 'SAATHI_VISIT_CONFIRMED_BY_BENEFICIARY') {
      notifType = NotificationType.appointment_confirmed;
    }

    // 2. Persist In-App Notification if User ID exists
    let notifRecord: any = null;
    if (recipientUserId) {
      notifRecord = await prisma.notification.create({
        data: {
          userId: recipientUserId,
          title,
          body,
          type: notifType,
          channel: NotificationChannel.push,
          data: dataPayload,
        },
      });
    }

    // 3. Dispatch Remote Push Notification (Redis Streams microservice queue with non-blocking fallback)
    if (pushToken && pushToken.trim()) {
      setImmediate(async () => {
        try {
          // A. Publish to Redis Streams in < 2ms (Microservice decoupled architecture)
          const publishResult = await notificationProducer.publish({
            idempotencyKey: `notif:${template.id}:${recipientUserId || pushToken}:${Date.now()}`,
            channel: 'push',
            event: eventKey,
            recipient: {
              pushToken: pushToken.trim(),
              userId: recipientUserId || undefined,
            },
            variables: {
              title,
              body,
              ...dataPayload,
            },
            metadata: {
              screen: targetScreen,
              priority: template.priority === 'critical' || template.priority === 'high' ? 'high' : 'normal',
              channelId: template.module === 'Visit & Hours Logging' ? 'visits' : 'default',
            },
          });

          // B. If Redis is not active (local dev or Redis worker offline), execute in-process push fallback
          if (!publishResult.streamId) {
            const dispatcher = PushNotificationDispatcher.getInstance();
            if (recipientUserId) {
              await dispatcher.send({
                userId: recipientUserId,
                title,
                body,
                type: notifType,
                data: dataPayload,
                priority: template.priority === 'critical' || template.priority === 'high' ? 'high' : 'normal',
                channelId: template.module === 'Visit & Hours Logging' ? 'visits' : 'default',
              });
            }
          }
        } catch (pushErr: any) {
          console.warn(`[SathiDispatcher] Push background delivery warning (${template.id}):`, pushErr.message);
        }
      });
    }

    console.log(`📱 [SathiDispatcher] Dispatched ${template.id} (${eventKey}) to recipient ${recipientUserId || 'unknown'}`);
    return {
      success: true,
      templateId: template.id,
      notificationId: notifRecord?.id,
      title,
      body,
    };
  } catch (err: any) {
    console.error(`❌ [SathiDispatcher] Failed to dispatch ${template.id}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Semantic Helper Dispatchers for all 28 Sathi Templates ──────────────────

/** ST-001: OTP for login / signup */
export async function dispatchSaathiOtp(volunteerPhone: string, otpCode: string, volunteerId?: string) {
  return dispatchSathiNotification(
    'SAATHI_LOGIN_OTP',
    { volunteerId, phone: volunteerPhone },
    { otpCode }
  );
}

/** ST-002: Saathi registration submitted */
export async function dispatchSaathiRegistrationSubmitted(volunteerId: string, volunteerName: string) {
  return dispatchSathiNotification(
    'SAATHI_REGISTRATION_SUBMITTED',
    { volunteerId },
    { volunteerName }
  );
}

/** ST-003: Saathi profile approved & activated */
export async function dispatchSaathiProfileApproved(volunteerId: string, volunteerName: string) {
  return dispatchSathiNotification(
    'SAATHI_PROFILE_APPROVED',
    { volunteerId },
    { volunteerName }
  );
}

/** ST-005: Profile edited & saved */
export async function dispatchSaathiProfileUpdated(volunteerId: string, volunteerName: string) {
  return dispatchSathiNotification(
    'SAATHI_PROFILE_UPDATED',
    { volunteerId },
    { volunteerName }
  );
}

/** ST-010: New beneficiary match assigned */
export async function dispatchSaathiBeneficiaryMatched(
  volunteerId: string,
  data: { volunteerName: string; beneficiaryName: string; distanceKm: string | number }
) {
  return dispatchSathiNotification('SAATHI_BENEFICIARY_MATCHED', { volunteerId }, data);
}

/** ST-011: Beneficiary reassigned / match removed */
export async function dispatchSaathiBeneficiaryUnmatched(
  volunteerId: string,
  data: { volunteerName: string; beneficiaryName: string }
) {
  return dispatchSathiNotification('SAATHI_BENEFICIARY_UNMATCHED', { volunteerId }, data);
}

/** ST-012: Visit request received */
export async function dispatchSaathiVisitRequestReceived(
  volunteerId: string,
  data: { beneficiaryName: string; requestId?: string }
) {
  return dispatchSathiNotification('SAATHI_VISIT_REQUEST_RECEIVED', { volunteerId }, data);
}

/** ST-013: No visits logged in 14 days — nudge */
export async function dispatchSaathiVisitInactiveNudge(
  volunteerId: string,
  data: { volunteerName: string; beneficiaryName: string }
) {
  return dispatchSathiNotification('SAATHI_VISIT_INACTIVE_NUDGE', { volunteerId }, data);
}

/** ST-020: Check-in confirmed */
export async function dispatchSaathiCheckInConfirmed(
  volunteerId: string,
  data: { beneficiaryName: string; checkInTime: string; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_CHECKIN_CONFIRMED', { volunteerId }, data);
}

/** ST-021: Visit completed / checked out */
export async function dispatchSaathiVisitCheckedOut(
  volunteerId: string,
  data: { volunteerName: string; beneficiaryName: string; duration: string; points: string | number; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_VISIT_CHECKED_OUT', { volunteerId }, data);
}

/** ST-022: Feedback not yet submitted — reminder */
export async function dispatchSaathiFeedbackReminder(
  volunteerId: string,
  data: { volunteerName: string; beneficiaryName: string; visitDate: string; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_FEEDBACK_REMINDER', { volunteerId }, data);
}

/** ST-023: Beneficiary confirmed visit completion */
export async function dispatchSaathiVisitConfirmedByBeneficiary(
  volunteerId: string,
  data: { beneficiaryName: string; points: string | number; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_VISIT_CONFIRMED_BY_BENEFICIARY', { volunteerId }, data);
}

/** ST-024: Monthly goal achieved (100%) */
export async function dispatchSaathiMonthlyGoalAchieved(
  volunteerId: string,
  data: { volunteerName: string; hoursLogged: string | number; goalHours: string | number }
) {
  return dispatchSathiNotification('SAATHI_MONTHLY_GOAL_ACHIEVED', { volunteerId }, data);
}

/** ST-025: Monthly goal at-risk — mid-month reminder */
export async function dispatchSaathiMonthlyGoalAtRisk(
  volunteerId: string,
  data: { volunteerName: string; hoursLogged: string | number; goalHours: string | number }
) {
  return dispatchSathiNotification('SAATHI_MONTHLY_GOAL_AT_RISK', { volunteerId }, data);
}

/** ST-026: Visit checked in but never checked out */
export async function dispatchSaathiVisitNotCheckedOut(
  volunteerId: string,
  data: { volunteerName: string; beneficiaryName: string; visitDate: string; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_VISIT_NOT_CHECKED_OUT', { volunteerId }, data);
}

/** ST-030: Credits earned after a visit */
export async function dispatchSaathiCreditsEarned(
  volunteerId: string,
  data: { points: string | number; beneficiaryName: string; totalBalance: string | number; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_CREDITS_EARNED', { volunteerId }, data);
}

/** ST-031: Redemption request submitted */
export async function dispatchSaathiRedemptionRequested(
  volunteerId: string,
  data: { volunteerName: string; credits: string | number; giftCardBrand: string }
) {
  return dispatchSathiNotification('SAATHI_REDEMPTION_REQUESTED', { volunteerId }, data);
}

/** ST-032: Gift card issued & delivered */
export async function dispatchSaathiGiftCardDelivered(
  volunteerId: string,
  data: { amount: string | number; giftCardBrand: string; recipientContact: string; code?: string }
) {
  return dispatchSathiNotification('SAATHI_GIFT_CARD_DELIVERED', { volunteerId }, data);
}

/** ST-033: Credit balance milestone / low-balance nudge */
export async function dispatchSaathiCreditBalanceMilestone(
  volunteerId: string,
  data: { volunteerName: string; credits: string | number; estimatedValue: string | number }
) {
  return dispatchSathiNotification('SAATHI_CREDIT_BALANCE_MILESTONE', { volunteerId }, data);
}

/** ST-040: Address updated */
export async function dispatchSaathiAddressUpdated(
  volunteerId: string,
  data: { volunteerName: string; newAddress: string }
) {
  return dispatchSathiNotification('SAATHI_ADDRESS_UPDATED', { volunteerId }, data);
}

/** ST-041: Availability schedule updated */
export async function dispatchSaathiAvailabilityUpdated(
  volunteerId: string,
  data: { volunteerName: string; availabilitySummary: string }
) {
  return dispatchSathiNotification('SAATHI_AVAILABILITY_UPDATED', { volunteerId }, data);
}

/** ST-042: Incomplete profile nudge */
export async function dispatchSaathiIncompleteProfileNudge(
  volunteerId: string,
  data: { volunteerName: string }
) {
  return dispatchSathiNotification('SAATHI_INCOMPLETE_PROFILE_NUDGE', { volunteerId }, data);
}

/** ST-050: New guide tip / best practice published */
export async function dispatchSaathiGuideTipPublished(
  volunteerId: string,
  data: { volunteerName: string; tipTitle: string; tipId?: string }
) {
  return dispatchSathiNotification('SAATHI_GUIDE_TIP_PUBLISHED', { volunteerId }, data);
}

/** ST-051: Emergency support alert acknowledged */
export async function dispatchSaathiEmergencyAcknowledged(
  volunteerId: string,
  data: { beneficiaryName: string; coordinatorName: string }
) {
  return dispatchSathiNotification('SAATHI_EMERGENCY_ACKNOWLEDGED', { volunteerId }, data);
}

/** ST-052: Visit feedback flags a concern */
export async function dispatchSaathiFeedbackConcernFlagged(
  coordinatorUserId: string,
  data: { volunteerName: string; beneficiaryName: string; feedbackExcerpt: string; visitId?: string }
) {
  return dispatchSathiNotification('SAATHI_FEEDBACK_CONCERN_FLAGGED', { userId: coordinatorUserId }, data);
}

/** ST-060: New Saathi volunteer registered */
export async function dispatchCoordinatorNewVolunteerRegistered(
  coordinatorUserId: string,
  data: { volunteerName: string; zoneCity: string; volunteerId?: string }
) {
  return dispatchSathiNotification('COORDINATOR_NEW_VOLUNTEER_REGISTERED', { userId: coordinatorUserId }, data);
}

/** ST-061: Gift card redemption needs approval */
export async function dispatchCoordinatorRedemptionAwaitingApproval(
  coordinatorUserId: string,
  data: { volunteerName: string; credits: string | number; estimatedValue: string | number; giftCardBrand: string; redemptionId?: string }
) {
  return dispatchSathiNotification('COORDINATOR_REDEMPTION_AWAITING_APPROVAL', { userId: coordinatorUserId }, data);
}

/** ST-062: Volunteer inactive 30+ days */
export async function dispatchCoordinatorVolunteerInactiveAlert(
  coordinatorUserId: string,
  data: { volunteerName: string; volunteerId?: string }
) {
  return dispatchSathiNotification('COORDINATOR_VOLUNTEER_INACTIVE_30D', { userId: coordinatorUserId }, data);
}
