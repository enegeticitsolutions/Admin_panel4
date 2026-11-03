import { IWhatsAppProvider, WhatsAppMessage } from '../../interfaces/IWhatsAppProvider';

export class Msg91WhatsAppProvider implements IWhatsAppProvider {
  readonly name = 'msg91-whatsapp';

  private readonly authKey: string;
  private readonly integratedNumber: string;
  private readonly namespace: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || '';
    this.integratedNumber = process.env.MSG91_WHATSAPP_NUMBER || '';
    this.namespace = process.env.MSG91_WHATSAPP_NAMESPACE || '';
  }

  async send(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.authKey) {
      console.warn('[Msg91WhatsAppProvider] MSG91_AUTH_KEY not set.');
      return { success: false, error: 'MSG91_AUTH_KEY environment variable missing' };
    }

    try {
      const cleanPhone = message.to.replace(/[^0-9]/g, '');
      const recipient = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
      const templateName = message.templateName || process.env.MSG91_WHATSAPP_OTP_TEMPLATE || '';

      let componentsObj: Record<string, any> = {};
      if (message.components && Object.keys(message.components).length > 0) {
        componentsObj = { ...message.components };
      } else if (message.variables && message.variables.length > 0) {
        message.variables.forEach((val, idx) => {
          componentsObj[`body_${idx + 1}`] = { type: 'text', value: val };
        });
      }

      // Support interactive button / quick reply callback payload
      if (message.buttonPayload && !componentsObj['button_1']) {
        componentsObj['button_1'] = {
          subtype: 'quick_reply',
          type: 'payload',
          value: message.buttonPayload,
        };
      }

      const payload = {
        integrated_number: this.integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: message.language || 'en',
              policy: 'deterministic',
            },
            namespace: this.namespace,
            to_and_components: [
              {
                to: [recipient],
                components: componentsObj,
              },
            ],
          },
        },
      };

      const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.authKey,
        },
        body: JSON.stringify(payload),
      });

      const result: any = await response.json();

      if (result.type === 'success' || !result.hasError) {
        return { success: true, messageId: result.message || 'sent' };
      }

      return { success: false, error: JSON.stringify(result) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown network error' };
    }
  }
}
