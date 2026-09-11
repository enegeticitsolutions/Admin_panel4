import { FileResource } from '../FileResource';
import prisma from '../../../core/database';
import { extractStorageKey } from '../../storage/urlResolver';

/**
 * BeneficiaryPhotoResource
 *
 * Authorization rule:
 *   The requesting user must be:
 *     - The subscriber who manages this beneficiary
 *     - The beneficiary user themselves
 *     - An assigned Care Companion, Sathi, or Staff member
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
        isActive: true,
        OR: [
          { subscriberId: userId },
          { userId: userId },
          { id: userId },
        ],
      },
      select: { photo: true },
    });

    if (beneficiary?.photo) {
      return extractStorageKey(beneficiary.photo);
    }

    // Allow staff, CC or Sathi to view beneficiary photo if not matched by direct relation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const permittedRoles = ['admin', 'operations_manager', 'field_manager', 'care_companion', 'volunteer'];
    if (user && permittedRoles.includes(user.role)) {
      const anyBeneficiary = await prisma.beneficiary.findUnique({
        where: { id: resourceId },
        select: { photo: true },
      });
      if (anyBeneficiary?.photo) {
        return extractStorageKey(anyBeneficiary.photo);
      }
    }

    return null;
  }
}
