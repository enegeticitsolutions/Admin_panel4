import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import { getStorageService } from '../../services/storage';
import { fileResourceRegistry } from '../../services/file-access/FileResourceRegistry';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/files/presigned?type=<resourceType>&id=<resourceId>
//
// Generates a short-lived presigned URL for secure file access.
//
// Flow:
//   1. Authenticate user (JWT)
//   2. Look up the FileResource handler for `type` in the registry
//   3. Call resource.getFileKey(id, userId) → authorization + fileKey lookup
//   4. Generate presigned URL via storage.getPresignedUrl(fileKey, ttl)
//   5. Return { url, expiresAt, ttlSeconds }
//
// Adding a new file type: register a new FileResource in main.ts.
// This route never changes.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/presigned', authenticate, async (req: AuthRequest, res: Response) => {
  const { type, id } = req.query as { type?: string; id?: string };
  const userId = req.userId!;

  if (!type || !id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required query parameters: type, id',
    });
  }

  const resource = fileResourceRegistry.get(type);
  if (!resource) {
    return res.status(400).json({
      success: false,
      message: `Unknown resource type: "${type}". Available types: ${fileResourceRegistry.types().join(', ')}`,
    });
  }

  try {
    const fileKey = await resource.getFileKey(id, userId);

    if (!fileKey) {
      return res.status(403).json({
        success: false,
        message: 'Access denied — you are not authorized to view this file.',
      });
    }

    const storage = getStorageService();
    const url = await storage.getPresignedUrl(fileKey, resource.ttlSeconds);
    const expiresAt = new Date(Date.now() + resource.ttlSeconds * 1000).toISOString();

    return res.json({
      success: true,
      url,
      expiresAt,
      ttlSeconds: resource.ttlSeconds,
    });
  } catch (error: any) {
    console.error(`[file-access] Presigned URL error (type=${type}, id=${id}):`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate file access URL.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/files/types
// Returns all registered resource types. Useful for debugging.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/types', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ success: true, types: fileResourceRegistry.types() });
});

export default router;
