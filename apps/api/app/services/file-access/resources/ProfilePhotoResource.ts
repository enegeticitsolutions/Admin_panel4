import { FileResource } from '../FileResource';
import prisma from '../../../core/database';
import { extractStorageKey } from '../../storage/urlResolver';

/**
 * ProfilePhotoResource
 *
 * Authorization rule:
 *   Authenticated users can view profile photos.
 *   resourceId can be:
 *     - 'me' (resolves to the requesting user's own photo)
 *     - a User.id (User.profilePhoto)
 *     - a Volunteer.id (Volunteer.profilePhoto)
 *     - a CareCompanion.id (CareCompanion.photo)
 *
 * Usage:
 *   GET /api/files/presigned?type=profile_photo&id=<userId|me>
 */
export class ProfilePhotoResource extends FileResource {
  readonly resourceType = 'profile_photo';
  // Profile photos — 30 min TTL
  readonly ttlSeconds = 1800;

  async getFileKey(resourceId: string, userId: string): Promise<string | null> {
    const targetId = resourceId === 'me' ? userId : resourceId;

    // 1. Check User table
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { profilePhoto: true },
    });

    if (user?.profilePhoto) {
      return extractStorageKey(user.profilePhoto);
    }

    // 2. Check Volunteer (Sathi) table
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: targetId },
      select: { profilePhoto: true },
    });

    if (volunteer?.profilePhoto) {
      return extractStorageKey(volunteer.profilePhoto);
    }

    // 3. Check CareCompanion table by CC id
    const careCompanion = await prisma.careCompanion.findUnique({
      where: { id: targetId },
      select: { photo: true },
    });

    if (careCompanion?.photo) {
      return extractStorageKey(careCompanion.photo);
    }

    return null;
  }
}
