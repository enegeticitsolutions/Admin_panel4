const FileResource = require('../FileResource');
const { prisma } = require('../../../lib/prisma');

/**
 * MedicalRecordResource (Admin Backend)
 *
 * Authorization:
 *   Admin / Operations / Staff authenticated users can view beneficiary medical records.
 *
 * Supports:
 *   - Direct fileKey
 *   - Legacy fileUrl key extraction fallback
 */
class MedicalRecordResource extends FileResource {
  get resourceType() { return 'medical_record'; }
  get ttlSeconds()   { return 900; } // 15 minutes

  extractKey(keyOrUrl) {
    if (!keyOrUrl) return null;
    if (!keyOrUrl.startsWith('http://') && !keyOrUrl.startsWith('https://')) {
      return keyOrUrl.replace(/^\//, '');
    }
    try {
      const url = new URL(keyOrUrl);
      let pathname = decodeURIComponent(url.pathname).replace(/^\//, '');
      const parts = pathname.split('/');
      if (parts[0] && (parts[0].includes('maihoonna') || parts[0].includes('staging') || parts[0].includes('media') || parts[0].includes('staff'))) {
        parts.shift();
        pathname = parts.join('/');
      }
      return pathname;
    } catch {
      return keyOrUrl;
    }
  }

  async getFileKey(resourceId, userId) {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: resourceId },
      select: { fileKey: true, fileUrl: true },
    });

    if (!record) return null;

    return record.fileKey || this.extractKey(record.fileUrl);
  }
}

module.exports = MedicalRecordResource;
