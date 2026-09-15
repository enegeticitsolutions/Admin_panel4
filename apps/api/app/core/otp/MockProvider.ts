import prisma from '../database';
import { OtpProvider, OtpResponse } from './OtpProvider';

export class MockProvider extends OtpProvider {
  /**
   * Send an OTP via database fallback (for development).
   */
  async send(phone: string): Promise<OtpResponse> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Dynamic OTP Bypass for testing
    const { isBypassPhone, getBypassOtpCode } = require('./otp_bypass');
    if (isBypassPhone(cleanPhone)) {
      const bypassCode = getBypassOtpCode();
      await prisma.otp.upsert({
        where: { phone: cleanPhone },
        update: { code: bypassCode, attempts: 0, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        create: { phone: cleanPhone, code: bypassCode, attempts: 0, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      return { success: true, message: 'OTP sent successfully' };
    }

    // 60-second cooldown check
    const existingOtp = await prisma.otp.findUnique({ where: { phone: cleanPhone } });
    if (existingOtp) {
      const elapsedMs = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsedMs < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - elapsedMs) / 1000);
        throw new Error(`Please wait ${waitSeconds}s before requesting another OTP.`);
      }
    }

    const mockOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.otp.upsert({
      where: { phone: cleanPhone },
      update: { code: mockOtpCode, attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      create: { phone: cleanPhone, code: mockOtpCode, attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });

    console.log(`\n\n[DEV MODE] Generated OTP for ${cleanPhone}: 👉 ${mockOtpCode} 👈\n\n`);

    return {
      success: true,
      message: `[DEV MODE] Using database fallback. OTP is ${mockOtpCode} (logged in terminal).`,
    };
  }

  /**
   * Verify an OTP from the database.
   */
  async verify(phone: string, code: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const { isBypassPhone, getBypassOtpCode } = require('./otp_bypass');
    if (isBypassPhone(cleanPhone) && code === getBypassOtpCode()) {
      return true;
    }

    const otpRecord = await prisma.otp.findUnique({ where: { phone: cleanPhone } });

    if (!otpRecord) return false;

    if (otpRecord.expiresAt < new Date()) {
      await prisma.otp.delete({ where: { phone: cleanPhone } }).catch(() => {});
      return false;
    }

    if (otpRecord.attempts >= 5) {
      await prisma.otp.delete({ where: { phone: cleanPhone } }).catch(() => {});
      throw new Error('Too many failed OTP attempts. This OTP has been invalidated for security. Please request a new OTP.');
    }

    if (otpRecord.code !== code) {
      const newAttempts = otpRecord.attempts + 1;
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

    // Consume the token on success
    await prisma.otp.delete({ where: { phone: cleanPhone } });
    return true;
  }
}
