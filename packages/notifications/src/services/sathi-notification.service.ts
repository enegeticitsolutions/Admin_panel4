import { PushChannel } from '../channels/push.channel';
import { WhatsAppChannel } from '../channels/whatsapp.channel';
import { EmailChannel } from '../channels/email.channel';
import { SmsChannel } from '../channels/sms.channel';
import { SathiTemplates, formatSathiTemplateText, SathiTemplateDefinition } from '../registry/sathi-templates.registry';
import { notificationBus, NotificationEventBus } from '../pubsub/notification-event-bus';

export interface SathiNotificationTarget {
  userId?: string;
  pushToken?: string;
  phone?: string;
  email?: string;
}

export interface SathiNotificationPayloads {
  SAATHI_LOGIN_OTP: { otpCode: string };
  SAATHI_REGISTRATION_SUBMITTED: { volunteerName: string };
  SAATHI_PROFILE_APPROVED: { volunteerName: string };
  SAATHI_PROFILE_UPDATED: { volunteerName: string };
  SAATHI_BENEFICIARY_MATCHED: { volunteerName: string; beneficiaryName: string; distanceKm: string | number };
  SAATHI_BENEFICIARY_UNMATCHED: { volunteerName: string; beneficiaryName: string };
  SAATHI_VISIT_REQUEST_RECEIVED: { beneficiaryName: string; requestId?: string };
  SAATHI_VISIT_INACTIVE_NUDGE: { volunteerName: string; beneficiaryName: string };
  SAATHI_CHECKIN_CONFIRMED: { beneficiaryName: string; checkInTime: string; visitId?: string };
  SAATHI_VISIT_CHECKED_OUT: { volunteerName: string; beneficiaryName: string; duration: string; points: string | number; visitId?: string };
  SAATHI_FEEDBACK_REMINDER: { volunteerName: string; beneficiaryName: string; visitDate: string; visitId?: string };
  SAATHI_VISIT_CONFIRMED_BY_BENEFICIARY: { beneficiaryName: string; points: string | number; visitId?: string };
  SAATHI_MONTHLY_GOAL_ACHIEVED: { volunteerName: string; hoursLogged: string | number; goalHours: string | number };
  SAATHI_MONTHLY_GOAL_AT_RISK: { volunteerName: string; hoursLogged: string | number; goalHours: string | number };
  SAATHI_VISIT_NOT_CHECKED_OUT: { volunteerName: string; beneficiaryName: string; visitDate: string; visitId?: string };
  SAATHI_CREDITS_EARNED: { points: string | number; beneficiaryName: string; totalBalance: string | number; visitId?: string };
  SAATHI_REDEMPTION_REQUESTED: { volunteerName: string; credits: string | number; giftCardBrand: string };
  SAATHI_GIFT_CARD_DELIVERED: { amount: string | number; giftCardBrand: string; recipientContact: string; code?: string };
  SAATHI_CREDIT_BALANCE_MILESTONE: { volunteerName: string; credits: string | number; estimatedValue: string | number };
  SAATHI_ADDRESS_UPDATED: { volunteerName: string; newAddress: string };
  SAATHI_AVAILABILITY_UPDATED: { volunteerName: string; availabilitySummary: string };
  SAATHI_INCOMPLETE_PROFILE_NUDGE: { volunteerName: string };
  SAATHI_GUIDE_TIP_PUBLISHED: { volunteerName: string; tipTitle: string; tipId?: string };
  SAATHI_EMERGENCY_ACKNOWLEDGED: { beneficiaryName: string; coordinatorName: string };
  SAATHI_FEEDBACK_CONCERN_FLAGGED: { volunteerName: string; beneficiaryName: string; feedbackExcerpt: string; visitId?: string };
  COORDINATOR_NEW_VOLUNTEER_REGISTERED: { volunteerName: string; zoneCity: string; volunteerId?: string };
  COORDINATOR_REDEMPTION_AWAITING_APPROVAL: { volunteerName: string; credits: string | number; estimatedValue: string | number; giftCardBrand: string; redemptionId?: string };
  COORDINATOR_VOLUNTEER_INACTIVE_30D: { volunteerName: string; volunteerId?: string };
}

export interface DispatchSathiResult {
  templateId: string;
  pushResult?: { success: boolean; ticketId?: string; error?: string };
  whatsAppResult?: { success: boolean; messageId?: string; error?: string };
  emailResult?: { success: boolean; messageId?: string; error?: string };
  title: string;
  body: string;
  data: Record<string, any>;
  success: boolean;
}

