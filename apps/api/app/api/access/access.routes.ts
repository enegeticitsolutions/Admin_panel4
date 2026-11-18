import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import * as accessService from '../../services/access/profile_access_service';
import { requireProfileAccess } from '../../middleware/profileAccess';
import { ApiError } from '../../utils/ApiError';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();

function handleError(res: Response, err: unknown, fallbackMessage: string) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  const msg = err instanceof Error ? err.message : fallbackMessage;
  console.error(`[AccessRoutes] ${fallbackMessage}:`, err);
  return res.status(500).json({ success: false, message: msg });
}

/**
 * POST /api/access/request
 * Pull Flow ("Ask for Access"): Request VIEWER or EDITOR access to someone's Care Profile by phone.
 */
router.post('/request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { targetPhone, phone, requestedRole, relationship, note } = req.body;
    const result = await accessService.requestProfileAccess({
      requesterUserId: req.userId!,
      targetPhone: targetPhone || phone,
      requestedRole,
      relationship,
      note,
    });
    return res.status(201).json({ success: true, data: result, message: result.message });
  } catch (err) {
    return handleError(res, err, 'Failed to submit access request');
  }
});

/**
 * POST /api/access/invite
 * Push Flow ("Share / Invite Access"): Profile owner (SELF) or MANAGER invites someone by phone/code.
 */
router.post('/invite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { beneficiaryId, targetPhone, phone, requestedRole, role, relationship, note } = req.body;
    if (!beneficiaryId) {
      return res.status(400).json({ success: false, message: 'beneficiaryId is required' });
    }
    const normalizedRole =
      requestedRole ||
      (role === 'editor' ? 'EDITOR' : role === 'manager' || role === 'primary_sponsor' ? 'MANAGER' : 'VIEWER');

    const result = await accessService.createAccessInvite({
      actorUserId: req.userId!,
      actorRole: req.userRole,
      beneficiaryId,
      targetPhone: targetPhone || phone,
      requestedRole: normalizedRole,
      relationship,
      note,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err, 'Failed to create access invite');
  }
});

/**
 * GET /api/access/requests/incoming
 * Returns pending "Ask for Access" requests awaiting caller's approval + pending invites sent to caller's phone.
 */
router.get('/requests/incoming', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = await accessService.listIncomingRequests(req.userId!);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch incoming requests');
  }
});

/**
 * GET /api/access/requests/outgoing
 * Returns access requests initiated by the authenticated user.
 */
router.get('/requests/outgoing', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = await accessService.listOutgoingRequests(req.userId!);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, 'Failed to fetch outgoing requests');
  }
});

/**
 * POST /api/access/requests/:requestId/respond
 * Atomically APPROVE, REJECT, or CANCEL a CareAccessRequest.
 */
router.post('/requests/:requestId/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const { action, grantedRole, rejectionReason } = req.body;

    if (!['APPROVE', 'REJECT', 'CANCEL'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be APPROVE, REJECT, or CANCEL' });
    }

    const result = await accessService.respondToAccessRequest({
      requestId,
      actorUserId: req.userId!,
      actorRole: req.userRole,
      action,
      grantedRole,
      rejectionReason,
    });

    return res.json({
      success: true,
      message:
        action === 'APPROVE'
          ? 'Access granted successfully.'
          : action === 'REJECT'
          ? 'Access request declined.'
          : 'Access request cancelled.',
      data: result,
    });
  } catch (err) {
    return handleError(res, err, 'Failed to respond to access request');
  }
});

/**
 * POST /api/access/join-code
 * Claims a 6-character CC-XXXXXX invite code.
 */
router.post('/join-code', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const result = await accessService.claimInviteCode(req.userId!, inviteCode);
    return res.json({
      success: true,
      message: `Connected to ${result.beneficiaryName}'s Care Profile.`,
      data: result,
    });
  } catch (err) {
    return handleError(res, err, 'Failed to claim invite code');
  }
});

/**
 * GET /api/access/profiles
 * Unified single-query listing of all Care Profiles accessible to the user,
 * cleanly bucketed for all 8 independent user types.
 */
