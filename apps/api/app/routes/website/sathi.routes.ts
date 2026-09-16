import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { createTransporter, isEmailConfigured, formatISTTimestamp } from './utils/mailer';

const router = Router();

/**
 * POST /api/website/saathi-enrollment
 * Handles Saathi volunteer applications submitted via the website.
 * Saves to DB and sends an internal notification email to Saathi coordinators and team.
 */
router.post('/saathi-enrollment', async (req: Request, res: Response) => {
  console.log('📩 [Saathi Enrollment] Received payload:', req.body);

  try {
    const { firstName, lastName, email, phone, gender, state, city, pincode, area, whyJoin, age, dob, interests } = req.body;

    if (!firstName || !phone || !state || !city) {
      return res.status(400).json({
        success: false,
        message: 'First Name, phone, state, and city are required',
      });
    }

    const name = `${firstName} ${lastName || ''}`.trim();

    // 1. Save volunteer application to database
    try {
      await (prisma as any).volunteer.create({
        data: {
          name,
          phone,
          email: email || null,
          gender: gender || null,
          state,
          city,
          pincode: pincode || null,
          streetArea: area || null,
          whyJoin: whyJoin || null,
          age: age ? parseInt(age, 10) : null,
          interests: Array.isArray(interests) ? interests : [],
          applicationStatus: 'SUBMITTED',
        },
      });
      console.log(`✅ [Saathi Enrollment] Saved to database: ${name}`);
    } catch (dbErr: any) {
      if (dbErr.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'This phone number or email is already registered.',
        });
      }
      console.error('⚠️ [Saathi Enrollment] DB insert error:', dbErr.message);
      throw dbErr;
    }

    // 2. Send internal notification email to team and Saathi coordinators
    const recipientEmails = process.env.SAATHI_RECIPIENT_EMAILS
      ? process.env.SAATHI_RECIPIENT_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)
      : [
          'aastha@maihoonna.com',
          'nidhi.hora@maihoonna.com',
          'info@maihoonna.com',
        ];

    const submittedOn = formatISTTimestamp();

    const mailOptions = {
      from: `"MaiHoonna Website" <${process.env.EMAIL_USER || 'info@maihoonna.com'}>`,
      to: recipientEmails,
      subject: `New Saathi Application - ${name}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1F2937; line-height: 1.7;">
          <div style="background: linear-gradient(135deg, #10B981, #34D399); padding: 24px 30px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">
              🤝 New Saathi Volunteer Application
            </h2>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #F3F4F6; border-top: none;">
            <p style="font-size: 15px; color: #374151; margin-top: 0;">Hello Team,</p>
            <p style="font-size: 15px; color: #374151;">
              A new user has submitted a Saathi Volunteer application via the website. Below are the application details:
            </p>
            <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 24px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280; width: 35%;">Applicant Name:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 600;">${name}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Mobile Number:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;"><a href="tel:${phone}" style="color: #059669; text-decoration: none; font-weight: 600;">${phone}</a></td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Email Address:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${email ? `<a href="mailto:${email}" style="color: #059669; text-decoration: none;">${email}</a>` : 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Gender:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${gender || 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Date of Birth / Age:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${dob ? `${dob}${age ? ` (${age} years)` : ''}` : (age ? `${age} years` : 'N/A')}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">State:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${state}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">City:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${city}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Pincode:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${pincode || 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Area / Sector:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${area || 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Interests / Hobbies:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${Array.isArray(interests) && interests.length > 0 ? interests.join(', ') : 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280; vertical-align: top;">Why Join:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${whyJoin || 'N/A'}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Submitted On:</td><td style="padding: 6px 0; font-size: 14px; color: #374151;">${submittedOn}</td></tr>
              </table>
            </div>
          </div>
        </div>
      `,
    };

    if (isEmailConfigured()) {
      const transporter = createTransporter();
      transporter.sendMail(mailOptions).catch((e) =>
        console.error('⚠️ Saathi notification email failed:', e.message)
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
    });
  } catch (error: any) {
    console.error('❌ [Saathi Enrollment Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
});

export default router;
