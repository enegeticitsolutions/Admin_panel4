import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import * as accessService from '../../services/access/profile_access_service';
import { ApiError } from '../../utils/ApiError';

const router = Router();

function sendError(res: Response, err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  const message = err instanceof Error ? err.message : fallback;
  console.error(`[CareCircle] ${fallback}:`, err);
  return res.status(500).json({ success: false, message });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriber/care-circle/:beneficiaryId
// Backward-compatible endpoint returning Care Circle members for a Care Profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:beneficiaryId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const beneficiaryId = req.params.beneficiaryId as string;

    const access = await accessService.getProfileAccess(userId, beneficiaryId, req.userRole);
    if (!access.canView) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not part of this Care Circle' });
    }

    const [beneficiary, pendingInvites] = await Promise.all([
      prisma.beneficiary.findUnique({
        where: { id: beneficiaryId },
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, profilePhoto: true } },
          subscriber: { select: { id: true, name: true, phone: true, email: true, profilePhoto: true } },
          careCircleMembers: {
            where: { status: { in: ['active', 'invited'] } },
            include: {
              user: { select: { id: true, name: true, phone: true, email: true, profilePhoto: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.careAccessRequest.findMany({
        where: { beneficiaryId, status: 'PENDING', expiresAt: { gt: new Date() } },
        include: { requester: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Null-safe resolution of primary sponsor (handles subscriberId = null self-managed profiles cleanly)
    const primaryUser = beneficiary.subscriber || beneficiary.user;
    const primarySponsor = {
      userId: primaryUser.id,
      name: primaryUser.name || 'Primary Caregiver',
      phone: primaryUser.phone,
      email: primaryUser.email,
      profilePhoto: primaryUser.profilePhoto,
      role: beneficiary.subscriber ? 'primary_sponsor' : 'self',
      accessRole: beneficiary.subscriber && beneficiary.subscriber.id !== beneficiary.userId ? 'MANAGER' : 'SELF',
      relationship: beneficiary.subscriber ? beneficiary.relationship || 'Sponsor' : 'Self',
      isPrimary: true,
      canRenew: true,
      canViewVitals: true,
      canBookVisits: true,
      canEditDetails: true,
      canManageAccess: true,
      status: 'active',
    };

    // Exclude the primaryUser from secondary `members` list to prevent duplicate cards & off-by-one counts
    const members = beneficiary.careCircleMembers
      .filter((m) => m.user.id !== primaryUser.id)
      .map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name || 'Co-Caregiver',
        phone: m.user.phone,
        email: m.user.email,
        profilePhoto: m.user.profilePhoto,
        role: m.role,
        accessRole: m.accessRole,
        relationship: m.relationship || 'Family Member',
        isPrimary: m.accessRole === 'SELF' || m.accessRole === 'MANAGER',
        canRenew: m.canRenew,
        canViewVitals: m.canViewVitals,
        canBookVisits: m.canBookVisits,
        canEditDetails: m.canEditDetails,
        canManageAccess: m.canManageAccess,
        status: m.status,
        inviteCode: m.inviteCode,
        createdAt: m.createdAt,
      }));

    res.json({
      success: true,
      data: {
        beneficiaryId: beneficiary.id,
        beneficiaryName: beneficiary.name,
        isCurrentUserPrimarySponsor: access.canManageAccess,
        currentUserAccessRole: access.accessRole,
        totalMembers: members.length + 1,
        primarySponsor,
        members,
        pendingRequests: pendingInvites,
      },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to load Care Circle members');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriber/care-circle/invite
// Invite a family member (creates a CareAccessRequest invite + shareable code)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      beneficiaryId,
      phone,
      name,
      relationship = 'Family Member',
      role,
      canEditDetails = false,
      canRenew = true,
      canViewVitals = true,
      canBookVisits = true,
    } = req.body;

    if (!beneficiaryId || !phone) {
      return res.status(400).json({ success: false, message: 'beneficiaryId and phone are required' });
    }

    const cleanPhone = accessService.normalizeIndianPhone(phone);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number' });
    }

    const access = await accessService.getProfileAccess(userId, beneficiaryId, req.userRole);
    if (!access.canManageAccess) {
      return res.status(403).json({
        success: false,
        message: 'Only the profile owner or Care Manager can invite members to this Care Circle',
      });
    }

    const targetRole =
      role === 'manager' || role === 'primary_sponsor'
        ? 'MANAGER'
        : role === 'editor' || Boolean(canEditDetails)
        ? 'EDITOR'
        : 'VIEWER';

    // Create standardized CareAccessRequest invite (for auto-matching + share code)
    const inviteResult = await accessService.createAccessInvite({
      actorUserId: userId,
      actorRole: req.userRole,
      beneficiaryId,
      targetPhone: cleanPhone,
      requestedRole: targetRole,
      relationship,
    });

    // If the invited user already exists in the system, keep instant-add backward compatibility
    const existingTargetUser = await prisma.user.findFirst({
      where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }] },
      select: { id: true, name: true, phone: true },
    });

    let membership: any = null;
    if (existingTargetUser && existingTargetUser.id !== userId) {
      const perms = accessService.derivePermissionsFromRole(targetRole);
      membership = await prisma.careCircleMember.upsert({
        where: { beneficiaryId_userId: { beneficiaryId, userId: existingTargetUser.id } },
        create: {
          beneficiaryId,
          userId: existingTargetUser.id,
          accessRole: targetRole,
          role: perms.legacyRole,
          relationship,
          canRenew: Boolean(canRenew),
          canViewVitals: Boolean(canViewVitals),
          canBookVisits: Boolean(canBookVisits),
          canEditDetails: perms.canEditDetails,
          canManageAccess: perms.canManageAccess,
          status: 'active',
          invitedBy: userId,
          grantedByUserId: userId,
        },
        update: {
          accessRole: targetRole,
          role: perms.legacyRole,
          relationship,
          canRenew: Boolean(canRenew),
          canViewVitals: Boolean(canViewVitals),
          canBookVisits: Boolean(canBookVisits),
          canEditDetails: perms.canEditDetails,
          canManageAccess: perms.canManageAccess,
          status: 'active',
          revokedAt: null,
          revokedByUserId: null,
          grantedByUserId: userId,
        },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
    }

    res.status(201).json({
      success: true,
      message: `${name || 'Family member'} invited to Care Circle`,
      data: {
        ...(membership || {}),
        inviteId: inviteResult.invite.id,
        inviteCode: inviteResult.inviteCode,
        shareText: inviteResult.shareText,
      },
    });
  } catch (error) {
    return sendError(res, error, 'Failed to invite Care Circle member');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriber/care-circle/join
// Join a Care Circle via invite code (delegates to ProfileAccessService)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await accessService.claimInviteCode(req.userId!, req.body.inviteCode);
    res.json({
      success: true,
      message: `You are now connected to ${result.beneficiaryName}'s Care Circle!`,
      data: result,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to join Care Circle');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/subscriber/care-circle/:beneficiaryId/members/:memberId
// Soft-revokes membership (blocks revoking SELF)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:beneficiaryId/members/:memberId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await accessService.revokeMemberAccess({
      actorUserId: req.userId!,
      actorRole: req.userRole,
      beneficiaryId: req.params.beneficiaryId as string,
      memberId: req.params.memberId as string,
    });

    res.json({
      success: true,
      message: result.isLeavingSelf ? 'You have left this Care Circle' : 'Member removed from Care Circle',
    });
  } catch (error) {
    return sendError(res, error, 'Failed to remove member');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/subscriber/care-circle/:beneficiaryId/members/:memberId/permissions
// Updates member permissions (blocks restricting SELF)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:beneficiaryId/members/:memberId/permissions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { canRenew, canViewVitals, canBookVisits, canEditDetails, role, accessRole, relationship } = req.body;
    const mappedRole =
      accessRole ||
      (role === 'manager' || role === 'primary_sponsor'
        ? 'MANAGER'
        : role === 'editor'
        ? 'EDITOR'
        : role === 'viewer'
        ? 'VIEWER'
        : undefined);

    const updated = await accessService.updateMemberRole({
      actorUserId: req.userId!,
      actorRole: req.userRole,
      beneficiaryId: req.params.beneficiaryId as string,
      memberId: req.params.memberId as string,
      accessRole: mappedRole,
      canRenew,
      canViewVitals,
      canBookVisits,
      canEditDetails,
      relationship,
    });

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      data: updated,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update permissions');
  }
});

export default router;
