import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { createTransporter, isEmailConfigured, formatISTTimestamp } from './utils/mailer';
import { ZohoCrmService } from '../../services/crm/zoho_crm_service';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { config } from '../../core/config';

const router = Router();

/**
 * POST /api/website/submit-form
 * Handles website lead signup, saves to DB, and dispatches Zoho notification emails.
 */
router.post('/submit-form', async (req: Request, res: Response) => {
  console.log('📩 [Website Lead] Received payload:', req.body);

  try {
    const { name, phone, pinCode, pincode, email } = req.body;
    const finalPinCode = pinCode || pincode;

    if (!name || !phone || !finalPinCode || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, pin code and email are required',
      });
    }

    let normalizedPhone: string;
    try {
      const phoneNumber = typeof phone === 'string' && phone.startsWith('+')
        ? parsePhoneNumberWithError(phone)
        : parsePhoneNumberWithError(phone, 'IN');

      if (!phoneNumber.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid mobile number format for the selected country',
        });
      }
      // Standardize to E.164 format (+[CountryCode][Number], e.g. +919305951785 or +12025550143)
      normalizedPhone = phoneNumber.format('E.164');
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format for the selected country',
      });
    }

    const recipientEmail = process.env.WAITLIST_RECIPIENT_EMAIL || 'info@maihoonna.com';
    const submittedOn = formatISTTimestamp();

    // 1. Save lead to database with normalized country code + mobile number
    try {
      await (prisma as any).marketingLead.create({
        data: {
          name,
          phone: normalizedPhone,
          pincode: finalPinCode,
          email,
          source: 'website',
          status: 'new',
        },
      });
      console.log(`✅ [Website Lead] Saved to database: ${name} (${normalizedPhone})`);
    } catch (dbErr: any) {
      console.error('⚠️ [Website Lead] DB insert warning:', dbErr.message);
    }

    // 2. Dispatch internal lead notification email
    const mailOptions = {
      from: `"MaiHoonna Website" <${process.env.EMAIL_USER || 'info@maihoonna.com'}>`,
      to: recipientEmail,
      subject: `New MaiHoonna Waitlist Lead - ${name}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1F2937; line-height: 1.7;">
          <div style="background: linear-gradient(135deg, #F97316, #FB923C); padding: 24px 30px; border-radius: 12px 12px 0 0;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">
              🎉 New Waitlist Signup
            </h2>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #F3F4F6; border-top: none;">
            <p style="font-size: 15px; color: #374151; margin-top: 0;">Hello Team,</p>
            <p style="font-size: 15px; color: #374151;">
              A new user has successfully joined the <strong>MaiHoonna</strong> waitlist.
            </p>
            <div style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 10px; padding: 24px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Full Name:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${name}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Mobile:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${normalizedPhone}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Email:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${email}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Pin Code:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${pinCode}</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #6B7280;">Submitted On:</td><td style="padding: 6px 0; font-size: 15px; color: #1F2937; font-weight: 500;">${submittedOn}</td></tr>
              </table>
            </div>
            <p style="font-size: 14px; color: #6B7280;">MaiHoonna Website Lead Notification</p>
          </div>
        </div>
      `,
    };

    if (isEmailConfigured()) {
      const transporter = createTransporter();
      await transporter.sendMail(mailOptions);
      console.log(`📧 [Website Lead] Notification email sent to ${recipientEmail}`);

      // 3. Send confirmation email to the user
      const confirmationMail = {
        from: `"MaiHoonna" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to the MaiHoonna Waitlist! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #F97316;">Hi ${name},</h2>
            <p>Thank you for joining the MaiHoonna waitlist!</p>
            <p>We will notify you as soon as MaiHoonna launches in your area.</p>
            <br>
            <p>Warm regards,<br><strong>Team MaiHoonna</strong></p>
          </div>
        `,
      };
      transporter.sendMail(confirmationMail).catch((e) =>
        console.error('⚠️ User confirmation email failed:', e.message)
      );
    }

    // 4. Send Lead to Zoho CRM
    const nameParts = name.trim().split(' ');
    const firstName = nameParts.length > 1 ? nameParts[0] : '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : name;

    await ZohoCrmService.createLead({
      firstName,
      lastName,
      email,
      phone: normalizedPhone,
      company: 'MaiHoonna Website Waitlist',
      description: `Waitlist Signup | Pincode: ${pinCode}`
    });

    return res.status(200).json({
      success: true,
      message: 'Lead submitted successfully',
    });
  } catch (error: any) {
    console.error('❌ [Website Lead Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
});

/**
 * POST /api/website/custom-plan
 * Handles bespoke care plan inquiries from the Plans page modal and pushes to Zoho CRM Leads Module
 */
router.post('/custom-plan', async (req: Request, res: Response) => {
  console.log('📩 [Custom Plan Inquiry] Received payload:', req.body);

  try {
    const { name, phone, pincode, email, services } = req.body;

    if (!name || !phone || !pincode || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, pincode, and email are required',
      });
    }

    // 1. Forward directly to Zoho CRM Leads WebToLeadForm endpoint using dedicated 'contact' credentials
    await ZohoCrmService.createLead({
      formType: 'contact',
      lastName: name,
      phone,
      pincode,
      email,
      description: services || '',
      leadSource: 'Web Research',
      company: 'Custom Care Plan Lead',
    });

    // 2. Also save to internal database for persistence & reporting
    try {
      await (prisma as any).marketingLead.create({
        data: {
          name,
          phone,
          pincode,
          email,
          notes: services ? `Custom Eldercare Plan Inquiry: ${services}` : 'Custom Eldercare Plan Inquiry',
          source: 'website',
          status: 'new',
        },
      });
    } catch (dbErr: any) {
      console.warn('⚠️ [Custom Plan DB insert note]:', dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Custom plan inquiry submitted successfully',
    });
  } catch (error: any) {
    console.error('❌ [Custom Plan Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
});

export default router;
