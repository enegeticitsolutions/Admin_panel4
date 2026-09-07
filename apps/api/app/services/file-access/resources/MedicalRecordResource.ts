import { FileResource } from '../FileResource';
import prisma from '../../../core/database';

/**
 * MedicalRecordResource
 *
 * Authorization rule:
 *   The requesting user must be the subscriber who owns the beneficiary
 *   that this medical record belongs to.
 *
 * Usage:
 *   GET /api/files/presigned?type=medical_record&id=<medicalRecord.id>
 */
export class MedicalRecordResource extends FileResource {
  readonly resourceType = 'medical_record';
  // Medical records are sensitive — limit URL lifetime to 15 minutes
  readonly ttlSeconds = 900;

  private extractKey(keyOrUrl?: string | null): string | null {
    if (!keyOrUrl) return null;
    if (!keyOrUrl.startsWith('http://') && !keyOrUrl.startsWith('https://')) {
      return keyOrUrl.replace(/^\//, '');
    }
    try {
      const url = new URL(keyOrUrl);
      let pathname = decodeURIComponent(url.pathname).replace(/^\//, '');
      const parts = pathname.split('/');
      // If path starts with bucket name, strip it
      if (parts[0] && (parts[0].includes('maihoonna') || parts[0].includes('staging') || parts[0].includes('media') || parts[0].includes('staff'))) {
        parts.shift();
        pathname = parts.join('/');
      }
      return pathname;
    } catch {
      return keyOrUrl;
    }
  }

  async getFileKey(resourceId: string, userId: string): Promise<string | null> {
    // Check if user is the uploader, the subscriber, or the beneficiary themselves
    const record = await prisma.medicalRecord.findFirst({
      where: {
        id: resourceId,
        isActive: true,
        OR: [
          { uploadedBy: userId },
          {
            beneficiary: {
              OR: [
                { subscriberId: userId },
                { userId: userId },
                { id: userId },
              ],
            },
          },
        ],
      },
      select: { fileKey: true, fileUrl: true },
    });

    if (!record) {
      // Also allow if user is an admin or care companion assigned to care
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const staffRoles = ['admin', 'operations_manager', 'field_manager', 'care_companion'];
      if (user && staffRoles.includes(user.role)) {
        const staffRecord = await prisma.medicalRecord.findUnique({
          where: { id: resourceId },
          select: { fileKey: true, fileUrl: true },
        });
        if (staffRecord) {
          return staffRecord.fileKey || this.extractKey(staffRecord.fileUrl);
        }
      }
      return null;
    }

    return record.fileKey || this.extractKey(record.fileUrl);
  }
}
