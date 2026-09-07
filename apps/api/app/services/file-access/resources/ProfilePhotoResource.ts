import { FileResource } from '../FileResource';
import prisma from '../../../core/database';

/**
 * ProfilePhotoResource
 *
 * Authorization rule:
 *   The requesting user can view their own profile photo.
 *   The resourceId is the userId whose photo is being requested.
 *
 * Note: Profile photos are lower sensitivity than medical docs, but we keep
 * them behind the presigned URL system for consistency and future-proofing.
 * Profile photos are stored in User.profilePhotoKey.
 *
 * Usage:
 *   GET /api/files/presigned?type=profile_photo&id=<userId>
 */
export class ProfilePhotoResource extends FileResource {
  readonly resourceType = 'profile_photo';
  // Profile photos — slightly longer TTL (30 min) since they're used in many list views
  readonly ttlSeconds = 1800;

  async getFileKey(resourceId: string, userId: string): Promise<string | null> {
    // Users can only access their own profile photo via this endpoint
    // For admin access to other users' photos, use StaffProfilePhotoResource (admin-backend)
    if (resourceId !== userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoKey: true } as any,
    });

    return (user as any)?.profilePhotoKey ?? null;
  }
}
