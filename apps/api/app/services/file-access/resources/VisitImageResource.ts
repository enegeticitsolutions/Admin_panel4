import { FileResource } from '../FileResource';
import prisma from '../../../core/database';
import { extractStorageKey } from '../../storage/urlResolver';

/**
 * VisitImageResource
 *
 * Authorization rule:
 *   The user must be either:
 *     (a) the Care Companion assigned to the visit
 *     (b) the Subscriber whose beneficiary received the visit
 *     (c) the Beneficiary who received the visit
 *     (d) an admin or staff member
 *
 * The resourceId format:
 *   "<visitId>/<imageIndex>"   e.g. "abc-123/0"
 *
 * Usage:
 *   GET /api/files/presigned?type=visit_image&id=<visitId>/<imageIndex>
 */
export class VisitImageResource extends FileResource {
  readonly resourceType = 'visit_image';
  // Visit images — 15 minutes
  readonly ttlSeconds = 900;

  async getFileKey(resourceId: string, userId: string): Promise<string | null> {
    // resourceId format: "<visitId>/<imageIndex>"
    const slashIdx = resourceId.lastIndexOf('/');
    if (slashIdx === -1) return null;

    const visitId = resourceId.substring(0, slashIdx);
    const imageIndex = parseInt(resourceId.substring(slashIdx + 1), 10);
    if (isNaN(imageIndex)) return null;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: {
        imageUrls: true,
        beneficiaryId: true,
        beneficiary: {
          select: {
            subscriberId: true,
            userId: true,
          },
        },
        careCompanionId: true,
        careCompanion: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!visit) return null;

    // Authorization: CC, Subscriber, Beneficiary, or Staff
    const isCareCompanion = visit.careCompanion?.userId === userId;
    const isSubscriber = visit.beneficiary?.subscriberId === userId;
    const isBeneficiary = visit.beneficiary?.userId === userId || visit.beneficiaryId === userId;

    if (!isCareCompanion && !isSubscriber && !isBeneficiary) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const staffRoles = ['admin', 'operations_manager', 'field_manager'];
      if (!user || !staffRoles.includes(user.role)) {
        return null;
      }
    }

    let parsedList: string[] = [];
    const raw = visit.imageUrls;
    if (raw) {
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) parsedList = parsed;
        } catch {
          parsedList = raw.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
    }

    const targetItem = parsedList[imageIndex];
    if (!targetItem) return null;

    return extractStorageKey(targetItem);
  }
}