/**
 * Enterprise Sathi Notification Service
 * Formats, enriches, and dispatches push, WhatsApp, email, and in-app payloads
 * across all 28 Sathi App notification templates (ST-001 through ST-062).
 */
export class SathiNotificationService {
  private static instance: SathiNotificationService;
  private pushChannel: PushChannel;
  private whatsAppChannel: WhatsAppChannel;
  private emailChannel: EmailChannel;
  private smsChannel: SmsChannel;
  private eventBus: NotificationEventBus;

  constructor(
    pushChannel?: PushChannel,
    whatsAppChannel?: WhatsAppChannel,
    emailChannel?: EmailChannel,
    smsChannel?: SmsChannel,
    eventBus?: NotificationEventBus
  ) {
    this.pushChannel = pushChannel || new PushChannel();
    this.whatsAppChannel = whatsAppChannel || new WhatsAppChannel();
    this.emailChannel = emailChannel || new EmailChannel();
    this.smsChannel = smsChannel || new SmsChannel();
    this.eventBus = eventBus || notificationBus;
  }

  public static getInstance(): SathiNotificationService {
    if (!SathiNotificationService.instance) {
      SathiNotificationService.instance = new SathiNotificationService();
    }
    return SathiNotificationService.instance;
  }

  /**
   * Universal dispatcher for all 28 Sathi templates
   */
  public async dispatch<K extends keyof SathiNotificationPayloads>(
    eventKey: K,
    target: SathiNotificationTarget,
    variables: SathiNotificationPayloads[K],
    extraData?: Record<string, any>
  ): Promise<DispatchSathiResult> {
    const template: SathiTemplateDefinition = SathiTemplates[eventKey];
    if (!template) {
      throw new Error(`Sathi Template for event "${eventKey}" is not registered.`);
    }

    const title = template.subject;
    const body = formatSathiTemplateText(template.bodyTemplate, variables as any);
    const dataPayload = {
      templateId: template.id,
      eventKey,
      module: template.module,
      priority: template.priority,
      screen: template.targetScreen || '/(sathi)/notifications',
      ...variables,
      ...(extraData || {}),
    };

    let pushResult: any = null;
    let whatsAppResult: any = null;
    let emailResult: any = null;

    // 1. Primary Push Channel (Expo Push / FCM / APNs)
    if (target.pushToken && template.channels.includes('push')) {
      pushResult = await this.pushChannel.send({
        to: target.pushToken,
        title,
        body,
        data: dataPayload,
        priority: template.priority === 'critical' || template.priority === 'high' ? 'high' : 'normal',
        sound: 'default',
        channelId: template.module === 'Visit & Hours Logging' ? 'visits' : 'default',
      });
      console.log(`[SathiNotification] Push dispatched (${template.id}):`, pushResult.success ? '✅ OK' : `❌ ${pushResult.error}`);
    }

    // 2. WhatsApp Channel (Optional / Environment toggled)
    if (target.phone && template.channels.includes('whatsapp') && process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true') {
      const orderedVars = template.variables.map((v) => String((variables as any)[v] ?? ''));
      whatsAppResult = await this.whatsAppChannel.send({
        to: target.phone,
        templateName: template.key.toLowerCase(),
        variables: orderedVars,
      });
      console.log(`[SathiNotification] WhatsApp dispatched (${template.id}):`, whatsAppResult.success ? '✅ OK' : `❌ ${whatsAppResult.error}`);
    }

    // 3. Email Channel (Optional when email provided)
    if (target.email && template.channels.includes('email') && process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
      emailResult = await this.emailChannel.send({
        to: target.email,
        subject: title,
        html: `<p>${body}</p>`,
      });
      console.log(`[SathiNotification] Email dispatched (${template.id}):`, emailResult.success ? '✅ OK' : `❌ ${emailResult.error}`);
    }

    return {
      templateId: template.id,
      pushResult,
      whatsAppResult,
      emailResult,
      title,
      body,
      data: dataPayload,
      success: !!(pushResult?.success || whatsAppResult?.success || emailResult?.success || (!target.pushToken && !target.phone && !target.email)),
    };
  }
}

export const sathiNotificationService = SathiNotificationService.getInstance();