router.get('/profiles', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await accessService.listAccessibleProfiles(req.userId!);
    const mapped = await Promise.all(
      memberships.map(async (m) => ({
        memberId: m.id,
        beneficiaryId: m.beneficiary.id,
        name: m.beneficiary.name,
        age: m.beneficiary.age,
        photo: m.beneficiary.photo ? await resolveFileUrl(m.beneficiary.photo, 1800) : null,
        accessRole: m.accessRole,
        relationship: m.relationship,
        canView: true,
        canEdit: m.accessRole === 'SELF' || m.accessRole === 'MANAGER' || m.accessRole === 'EDITOR' || m.canEditDetails,
        canManageAccess: m.accessRole === 'SELF' || m.accessRole === 'MANAGER' || m.canManageAccess,
        membersCount: m.beneficiary.careCircleMembers.length,
      }))
    );

    const selfProfile = mapped.find((p) => p.accessRole === 'SELF') || null;
    const managedProfiles = mapped.filter((p) => p.accessRole === 'MANAGER');
    const sharedProfiles = mapped.filter((p) => p.accessRole === 'EDITOR' || p.accessRole === 'VIEWER');

    return res.json({
      success: true,
      data: {
        selfProfile,
        managedProfiles,
        sharedProfiles,
        allProfiles: mapped,
      },
    });
  } catch (err) {
    return handleError(res, err, 'Failed to load accessible care profiles');
  }
});

/**
 * GET /api/access/profiles/:beneficiaryId/members
 * Lists all active members & pending invites/requests for a Care Profile.
 */
router.get(
  '/profiles/:beneficiaryId/members',
  authenticate,
  requireProfileAccess('VIEW'),
  async (req: AuthRequest, res: Response) => {
    try {
      const beneficiaryId = req.params.beneficiaryId as string;
      const [members, pendingRequests] = await Promise.all([
        prisma.careCircleMember.findMany({
          where: { beneficiaryId, status: 'active' },
          include: {
            user: { select: { id: true, name: true, phone: true, email: true, profilePhoto: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.careAccessRequest.findMany({
          where: { beneficiaryId, status: 'PENDING', expiresAt: { gt: new Date() } },
          include: {
            requester: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          beneficiaryId,
          members: members.map((m) => ({
            id: m.id,
            userId: m.user.id,
            name: m.user.name || 'User',
            phone: m.user.phone,
            email: m.user.email,
            profilePhoto: m.user.profilePhoto,
            accessRole: m.accessRole,
            relationship: m.relationship,
            canEditDetails: m.canEditDetails,
            canManageAccess: m.canManageAccess,
            createdAt: m.createdAt,
          })),
          pendingRequests,
        },
      });
    } catch (err) {
      return handleError(res, err, 'Failed to list profile members');
    }
  }
);

/**
 * PATCH /api/access/profiles/:beneficiaryId/members/:memberId
 * Updates a member's accessRole (VIEWER | EDITOR | MANAGER).
 */
router.patch('/profiles/:beneficiaryId/members/:memberId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await accessService.updateMemberRole({
      actorUserId: req.userId!,
      actorRole: req.userRole,
      beneficiaryId: req.params.beneficiaryId as string,
      memberId: req.params.memberId as string,
      accessRole: req.body.accessRole,
      canEditDetails: req.body.canEditDetails,
      canRenew: req.body.canRenew,
      canViewVitals: req.body.canViewVitals,
      canBookVisits: req.body.canBookVisits,
      relationship: req.body.relationship,
    });
    return res.json({ success: true, message: 'Member access updated.', data: updated });
  } catch (err) {
    return handleError(res, err, 'Failed to update member access');
  }
});

/**
 * DELETE /api/access/profiles/:beneficiaryId/members/:memberId
 * Revokes a member's access (or lets a shared member leave). Cannot revoke SELF.
 */
router.delete('/profiles/:beneficiaryId/members/:memberId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await accessService.revokeMemberAccess({
      actorUserId: req.userId!,
      actorRole: req.userRole,
      beneficiaryId: req.params.beneficiaryId as string,
      memberId: req.params.memberId as string,
    });
    return res.json({
      success: true,
      message: result.isLeavingSelf ? 'You have left this care profile.' : 'Member access revoked.',
    });
  } catch (err) {
    return handleError(res, err, 'Failed to revoke member access');
  }
});

export default router;
