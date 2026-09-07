const express = require('express');
const router = express.Router();
const storageService = require('../services/storage');
const registry = require('../services/file-access/FileResourceRegistry');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/files/presigned?type=<resourceType>&id=<resourceId>
//
// Generates a short-lived presigned URL for secure file access from the admin panel.
//
// Authentication is handled by the staffOnly middleware applied in server.js.
// This route never changes — new file types are added via FileResourceRegistry.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/presigned', async (req, res) => {
  const { type, id } = req.query;
  const userId = req.user?.id;

  if (!type || !id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required query parameters: type, id',
    });
  }

  const resource = registry.get(type);
  if (!resource) {
    return res.status(400).json({
      success: false,
      message: `Unknown resource type: "${type}". Available: ${registry.types().join(', ')}`,
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

    const url = await storageService.getPresignedUrl(fileKey, resource.ttlSeconds);
    const expiresAt = new Date(Date.now() + resource.ttlSeconds * 1000).toISOString();

    return res.json({
      success: true,
      url,
      expiresAt,
      ttlSeconds: resource.ttlSeconds,
    });
  } catch (error) {
    console.error(`[file-access] Error (type=${type}, id=${id}):`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate file access URL.',
    });
  }
});

// GET /api/files/types — lists all registered types (for debugging)
router.get('/types', (req, res) => {
  res.json({ success: true, types: registry.types() });
});

module.exports = router;
