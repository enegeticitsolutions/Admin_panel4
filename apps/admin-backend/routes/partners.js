const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const storageService = require('../services/storage');
const { resolveFileUrl, extractStorageKey } = require('../services/storage/urlResolver');
const { dispatchPartnerEnrolmentRequest, dispatchPartnerEnrolmentApproved } = require('../services/events/admin-event.dispatcher');

/**
 * Helper: Strip transient presigned query parameters and extract raw canonical key before DB save.
 */
function sanitizeStorageKey(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return keyOrUrl;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return trimmed;
  // External cloud docs or third-party images that do not need S3 presigning
  if (
    trimmed.includes('drive.google.com') ||
    trimmed.includes('dropbox.com') ||
    trimmed.includes('unsplash.com') ||
    trimmed.includes('supabase.co') ||
    trimmed.includes('placehold.co')
  ) {
    return trimmed;
  }
  const key = extractStorageKey(trimmed);
  return key || trimmed;
}

/**
 * Helper: Resolve partner media fields (logo, banner, photos, compliance documents)
 * to fresh presigned URLs. Defaults to 7 days (86400 * 7) for public website reliability.
 */
async function resolvePartnerMedia(partner, ttlSeconds = 86400 * 7) {
  if (!partner) return partner;
  const resolved = { ...partner };

  if (resolved.logoUrl) {
    resolved.logoUrl = await resolveFileUrl(resolved.logoUrl, ttlSeconds);
  }
  if (resolved.bannerImageUrl) {
    resolved.bannerImageUrl = await resolveFileUrl(resolved.bannerImageUrl, ttlSeconds);
  }
  if (resolved.attachmentUrl) {
    resolved.attachmentUrl = await resolveFileUrl(resolved.attachmentUrl, ttlSeconds);
  }

  // Resolve photos array
  if (Array.isArray(resolved.photos) && resolved.photos.length > 0) {
    resolved.photos = await Promise.all(
      resolved.photos.map(p => resolveFileUrl(p, ttlSeconds))
    );
  } else if (typeof resolved.photos === 'string' && resolved.photos.trim()) {
    try {
      const parsed = JSON.parse(resolved.photos);
      if (Array.isArray(parsed)) {
        resolved.photos = await Promise.all(
          parsed.map(p => resolveFileUrl(p, ttlSeconds))
        );
      }
    } catch {
      resolved.photos = [await resolveFileUrl(resolved.photos, ttlSeconds)];
    }
  }

  // Resolve documents array of objects [{ name, url, documentType, ... }]
  if (Array.isArray(resolved.documents) && resolved.documents.length > 0) {
    resolved.documents = await Promise.all(
      resolved.documents.map(async (doc) => {
        if (!doc) return doc;
        if (typeof doc === 'string') {
          const fresh = await resolveFileUrl(doc, ttlSeconds);
          return {
            name: doc.split('/').pop() || 'Document',
            url: fresh,
            previewUrl: fresh,
          };
        }
        const freshUrl = doc.url ? await resolveFileUrl(doc.url, ttlSeconds) : doc.url;
        return {
          ...doc,
          url: freshUrl,
          previewUrl: freshUrl,
        };
      })
    );
  } else if (typeof resolved.documents === 'string' && resolved.documents.trim()) {
    try {
      const parsed = JSON.parse(resolved.documents);
      if (Array.isArray(parsed)) {
        resolved.documents = await Promise.all(
          parsed.map(async (doc) => {
            if (!doc) return doc;
            const freshUrl = doc.url ? await resolveFileUrl(doc.url, ttlSeconds) : doc.url;
            return {
              ...doc,
              url: freshUrl,
              previewUrl: freshUrl,
            };
          })
        );
      }
    } catch {
      // ignore
    }
  }

  return resolved;
}

/**
 * Helper: Forward partner submission directly to Zoho CRM Web-to-Entity endpoint
 */
