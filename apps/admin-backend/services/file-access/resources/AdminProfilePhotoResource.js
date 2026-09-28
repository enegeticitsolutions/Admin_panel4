const FileResource = require('../FileResource');
const { prisma } = require('../../../lib/prisma');
const { extractStorageKey } = require('../../storage/urlResolver');

/**
 * AdminProfilePhotoResource
 *
 * Authorization rule:
 *   Any authenticated staff member can view any user's profile photo.
 *   Admin role checking is handled by staffOnly middleware on the route.
 *
 * resourceId can be:
 *   - a User.id (profilePhoto on User)
 *   - a CareCompanion.id
 *   - an OperationsManager.id
 *   - a FieldManager.id
 *   - a CustomerServiceAgent.id
 *   - a Volunteer.id
 *   - a Beneficiary.id
 *
 * Usage:
 *   GET /api/files/presigned?type=profile_photo&id=<userId>
 */
class AdminProfilePhotoResource extends FileResource {
  get resourceType() { return 'profile_photo'; }
  get ttlSeconds()   { return 1800; } // 30 minutes — profile pictures used in list views

  async getFileKey(resourceId, userId) {
    const clean = (val) => (val ? (extractStorageKey(val) || val) : null);

    // Try User first
    const user = await prisma.user.findUnique({
      where: { id: resourceId },
      select: { profilePhoto: true },
    });
    if (user?.profilePhoto) return clean(user.profilePhoto);

    // Try OperationsManager by its ID directly
    const om = await prisma.operationsManager.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (om?.photo) return clean(om.photo);

    // Try FieldManager by its ID directly
    const fm = await prisma.fieldManager.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (fm?.photo) return clean(fm.photo);

    // Try CareCompanion by its ID directly
    const cc = await prisma.careCompanion.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (cc?.photo) return clean(cc.photo);

    // Try CustomerServiceAgent by its ID directly
    const csa = await prisma.customerServiceAgent.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (csa?.photo) return clean(csa.photo);

    // Try Volunteer (Sathi)
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: resourceId },
      select: { profilePhoto: true },
    });
    if (volunteer?.profilePhoto) return clean(volunteer.profilePhoto);

    // Try Beneficiary
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: resourceId },
      select: { photo: true },
    });
    if (beneficiary?.photo) return clean(beneficiary.photo);

    return null;
  }
}

module.exports = AdminProfilePhotoResource;
