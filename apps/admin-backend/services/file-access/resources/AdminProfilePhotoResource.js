const FileResource = require('../FileResource');
const { prisma } = require('../../../lib/prisma');

/**
 * AdminProfilePhotoResource
 *
 * Authorization rule:
 *   Any authenticated staff member can view any user's profile photo.
 *   Admin role checking is handled by staffOnly middleware on the route.
 *
 * resourceId can be:
 *   - a User.id (profilePhotoKey on User)
 *   - a CareCompanion.id (photo on CareCompanion → resolved to fileKey)
 *
 * Usage:
 *   GET /api/files/presigned?type=profile_photo&id=<userId>
 */
class AdminProfilePhotoResource extends FileResource {
  get resourceType() { return 'profile_photo'; }
  get ttlSeconds()   { return 1800; } // 30 minutes — profile pictures used in list views

  async getFileKey(resourceId, userId) {
    // Try User first
    const user = await prisma.user.findUnique({
      where: { id: resourceId },
      select: { profilePhoto: true },
    });
    if (user?.profilePhoto) return user.profilePhoto;

    // Try Volunteer (Sathi)
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: resourceId },
      select: { profilePhoto: true },
    });
    if (volunteer?.profilePhoto) return volunteer.profilePhoto;

    // Try CareCompanion by its ID directly
    const cc = await prisma.careCompanion.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (cc?.photo) return cc.photo;

    // Try Beneficiary
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (beneficiary?.photo) return beneficiary.photo;

    return null;
  }
}

module.exports = AdminProfilePhotoResource;
