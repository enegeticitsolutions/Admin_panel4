import { FileResource } from '../FileResource';
import prisma from '../../../core/database';

/**
 * VisitImageResource
 *
 * Authorization rule:
 *   The user must be either:
 *     (a) the Care Companion assigned to the visit (CC's userId matches)
 *     (b) an admin or field manager (role-based access — handled by middleware before this)
 *
 * The imageKey encodes both visitId and image index:
 *   id format: "<visitId>/<imageIndex>"   e.g. "abc-123/2"
 *
 * Usage:
 *   GET /api/files/presigned?type=visit_image&id=<visitId>/<imageIndex>
 */
export class VisitImageResource extends FileResource {
  readonly resourceType = 'visit_image';
  // Visit images — 15 minutes (same as medical records)
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
        imageKeys: true,
        careCompanionId: true,
        careCompanion: { select: { userId: true } },
      } as any,
    });

    if (!visit) return null;

    // Authorization: must be the assigned CC
    const cc = (visit as any).careCompanion;
    if (!cc || cc.userId !== userId) return null;

    const imageKeys: string[] = JSON.parse((visit as any).imageKeys || '[]');
    const key = imageKeys[imageIndex];
    return key ?? null;
  }
}