async function syncPartnerToZohoCrm(data) {
  try {
    const xnQsjsdp = process.env.ZOHO_CRM_XNQSJSDP;
    const xmIwtLD = process.env.ZOHO_CRM_XMIWTLD;
    const actionType = process.env.ZOHO_CRM_ACTION_TYPE || 'TGVhZHM=';
    const returnURL = process.env.ZOHO_CRM_RETURN_URL || 'https://maihoonna.com/thank-you';

    if (!xnQsjsdp || !xmIwtLD) {
      console.warn('[Zoho CRM Sync] Missing ZOHO_CRM_XNQSJSDP or ZOHO_CRM_XMIWTLD in environment variables. Skipping sync.');
      return { success: false, error: 'Zoho CRM credentials not configured in environment' };
    }

    const zohoParams = new URLSearchParams({
      xnQsjsdp,
      zc_gad: '',
      xmIwtLD,
      actionType,
      returnURL,
      // Standard Leads format (actionType = TGVhZHM=)
      'Last Name': data.primaryContactName || data.organizationName || data.name || 'Partner',
      'Company': data.organizationName || data.name || 'Partner Lead',
      'Email': data.email || '',
      'Phone': data.phone || '',
      'Description': `Partner Application [${data.categoryName || data.category || 'General'}] | City: ${data.city || 'N/A'}\n${data.description || ''}`,
      // CustomModule3 fallback fields (if actionType is CustomModule3)
      NAME: data.organizationName || data.name || 'Partner',
      COBJ3CF5: data.categoryName || data.category || '-None-',
      COBJ3CF7: data.description || '',
      COBJ3CF1: data.primaryContactName || '',
      COBJ3CF2: data.phone || '',
      COBJ3CF4: data.city || '',
      COBJ3CF3: data.state || '',
      aG9uZXlwb3Q: '',
    });

    const response = await fetch('https://crm.zoho.in/crm/WebForm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: zohoParams.toString(),
    });

    const responseText = await response.text();
    console.log('[Zoho CRM Sync] Status:', response.status, 'Response:', responseText.slice(0, 200));
    return { success: response.ok, raw: responseText };
  } catch (err) {
    console.error('[Zoho CRM Sync Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// 1. PUBLIC PARTNER APPLICATION & ZOHO CRM SYNC
// ==========================================
router.post('/apply', async (req, res) => {
  try {
    const payload = req.body;
    const organizationName = (payload.organization_name || payload.name || payload.NAME || '').trim();
    const primaryContactName = (payload.primary_contact_name || payload.contactName || payload.COBJ3CF1 || '').trim() || null;
    const email = (payload.email || payload.Email || '').trim() || null;
    const phone = (payload.phone || payload.COBJ3CF2 || '').trim() || null;
    const city = (payload.city || payload.COBJ3CF4 || '').trim() || null;
    const state = (payload.state || payload.COBJ3CF3 || '').trim() || null;
    const description = (payload.description || payload.COBJ3CF7 || '').trim() || 'Website Application';
    const categoryName = (payload.category || payload.COBJ3CF5 || 'General Partner').trim();

    if (!organizationName) {
      return res.status(400).json({ success: false, message: 'Organization name is required' });
    }

    // 1. Dynamic category find/create
    const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let category = await prisma.partnerCategory.findFirst({
      where: {
        OR: [
          { name: { equals: categoryName, mode: 'insensitive' } },
          { slug: categorySlug },
          { code: categoryName.toUpperCase() },
        ],
      },
    });

    if (!category) {
      category = await prisma.partnerCategory.create({
        data: {
          name: categoryName,
          slug: categorySlug,
          code: categoryName.toUpperCase().replace(/[^A-Z0-9_]+/g, '_'),
          isActive: true,
        },
      });
    }

    // 2. Create partner in DB with PENDING review status
    const partner = await prisma.partner.create({
      data: {
        organizationName,
        primaryContactName,
        email,
        phone,
        city,
        state,
        description,
        categoryId: category.id,
        status: 'PENDING',
        source: 'WEBSITE',
        isPublished: false,
        zohoDataPayload: payload,
        zohoSyncedAt: new Date(),
      },
    });

    // 3. Sync directly to Zoho CRM Cloud
    const zohoResult = await syncPartnerToZohoCrm({
      organizationName,
      categoryName,
      description,
      primaryContactName,
      email,
      phone,
      city,
      state,
    });

    // 4. Dispatch Event Notifications (Admin notification + SES email)
    dispatchPartnerEnrolmentRequest({
      partnerName: organizationName,
      partnerType: categoryName,
      partnerEmail: email,
    }).catch(err => console.warn('[PartnerApply] Event dispatch warning:', err.message));

    res.json({
      success: true,
      message: 'Partner application received successfully',
      data: partner,
      zohoSynced: zohoResult.success,
    });
  } catch (error) {
    console.error('Error processing partner application:', error);
    res.status(500).json({ success: false, message: 'Failed to process application' });
  }
});

// ==========================================
// 1.1 ZOHO CRM WEBHOOK RECEIVER (PUBLIC / SECRET VERIFIED)
// ==========================================
router.post('/webhook/zoho', async (req, res) => {
  try {
    const payload = req.body;

    // Optional secret verification header if configured in env
    const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingSecret = req.headers['x-zoho-webhook-secret'] || req.query.secret;
      if (incomingSecret !== webhookSecret) {
        return res.status(401).json({ success: false, message: 'Unauthorized webhook request' });
      }
    }

    const zohoLeadId = payload.lead_id || payload.id || payload.Zoho_Lead_ID || payload.LEADID;
    const organizationName = payload.organization_name || payload.Company || payload.Organisation_Name || payload.Account_Name || payload.NAME || 'Unknown Organization';
    const primaryContactName = payload.primary_contact_name || payload.Full_Name || payload.COBJ3CF1 || `${payload.First_Name || ''} ${payload.Last_Name || ''}`.trim() || null;
    const email = payload.email || payload.Email || null;
    const phone = payload.phone || payload.Phone || payload.Mobile || payload.COBJ3CF2 || null;
    const city = payload.city || payload.City || payload.COBJ3CF4 || null;
    const state = payload.state || payload.State || payload.COBJ3CF3 || null;
    const description = payload.description || payload.Description || payload.Brief_Description || payload.COBJ3CF7 || 'Synced from Zoho CRM';
    const categoryName = payload.category || payload.Partner_Category || payload.Category || payload.COBJ3CF5 || 'General Partner';
    const attachmentUrl = payload.attachment_url || payload.File_URL || null;

    // 1. Find or create the dynamic PartnerCategory
    const categorySlug = categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let category = await prisma.partnerCategory.findFirst({
      where: {
        OR: [
          { name: { equals: categoryName.trim(), mode: 'insensitive' } },
          { slug: categorySlug },
          { code: categoryName.trim().toUpperCase() },
        ],
      },
    });

    if (!category) {
      category = await prisma.partnerCategory.create({
        data: {
          name: categoryName.trim(),
          slug: categorySlug,
          code: categoryName.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_'),
          isActive: true,
        },
      });
    }

    // 2. Upsert Partner by zohoLeadId
    let partner;
    if (zohoLeadId) {
      partner = await prisma.partner.upsert({
        where: { zohoLeadId: String(zohoLeadId) },
        update: {
          organizationName,
          primaryContactName,
          email,
          phone,
          city,
          state,
          description,
          categoryId: category.id,
          attachmentUrl: attachmentUrl || undefined,
          zohoDataPayload: payload,
          zohoSyncedAt: new Date(),
        },
        create: {
          zohoLeadId: String(zohoLeadId),
          organizationName,
          primaryContactName,
          email,
          phone,
          city,
          state,
          description,
          categoryId: category.id,
          attachmentUrl,
          status: 'PENDING',
          source: payload.source || (zohoLeadId ? 'ZOHO_CRM' : 'WEBSITE'),
          isPublished: false,
          zohoDataPayload: payload,
          zohoSyncedAt: new Date(),
        },
      });
    } else {
      partner = await prisma.partner.create({
        data: {
          organizationName,
          primaryContactName,
          email,
          phone,
          city,
          state,
          description,
          categoryId: category.id,
          attachmentUrl,
          status: 'PENDING',
          source: payload.source || 'WEBSITE',
          isPublished: false,
          zohoDataPayload: payload,
          zohoSyncedAt: new Date(),
        },
      });

      // Forward to Zoho CRM if created from website
      syncPartnerToZohoCrm({
        organizationName,
        categoryName,
        description,
        primaryContactName,
        email,
        phone,
        city,
        state,
      });
    }

    res.json({
      success: true,
      message: 'Zoho CRM partner processed successfully',
      data: partner,
    });
  } catch (error) {
    console.error('Error handling Zoho CRM webhook:', error);
    res.status(500).json({ success: false, message: 'Failed to process Zoho CRM webhook' });
  }
});

// ==========================================
// 2. PUBLIC PARTNERS & CATEGORIES FOR WEBSITE
// ==========================================
router.get('/public', async (req, res) => {
  try {
    const [categories, partners] = await Promise.all([
      prisma.partnerCategory.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.partner.findMany({
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
      partners.map(p => resolvePartnerMedia(p, 86400 * 7))
    );

    res.json({
      success: true,
      data: {
        categories,
        partners: resolvedPartners,
      },
    });
  } catch (error) {
    console.error('Error fetching public partners:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch public partners' });
  }
});

// ─── Protected Routes (Requires Staff Auth) ──────────────────────────────────
router.use(verifyToken);


// ==========================================
// 2. STATS & SUMMARY
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const [total, pending, inReview, approved, published, zohoSynced, totalCategories] = await Promise.all([
      prisma.partner.count(),
      prisma.partner.count({ where: { status: 'PENDING' } }),
      prisma.partner.count({ where: { status: 'IN_REVIEW' } }),
      prisma.partner.count({ where: { status: 'APPROVED' } }),
      prisma.partner.count({ where: { isPublished: true } }),
      prisma.partner.count({ where: { source: 'ZOHO_CRM' } }),
      prisma.partnerCategory.count({ where: { isActive: true } }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        inReview,
        approved,
        published,
        zohoSynced,
        totalCategories,
      },
    });
  } catch (error) {
    console.error('Error fetching partner stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch partner statistics' });
  }
});

