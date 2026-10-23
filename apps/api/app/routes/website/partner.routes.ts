import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { createTransporter, isEmailConfigured, formatISTTimestamp } from './utils/mailer';
import { ZohoCrmService } from '../../services/crm/zoho_crm_service';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();

/**
 * POST /api/website/partner-application
 * Handles partner applications from the Partner with Us page.
 */
router.post('/partner-application', async (req: Request, res: Response) => {
  console.log('🤝 [Partner Application] Received payload:', req.body);

  try {
    const organizationName = (req.body.organizationName || req.body.organization_name || req.body.name || '').trim();
    const category = (req.body.category || '').trim();
    const contactName = (req.body.contactName || req.body.primary_contact_name || req.body.primaryContactName || organizationName).trim();
    const phone = (req.body.phone || '').trim();
    const email = (req.body.email || '').trim();
    const operatingCity = (req.body.operatingCity || req.body.city || '').trim();
    const serviceDetails = (req.body.serviceDetails || req.body.description || '').trim();

    if (!organizationName || !category || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Organization name, category, phone, and email are required.',
      });
    }

    const submittedOn = formatISTTimestamp();

    // 1. Save to Partner Ecosystem table (powers Admin Panel Partners page)
    try {
      const categorySlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      let partnerCategory = await (prisma as any).partnerCategory.findFirst({
        where: {
          OR: [
            { name: { equals: category, mode: 'insensitive' } },
            { slug: categorySlug },
            { code: category.toUpperCase() },
          ],
        },
      });

      if (!partnerCategory) {
        partnerCategory = await (prisma as any).partnerCategory.create({
          data: {
            name: category,
            slug: categorySlug,
            code: category.toUpperCase().replace(/[^A-Z0-9_]+/g, '_'),
            isActive: true,
          },
        });
      }

      await (prisma as any).partner.create({
        data: {
          organizationName,
          primaryContactName: contactName,
          email,
          phone,
          city: operatingCity || null,
          state: (req.body.state || '').trim() || null,
          description: serviceDetails || 'Website Application',
          categoryId: partnerCategory.id,
          status: 'PENDING',
          source: 'WEBSITE',
          isPublished: false,
          zohoDataPayload: req.body,
          zohoSyncedAt: new Date(),
        },
      });
      console.log(`✅ [Partner Application] Saved to Partner ecosystem table: ${organizationName}`);
    } catch (partnerErr: any) {
      console.error('⚠️ [Partner Application] Partner table insert error:', partnerErr.message);
    }

    // 2. Also save to MarketingLead (for CRM / Marketing tracking)
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
      console.log(`✅ [Partner Application] Saved to MarketingLead: ${organizationName}`);
    } catch (dbErr: any) {
      console.error('⚠️ [Partner Application] MarketingLead insert error:', dbErr.message);
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

    // 3. Forward to Zoho CRM Web-to-Lead
    const nameParts = (contactName || organizationName || 'Partner').trim().split(' ');
    const firstName = nameParts.length > 1 ? nameParts[0] : '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

    ZohoCrmService.createLead({
      firstName,
      lastName,
      email,
      phone,
      company: organizationName,
      description: `Partner Application [Category: ${category}] | City: ${operatingCity || 'Not specified'}\nDetails: ${serviceDetails || 'None provided'}`,
    }).catch((zohoErr: any) =>
      console.error('⚠️ [Partner Application] Zoho CRM sync error:', zohoErr.message)
    );

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

/**
 * GET /api/website/partners
 * Returns dynamic active partner categories and approved/published partners for the website.
 */
router.get('/partners', async (req: Request, res: Response) => {
  try {
    const [categories, partners] = await Promise.all([
      (prisma as any).partnerCategory.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      (prisma as any).partner.findMany({
        where: {
          isPublished: true,
          status: 'APPROVED',
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              code: true,
              iconUrl: true,
            },
          },
        },
        orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    const resolvedPartners = await Promise.all(
      partners.map(async (p: any) => {
        const logoUrl = p.logoUrl ? await resolveFileUrl(p.logoUrl, 86400 * 7) : p.logoUrl;
        const bannerImageUrl = p.bannerImageUrl ? await resolveFileUrl(p.bannerImageUrl, 86400 * 7) : p.bannerImageUrl;
        let photos = p.photos;
        if (Array.isArray(p.photos) && p.photos.length > 0) {
          photos = await Promise.all(p.photos.map((ph: string) => resolveFileUrl(ph, 86400 * 7)));
        }
        return {
          ...p,
          logoUrl,
          bannerImageUrl,
          photos,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        categories,
        partners: resolvedPartners,
      },
    });
  } catch (error: any) {
    console.error('❌ [Fetch Website Partners Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch partners for website.',
      data: { categories: [], partners: [] },
    });
  }
});

export default router;

