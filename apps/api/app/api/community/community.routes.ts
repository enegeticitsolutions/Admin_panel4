import { Router, Request, Response } from 'express';
import { authenticate, optionalAuthenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();

/** Helper to resolve raw S3 storage keys to fresh URLs */
async function resolveUrl(key?: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await resolveFileUrl(key);
  } catch {
    return null;
  }
}

function sortWithRanking(items: any[], dateField = 'publishedAt', dateAsc = false) {
  return [...items].sort((a, b) => {
    const rA = typeof a.ranking === 'number' && a.ranking >= 1 && a.ranking <= 5 ? a.ranking : null;
    const rB = typeof b.ranking === 'number' && b.ranking >= 1 && b.ranking <= 5 ? b.ranking : null;
    if (rA !== null && rB !== null) return rA - rB;
    if (rA !== null) return -1;
    if (rB !== null) return 1;
    const dA = new Date(a[dateField] || 0).getTime();
    const dB = new Date(b[dateField] || 0).getTime();
    return dateAsc ? dA - dB : dB - dA;
  });
}

// ─── GET /api/community/home ──────────────────────────────────────────────────
router.get('/home', optionalAuthenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  try {
    const now = new Date();

    const [eventsResult, blogs, podcasts, categories, userRegs] = await Promise.all([
      // Only upcoming or ongoing published events (exclude completed)
      (prisma as any).communityEvent.findMany({
        where: {
          status: 'published',
          endDateTime: { gte: now },
        },
        include: {
          category: { select: { id: true, name: true, slug: true, color: true } },
          host: { select: { id: true, name: true, designation: true, avatarKey: true } },
        },
      }),

      // Active blogs
      (prisma as any).blog.findMany({
        where: { status: 'published' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true, designation: true, avatarKey: true } },
        },
      }),

      // Active podcasts
      (prisma as any).podcast.findMany({
        where: { status: 'published' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          host: { select: { id: true, name: true } },
          _count: { select: { episodes: true } },
        },
      }),

      // Active Categories
      (prisma as any).contentCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),

      // User registrations if authenticated
      userId
        ? (prisma as any).eventRegistration.findMany({
            where: { userId, status: { not: 'cancelled' } },
            select: { eventId: true, id: true, status: true },
          })
        : [],
    ]);

    const regMap = new Map(userRegs.map((r: any) => [r.eventId, r]));
    const sortedEvents = sortWithRanking(eventsResult, 'startDateTime', true);
    const sortedBlogs = sortWithRanking(blogs, 'publishedAt', false).slice(0, 5);
    const sortedPodcasts = sortWithRanking(podcasts, 'createdAt', false).slice(0, 5);

    // Resolve media URLs
    const nowMs = now.getTime();
    const resolvedEvents = await Promise.all(
      sortedEvents.map(async (e: any) => {
        const eventStart = new Date(e.startDateTime).getTime();
        const eventEnd = new Date(e.endDateTime).getTime();
        const timelineStatus = nowMs >= eventStart && nowMs <= eventEnd ? 'ongoing' : nowMs < eventStart ? 'upcoming' : 'past';

        return {
          ...e,
          timelineStatus,
          isRegistered: regMap.has(e.id),
          userRegistration: regMap.get(e.id) || null,
          resolvedThumbnailUrl: await resolveUrl(e.thumbnailKey),
        };
      })
    );

    const resolvedBlogs = await Promise.all(
      sortedBlogs.map(async (b: any) => ({
        ...b,
        resolvedThumbnailUrl: await resolveUrl(b.thumbnailKey),
        author: b.author
          ? { ...b.author, avatarUrl: await resolveUrl(b.author.avatarKey) }
          : null,
      }))
    );

    const resolvedPodcasts = await Promise.all(
      sortedPodcasts.map(async (p: any) => ({
        ...p,
        resolvedCoverUrl: await resolveUrl(p.coverImageKey),
      }))
    );

    res.json({
      success: true,
      data: {
        events: resolvedEvents,
        blogs: resolvedBlogs,
        podcasts: resolvedPodcasts,
        categories,
      },
    });
  } catch (err: any) {
    console.error('[Community API] Error fetching home:', err);
    res.status(500).json({ success: false, message: 'Server error loading community content' });
  }
});

