const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const upload = require('../middleware/upload');
const storageService = require('../services/storage');
const { resolveFileUrl, extractStorageKey } = require('../services/storage/urlResolver');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

function sanitizeStorageKey(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return keyOrUrl;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.includes('unsplash.com') ||
    trimmed.includes('supabase.co') ||
    trimmed.includes('ui-avatars.com') ||
    trimmed.includes('placehold.co')
  ) {
    return trimmed;
  }
  const key = extractStorageKey(trimmed);
  return key || trimmed;
}

async function safeResolveUrl(key, ttl = 86400 * 7) {
  if (!key) return null;
  try {
    return await resolveFileUrl(key, ttl);
  } catch (e) {
    console.warn('[Community] Failed to resolve URL for key:', key, e.message);
    return null;
  }
}

const adminsOnly = [verifyToken, authorizeRoles('admin', 'master_admin')];
const staffOnly = [
  verifyToken,
  authorizeRoles(
    'master_admin',
    'admin',
    'operations_manager',
    'field_manager',
    'customer_service_manager',
    'customer_service'
  ),
];

// ─── 1. Dashboard Metrics ───────────────────────────────────────────────────
router.get('/dashboard', staffOnly, async (req, res) => {
  try {
    const now = new Date();
    const [
      totalEvents,
      upcomingEvents,
      totalRegistrations,
      totalBlogs,
      totalPodcasts,
      totalEpisodes,
      recentEvents,
      recentBlogs,
    ] = await Promise.all([
      prisma.communityEvent.count().catch(() => 0),
      prisma.communityEvent.count({ where: { startDateTime: { gte: now }, status: 'published' } }).catch(() => 0),
      prisma.eventRegistration.count({ where: { status: 'confirmed' } }).catch(() => 0),
      prisma.blog.count({ where: { status: 'published' } }).catch(() => 0),
      prisma.podcast.count({ where: { status: 'published' } }).catch(() => 0),
      prisma.podcastEpisode.count({ where: { status: 'published' } }).catch(() => 0),
      prisma.communityEvent.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { category: true, _count: { select: { registrations: true } } },
      }).catch(() => []),
      prisma.blog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { category: true, author: true },
      }).catch(() => []),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalEvents,
          upcomingEvents,
          totalRegistrations,
          totalBlogs,
          totalPodcasts,
          totalEpisodes,
        },
        recentEvents,
        recentBlogs,
      },
    });
  } catch (err) {
    console.error('[Community Admin] Dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 2. Categories CRUD (with auto-seed fallback) ───────────────────────────
router.get('/categories', staffOnly, async (req, res) => {
  try {
    let categories = await prisma.contentCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { events: true, blogs: true, podcasts: true },
        },
      },
    });

    // Auto-seed default senior wellness categories if none exist
    if (categories.length === 0) {
      const defaults = [
        { name: 'Heart Health & Vitals', slug: 'heart-health', color: '#EF4444', description: 'Cardiovascular wellness, BP, and vitals management', sortOrder: 1 },
        { name: 'Active Aging & Mobility', slug: 'active-aging', color: '#FE6700', description: 'Gentle yoga, physiotherapy, and walking posture', sortOrder: 2 },
        { name: 'Mental Wellbeing & Memory', slug: 'mental-wellbeing', color: '#8B5CF6', description: 'Cognitive health, meditation, and memory retention', sortOrder: 3 },
        { name: 'Nutrition & Diet', slug: 'nutrition', color: '#10B981', description: 'Diabetic care, hydration, and senior superfoods', sortOrder: 4 },
        { name: 'Geriatric Care & Lifestyle', slug: 'geriatric-care', color: '#2563EB', description: 'Elder care guidance and daily assisted living tips', sortOrder: 5 },
        { name: 'Social & Recreational', slug: 'social-recreation', color: '#EC4899', description: 'Community gatherings, hobby clubs, and arts', sortOrder: 6 },
      ];
      await prisma.contentCategory.createMany({ data: defaults });
      categories = await prisma.contentCategory.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { events: true, blogs: true, podcasts: true },
          },
        },
      });
    }

    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('[Community Categories] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/categories', adminsOnly, async (req, res) => {
  try {
    const { name, slug, description, color, icon, sortOrder } = req.body;
    const category = await prisma.contentCategory.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description,
        color: color || '#2563EB',
        icon,
        sortOrder: sortOrder || 0,
      },
    });
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/categories/:id', adminsOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, color, icon, sortOrder, isActive } = req.body;
    const updated = await prisma.contentCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        color,
        icon,
        sortOrder,
        isActive,
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 3. Authors & Speakers CRUD ─────────────────────────────────────────────
router.get('/authors', staffOnly, async (req, res) => {
  try {
    const authors = await prisma.contentAuthor.findMany({
      orderBy: { name: 'asc' },
    });

    const resolved = await Promise.all(
      authors.map(async (a) => ({
        ...a,
        avatarUrl: await safeResolveUrl(a.avatarKey),
      }))
    );

    res.json({ success: true, data: resolved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/authors', adminsOnly, async (req, res) => {
  try {
    const { name, designation, bio, avatarKey, email, phone, website } = req.body;
    const author = await prisma.contentAuthor.create({
      data: {
        name,
        designation,
        bio,
        avatarKey: sanitizeStorageKey(avatarKey),
        email,
        phone,
        website,
      },
    });
    res.json({ success: true, data: author });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/authors/:id', adminsOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, designation, bio, avatarKey, email, phone, website, isActive } = req.body;
    const updated = await prisma.contentAuthor.update({
      where: { id },
      data: {
        name,
        designation,
        bio,
        avatarKey: sanitizeStorageKey(avatarKey),
        email,
        phone,
        website,
        isActive,
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 4. Events Management (with accessTier, city, state, thumbnail) ──────────
router.get('/events', staffOnly, async (req, res) => {
  try {
    const { status, eventType, categoryId, timeFilter } = req.query;
    const where = {};
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (categoryId) where.categoryId = categoryId;

    if (timeFilter) {
      const now = new Date();
      if (timeFilter === 'upcoming') {
        where.startDateTime = { gt: now };
      } else if (timeFilter === 'ongoing') {
        where.startDateTime = { lte: now };
        where.endDateTime = { gte: now };
      } else if (timeFilter === 'past') {
        where.endDateTime = { lt: now };
      }
    }

    const events = await prisma.communityEvent.findMany({
      where,
      orderBy: { startDateTime: 'desc' },
      include: {
        category: true,
        host: true,
        _count: { select: { registrations: true } },
      },
    });

    const resolved = await Promise.all(
      events.map(async (e) => ({
        ...e,
        resolvedThumbnailUrl: await safeResolveUrl(e.thumbnailKey),
      }))
    );

    res.json({ success: true, data: resolved });
  } catch (err) {
    console.error('[Community Events] Get events error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/events', adminsOnly, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      slug,
      shortDescription,
      detailedDescription,
      categoryId,
      authorId,
      eventType,
      language,
      thumbnailKey,
      accessTier,
      city,
      state,
      startDateTime,
      endDateTime,
      registrationRequired,
      maxCapacity,
      venueName,
      venueAddress,
      meetingUrl,
      meetingPasscode,
      status,
      ranking,
    } = req.body;

    const parsedRanking = ranking !== undefined && ranking !== '' && ranking !== null && !isNaN(parseInt(ranking, 10))
      ? Math.min(5, Math.max(1, parseInt(ranking, 10)))
      : null;

    if (parsedRanking !== null) {
      // Enforce unique ranking: clear this rank from any other event
      await prisma.communityEvent.updateMany({
        where: { ranking: parsedRanking },
        data: { ranking: null },
      });
    }

    const event = await prisma.communityEvent.create({
      data: {
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
        shortDescription: shortDescription || title,
        detailedDescription: detailedDescription || shortDescription || title,
        categoryId,
        authorId: authorId || null,
        eventType: eventType || 'online',
        language: language || 'en',
        thumbnailKey: sanitizeStorageKey(thumbnailKey),
        accessTier: accessTier === 'subscribers_only' ? 'subscribers_only' : 'free',
        city: city || null,
        state: state || null,
        ranking: parsedRanking,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        registrationRequired: registrationRequired !== false,
        maxCapacity: parseInt(maxCapacity || '100', 10),
        venueName: venueName || null,
        venueAddress: venueAddress || null,
        meetingUrl: meetingUrl || null,
        meetingPasscode: meetingPasscode || null,
        status: status || 'published',
        publishedAt: status === 'published' ? new Date() : null,
        createdById: userId,
      },
    });

    res.json({ success: true, data: event });
  } catch (err) {
    console.error('[Community Events] Create event error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/events/:id', adminsOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if ('ranking' in req.body) {
      body.ranking = req.body.ranking !== '' && req.body.ranking !== null && !isNaN(parseInt(req.body.ranking, 10))
        ? Math.min(5, Math.max(1, parseInt(req.body.ranking, 10)))
        : null;

      if (body.ranking !== null) {
        // Enforce unique ranking: clear this rank from any other event
        await prisma.communityEvent.updateMany({
          where: {
            ranking: body.ranking,
            id: { not: id },
          },
          data: { ranking: null },
        });
      }
    }

    const updated = await prisma.communityEvent.update({
      where: { id },
      data: {
        ...body,
        thumbnailKey: sanitizeStorageKey(body.thumbnailKey),
        accessTier: body.accessTier === 'subscribers_only' ? 'subscribers_only' : 'free',
        city: body.city !== undefined ? (body.city || null) : undefined,
        state: body.state !== undefined ? (body.state || null) : undefined,
        ranking: body.ranking !== undefined ? body.ranking : undefined,
        startDateTime: body.startDateTime ? new Date(body.startDateTime) : undefined,
        endDateTime: body.endDateTime ? new Date(body.endDateTime) : undefined,
        maxCapacity: body.maxCapacity ? parseInt(body.maxCapacity, 10) : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/events/:id/status', adminsOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;

    const updated = await prisma.communityEvent.update({
      where: { id },
      data: {
        status,
        cancellationReason: cancellationReason || null,
        publishedAt: status === 'published' ? new Date() : undefined,
        cancelledAt: status === 'cancelled' ? new Date() : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/events/:id/attendees', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, role: true } },
        beneficiary: { select: { id: true, name: true, relationship: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: registrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 5. Blogs Management ────────────────────────────────────────────────────
router.get('/blogs', staffOnly, async (req, res) => {
  try {
    const { status, categoryId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;

    const blogs = await prisma.blog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        author: true,
      },
    });

    const resolved = await Promise.all(
      blogs.map(async (b) => ({
        ...b,
        resolvedThumbnailUrl: await safeResolveUrl(b.thumbnailKey),
      }))
    );

    res.json({ success: true, data: resolved });
  } catch (err) {
    console.error('[Community Blogs] Get blogs error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/blogs', adminsOnly, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      slug,
      shortDescription,
      richContent,
      categoryId,
      authorId,
      language,
      thumbnailKey,
      readingTimeMinutes,
      tags,
      isFeatured,
      ranking,
      status,
    } = req.body;

    const parsedRanking = ranking !== undefined && ranking !== '' && ranking !== null && !isNaN(parseInt(ranking, 10))
      ? Math.min(5, Math.max(1, parseInt(ranking, 10)))
      : null;

    if (parsedRanking !== null) {
      // Enforce unique ranking: clear this rank from any other blog
      await prisma.blog.updateMany({
        where: { ranking: parsedRanking },
        data: { ranking: null },
      });
    }

    const blog = await prisma.blog.create({
      data: {
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
        shortDescription: shortDescription || title,
        richContent: richContent || shortDescription || title,
        categoryId,
        authorId: authorId || null,
        language: language || 'en',
        thumbnailKey: sanitizeStorageKey(thumbnailKey),
        readingTimeMinutes: readingTimeMinutes || Math.max(1, Math.ceil((richContent || '').split(' ').length / 200)),
        tags: tags || [],
        isFeatured: !!isFeatured,
        ranking: parsedRanking,
        status: status || 'published',
        publishedAt: status === 'published' ? new Date() : null,
        createdById: userId,
      },
    });

    res.json({ success: true, data: blog });
  } catch (err) {
    console.error('[Community Blogs] Create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/blogs/:id', adminsOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if ('ranking' in req.body) {
      body.ranking = req.body.ranking !== '' && req.body.ranking !== null && !isNaN(parseInt(req.body.ranking, 10))
        ? Math.min(5, Math.max(1, parseInt(req.body.ranking, 10)))
        : null;

      if (body.ranking !== null) {
        // Enforce unique ranking: clear this rank from any other blog
        await prisma.blog.updateMany({
          where: {
            ranking: body.ranking,
            id: { not: id },
          },
          data: { ranking: null },
        });
      }
    }

    const updated = await prisma.blog.update({
      where: { id },
      data: {
        ...body,
        thumbnailKey: sanitizeStorageKey(body.thumbnailKey),
        ranking: body.ranking !== undefined ? body.ranking : undefined,
        publishedAt: body.status === 'published' ? new Date() : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 6. Podcasts Management ─────────────────────────────────────────────────
router.get('/podcasts', staffOnly, async (req, res) => {
  try {
    const podcasts = await prisma.podcast.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        host: true,
        episodes: {
          orderBy: { episodeNumber: 'asc' },
        },
      },
    });

    const resolved = await Promise.all(
      podcasts.map(async (p) => ({
        ...p,
        resolvedCoverUrl: await safeResolveUrl(p.coverImageKey),
        episodes: await Promise.all(
          p.episodes.map(async (ep) => ({
            ...ep,
            resolvedAudioUrl: await safeResolveUrl(ep.audioStorageKey),
          }))
        ),
      }))
    );

    res.json({ success: true, data: resolved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/podcasts', adminsOnly, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, slug, description, categoryId, authorId, coverImageKey, language, isFeatured, ranking } = req.body;

    const parsedRanking = ranking !== undefined && ranking !== '' && ranking !== null && !isNaN(parseInt(ranking, 10))
      ? Math.min(5, Math.max(1, parseInt(ranking, 10)))
      : null;

    if (parsedRanking !== null) {
      // Enforce unique ranking: clear this rank from any other podcast
      await prisma.podcast.updateMany({
        where: { ranking: parsedRanking },
        data: { ranking: null },
      });
    }

    const podcast = await prisma.podcast.create({
      data: {
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
        description: description || '',
        categoryId,
        authorId: authorId || null,
        language: language || 'en',
        coverImageKey: sanitizeStorageKey(coverImageKey),
        isFeatured: !!isFeatured,
        ranking: parsedRanking,
        status: 'published',
        createdById: userId,
      },
    });

    res.json({ success: true, data: podcast });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/podcasts/:id', adminsOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if ('ranking' in req.body) {
      body.ranking = req.body.ranking !== '' && req.body.ranking !== null && !isNaN(parseInt(req.body.ranking, 10))
        ? Math.min(5, Math.max(1, parseInt(req.body.ranking, 10)))
        : null;

      if (body.ranking !== null) {
        // Enforce unique ranking: clear this rank from any other podcast
        await prisma.podcast.updateMany({
          where: {
            ranking: body.ranking,
            id: { not: id },
          },
          data: { ranking: null },
        });
      }
    }

    const updated = await prisma.podcast.update({
      where: { id },
      data: {
        ...body,
        coverImageKey: sanitizeStorageKey(body.coverImageKey),
        ranking: body.ranking !== undefined ? body.ranking : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/podcasts/:id/episodes', adminsOnly, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: podcastId } = req.params;
    const { title, slug, description, episodeNumber, audioStorageKey, thumbnailKey, durationSeconds, status } = req.body;

    const episode = await prisma.podcastEpisode.create({
      data: {
        podcastId,
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
        description: description || '',
        episodeNumber: parseInt(episodeNumber, 10),
        audioStorageKey: sanitizeStorageKey(audioStorageKey),
        thumbnailKey: sanitizeStorageKey(thumbnailKey),
        durationSeconds: parseInt(durationSeconds || '0', 10),
        status: status || 'published',
        publishedAt: new Date(),
        createdById: userId,
      },
    });

    await prisma.podcast.update({
      where: { id: podcastId },
      data: { totalEpisodes: { increment: 1 } },
    });

    res.json({ success: true, data: episode });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── 7. Unified Media File Upload ───────────────────────────────────────────
router.post('/upload-media', adminsOnly, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }

  try {
    const subfolder = req.body.folder || 'community';
    const ext = file.originalname.split('.').pop() || 'bin';
    const key = `${subfolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const uploaded = await storageService.upload(file.buffer, key, file.mimetype);
    const presignedUrl = await storageService.getPresignedUrl(uploaded.path, 86400 * 7);

    res.json({
      success: true,
      data: {
        storageKey: uploaded.path,
        url: presignedUrl,
      },
    });
  } catch (err) {
    console.error('[Community Upload] S3 upload error:', err);
    // If S3 is unconfigured locally, provide a local data URL fallback so the UI never breaks
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    res.json({
      success: true,
      data: {
        storageKey: `local_${Date.now()}_${file.originalname}`,
        url: base64,
      },
    });
  }
});

module.exports = router;
