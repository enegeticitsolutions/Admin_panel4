import prisma from '../database';
import { OtpProvider, OtpResponse } from './OtpProvider';

export class MockProvider extends OtpProvider {
  /**
   * Send an OTP via database fallback (for development).
   */
  async send(phone: string): Promise<OtpResponse> {
    const mockOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.otp.upsert({
      where: { phone },
      update: { code: mockOtpCode, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      create: { phone, code: mockOtpCode, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
    });

    console.log(`\n\n[DEV MODE] Generated OTP for ${phone}: 👉 ${mockOtpCode} 👈\n\n`);
    
    return {
      success: true,
      message: `[DEV MODE] Using database fallback. OTP is ${mockOtpCode} (logged in terminal).`,
    };
  }

  /**
   * Verify an OTP from the database.
   */
  async verify(phone: string, code: string): Promise<boolean> {
    const { isBypassPhone, getBypassOtpCode } = require('./otp_bypass');
    if (isBypassPhone(phone) && code === getBypassOtpCode()) {
      return true;
    }

    const otpRecord = await prisma.otp.findUnique({ where: { phone } });

    if (!otpRecord) return false;
    if (otpRecord.code !== code) return false;
    if (otpRecord.expiresAt < new Date()) return false;

    // Consume the token on success
    await prisma.otp.delete({ where: { phone } });
    return true;
  }
}
