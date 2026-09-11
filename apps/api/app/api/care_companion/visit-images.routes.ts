import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getStorageService, resolveFileUrls, extractStorageKey } from '../../services/storage';

const router = Router();

// ─── Config from .env ─────────────────────────────────────────────────────────

const VISIT_IMAGE_MAX_COUNT = parseInt(process.env.VISIT_IMAGE_MAX_COUNT || '10', 10);
const VISIT_IMAGE_MAX_SIZE_MB = parseFloat(process.env.VISIT_IMAGE_MAX_SIZE_MB || '25');
const VISIT_IMAGE_ALLOWED_TYPES = (
  process.env.VISIT_IMAGE_ALLOWED_TYPES ||
  'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif'
)
  .split(',')
  .map(t => t.trim());

// ─── Multer (memory storage) ──────────────────────────────────────────────────

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VISIT_IMAGE_MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (VISIT_IMAGE_ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${VISIT_IMAGE_ALLOWED_TYPES.join(', ')}`));
    }
  },
});

// ─── Storage (provider-agnostic) ────────────────────────────────────────────

/** Upload a buffer via the active storage provider and return storageKey and presigned URL. */
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

/** Safely parse the imageUrls JSON string field → string array.
 *  Accepts the Prisma-generated type which may be string | string[] | null | undefined.
 */
function parseImageUrls(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) as string[]; }
  catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/care-companion/visit-images/config
// Returns upload limits from .env. Mobile app fetches this once on screen
// mount so limits are never hardcoded in the app.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/config', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      maxImages: VISIT_IMAGE_MAX_COUNT,
      maxFileSizeMB: VISIT_IMAGE_MAX_SIZE_MB,
      allowedTypes: VISIT_IMAGE_ALLOWED_TYPES,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/care-companion/visit-images/:visitId
// Returns the current array of presigned image URLs for a visit.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:visitId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const visitId = req.params.visitId as string;
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    const keys = parseImageUrls((visit as any).imageUrls);
    const presignedUrls = await resolveFileUrls(keys, 1800);
    res.json({ success: true, data: { imageUrls: presignedUrls } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/care-companion/visit-images/:visitId
// Upload one image for a visit.
// Body: multipart/form-data, field "file"
// Response: { success, url, totalImages, maxImages }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:visitId', authenticate, (req: any, res: any, next: any) => {
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('📸 [Visit Image Upload] Multer error:', err.message);
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  const file = req.file;
  const visitId = req.params.visitId as string;
  const userId = req.userId!;

  console.log(`\n📸 [Visit Image Upload] visitId=${visitId} userId=${userId}`);
  console.log(`   file: ${file ? `${file.originalname} (${file.mimetype}, ${file.size}B)` : 'MISSING'}`);

  if (!file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

  try {
    // Fetch visit + CC (for authorisation check)
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit || !visit.careCompanionId) return res.status(404).json({ success: false, message: 'Visit not found or unassigned.' });

    // Resolve the CC's userId for authorisation
    const cc = await prisma.careCompanion.findUnique({
      where: { id: visit.careCompanionId },
      select: { userId: true },
    });
    if (!cc) return res.status(404).json({ success: false, message: 'Care Companion not found.' });
    if (cc.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this visit.' });
    }

    // Enforce max image count
    const existing = parseImageUrls((visit as any).imageUrls);
    if (existing.length >= VISIT_IMAGE_MAX_COUNT) {
      return res.status(400).json({
        success: false,
        message: `Maximum of ${VISIT_IMAGE_MAX_COUNT} images already reached for this visit.`,
      });
    }

    // Generate unique storage path: visits/{visitId}/{timestamp}_{uid}.ext
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const uid = uuidv4().split('-')[0];
    const storagePath = `visits/${visitId}/${Date.now()}_${uid}.${ext}`;

    const mimeType = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
    const { storageKey, presignedUrl } = await uploadFile(file.buffer, storagePath, mimeType);

    // Append the storage key and persist
    const updated = [...existing, storageKey];
    await prisma.visit.update({
      where: { id: visitId },
      data: { imageUrls: JSON.stringify(updated) },
    });

    console.log(`   ✅ Uploaded → ${storageKey} (${updated.length}/${VISIT_IMAGE_MAX_COUNT})`);

    res.json({
      success: true,
      message: 'Image uploaded successfully.',
      url: presignedUrl,
      key: storageKey,
      totalImages: updated.length,
      maxImages: VISIT_IMAGE_MAX_COUNT,
    });
  } catch (err: any) {
    console.error('[visit-images] Upload error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/care-companion/visit-images/:visitId
// Remove one image URL from the visit's imageUrls array.
// Body: { "url": "https://..." or "visits/..." }
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:visitId', authenticate, async (req: AuthRequest, res: Response) => {
  const visitId = req.params.visitId as string;
  const { url } = req.body as { url: string };
  const userId = req.userId!;

  if (!url) return res.status(400).json({ success: false, message: 'url is required in request body.' });

  try {
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit || !visit.careCompanionId) return res.status(404).json({ success: false, message: 'Visit not found or unassigned.' });

    const cc = await prisma.careCompanion.findUnique({
      where: { id: visit.careCompanionId },
      select: { userId: true },
    });
    if (!cc || cc.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this visit.' });
    }

    const existing = parseImageUrls((visit as any).imageUrls);
    const targetKey = extractStorageKey(url) || url;
    const updated = existing.filter(u => u !== url && extractStorageKey(u) !== targetKey);

    if (updated.length === existing.length) {
      return res.status(404).json({ success: false, message: 'Image URL not found in this visit.' });
    }

    await prisma.visit.update({
      where: { id: visitId },
      data: { imageUrls: JSON.stringify(updated) },
    });

    res.json({ success: true, message: 'Image removed.', totalImages: updated.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
