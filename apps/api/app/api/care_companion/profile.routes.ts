import { Router, Request, Response } from 'express';
import { authenticate } from '../shared/deps';
import prisma from '../../core/database';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();

// GET /api/care-companion/profile
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId; // From authenticate middleware

    const cc = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        careCompanionProfile: true,
        staffProfile: true,
      },
    });

    if (!cc || !cc.careCompanionProfile) {
      return res.status(404).json({ success: false, message: 'Care Companion profile not found' });
    }

    // Calculate impact stats
    const totalVisits = await prisma.visit.count({
      where: { careCompanionId: cc.careCompanionProfile.id, status: 'completed' },
    });

    // Total hours = sum of durationMinutes / 60
    const visitsWithDuration = await prisma.visit.findMany({
      where: { careCompanionId: cc.careCompanionProfile.id, status: 'completed' },
      select: { durationMinutes: true },
    });
    const totalHours = visitsWithDuration.reduce((sum, v) => sum + (v.durationMinutes || 0), 0) / 60;

    const uniqueBeneficiaries = await prisma.visit.groupBy({
      by: ['beneficiaryId'],
      where: { careCompanionId: cc.careCompanionProfile.id },
    });

    const rawPhoto = cc.careCompanionProfile.photo || cc.profilePhoto;
    const resolvedPhoto = rawPhoto ? await resolveFileUrl(rawPhoto) : null;

    res.json({
      success: true,
      data: {
        name: cc.name,
        initials: cc.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'CC',
        photo: resolvedPhoto,
        role: 'Care Companion',
        verified: cc.isVerified,
        email: cc.email || '',
        phone: cc.phone,
        location: cc.careCompanionProfile.zone || cc.location || 'N/A',
        bio: cc.careCompanionProfile.bio || '',
        memberSince: cc.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        impact: {
          visits: totalVisits,
          hours: Math.round(totalHours),
          clients: uniqueBeneficiaries.length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/care-companion/profile - Update Care Companion Profile (Name, Phone, Email, Location, Bio)
router.put('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { name, email, phone, location, bio } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email !== undefined && typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    const trimmedPhone = phone !== undefined && typeof phone === 'string' ? phone.trim() : undefined;
    const trimmedLocation = location !== undefined && typeof location === 'string' ? location.trim() : undefined;
    const trimmedBio = bio !== undefined && typeof bio === 'string' ? bio.trim() : undefined;

    // Validate phone uniqueness if changing
    if (trimmedPhone) {
      const existingPhoneUser = await prisma.user.findFirst({
        where: {
          phone: trimmedPhone,
          id: { not: userId },
        },
      });
      if (existingPhoneUser) {
        return res.status(400).json({ success: false, message: 'This phone number is already registered to another account' });
      }
    }

    // Validate email uniqueness if changing
    if (trimmedEmail) {
      const existingEmailUser = await prisma.user.findFirst({
        where: {
          email: trimmedEmail,
          id: { not: userId },
        },
      });
      if (existingEmailUser) {
        return res.status(400).json({ success: false, message: 'This email address is already registered to another account' });
      }
    }

    // Build User update data
    const userUpdateData: any = { name: trimmedName };
    if (trimmedPhone !== undefined) {
      userUpdateData.phone = trimmedPhone;
    }
    if (trimmedEmail !== undefined) {
      userUpdateData.email = trimmedEmail || null;
    }
    if (trimmedLocation !== undefined) {
      userUpdateData.location = trimmedLocation;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    });

    // Update CareCompanion record
    const cc = await prisma.careCompanion.findUnique({ where: { userId } });
    if (cc) {
      const ccUpdateData: any = { name: trimmedName };
      if (trimmedLocation !== undefined) {
        ccUpdateData.zone = trimmedLocation;
      }
      if (trimmedBio !== undefined) {
        ccUpdateData.bio = trimmedBio;
      }
      await prisma.careCompanion.update({
        where: { userId },
        data: ccUpdateData,
      });
    }

    const finalLocation = trimmedLocation !== undefined
      ? trimmedLocation
      : (cc?.zone || updatedUser.location || 'N/A');

    const finalBio = trimmedBio !== undefined
      ? trimmedBio
      : (cc?.bio || '');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: updatedUser.name,
        email: updatedUser.email || '',
        phone: updatedUser.phone,
        location: finalLocation,
        bio: finalBio,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/care-companion/profile/assigned-beneficiaries
router.get('/assigned-beneficiaries', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const cc = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        careCompanionProfile: true,
      },
    });

    if (!cc || !cc.careCompanionProfile) {
      return res.status(404).json({ success: false, message: 'Care Companion profile not found' });
    }

    const beneficiaries = await prisma.beneficiary.findMany({
      where: {
        OR: [
          { primaryCcId: cc.careCompanionProfile.id },
          { secondaryCcId: cc.careCompanionProfile.id }
        ],
        isActive: true
      },
      include: {
        subscriber: {
          select: { name: true, phone: true }
        }
      }
    });

    res.json({ success: true, data: beneficiaries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
