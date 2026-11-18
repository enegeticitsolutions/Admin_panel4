/**
 * Shared Profile Access Helper for Admin Backend
 *
 * 1. Dual-writes SELF + MANAGER rows into `care_circle_members` whenever Admin/CSA
 *    creates or links a Beneficiary profile (preventing drift with Mobile API).
 * 2. Resolves deduplicated active Care Circle recipients for critical event alerts
 *    (Emergency SOS, Abnormal Vitals) so shared family members never miss alerts.
 */

async function ensureProfileAccessOnCreate(tx, { beneficiaryId, beneficiaryUserId, sponsorUserId, relationship }) {
  if (!beneficiaryId || !beneficiaryUserId) return;

  await tx.careCircleMember.upsert({
    where: {
      beneficiaryId_userId: { beneficiaryId, userId: beneficiaryUserId },
    },
    create: {
      beneficiaryId,
      userId: beneficiaryUserId,
      accessRole: 'SELF',
      role: 'self',
      relationship: 'Self',
      canRenew: true,
      canViewVitals: true,
      canBookVisits: true,
      canEditDetails: true,
      canManageAccess: true,
      status: 'active',
    },
    update: {
      accessRole: 'SELF',
      role: 'self',
      canEditDetails: true,
      canManageAccess: true,
      status: 'active',
    },
  });

  if (sponsorUserId && sponsorUserId !== beneficiaryUserId) {
    await tx.careCircleMember.upsert({
      where: {
        beneficiaryId_userId: { beneficiaryId, userId: sponsorUserId },
      },
      create: {
        beneficiaryId,
        userId: sponsorUserId,
        accessRole: 'MANAGER',
        role: 'primary_sponsor',
        relationship: relationship || 'Sponsor',
        canRenew: true,
        canViewVitals: true,
        canBookVisits: true,
        canEditDetails: true,
        canManageAccess: true,
        grantedByUserId: sponsorUserId,
        status: 'active',
      },
      update: {
        accessRole: 'MANAGER',
        role: 'primary_sponsor',
        canEditDetails: true,
        canManageAccess: true,
        status: 'active',
      },
    });
  }
}

/**
 * Returns unique User IDs of all active Care Circle members (MANAGER, EDITOR, VIEWER)
 * who should receive critical alerts (Emergency SOS, Abnormal Vitals) for a Care Profile.
 * Excludes the Care Profile's own SELF userId by default unless includeSelf=true.
 */
async function getCareCircleAlertRecipients(prismaClient, beneficiaryId, fallbackSubscriberId = null, includeSelf = false) {
  const userIds = new Set();

  if (fallbackSubscriberId) {
    userIds.add(fallbackSubscriberId);
  }

  try {
    const members = await prismaClient.careCircleMember.findMany({
      where: {
        beneficiaryId,
        status: 'active',
        ...(includeSelf ? {} : { accessRole: { not: 'SELF' } }),
      },
      select: { userId: true },
    });

    for (const m of members) {
      if (m.userId) userIds.add(m.userId);
    }
  } catch (err) {
    console.warn('[ProfileAccessHelper] Failed to query careCircleMembers for alerts:', err.message);
  }

  return Array.from(userIds);
}

module.exports = {
  ensureProfileAccessOnCreate,
  getCareCircleAlertRecipients,
};
