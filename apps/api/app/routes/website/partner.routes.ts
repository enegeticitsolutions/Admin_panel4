import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { createTransporter, isEmailConfigured, formatISTTimestamp } from './utils/mailer';

const router = Router();

/**
 * POST /api/website/partner-application
 * Handles partner applications from the Partner with Us page.
 */
router.post('/partner-application', async (req: Request, res: Response) => {
  console.log('🤝 [Partner Application] Received payload:', req.body);

  try {
    const {
      organizationName,
      category,
      contactName,
      phone,
      email,
      operatingCity,
      serviceDetails,
    } = req.body;

    if (!organizationName || !category || !contactName || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Organization name, category, contact person, phone, and email are required.',
      });
    }

    const submittedOn = formatISTTimestamp();

    // 1. Save to MarketingLead with Partner tag
    try {
      await (prisma as any).marketingLead.create({
        data: {
          name: `${contactName.trim()} (${organizationName.trim()})`,
          email: email.trim(),
          phone: phone.trim(),
          city: operatingCity ? operatingCity.trim() : null,
          source: 'website',
          status: 'new',
          notes: `[PARTNER APPLICATION]
Organization: ${organizationName.trim()}
Category: ${category.trim()}
Contact Person: ${contactName.trim()}
Operating City: ${operatingCity ? operatingCity.trim() : 'Not provided'}
Service Details: ${serviceDetails ? serviceDetails.trim() : 'None provided'}`,
        },
      });
      console.log(`✅ [Partner Application] Saved to DB: ${organizationName} - ${contactName}`);
    } catch (dbErr: any) {
      console.error('⚠️ [Partner Application] DB insert error:', dbErr.message);
    }

    // 2. Dispatch internal notification email
    const recipientEmail =
      process.env.PARTNER_RECIPIENT_EMAIL ||
      process.env.WAITLIST_RECIPIENT_EMAIL ||
      'info@maihoonna.com';

    const mailOptions = {
      from: `"MaiHoonNa Partner Network" <${process.env.EMAIL_USER || 'info@maihoonna.com'}>`,
      to: recipientEmail,
      subject: `New Partner Application: ${organizationName} (${category})`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1F2937; line-height: 1.7;">
          <div style="background: linear-gradient(135deg, #111827, #1F2937); padding: 24px 30px; border-radius: 12px 12px 0 0;">
            <span style="background: rgba(254, 103, 0, 0.15); color: #fe6700; border: 1px solid rgba(254, 103, 0, 0.3); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
              Partner Network Application
            </span>
            <h2 style="color: #ffffff; margin: 12px 0 0 0; font-size: 22px; font-weight: 700;">
              ${organizationName}
            </h2>
            <p style="color: #9CA3AF; margin: 4px 0 0 0; font-size: 14px;">
              Category: <strong style="color: #FE6700;">${category}</strong>
            </p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #F3F4F6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 15px; color: #374151; margin-top: 0;">Hello Team,</p>
            <p style="font-size: 15px; color: #374151;">
              A new healthcare / eldercare partner has applied to join the <strong>MaiHoonNa Ecosystem</strong>:
            </p>
            <div style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280; width: 35%;">Organization:</td>
                  <td style="padding: 6px 0; font-size: 15px; color: #111827; font-weight: 600;">${organizationName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Category:</td>
                  <td style="padding: 6px 0; font-size: 15px; color: #fe6700; font-weight: 600;">${category}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Contact Person:</td>
                  <td style="padding: 6px 0; font-size: 15px; color: #111827; font-weight: 500;">${contactName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Phone / WhatsApp:</td>
                  <td style="padding: 6px 0; font-size: 15px; color: #111827; font-weight: 500;">${phone}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Email:</td>
                  <td style="padding: 6px 0; font-size: 15px; color: #111827; font-weight: 500;"><a href="mailto:${email}" style="color: #2563EB;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">City / Area:</td>
                  <td style="padding: 6px 0; font-size: 15px; color: #111827;">${operatingCity || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280; vertical-align: top;">Service Details:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${serviceDetails || 'None provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Submitted At:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #6B7280;">${submittedOn}</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 13px; color: #9CA3AF; margin-bottom: 0;">
              This inquiry was submitted from the Partner with Us page on maihoonna.com.
            </p>
          </div>
        </div>
      `,
    };

    if (isEmailConfigured()) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`✉️ [Partner Application] Email sent for ${organizationName}`);
      } catch (mailErr: any) {
        console.error('⚠️ [Partner Application] Email dispatch error:', mailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Your partnership application has been received. Our team will contact you shortly.',
    });
  } catch (error: any) {
    console.error('❌ [Partner Application Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
});

export default router;
