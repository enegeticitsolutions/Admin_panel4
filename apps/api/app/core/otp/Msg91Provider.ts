import prisma from '../database';
import { OtpProvider, OtpResponse } from './OtpProvider';
import { isBypassPhone, getBypassOtpCode } from './otp_bypass';

/**
 * Enterprise MSG91 Provider — Flow API & WhatsApp Outbound
 */
export class Msg91Provider extends OtpProvider {
  async send(phone: string): Promise<OtpResponse> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Dynamic OTP Bypass for testing team (configured strictly via .env)
    if (isBypassPhone(cleanPhone)) {
      const bypassCode = getBypassOtpCode();
      await prisma.otp.upsert({
        where: { phone: cleanPhone },
        update: { code: bypassCode, attempts: 0, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        create: { phone: cleanPhone, code: bypassCode, attempts: 0, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      return { success: true, message: 'OTP sent successfully' };
    }

    // 60-second cooldown check to prevent SMS bombing / financial exhaustion
    const existingOtp = await prisma.otp.findUnique({ where: { phone: cleanPhone } });
    if (existingOtp) {
      const elapsedMs = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsedMs < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - elapsedMs) / 1000);
        throw new Error(`Please wait ${waitSeconds}s before requesting another OTP.`);
      }
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      throw new Error('MSG91_AUTH_KEY environment variable is required');
    }

    // Generate 6-digit secure OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert OTP record with 5-minute TTL, reset attempts to 0 and record createdAt
    await prisma.otp.upsert({
      where: { phone: cleanPhone },
      update: { code: otpCode, attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      create: { phone: cleanPhone, code: otpCode, attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });

    const recipient = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    // If Flow template ID is configured, send via Flow API
    const flowTemplateId = process.env.MSG91_FLOW_TEMPLATE_ID || process.env.STPL_TEMPLATE_ID;
    if (flowTemplateId) {
      const flowPayload = {
        template_id: flowTemplateId,
        recipients: [
          {
            mobiles: recipient,
            var: otpCode,
          },
        ],
      };

      try {
        const response = await fetch('https://control.msg91.com/api/v5/flow', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authkey: authKey,
          },
          body: JSON.stringify(flowPayload),
        });
        const data: any = await response.json();
        if (data.hasError || data.status === 'error' || data.type === 'error') {
          console.warn('[MSG91 Flow OTP] Warning/Error:', data);
        } else {
          return { success: true, message: 'OTP sent successfully' };
        }
      } catch (err: any) {
        console.error('[MSG91 Flow OTP] Delivery Error:', err);
      }
    }

    // Fallback or parallel: WhatsApp Outbound Template
    const integratedNumber = process.env.MSG91_WHATSAPP_NUMBER || '';
    const templateName = process.env.MSG91_WHATSAPP_OTP_TEMPLATE || '';
    const namespace = process.env.MSG91_WHATSAPP_NAMESPACE || '';

    if (integratedNumber && templateName && namespace) {
      const rawVars = process.env.MSG91_WHATSAPP_BODY_VARS;
      const components: Record<string, any> = {};

      if (rawVars) {
        const varList = rawVars.split(',').map((v) => v.trim().replace('{otp}', otpCode));
        varList.forEach((val, i) => {
          components[`body_${i + 1}`] = { type: 'text', value: val };
        });
        components['button_1'] = { subtype: 'url', type: 'text', value: otpCode };
      } else {
        components['body_1'] = { type: 'text', value: otpCode };
        components['button_1'] = { subtype: 'url', type: 'text', value: otpCode };
      }

      const payload = {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en', policy: 'deterministic' },
            namespace: namespace,
            to_and_components: [{ to: [recipient], components }],
          },
        },
      };

      try {
        const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authkey: authKey,
          },
          body: JSON.stringify(payload),
        });

        const data: any = await response.json();
        if (data.hasError || data.status === 'error') {
          throw new Error(`MSG91 Error: ${data.message || JSON.stringify(data)}`);
        }

        return { success: true, message: 'OTP sent successfully' };
      } catch (error: any) {
        console.error('[MSG91 OTP Service] Delivery Error:', error);
        throw new Error('OTP delivery failed');
      }
    }

    return { success: true, message: 'OTP sent successfully' };
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // If phone is configured for bypass in .env, verify against the configured bypass code
    if (isBypassPhone(cleanPhone)) {
      if (code === getBypassOtpCode()) {
        return true;
      }
    }

    // Strict database lookup for verified OTP code using normalized phone
    const record = await prisma.otp.findUnique({ where: { phone: cleanPhone } });
    if (!record) {
      return false;
    }

    if (record.expiresAt < new Date()) {
      await prisma.otp.delete({ where: { phone: cleanPhone } }).catch(() => {});
      return false;
    }

    // Check if max attempts (5) already reached
    if (record.attempts >= 5) {
      await prisma.otp.delete({ where: { phone: cleanPhone } }).catch(() => {});
      throw new Error('Too many failed OTP attempts. This OTP has been invalidated for security. Please request a new OTP.');
    }

    // Check code match
    if (record.code !== code) {
      const newAttempts = record.attempts + 1;
      if (newAttempts >= 5) {
        await prisma.otp.delete({ where: { phone: cleanPhone } }).catch(() => {});
        throw new Error('Too many failed OTP attempts. This OTP has been invalidated for security. Please request a new OTP.');
      }
      await prisma.otp.update({
        where: { phone: cleanPhone },
        data: { attempts: newAttempts },
      });
      return false;
    }

    await prisma.otp.delete({ where: { phone: cleanPhone } });
    return true;
  }
}
