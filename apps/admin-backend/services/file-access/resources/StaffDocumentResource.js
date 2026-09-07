const FileResource = require('../FileResource');
const { prisma } = require('../../../lib/prisma');

/**
 * StaffDocumentResource
 *
 * Authorization rule:
 *   Any authenticated staff member can access staff documents.
 *   Admin-level role checking is handled by the staffOnly middleware
 *   applied to the file-access route in server.js.
 *
 * Usage:
 *   GET /api/files/presigned?type=staff_document&id=<staffDocument.id>
 */
class StaffDocumentResource extends FileResource {
  get resourceType() { return 'staff_document'; }
  get ttlSeconds()   { return 900; } // 15 minutes — sensitive KYC documents

  async getFileKey(resourceId, userId) {
    // Staff authentication is already verified by the route middleware (staffOnly).
    // We just need to confirm the record exists.
    const doc = await prisma.staffDocument.findUnique({
      where: { id: resourceId },
      select: { fileKey: true },
    });

    return doc?.fileKey ?? null;
  }
}

module.exports = StaffDocumentResource;