// ─── GET /api/community/events ────────────────────────────────────────────────
router.get('/events', optionalAuthenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  try {
    const { categoryId, type, language, timeline } = req.query;
    const now = new Date();
    const where: any = {
      status: 'published',
    };
    if (timeline === 'past') {
      where.endDateTime = { lt: now };
    } else if (timeline === 'ongoing') {
      where.startDateTime = { lte: now };
      where.endDateTime = { gte: now };
    } else if (timeline === 'all') {
      // return all events
    } else {
      // default: active (upcoming & ongoing)
      where.endDateTime = { gte: now };
    }
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;
    if (type) where.eventType = type;
    if (language) where.language = language;

    const [events, userRegs] = await Promise.all([
      (prisma as any).communityEvent.findMany({
        where,
        include: {
          category: true,
          host: true,
        },
      }),
      userId
        ? (prisma as any).eventRegistration.findMany({
            where: { userId, status: { not: 'cancelled' } },
            select: { eventId: true, id: true, status: true },
          })
        : [],
    ]);

    const regMap = new Map(userRegs.map((r: any) => [r.eventId, r]));
    const sortedEvents = sortWithRanking(events, 'startDateTime', true);

    const data = await Promise.all(
      sortedEvents.map(async (e: any) => {
        const eventStart = new Date(e.startDateTime).getTime();
        const eventEnd = new Date(e.endDateTime).getTime();
        const nowMs = now.getTime();
        const timelineStatus = nowMs >= eventStart && nowMs <= eventEnd ? 'ongoing' : nowMs < eventStart ? 'upcoming' : 'past';

        return {
          ...e,
          timelineStatus,
          isRegistered: regMap.has(e.id),
          userRegistration: regMap.get(e.id) || null,
          resolvedThumbnailUrl: await resolveUrl(e.thumbnailKey),
        };
      })
    );

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/community/events/:id ────────────────────────────────────────────
router.get('/events/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { id } = req.params;

  try {
    const event = await (prisma as any).communityEvent.findUnique({
      where: { id },
      include: {
        category: true,
        host: true,
      },
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    let userRegistration = null;
    if (authReq.userId) {
      userRegistration = await (prisma as any).eventRegistration.findFirst({
        where: { eventId: id, userId: authReq.userId, status: { not: 'cancelled' } },
      });
    }

    const resolvedEvent = {
      ...event,
      resolvedThumbnailUrl: await resolveUrl(event.thumbnailKey),
      host: event.host
        ? { ...event.host, avatarUrl: await resolveUrl(event.host.avatarKey) }
        : null,
    };

    res.json({
      success: true,
      data: {
        event: resolvedEvent,
        userRegistration,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/community/events/:id/register ──────────────────────────────────
router.post('/events/:id/register', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { id: eventId } = req.params;
  const userId = authReq.userId!;

  try {
    const event = await (prisma as any).communityEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Event is not open for registration.' });
    }

    // Check Package Entitlement if Event is Subscribers Only
    if (event.accessTier === 'subscribers_only') {
      const activeSub = await (prisma as any).subscription.findFirst({
        where: {
          subscriberId: userId,
          status: 'active',
        },
      });

      const careCircleSub = !activeSub
        ? await (prisma as any).careCircleMember.findFirst({
            where: {
              userId,
              status: 'active',
              beneficiary: {
                subscriptions: {
                  some: { status: 'active' },
                },
              },
            },
          })
        : null;

      if (!activeSub && !careCircleSub) {
        return res.status(403).json({
          success: false,
          message: 'This exclusive community event is reserved for subscribers with an active care plan package.',
        });
      }
    }

    // Atomic transaction for capacity and registration
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const existing = await tx.eventRegistration.findFirst({
        where: { eventId, userId, status: { in: ['confirmed', 'waitlisted'] } },
      });

      if (existing) {
        return { alreadyRegistered: true, registration: existing };
      }

      const isCapacityFull = event.currentRegistrations >= event.maxCapacity;
      const status = isCapacityFull ? 'waitlisted' : 'confirmed';

      const registration = await tx.eventRegistration.create({
        data: {
          eventId,
          userId,
          status,
          waitlistNumber: isCapacityFull ? event.currentRegistrations - event.maxCapacity + 1 : null,
        },
      });

      if (status === 'confirmed') {
        await tx.communityEvent.update({
          where: { id: eventId },
          data: { currentRegistrations: { increment: 1 } },
        });
      }

      return { registration };
    });

    res.json({
      success: true,
      message: result.alreadyRegistered ? 'Already registered' : 'Registration completed successfully',
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/community/events/:id/register ────────────────────────────────
router.delete('/events/:id/register', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { id: eventId } = req.params;
  const userId = authReq.userId!;

  try {
    const registration = await (prisma as any).eventRegistration.findFirst({
      where: { eventId, userId, status: { in: ['confirmed', 'waitlisted'] } },
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Active registration not found' });
    }

    await (prisma as any).$transaction(async (tx: any) => {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      if (registration.status === 'confirmed') {
        await tx.communityEvent.update({
          where: { id: eventId },
          data: { currentRegistrations: { decrement: 1 } },
        });

        // Promote first waitlisted member if available
        const nextInLine = await tx.eventRegistration.findFirst({
          where: { eventId, status: 'waitlisted' },
          orderBy: { createdAt: 'asc' },
        });

        if (nextInLine) {
          await tx.eventRegistration.update({
            where: { id: nextInLine.id },
            data: { status: 'confirmed', waitlistNumber: null },
          });
          await tx.communityEvent.update({
            where: { id: eventId },
            data: { currentRegistrations: { increment: 1 } },
          });
        }
      }
    });

    res.json({ success: true, message: 'Registration cancelled successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/community/blogs ─────────────────────────────────────────────────
router.get('/blogs', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { categoryId, language } = req.query;
    const where: any = { status: 'published' };
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;
    if (language) where.language = language;

    const blogs = await (prisma as any).blog.findMany({
      where,
      include: {
        category: true,
        author: true,
      },
    });

    const sortedBlogs = sortWithRanking(blogs, 'publishedAt', false);

    const data = await Promise.all(
      sortedBlogs.map(async (b: any) => ({
        ...b,
        resolvedThumbnailUrl: await resolveUrl(b.thumbnailKey),
        author: b.author ? { ...b.author, avatarUrl: await resolveUrl(b.author.avatarKey) } : null,
      }))
    );

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/community/blogs/:id ─────────────────────────────────────────────
router.get('/blogs/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { id } = req.params;

  try {
    const blog = await (prisma as any).blog.findUnique({
      where: { id },
      include: {
        category: true,
        author: true,
      },
    });

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog article not found' });
    }

    // Increment view counter asynchronously
    (prisma as any).blog.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    let userLiked = false;
    let userBookmarked = false;

    if (authReq.userId) {
      const [like, bookmark] = await Promise.all([
        (prisma as any).contentLike.findFirst({
          where: { blogId: id, userId: authReq.userId },
        }),
        (prisma as any).contentBookmark.findFirst({
          where: { blogId: id, userId: authReq.userId },
        }),
      ]);
      userLiked = !!like;
      userBookmarked = !!bookmark;
    }

    const resolvedBlog = {
      ...blog,
      resolvedThumbnailUrl: await resolveUrl(blog.thumbnailKey),
      author: blog.author ? { ...blog.author, avatarUrl: await resolveUrl(blog.author.avatarKey) } : null,
    };

    res.json({
      success: true,
      data: {
        blog: resolvedBlog,
        userLiked,
        userBookmarked,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/community/podcasts ──────────────────────────────────────────────
router.get('/podcasts', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.query;
    const where: any = { status: 'published' };
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;

    const podcasts = await (prisma as any).podcast.findMany({
      where,
      include: {
        category: true,
        host: true,
        _count: { select: { episodes: true } },
      },
    });

    const sortedPodcasts = sortWithRanking(podcasts, 'createdAt', false);

    const data = await Promise.all(
      sortedPodcasts.map(async (p: any) => ({
        ...p,
        resolvedCoverUrl: await resolveUrl(p.coverImageKey),
      }))
    );

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/community/podcasts/:id ──────────────────────────────────────────
router.get('/podcasts/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const podcast = await (prisma as any).podcast.findUnique({
      where: { id },
      include: {
        host: true,
        episodes: {
          where: { status: 'published' },
          orderBy: { episodeNumber: 'desc' },
        },
      },
    });

    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast show not found' });
    }

    const resolvedCoverUrl = await resolveUrl(podcast.coverImageKey);
    const episodes = await Promise.all(
      podcast.episodes.map(async (ep: any) => ({
        ...ep,
        resolvedAudioUrl: await resolveUrl(ep.audioStorageKey),
      }))
    );

    res.json({
      success: true,
      data: {
        podcast: { ...podcast, resolvedCoverUrl },
        episodes,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/community/interactions/like ────────────────────────────────────
router.post('/interactions/like', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { itemType, blogId, podcastEpisodeId } = req.body;
  const userId = authReq.userId!;

  try {
    const existing = await (prisma as any).contentLike.findFirst({
      where: {
        userId,
        itemType,
        blogId: blogId || null,
        podcastEpisodeId: podcastEpisodeId || null,
      },
    });

    if (existing) {
      await (prisma as any).contentLike.delete({ where: { id: existing.id } });
      if (blogId) {
        await (prisma as any).blog.update({
          where: { id: blogId },
          data: { likeCount: { decrement: 1 } },
        });
      }
      return res.json({ success: true, liked: false });
    } else {
      await (prisma as any).contentLike.create({
        data: {
          userId,
          itemType,
          blogId: blogId || null,
          podcastEpisodeId: podcastEpisodeId || null,
        },
      });
      if (blogId) {
        await (prisma as any).blog.update({
          where: { id: blogId },
          data: { likeCount: { increment: 1 } },
        });
      }
      return res.json({ success: true, liked: true });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/community/interactions/bookmark ────────────────────────────────
router.post('/interactions/bookmark', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { itemType, eventId, blogId, podcastEpisodeId } = req.body;
  const userId = authReq.userId!;

  try {
    const existing = await (prisma as any).contentBookmark.findFirst({
      where: {
        userId,
        itemType,
        eventId: eventId || null,
        blogId: blogId || null,
        podcastEpisodeId: podcastEpisodeId || null,
      },
    });

    if (existing) {
      await (prisma as any).contentBookmark.delete({ where: { id: existing.id } });
      return res.json({ success: true, bookmarked: false });
    } else {
      await (prisma as any).contentBookmark.create({
        data: {
          userId,
          itemType,
          eventId: eventId || null,
          blogId: blogId || null,
          podcastEpisodeId: podcastEpisodeId || null,
        },
      });
      return res.json({ success: true, bookmarked: true });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

