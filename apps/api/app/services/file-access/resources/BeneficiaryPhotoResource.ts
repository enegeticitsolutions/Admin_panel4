import { FileResource } from '../FileResource';
import prisma from '../../../core/database';

/**
 * BeneficiaryPhotoResource
 *
 * Authorization rule:
 *   The requesting user must be the subscriber who owns this beneficiary.
 *   resourceId is the Beneficiary.id.
 *
 * Usage:
 *   GET /api/files/presigned?type=beneficiary_photo&id=<beneficiary.id>
 */
export class BeneficiaryPhotoResource extends FileResource {
  readonly resourceType = 'beneficiary_photo';
  readonly ttlSeconds = 1800; // 30 minutes — used in profile/card views

  async getFileKey(resourceId: string, userId: string): Promise<string | null> {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: {
        id: resourceId,
        subscriberId: userId,
        isActive: true,
      },
      select: { photoKey: true } as any,
    });

    return (beneficiary as any)?.photoKey ?? null;
  }
}
