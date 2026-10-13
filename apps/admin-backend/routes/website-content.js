const express = require('express');
const router = express.Router();
const path = require('path');
const { prisma } = require('../lib/prisma');
const upload = require('../middleware/upload');
const storageService = require('../services/storage');
const { resolveFileUrl } = require('../services/storage/urlResolver');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

const adminsOnly = [verifyToken, authorizeRoles('admin', 'master_admin')];

/**
 * GET /api/website-content/home
 * Public endpoint to fetch home page content (testimonials).
 * Resolves private S3 storage keys to public/presigned URLs.
 */
router.get('/home', async (req, res) => {
  try {
    const content = await prisma.websiteContent.findUnique({
      where: { pageKey: 'home_page' },
    });
    
    if (!content) {
      return res.json({ success: true, data: { testimonials: [] } });
    }

    let contentData = content.content || {};
    
    // Resolve any stored S3 image keys so public website users can display them
    if (Array.isArray(contentData.testimonials)) {
      contentData.testimonials = await Promise.all(
        contentData.testimonials.map(async (t) => {
          let resolvedImage = t.image;
          if (t.image && typeof t.image === 'string') {
            try {
              resolvedImage = await resolveFileUrl(t.image, 86400 * 7); // 7 days TTL
            } catch (err) {
              console.warn('[WebsiteContent] Failed resolving testimonial image:', err.message);
            }
          }
          return {
            ...t,
            image: resolvedImage || t.image,
          };
        })
      );
    }

    res.json({ success: true, data: contentData });
  } catch (error) {
    console.error('Error fetching home page content:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching content' });
  }
});

/**
 * POST /api/website-content/upload-image
 * Upload a testimonial photo to cloud storage (S3/Supabase)
 * Protected: Admin & Master Admin only
 */
router.post('/upload-image', adminsOnly, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded' });
  }

  try {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileKey = `testimonials/${Date.now()}-${cleanBase}${ext}`;

    const { url } = await storageService.upload(file.buffer, fileKey, file.mimetype);
    
    // Presigned / direct URL for immediate frontend display
    const previewUrl = await resolveFileUrl(url, 86400 * 7);

    return res.json({
      success: true,
      data: {
        url: previewUrl,
        storageKey: url,
      },
    });
  } catch (error) {
    console.error('Testimonial photo upload failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload testimonial photo',
    });
  }
});

/**
 * PUT /api/website-content/home/testimonials
 * Update testimonials list on home page
 * Protected: Admin & Master Admin only
 */
router.put('/home/testimonials', adminsOnly, async (req, res) => {
  try {
    const { testimonials } = req.body;
    
    if (!Array.isArray(testimonials)) {
      return res.status(400).json({ success: false, message: 'Testimonials must be an array' });
    }

    // Get current content
    let content = await prisma.websiteContent.findUnique({
      where: { pageKey: 'home_page' },
    });

    let newContent = content && content.content ? content.content : {};
    newContent.testimonials = testimonials;

    await prisma.websiteContent.upsert({
      where: { pageKey: 'home_page' },
      update: { content: newContent },
      create: { pageKey: 'home_page', content: newContent },
    });

    res.json({ success: true, message: 'Testimonials updated successfully' });
  } catch (error) {
    console.error('Error updating testimonials:', error);
    res.status(500).json({ success: false, message: 'Server error while updating testimonials' });
  }
});

module.exports = router;

