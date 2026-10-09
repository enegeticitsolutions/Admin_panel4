import { WhatsAppRegistry } from '../registry/whatsapp.registry';
import { WhatsAppChannel } from '../channels/whatsapp.channel';
import { EmailRegistry } from '../registry/email.registry';
import { EmailChannel } from '../channels/email.channel';

const whatsAppChannel = new WhatsAppChannel();
const emailChannel = new EmailChannel();

export interface SendNotificationParams {
  channel: 'whatsapp' | 'sms' | 'email';
  event: string;
  to: string;
  variables?: Record<string, any>;
  from?: string;
}

export const notificationService = {
  async send(params: SendNotificationParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { channel, event, to, variables = {}, from } = params;

    // ─── 1. WhatsApp Channel ──────────────────────────────────────────────────
    if (channel === 'whatsapp') {
      const templateConfig = WhatsAppRegistry[event];
      
      if (!templateConfig) {
        console.warn(`[NotificationService] Event "${event}" not found in WhatsAppRegistry.`);
        return { success: false, error: `Event "${event}" not mapped for WhatsApp` };
      }

      // Map the dictionary variables to an ordered array as required by the template config
      const orderedVariables: string[] = [];
      for (const key of templateConfig.body) {
        const val = variables[key];
        if (val === undefined || val === null) {
          console.warn(`[NotificationService] Missing required variable '${key}' for WhatsApp event '${event}'`);
          return { success: false, error: `Missing required variable '${key}'` };
        }
        orderedVariables.push(String(val));
      }

      return whatsAppChannel.send({
        to,
        templateName: templateConfig.template,
        variables: orderedVariables,
      });
    }

    // ─── 2. AWS SES Email Channel ─────────────────────────────────────────────
    if (channel === 'email') {
      const templateConfig = EmailRegistry[event];

      if (!templateConfig) {
        console.warn(`[NotificationService] Event "${event}" not found in EmailRegistry.`);
        return { success: false, error: `Event "${event}" not mapped in EmailRegistry` };
      }

      // Format template dictionary matching AWS SES Template variables
      const templateData: Record<string, any> = {};
      for (const key of templateConfig.variables) {
        const val = variables[key] ?? variables[key.replace(/_([a-z])/g, (_, g) => g.toUpperCase())]; // support both snake_case and camelCase
        templateData[key] = val !== undefined && val !== null ? String(val) : '';
      }

      return emailChannel.sendTemplate({
        to,
        templateName: templateConfig.template,
        templateData,
        from,
      });
    }

    // Default handlers for sms
    console.warn(`[NotificationService] Channel '${channel}' not fully implemented via generic send yet.`);
    return { success: false, error: `Channel '${channel}' not implemented via generic send.` };
  }
};
