import { createTransporter, isEmailConfigured } from '../../routes/website/utils/mailer';
import prisma from '../../core/database';

interface OtpEntry {
  otp: string;
  expiresAt: number;
}

// In-memory store for email verification OTPs (10-minute validity)
const emailOtpStore = new Map<string, OtpEntry>();

export async function sendEmailVerificationOtp(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address');
  }

  // Guard: check if email is already linked to a different account
  const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existingUser) {
    throw new Error('This email address is already linked to another account. Please use a different email.');
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  emailOtpStore.set(cleanEmail, { otp, expiresAt });

  if (!isEmailConfigured()) {
    console.log(`[DEV MODE] Email OTP for ${cleanEmail}: ${otp}`);
    return {
      success: true,
      message: `[DEV] Verification OTP generated: ${otp}`,
    };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"MaiHoonNa Care" <${process.env.EMAIL_USER}>`,
      to: cleanEmail,
      subject: 'Your MaiHoonNa Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #FE6700; text-align: center;">MaiHoonNa Senior Care</h2>
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 15px; color: #555;">Use the verification code below to confirm your email address in the MaiHoonNa mobile app:</p>
          <div style="background-color: #FFF3EB; border: 1px dashed #FE6700; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #FE6700;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #777; text-align: center;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
        </div>
      `,
    });

    return {
      success: true,
      message: 'Verification code sent to your email address',
    };
  } catch (error: any) {
    console.error('Failed to send verification email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function verifyEmailOtp(
  email: string,
  otp: string,
  userId?: string
): Promise<{ success: boolean; message: string; email: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const entry = emailOtpStore.get(cleanEmail);

  if (!entry) {
    throw new Error('No OTP request found for this email address. Please request a new code.');
  }

  if (Date.now() > entry.expiresAt) {
    emailOtpStore.delete(cleanEmail);
    throw new Error('Verification code has expired. Please request a new code.');
  }

  if (entry.otp !== otp.trim()) {
    throw new Error('Invalid verification code. Please check and try again.');
  }

  // Clear OTP on success
  emailOtpStore.delete(cleanEmail);

  // Update DB if userId is available
  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { email: cleanEmail, isVerified: true },
      });
    } catch (error: any) {
      // Prisma unique constraint violation — email already belongs to another account
      if (error?.code === 'P2002' || error?.message?.includes('users_email_key')) {
        throw new Error('This email address is already linked to another account. Please use a different email.');
      }
      // Re-throw any other unexpected DB error (will be caught by global error handler)
      console.error('[Email Verify] Unexpected DB error while saving email:', error);
      throw new Error('Something went wrong while saving your email. Please try again.');
    }
  }

  return {
    success: true,
    message: 'Email verified successfully',
    email: cleanEmail,
  };
}
