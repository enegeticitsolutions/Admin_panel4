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

  async getFileKey(resourceId: string, userId: string): Promise<string | null> {
    const record = await prisma.medicalRecord.findFirst({
      where: {
        id: resourceId,
        isActive: true,
        // Verify the beneficiary belongs to this subscriber
        beneficiary: {
          subscriberId: userId,
          isActive: true,
        },
      },
      select: { fileKey: true },
    });

    return record?.fileKey ?? null;
  }
}