// ==========================================
// 3. DYNAMIC CATEGORIES CRUD
// ==========================================
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.partnerCategory.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { partners: true },
        },
      },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching partner categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch partner categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, slug, code, description, iconUrl, bannerUrl, displayOrder, isActive, metadata } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const generatedSlug = slug ? slug.trim().toLowerCase() : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const newCategory = await prisma.partnerCategory.create({
      data: {
        name: name.trim(),
        slug: generatedSlug,
        code: code ? code.trim().toUpperCase() : undefined,
        description: description || null,
        iconUrl: iconUrl || null,
        bannerUrl: bannerUrl || null,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder, 10) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        metadata: metadata || undefined,
      },
    });

    res.status(201).json({ success: true, data: newCategory, message: 'Category created successfully' });
  } catch (error) {
    console.error('Error creating partner category:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A category with this name, slug, or code already exists.' });
    }
    res.status(500).json({ success: false, message: 'Failed to create partner category' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, code, description, iconUrl, bannerUrl, displayOrder, isActive, metadata } = req.body;

    const updated = await prisma.partnerCategory.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        slug: slug ? slug.trim().toLowerCase() : undefined,
        code: code ? code.trim().toUpperCase() : undefined,
        description: description !== undefined ? description : undefined,
        iconUrl: iconUrl !== undefined ? iconUrl : undefined,
        bannerUrl: bannerUrl !== undefined ? bannerUrl : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder, 10) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        metadata: metadata !== undefined ? metadata : undefined,
      },
    });

    res.json({ success: true, data: updated, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating partner category:', error);
    res.status(500).json({ success: false, message: 'Failed to update partner category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const partnerCount = await prisma.partner.count({ where: { categoryId: id } });
    if (partnerCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${partnerCount} partners are linked to it. Reassign them first or mark the category as inactive.`,
      });
    }

    await prisma.partnerCategory.delete({ where: { id } });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting partner category:', error);
    res.status(500).json({ success: false, message: 'Failed to delete partner category' });
  }
});

// ==========================================
// 4. PARTNERS LISTING & DETAILS
// ==========================================
router.get('/', async (req, res) => {
  try {
    const {
      search,
      status,
      categoryId,
      isPublished,
      source,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }

    if (isPublished !== undefined && isPublished !== 'ALL' && isPublished !== '') {
      where.isPublished = isPublished === 'true' || isPublished === true;
    }

    if (source && source !== 'ALL') {
      where.source = source;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { organizationName: { contains: q, mode: 'insensitive' } },
        { primaryContactName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { state: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, partners] = await Promise.all([
      prisma.partner.count({ where }),
      prisma.partner.findMany({
        where,
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
        orderBy: { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    const resolvedPartners = await Promise.all(
      partners.map(p => resolvePartnerMedia(p, 86400 * 7))
    );

    res.json({
      success: true,
      data: resolvedPartners,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching partners list:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch partners' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    const resolved = await resolvePartnerMedia(partner, 86400 * 7);
    res.json({ success: true, data: resolved });
  } catch (error) {
    console.error('Error fetching partner details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch partner details' });
  }
});

// ==========================================
// 5. CREATE PARTNER (ADMIN DIRECT)
// ==========================================
router.post('/', async (req, res) => {
  try {
    const {
      organizationName,
      categoryId,
      description,
      primaryContactName,
      email,
      phone,
      city,
      state,
      attachmentUrl,
      status,
      adminNotes,
      assignedToAdmin,
      isPublished,
      isFeatured,
      displayOrder,
      logoUrl,
      bannerImageUrl,
      websiteUrl,
      customBadgeText,
      serviceHighlights,
      photos,
      documents,
    } = req.body;

    if (!organizationName || !organizationName.trim()) {
      return res.status(400).json({ success: false, message: 'Organisation Name is required' });
    }

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Partner Category is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    const partnerPhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
    const mainBanner = bannerImageUrl || (partnerPhotos.length > 0 ? partnerPhotos[0] : null);
    const partnerDocs = Array.isArray(documents) ? documents : (documents ? [documents] : []);

    const cleanPhotos = partnerPhotos.map(sanitizeStorageKey);
    const cleanBanner = mainBanner ? sanitizeStorageKey(mainBanner) : null;
    const cleanLogo = logoUrl ? sanitizeStorageKey(logoUrl) : null;
    const cleanDocs = partnerDocs.map(doc => {
      if (!doc) return doc;
      if (typeof doc === 'string') return sanitizeStorageKey(doc);
      return {
        ...doc,
        url: sanitizeStorageKey(doc.url),
      };
    });
    const cleanAttachment = attachmentUrl ? sanitizeStorageKey(attachmentUrl) : (cleanDocs.length > 0 ? (cleanDocs[0].url || cleanDocs[0]) : null);

    const newPartner = await prisma.partner.create({
      data: {
        organizationName: organizationName.trim(),
        categoryId,
        description: description.trim(),
        primaryContactName: primaryContactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        attachmentUrl: cleanAttachment,
        documents: cleanDocs,
        status: status || 'PENDING',
        adminNotes: adminNotes || null,
        assignedToAdmin: assignedToAdmin || null,
        isPublished: Boolean(isPublished),
        isFeatured: Boolean(isFeatured),
        displayOrder: displayOrder ? parseInt(displayOrder, 10) : 0,
        logoUrl: cleanLogo,
        bannerImageUrl: cleanBanner,
        photos: cleanPhotos,
        websiteUrl: websiteUrl || null,
        customBadgeText: customBadgeText || null,
        serviceHighlights: Array.isArray(serviceHighlights) ? serviceHighlights : [],
        source: 'ADMIN_DIRECT',
      },
      include: {
        category: true,
      },
    });

    const resolvedNewPartner = await resolvePartnerMedia(newPartner, 86400 * 7);
    res.status(201).json({ success: true, data: resolvedNewPartner, message: 'Partner created successfully' });
  } catch (error) {
    console.error('Error creating partner:', error);
    res.status(500).json({ success: false, message: 'Failed to create partner' });
  }
});

// ==========================================
// 6. UPDATE PARTNER DETAILS & EDIT
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      organizationName,
      categoryId,
      description,
      primaryContactName,
      email,
      phone,
      city,
      state,
      attachmentUrl,
      documents,
      status,
      adminNotes,
      assignedToAdmin,
      isPublished,
      isFeatured,
      displayOrder,
      logoUrl,
      bannerImageUrl,
      websiteUrl,
      customBadgeText,
      serviceHighlights,
      photos,
    } = req.body;

    const existing = await prisma.partner.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    const partnerPhotos = Array.isArray(photos) ? photos.filter(Boolean) : undefined;
    const computedBanner = bannerImageUrl !== undefined ? bannerImageUrl : (partnerPhotos && partnerPhotos.length > 0 ? partnerPhotos[0] : undefined);
    const partnerDocs = documents !== undefined ? (Array.isArray(documents) ? documents : [documents]) : undefined;

    const cleanPhotos = partnerPhotos !== undefined ? partnerPhotos.map(sanitizeStorageKey) : undefined;
    const cleanBanner = computedBanner !== undefined ? sanitizeStorageKey(computedBanner) : undefined;
    const cleanLogo = logoUrl !== undefined ? sanitizeStorageKey(logoUrl) : undefined;
    const cleanDocs = partnerDocs !== undefined ? partnerDocs.map(doc => {
      if (!doc) return doc;
      if (typeof doc === 'string') return sanitizeStorageKey(doc);
      return {
        ...doc,
        url: sanitizeStorageKey(doc.url),
      };
    }) : undefined;
    const cleanAttachment = attachmentUrl !== undefined ? sanitizeStorageKey(attachmentUrl) : (cleanDocs && cleanDocs.length > 0 ? (cleanDocs[0].url || cleanDocs[0]) : undefined);

    const updated = await prisma.partner.update({
      where: { id },
      data: {
        organizationName: organizationName !== undefined ? organizationName.trim() : undefined,
        categoryId: categoryId !== undefined ? categoryId : undefined,
        description: description !== undefined ? description.trim() : undefined,
        primaryContactName: primaryContactName !== undefined ? (primaryContactName?.trim() || null) : undefined,
        email: email !== undefined ? (email?.trim() || null) : undefined,
        phone: phone !== undefined ? (phone?.trim() || null) : undefined,
        city: city !== undefined ? (city?.trim() || null) : undefined,
        state: state !== undefined ? (state?.trim() || null) : undefined,
        attachmentUrl: cleanAttachment,
        documents: cleanDocs,
        status: status !== undefined ? status : undefined,
        adminNotes: adminNotes !== undefined ? adminNotes : undefined,
        assignedToAdmin: assignedToAdmin !== undefined ? assignedToAdmin : undefined,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : undefined,
        isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder, 10) : undefined,
        logoUrl: cleanLogo,
        bannerImageUrl: cleanBanner,
        photos: cleanPhotos,
        websiteUrl: websiteUrl !== undefined ? websiteUrl : undefined,
        customBadgeText: customBadgeText !== undefined ? customBadgeText : undefined,
        serviceHighlights: Array.isArray(serviceHighlights) ? serviceHighlights : undefined,
      },
      include: {
        category: true,
      },
    });

    if (status === 'APPROVED' && existing.status !== 'APPROVED') {
      dispatchPartnerEnrolmentApproved({
        partnerName: updated.organizationName,
        partnerPhone: updated.phone,
        partnerEmail: updated.email,
        date: new Date().toLocaleDateString('en-IN'),
      }).catch(err => console.warn('[PartnerUpdate] Event dispatch warning:', err.message));
    }

    const resolvedUpdated = await resolvePartnerMedia(updated, 86400 * 7);
    res.json({ success: true, data: resolvedUpdated, message: 'Partner updated successfully' });
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({ success: false, message: 'Failed to update partner' });
  }
});

// ==========================================
// 6.1 UPLOAD PARTNER PHOTO
// ==========================================
router.post('/upload-photo', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const fileKey = `partners/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { url } = await storageService.upload(file.buffer, fileKey, file.mimetype);
    const previewUrl = await resolveFileUrl(url, 86400 * 7);

    res.json({
      success: true,
      data: {
        url: previewUrl || url,
        previewUrl: previewUrl || url,
        storageKey: fileKey,
      },
      url: previewUrl || url,
      previewUrl: previewUrl || url,
      storageKey: fileKey,
      message: 'Photo uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading partner photo:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload photo' });
  }
});

// ==========================================
// 6.2 UPLOAD PARTNER DOCUMENT (PDF / DOC / IMAGES)
// ==========================================
router.post('/upload-document', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded' });
    }

    const fileKey = `partners/documents/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { url } = await storageService.upload(file.buffer, fileKey, file.mimetype);
    const previewUrl = await resolveFileUrl(url, 86400 * 7);

    res.json({
      success: true,
      data: {
        name: file.originalname,
        url: previewUrl || url,
        previewUrl: previewUrl || url,
        storageKey: fileKey,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      },
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading partner document:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload document' });
  }
});

// ==========================================
// 7. QUICK TOGGLE PUBLISH & STATUS
// ==========================================
router.patch('/:id/toggle-publish', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.partner.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    const newPublishedState = !existing.isPublished;
    const updated = await prisma.partner.update({
      where: { id },
      data: { isPublished: newPublishedState },
      include: { category: true },
    });

    res.json({
      success: true,
      data: updated,
      message: `Partner is now ${newPublishedState ? 'live on website' : 'hidden from website'}`,
    });
  } catch (error) {
    console.error('Error toggling partner publication status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle publication status' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid partner status' });
    }

    const updated = await prisma.partner.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes !== undefined ? adminNotes : undefined,
      },
      include: { category: true },
    });

    if (status === 'APPROVED') {
      dispatchPartnerEnrolmentApproved({
        partnerName: updated.organizationName,
        partnerPhone: updated.phone,
        partnerEmail: updated.email,
        date: new Date().toLocaleDateString('en-IN'),
      }).catch(err => console.warn('[PartnerStatus] Event dispatch warning:', err.message));
    }

    res.json({ success: true, data: updated, message: `Partner status updated to ${status}` });
  } catch (error) {
    console.error('Error updating partner status:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// ==========================================
// 8. DELETE PARTNER
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.partner.delete({ where: { id } });
    res.json({ success: true, message: 'Partner removed successfully' });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({ success: false, message: 'Failed to delete partner' });
  }
});

module.exports = router;
