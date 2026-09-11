import twilio from 'twilio';
import { OtpProvider, OtpResponse } from './OtpProvider';

export class TwilioProvider extends OtpProvider {
  private client: twilio.Twilio | null;
  private serviceSid: string;

  constructor() {
    super();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';

    const hasValidKeys = accountSid && authToken && accountSid.startsWith('AC');
    this.client = hasValidKeys ? twilio(accountSid, authToken) : null;
  }

  async send(phone: string): Promise<OtpResponse> {
    if (!this.client || !this.serviceSid) {
      throw new Error('Twilio provider not properly configured.');
    }

    try {
      const verification = await this.client.verify.v2
        .services(this.serviceSid)
        .verifications.create({
          to: `+91${phone}`, // Assuming Indian numbers as per project context
          channel: "sms",
        });

      return { 
        success: true, 
        message: `OTP sent successfully via Twilio.`, 
        status: verification.status 
      };
    } catch (error: any) {
      console.error("Twilio Provider Error (Send):", error);
      throw new Error(`Twilio Error: ${error.message}`);
    }
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const { isBypassPhone, getBypassOtpCode } = require('./otp_bypass');
    if (isBypassPhone(phone) && code === getBypassOtpCode()) return true;

    if (!this.client || !this.serviceSid) {
      throw new Error('Twilio provider not properly configured.');
    }

    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.serviceSid)
        .verificationChecks.create({
          to: `+91${phone}`,
          code: code,
        });

      return verificationCheck.status === "approved";
    } catch (error: any) {
      console.error("Twilio Provider Error (Check):", error);
      return false;
    }
  }
}
