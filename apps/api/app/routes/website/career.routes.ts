import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { createTransporter, isEmailConfigured, formatISTTimestamp } from './utils/mailer';

const router = Router();

/**
 * POST /api/website/career-interest
 * Handles "Express Interest" / Careers submissions from Team page
 */
router.post('/career-interest', async (req: Request, res: Response) => {
  console.log('📩 [Career Interest] Received payload:', req.body);

  try {
    const { name, email, role, note, resumeLink } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required.',
      });
    }

    const submittedOn = formatISTTimestamp();

    // 1. Save to MarketingLead with career tag
    try {
      await (prisma as any).marketingLead.create({
        data: {
          name: name.trim(),
          email: email.trim(),
          phone: req.body.phone || 'Not Provided',
          source: 'website',
          status: 'new',
          notes: `[CAREER INTEREST]\nRole: ${role || 'General'}\nNote: ${note || 'None'}\nResume/Link: ${resumeLink || 'None'}`,
        },
      });
      console.log(`✅ [Career Interest] Saved to DB: ${name} (${role})`);
    } catch (dbErr: any) {
      console.error('⚠️ [Career Interest] DB insert error:', dbErr.message);
    }

    // 2. Dispatch internal notification email
    const recipientEmail = process.env.CAREER_RECIPIENT_EMAIL || process.env.WAITLIST_RECIPIENT_EMAIL || 'careers@maihoonna.com';
    const mailOptions = {
      from: `"MaiHoonna Team" <${process.env.EMAIL_USER || 'info@maihoonna.com'}>`,
      to: recipientEmail,
      subject: `New Team Candidate Application - ${name} (${role || 'General'})`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1F2937; line-height: 1.7;">
          <div style="background: linear-gradient(135deg, #111827, #374151); padding: 24px 30px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #fe6700; margin: 0; font-size: 22px; font-weight: 600;">
              💼 New Career / Team Application
            </h2>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #F3F4F6; border-top: none;">
            <p style="font-size: 15px; color: #374151; margin-top: 0;">Hello Team,</p>
            <p style="font-size: 15px; color: #374151;">
              A new candidate has expressed interest in joining <strong>MaiHoonNa</strong>:
            </p>
            <div style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 10px; padding: 24px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Full Name:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${name}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Email:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${email}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Role of Interest:</td><td style="padding: 6px 0; font-size: 15px; color: #fe6700; font-weight: 600;">${role || 'Not specified'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Why MaiHoonNa:</td><td style="padding: 6px 0; font-size: 14px; color: #1F2937;">${note || 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Resume / Portfolio:</td><td style="padding: 6px 0; font-size: 14px; color: #2563EB;">${resumeLink || 'None provided'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Submitted On:</td><td style="padding: 6px 0; font-size: 14px; color: #1F2937;">${submittedOn}</td></tr>
              </table>
            </div>
          </div>
        </div>
      `,
    };

    if (isEmailConfigured()) {
      const transporter = createTransporter();
      await transporter.sendMail(mailOptions);
    }

    return res.status(200).json({
      success: true,
      message: 'Your profile has been received. Thank you!',
    });
  } catch (error: any) {
    console.error('❌ [Career Interest Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
});

export default router;
