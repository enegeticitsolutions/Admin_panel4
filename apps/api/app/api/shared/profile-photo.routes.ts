import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getStorageService, resolveFileUrl } from '../../services/storage';

const router = Router();

// ─── Multer (memory storage) ──────────────────────────────────────────────────
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — no size restriction
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`));
    }
  },
});

/**
 * Upload buffer via the active storage provider and return both storage path and presigned URL.
 */
async function uploadFile(
  buffer: Buffer,
  path: string,
  mimeType: string
): Promise<{ storageKey: string; presignedUrl: string }> {
  const storage = getStorageService();
  const result = await storage.upload(buffer, path, mimeType);
  const presignedUrl = await storage.getPresignedUrl(result.path, 1800);
  return { storageKey: result.path, presignedUrl };
}

/**
 * Generate a unique storage path for a profile photo
 */
function generateProfilePath(entityType: string, entityId: string, originalName: string): string {
  const ext = originalName.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const uid = uuidv4().split('-')[0];
  return `profiles/${entityType}/${entityId}/${timestamp}_${uid}.${ext}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile-photo/upload
//
// Upload or update a profile photo for any authenticated user, or for a
// beneficiary managed by an authenticated subscriber.
//
// Form-data fields:
//   - file       : image file (required)
//   - targetType : 'self' | 'beneficiary' (default: 'self')
//   - targetId   : required when targetType = 'beneficiary'
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', authenticate, (req: any, res: any, next: any) => {
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('📸 [Profile Photo Upload] Multer error:', err.message);
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  const file = req.file;
  const userId = req.userId!;
  const targetType = (req.body.targetType as string) || 'self';
  const targetId = req.body.targetId as string | undefined;

  // DEBUG: log what we received
  console.log('\n📸 [Photo Upload] Incoming request:');
  console.log('   userId     :', userId);
  console.log('   targetType :', targetType);
  console.log('   targetId   :', targetId);
  console.log('   file       :', file ? `${file.originalname} (${file.mimetype}, ${file.size} bytes)` : 'MISSING');
  console.log('─────────────────────────────────────────\n');

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    // Fetch the requesting user's role (could be User or Volunteer)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        careCompanionProfile: true,
        beneficiaryProfile: true,
      },
    });

    let isVolunteer = false;
    let volunteer = null;

    if (!user) {
      volunteer = await prisma.volunteer.findUnique({
        where: { id: userId },
      });
      if (!volunteer) {
        return res.status(404).json({ success: false, message: 'User or Volunteer not found' });
      }
      isVolunteer = true;
    }

    let updatedEntity: any;

    if (targetType === 'self') {
      // ── Upload profile photo for the authenticated user themselves ───────────
      const mimeType = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
      const role = isVolunteer ? 'volunteer' : user!.role;
      const storagePath = generateProfilePath(role, userId, file.originalname);
      const { storageKey, presignedUrl } = await uploadFile(file.buffer, storagePath, mimeType);

      if (isVolunteer) {
        updatedEntity = await prisma.volunteer.update({
          where: { id: userId },
          data: { profilePhoto: storageKey },
          select: { id: true, name: true, profilePhoto: true },
        });
      } else if (user!.role === 'care_companion' && user!.careCompanionProfile) {
        // CC: update CareCompanion.photo
        updatedEntity = await prisma.careCompanion.update({
          where: { id: user!.careCompanionProfile.id },
          data: { photo: storageKey },
          select: { id: true, name: true, photo: true },
        });
        // Also update User.profilePhoto for consistency
        await prisma.user.update({ where: { id: userId }, data: { profilePhoto: storageKey } });
      } else if (user!.role === 'beneficiary' && user!.beneficiaryProfile) {
        // Beneficiary: update Beneficiary.photo
        updatedEntity = await prisma.beneficiary.update({
          where: { id: user!.beneficiaryProfile.id },
          data: { photo: storageKey },
          select: { id: true, name: true, photo: true },
        });
        await prisma.user.update({ where: { id: userId }, data: { profilePhoto: storageKey } });
      } else {
        // Subscriber (and any other role): update User.profilePhoto
        updatedEntity = await prisma.user.update({
          where: { id: userId },
          data: { profilePhoto: storageKey },
          select: { id: true, name: true, profilePhoto: true },
        });
      }

      return res.json({
        success: true,
        message: 'Profile photo updated successfully',
        url: presignedUrl,
        key: storageKey,
        data: updatedEntity,
      });
    }

    if (targetType === 'beneficiary') {
      // ── Subscriber uploading/updating a beneficiary's photo ──────────────────
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'targetId is required for beneficiary upload' });
      }

      // Verify this beneficiary belongs to the subscriber
      const beneficiary = await prisma.beneficiary.findFirst({
        where: { id: targetId, subscriberId: userId, isActive: true },
        select: { id: true, name: true, photo: true },
      });

      if (!beneficiary) {
        return res.status(403).json({
          success: false,
          message: 'Beneficiary not found or does not belong to this subscriber',
        });
      }

      const mimeType = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
      const storagePath = generateProfilePath('beneficiary', targetId, file.originalname);
      const { storageKey, presignedUrl } = await uploadFile(file.buffer, storagePath, mimeType);

      updatedEntity = await prisma.beneficiary.update({
        where: { id: targetId },
        data: { photo: storageKey },
        select: { id: true, name: true, photo: true },
      });

      return res.json({
        success: true,
        message: `${beneficiary.name}'s photo updated successfully`,
        url: presignedUrl,
        key: storageKey,
        data: updatedEntity,
      });
    }

    return res.status(400).json({ success: false, message: `Unknown targetType: ${targetType}` });
  } catch (error: any) {
    console.error('[profile-photo] Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profile-photo/me
// Returns the current user's profile photo URL
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let user: any = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, profilePhoto: true, name: true, role: true },
    });

    if (!user) {
      const volunteer = await prisma.volunteer.findUnique({
        where: { id: req.userId! },
        select: { id: true, profilePhoto: true, name: true },
      });
      if (!volunteer) return res.status(404).json({ success: false, message: 'User not found' });
      user = { ...volunteer, role: 'volunteer' };
    }

    if (user.profilePhoto) {
      user.profilePhoto = await resolveFileUrl(user.profilePhoto, 1800);
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
