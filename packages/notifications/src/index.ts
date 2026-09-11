import { SmsChannel } from './channels/sms.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { PushChannel } from './channels/push.channel';
import { SmsMessage } from './interfaces/ISmsProvider';
import { WhatsAppMessage } from './interfaces/IWhatsAppProvider';
import { PushNotificationMessage } from './interfaces/IPushProvider';

import { EmailChannel } from './channels/email.channel';
import { EmailMessage } from './interfaces/IEmailProvider';

export * from './interfaces/ISmsProvider';
export * from './interfaces/IWhatsAppProvider';
export * from './interfaces/IPushProvider';
export * from './interfaces/IEmailProvider';
export * from './providers/provider.factory';
export * from './providers/push/expo-fcm.provider';
export * from './providers/email/AwsSesEmailProvider';
export * from './channels/sms.channel';
export * from './channels/whatsapp.channel';
export * from './channels/push.channel';
export * from './channels/email.channel';
export * from './services/notification.service';
export * from './services/care-mitra-notification.service';
export * from './services/sathi-notification.service';
export * from './registry/whatsapp.registry';
export * from './registry/care-mitra-templates.registry';
export * from './registry/sathi-templates.registry';
export * from './pubsub/notification-event-bus';

// Redis Streams Microservice Exports
export * from './redis/redis.types';
export * from './redis/redis.connection';
export * from './redis/notification.producer';
export * from './redis/notification.consumer';

const smsChannel = new SmsChannel();
const whatsAppChannel = new WhatsAppChannel();
const pushChannel = new PushChannel();
const emailChannel = new EmailChannel();

export async function sendSMS(message: SmsMessage) {
  return smsChannel.send(message);
}

export async function sendOTP(to: string, otp: string, templateId?: string) {
  return smsChannel.send({
    to,
    body: `Your MaiHoonNa verification code is: ${otp}. Do not share this OTP with anyone.`,
    templateId,
  });
}

export async function sendWhatsApp(message: WhatsAppMessage) {
  return whatsAppChannel.send(message);
}

export async function sendWhatsAppOTP(to: string, otp: string) {
  return whatsAppChannel.send({
    to,
    templateName: process.env.MSG91_WHATSAPP_OTP_TEMPLATE || 'otp',
    variables: [otp],
    components: {
      body_1: { type: 'text', value: otp },
      button_1: { subtype: 'url', type: 'text', value: otp },
    },
  });
}

export async function sendEmail(message: EmailMessage | { to: string; subject: string; body: string }) {
  if ('body' in message && !('html' in message)) {
    return emailChannel.send({
      to: message.to,
      subject: message.subject,
      html: (message as any).body,
    });
  }
  return emailChannel.send(message as EmailMessage);
}

export async function sendPush(message: PushNotificationMessage) {
  return pushChannel.send(message);
}


