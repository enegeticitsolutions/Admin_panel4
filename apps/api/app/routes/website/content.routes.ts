import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();

/**
 * GET /api/website/health
 * Simple health check for the website API.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'Website API running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/website/content/sathi
 * Returns dynamic CMS content for the Saathi page, active Saathi profiles,
 * and live aggregate stats (volunteer count & total hours).
 */
router.get('/content/sathi', async (_req: Request, res: Response) => {
  try {
    const content = await (prisma as any).websiteContent.findUnique({
      where: { pageKey: 'sathi_page' },
    });

    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Fetch up to 4 approved volunteers for the "Meet our Saathis" section
    const saathisRaw = await (prisma as any).volunteer.findMany({
      where: { applicationStatus: 'APPROVED', showOnWebsite: true },
      take: 4,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        streetArea: true,
        totalCreditHours: true,
        profilePhoto: true,
      },
    });

    const saathis = await Promise.all(saathisRaw.map(async (s: any) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      state: s.state,
      area: s.streetArea || null,
      totalCreditHours: s.totalCreditHours || 0,
      profilePhoto: s.profilePhoto ? await resolveFileUrl(s.profilePhoto) : null,
    })));

    // Aggregate live stats for the hero section
    const volunteerStats = await (prisma as any).volunteer.aggregate({
      where: { applicationStatus: 'APPROVED' },
      _count: true,
      _sum: { totalCreditHours: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        content: content.content,
        saathis,
        liveStats: {
          activeCount: volunteerStats._count || 0,
          totalHours: volunteerStats._sum.totalCreditHours || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [Website Content Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching content.',
    });
  }
});

/**
 * GET /api/website/content/home
 * Returns dynamic CMS content for the Home page, including testimonials.
 */
router.get('/content/home', async (_req: Request, res: Response) => {
  try {
    const content = await (prisma as any).websiteContent.findUnique({
      where: { pageKey: 'home_page' },
    });

    if (!content) {
      return res.status(404).json({ success: false, message: 'Home page content not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        content: content.content,
      },
    });
  } catch (error: any) {
    console.error('❌ [Website Home Content Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching home page content.',
    });
  }
});

/**
 * GET /api/website/content/legal
 * Returns all active legal policies ordered by sortOrder
 */
router.get('/content/legal', async (_req: Request, res: Response) => {
  try {
    const policies = await (prisma as any).legalPolicy.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return res.status(200).json({
      success: true,
      count: policies.length,
      data: policies,
    });
  } catch (error: any) {
    console.error('❌ [Website Legal Policies Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching legal policies.',
    });
  }
});

/**
 * GET /api/website/content/legal/:slug
 * Returns a single legal policy by its slug (e.g., terms, privacy, refund, cookie, child-safety)
 */
router.get('/content/legal/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const policy = await (prisma as any).legalPolicy.findFirst({
      where: {
        slug: slug.toLowerCase(),
        isActive: true,
      },
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `Legal policy with slug '${slug}' not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    console.error('❌ [Website Legal Policy By Slug Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching legal policy.',
    });
  }
});

/**
 * GET /api/website/content/legacy-circle
 * Returns all approved Legacy Circle senior expert profiles with their beneficiary data for the website.
 */
router.get('/content/legacy-circle', async (_req: Request, res: Response) => {
  try {
    const profiles = await (prisma as any).legacyCircleProfile.findMany({
      where: { status: 'approved', isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        beneficiary: {
          select: {
            id: true,
            name: true,
            photo: true,
            city: true,
            state: true,
            age: true,
            gender: true,
          },
        },
      },
    });

    const AVATAR_COLORS = ["#fe6700", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

    const experts = await Promise.all(
      profiles.map(async (p: any, idx: number) => {
        const b = p.beneficiary || {};
        const photoUrl = b.photo ? await resolveFileUrl(b.photo) : null;
        const expNum = parseInt(String(p.yearsOfExperience || '').replace(/\D/g, ''), 10) || 25;

        return {
          id: p.id,
          name: b.name || p.title || 'Senior Advisor',
          role: p.title || 'Consultant & Advisor',
          company: p.industry || 'Domain Specialist',
          location: b.city || 'Delhi NCR',
          experience: expNum,
          domain: p.industry || 'Strategy & Consulting',
          email: p.email || '',
          bio: p.headline || '',
          tags: p.industry ? [p.industry] : ['Advisory', 'Consulting'],
          profilePhoto: photoUrl,
          photoUrl: photoUrl,
          avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          verified: true,
          status: p.status,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: experts.length,
      data: experts,
    });
  } catch (error: any) {
    console.error('❌ [Website Legacy Circle Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching Legacy Circle profiles.',
    });
  }
});

/**
 * GET /api/website/content/legacy-circle/:id
 * Returns a specific approved Legacy Circle senior expert profile by ID.
 */
router.get('/content/legacy-circle/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await (prisma as any).legacyCircleProfile.findFirst({
      where: { 
        id, 
        status: 'approved',
        isActive: true
      },
      include: {
        beneficiary: {
          select: {
            id: true,
            name: true,
            photo: true,
            city: true,
            state: true,
            age: true,
            gender: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: `Approved Legacy Circle profile not found.`,
      });
    }

    const b = profile.beneficiary || {};
    const photoUrl = b.photo ? await resolveFileUrl(b.photo) : null;
    const expNum = parseInt(String(profile.yearsOfExperience || '').replace(/\D/g, ''), 10) || 25;

    const expert = {
      id: profile.id,
      name: b.name || profile.title || 'Senior Advisor',
      role: profile.title || 'Consultant & Advisor',
      company: profile.industry || 'Domain Specialist',
      location: b.city || 'Delhi NCR',
      experience: expNum,
      domain: profile.industry || 'Strategy & Consulting',
      email: profile.email || '',
      bio: profile.headline || '',
      tags: profile.industry ? [profile.industry] : ['Advisory', 'Consulting'],
      profilePhoto: photoUrl,
      photoUrl: photoUrl,
      avatarColor: "#fe6700", // Default single color for detail view
      verified: true,
      status: profile.status,
    };

    return res.status(200).json({
      success: true,
      data: expert,
    });
  } catch (error: any) {
    console.error('❌ [Website Legacy Circle By Id Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching Legacy Circle profile.',
    });
  }
});

/**
 * POST /api/website/content/legacy-circle/:id/request-connection
 * Increments the connection request count for a specific Legacy Circle profile.
 */
router.post('/content/legacy-circle/:id/request-connection', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // First check if profile exists and is approved
    const existingProfile = await (prisma as any).legacyCircleProfile.findFirst({
      where: { id, status: 'approved', isActive: true },
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'Approved Legacy Circle profile not found.',
      });
    }

    // Increment count
    await (prisma as any).legacyCircleProfile.update({
      where: { id },
      data: { connectRequests: { increment: 1 } },
    });

    return res.status(200).json({
      success: true,
      message: 'Connection request count updated successfully.',
    });
  } catch (error: any) {
    console.error('❌ [Website Legacy Circle Request Connection Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating connection requests.',
    });
  }
});
export default router;

