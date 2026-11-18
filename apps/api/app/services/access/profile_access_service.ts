import prisma from '../../core/database';
import { CareAccessRole, AccessRequestDirection, AccessRequestStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { dispatchAccessRequestWhatsApp, dispatchAccessDecisionWhatsApp } from './whatsapp_access_consent';

export type RequiredAccessLevel = 'VIEW' | 'EDIT' | 'MANAGE';

export interface ResolvedProfileAccess {
  hasAccess: boolean;
  isStaff: boolean;
  accessRole: CareAccessRole | 'STAFF' | null;
  canView: boolean;
  canEdit: boolean;
  canBookVisits: boolean;
  canRenew: boolean;
  canManageAccess: boolean;
  memberId?: string;
}

const STAFF_ACCESS_ROLES = new Set([
  'admin',
  'master_admin',
  'super_admin',
  'field_manager',
  'operations_manager',
  'customer_service',
  'customer_service_manager',
  'care_companion',
  'command_center',
]);

const REQUEST_TTL_DAYS = 7;
const REJECTION_COOLDOWN_DAYS = 7;
const MAX_REQUESTS_PER_24H = 5;

export function normalizeIndianPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return digits;
  return digits.slice(-10);
}

export function derivePermissionsFromRole(accessRole: CareAccessRole) {
  switch (accessRole) {
    case 'SELF':
      return {
        legacyRole: 'self',
        canViewVitals: true,
        canEditDetails: true,
        canBookVisits: true,
        canRenew: true,
        canManageAccess: true,
      };
    case 'MANAGER':
      return {
        legacyRole: 'primary_sponsor',
        canViewVitals: true,
        canEditDetails: true,
        canBookVisits: true,
        canRenew: true,
        canManageAccess: true,
      };
    case 'EDITOR':
      return {
        legacyRole: 'editor',
        canViewVitals: true,
        canEditDetails: true,
        canBookVisits: true,
        canRenew: true,
        canManageAccess: false,
      };
    case 'VIEWER':
    default:
      return {
        legacyRole: 'viewer',
        canViewVitals: true,
        canEditDetails: false,
        canBookVisits: false,
        canRenew: true,
        canManageAccess: false,
      };
  }
}

function generateInviteCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `CC-${digits}`;
}

/**
 * Single unique-index lookup returning full permissions for (userId, beneficiaryId).
 * Replaces scattered 3-table OR checks and duplicate verifyAccess/verifyWriteAccess queries.
 */
export async function getProfileAccess(
  userId: string | undefined,
  beneficiaryId: string | undefined,
  userRole?: string
): Promise<ResolvedProfileAccess> {
  if (!userId || !beneficiaryId) {
    return {
      hasAccess: false,
      isStaff: false,
      accessRole: null,
      canView: false,
      canEdit: false,
      canBookVisits: false,
      canRenew: false,
      canManageAccess: false,
    };
  }

  if (userRole && STAFF_ACCESS_ROLES.has(userRole)) {
    return {
      hasAccess: true,
      isStaff: true,
      accessRole: 'STAFF',
      canView: true,
      canEdit: true,
      canBookVisits: true,
      canRenew: true,
      canManageAccess: true,
    };
  }

  // O(1) unique index lookup on @@unique([beneficiaryId, userId])
  const membership = await prisma.careCircleMember.findUnique({
    where: {
      beneficiaryId_userId: { beneficiaryId, userId },
    },
    select: {
      id: true,
      accessRole: true,
      status: true,
      canViewVitals: true,
      canEditDetails: true,
      canBookVisits: true,
      canRenew: true,
      canManageAccess: true,
    },
  });

  if (membership && membership.status === 'active') {
    const isOwnerOrManager = membership.accessRole === 'SELF' || membership.accessRole === 'MANAGER';
    const isEditor = membership.accessRole === 'EDITOR';
    return {
      hasAccess: true,
      isStaff: false,
      accessRole: membership.accessRole,
      canView: true,
      canEdit: isOwnerOrManager || isEditor || membership.canEditDetails,
      canBookVisits: isOwnerOrManager || isEditor || membership.canBookVisits,
      canRenew: true, // Billing/recharge is decoupled from care permissions
      canManageAccess: isOwnerOrManager || membership.canManageAccess,
      memberId: membership.id,
    };
  }

  // Safe fallback for any legacy row created before backfill completes
  const legacyBen = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { userId: true, subscriberId: true },
  });

  if (legacyBen && (legacyBen.userId === userId || legacyBen.subscriberId === userId)) {
    const inferredRole: CareAccessRole = legacyBen.userId === userId ? 'SELF' : 'MANAGER';
    return {
      hasAccess: true,
      isStaff: false,
      accessRole: inferredRole,
      canView: true,
      canEdit: true,
      canBookVisits: true,
      canRenew: true,
      canManageAccess: true,
    };
  }

  return {
    hasAccess: false,
    isStaff: false,
    accessRole: null,
    canView: false,
    canEdit: false,
    canBookVisits: false,
    canRenew: false,
    canManageAccess: false,
  };
}

export function satisfiesLevel(access: ResolvedProfileAccess, level: RequiredAccessLevel): boolean {
  if (!access.hasAccess) return false;
  if (level === 'VIEW') return access.canView;
  if (level === 'EDIT') return access.canEdit;
  if (level === 'MANAGE') return access.canManageAccess;
  return false;
}

/**
 * Dual-write helper: ensures SELF and optional MANAGER access rows exist inside
 * the same transaction whenever a Beneficiary profile is created.
 */
export async function ensureProfileAccessOnCreate(
  tx: Prisma.TransactionClient,
  params: {
    beneficiaryId: string;
    beneficiaryUserId: string;
    sponsorUserId?: string | null;
    relationship?: string | null;
    grantSponsorManager?: boolean;
  }
) {
  const { beneficiaryId, beneficiaryUserId, sponsorUserId, relationship, grantSponsorManager = true } = params;

  const selfPerms = derivePermissionsFromRole('SELF');
  await tx.careCircleMember.upsert({
    where: { beneficiaryId_userId: { beneficiaryId, userId: beneficiaryUserId } },
    create: {
      beneficiaryId,
      userId: beneficiaryUserId,
      accessRole: 'SELF',
      role: selfPerms.legacyRole,
      relationship: 'Self',
      canRenew: selfPerms.canRenew,
      canViewVitals: selfPerms.canViewVitals,
      canBookVisits: selfPerms.canBookVisits,
      canEditDetails: selfPerms.canEditDetails,
      canManageAccess: selfPerms.canManageAccess,
      status: 'active',
    },
    update: {
      accessRole: 'SELF',
      role: selfPerms.legacyRole,
      canEditDetails: true,
      canManageAccess: true,
      status: 'active',
    },
  });

  if (grantSponsorManager && sponsorUserId && sponsorUserId !== beneficiaryUserId) {
    const mgrPerms = derivePermissionsFromRole('MANAGER');
    await tx.careCircleMember.upsert({
      where: { beneficiaryId_userId: { beneficiaryId, userId: sponsorUserId } },
      create: {
        beneficiaryId,
        userId: sponsorUserId,
        accessRole: 'MANAGER',
        role: mgrPerms.legacyRole,
        relationship: relationship || 'Sponsor',
        canRenew: mgrPerms.canRenew,
        canViewVitals: mgrPerms.canViewVitals,
        canBookVisits: mgrPerms.canBookVisits,
        canEditDetails: mgrPerms.canEditDetails,
        canManageAccess: mgrPerms.canManageAccess,
        grantedByUserId: sponsorUserId,
        status: 'active',
      },
      update: {
        accessRole: 'MANAGER',
        role: mgrPerms.legacyRole,
        canEditDetails: true,
        canManageAccess: true,
        status: 'active',
      },
    });
  }
}

/**
 * Single composite-index lookup returning all Care Profiles accessible to a user,
 * cleanly bucketed into selfProfile, managedProfiles, and sharedProfiles.
 */
export async function listAccessibleProfiles(userId: string) {
  const memberships = await prisma.careCircleMember.findMany({
    where: {
      userId,
      status: 'active',
      beneficiary: { status: { not: 'deleted' } },
    },
    include: {
      beneficiary: {
        include: {
          careCircleMembers: {
            where: { status: 'active' },
            select: { id: true, userId: true, accessRole: true, role: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return memberships;
}

/**
 * Pull Flow ("Ask for Access"):
 * Any user can request VIEWER or EDITOR access to another person's Care Profile by phone.
 * Enforces privacy (no PII leaked before approval), rate limiting, and rejection cooldowns.
 */
export async function requestProfileAccess(params: {
  requesterUserId: string;
  targetPhone: string;
  requestedRole?: 'VIEWER' | 'EDITOR';
  relationship?: string;
  note?: string;
}) {
  const cleanPhone = normalizeIndianPhone(params.targetPhone);
  if (cleanPhone.length !== 10) {
    throw new ApiError(400, 'Please provide a valid 10-digit mobile number.');
  }

  const requestedRole: CareAccessRole = params.requestedRole === 'EDITOR' ? 'EDITOR' : 'VIEWER';

  // Rate limit: max 5 outgoing requests in 24h per requester
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.careAccessRequest.count({
    where: {
      requesterUserId: params.requesterUserId,
      direction: 'REQUEST',
      createdAt: { gte: oneDayAgo },
    },
  });
  if (recentCount >= MAX_REQUESTS_PER_24H) {
    throw new ApiError(429, 'Daily access request limit reached. Please try again tomorrow.');
  }

  // Find target user & profile without leaking existence/PII on failure
  const targetUser = await prisma.user.findFirst({
    where: {
      OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }],
    },
    select: {
      id: true,
      beneficiaryProfile: {
        select: { id: true, status: true },
      },
    },
  });

  if (!targetUser || !targetUser.beneficiaryProfile || targetUser.beneficiaryProfile.status === 'deleted') {
    // Privacy-preserving generic response (prevents phone enumeration)
    return {
      status: 'SUBMITTED',
      message: 'If a care profile exists for this number, your access request has been sent for approval.',
    };
  }

  if (targetUser.id === params.requesterUserId) {
    throw new ApiError(400, 'You already own your personal profile.');
  }

  const beneficiaryId = targetUser.beneficiaryProfile.id;

  // Check if requester already has active access
  const existingAccess = await prisma.careCircleMember.findUnique({
    where: { beneficiaryId_userId: { beneficiaryId, userId: params.requesterUserId } },
  });
  if (existingAccess && existingAccess.status === 'active') {
    if (existingAccess.accessRole === 'EDITOR' || existingAccess.accessRole === 'MANAGER' || existingAccess.accessRole === 'SELF') {
      throw new ApiError(409, 'You already have access to this care profile.');
    }
    if (requestedRole === 'VIEWER') {
      throw new ApiError(409, 'You already have View access to this care profile.');
    }
  }

  // Check for existing pending request (idempotent return)
  const existingPending = await prisma.careAccessRequest.findFirst({
    where: {
      beneficiaryId,
      requesterUserId: params.requesterUserId,
      direction: 'REQUEST',
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });
  if (existingPending) {
    return {
      requestId: existingPending.id,
      status: 'PENDING',
      message: 'Your access request is already pending approval.',
    };
  }

  // Enforce 7-day cooldown after rejection
  const cooldownCutoff = new Date(Date.now() - REJECTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const recentRejection = await prisma.careAccessRequest.findFirst({
    where: {
      beneficiaryId,
      requesterUserId: params.requesterUserId,
      direction: 'REQUEST',
      status: 'REJECTED',
      reviewedAt: { gte: cooldownCutoff },
    },
  });
  if (recentRejection) {
    throw new ApiError(429, 'A previous request for this profile was declined recently. Please try again later.');
  }

  const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
  const request = await prisma.careAccessRequest.create({
    data: {
      beneficiaryId,
      direction: 'REQUEST',
      requestedRole,
      relationship: params.relationship || 'Family Member',
      note: params.note?.trim().slice(0, 250) || null,
      requesterUserId: params.requesterUserId,
      targetPhone: cleanPhone,
      status: 'PENDING',
      expiresAt,
    },
  });

  // Asynchronously send interactive WhatsApp Approve/Decline consent to SELF & MANAGER(s)
  void dispatchAccessRequestWhatsApp(request.id);

  return {
    requestId: request.id,
    status: request.status,
    expiresAt: request.expiresAt,
    message: 'If a care profile exists for this number, your access request has been sent for approval.',
  };
}

/**
 * Push Flow ("Invite to Access"):
 * SELF or MANAGER invites a family member by phone (auto-matched on login) and/or 6-char shareable code.
 */
export async function createAccessInvite(params: {
  actorUserId: string;
  actorRole?: string;
  beneficiaryId: string;
  targetPhone?: string;
  requestedRole?: 'VIEWER' | 'EDITOR' | 'MANAGER';
  relationship?: string;
  note?: string;
}) {
  const access = await getProfileAccess(params.actorUserId, params.beneficiaryId, params.actorRole);
  if (!satisfiesLevel(access, 'MANAGE')) {
    throw new ApiError(403, 'Only the profile owner or a Care Manager can invite members.');
  }

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: params.beneficiaryId },
    select: { id: true, name: true },
  });
  if (!beneficiary) {
    throw new ApiError(404, 'Care profile not found.');
  }

  const cleanPhone = params.targetPhone ? normalizeIndianPhone(params.targetPhone) : null;
  if (cleanPhone && cleanPhone.length !== 10) {
    throw new ApiError(400, 'Please provide a valid 10-digit mobile number.');
  }

  const grantedRole: CareAccessRole =
    params.requestedRole === 'MANAGER'
      ? 'MANAGER'
      : params.requestedRole === 'EDITOR'
      ? 'EDITOR'
      : 'VIEWER';

  let inviteCode = generateInviteCode();
  const conflict = await prisma.careAccessRequest.findUnique({ where: { inviteCode } });
  if (conflict) {
    inviteCode = generateInviteCode();
  }

  const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invite = await prisma.careAccessRequest.create({
    data: {
      beneficiaryId: params.beneficiaryId,
      direction: 'INVITE',
      requestedRole: grantedRole,
      relationship: params.relationship || 'Family Member',
      note: params.note?.trim().slice(0, 250) || null,
      invitedByUserId: params.actorUserId,
      targetPhone: cleanPhone,
      inviteCode,
      status: 'PENDING',
      expiresAt,
    },
  });

  return {
    invite,
    inviteCode,
    shareText: `You have been invited to access ${beneficiary.name}'s Care Profile on MaiHoonNa (${grantedRole}). Enter code ${inviteCode} in the app to connect.`,
  };
}

/**
 * Lists all pending requests requiring the caller's action:
 * 1. Incoming "Ask for Access" REQUESTs for profiles where caller has MANAGE rights (SELF or MANAGER).
 * 2. Incoming INVITEs addressed to the caller's phone number.
 */
export async function listIncomingRequests(userId: string) {
  const now = new Date();
  const [user, manageableMemberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    prisma.careCircleMember.findMany({
      where: {
        userId,
        status: 'active',
        OR: [{ accessRole: { in: ['SELF', 'MANAGER'] } }, { canManageAccess: true }],
      },
      select: { beneficiaryId: true },
    }),
  ]);

  const manageableBenIds = manageableMemberships.map((m) => m.beneficiaryId);
  const cleanPhone = user?.phone ? normalizeIndianPhone(user.phone) : null;

  const [accessRequestsToApprove, invitesForMe] = await Promise.all([
    manageableBenIds.length > 0
      ? prisma.careAccessRequest.findMany({
          where: {
            beneficiaryId: { in: manageableBenIds },
            direction: 'REQUEST',
            status: 'PENDING',
            expiresAt: { gt: now },
          },
          include: {
            beneficiary: { select: { id: true, name: true, photo: true } },
            requester: { select: { id: true, name: true, phone: true, profilePhoto: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [],
    cleanPhone
      ? prisma.careAccessRequest.findMany({
          where: {
            targetPhone: cleanPhone,
            direction: 'INVITE',
            status: 'PENDING',
            expiresAt: { gt: now },
          },
          include: {
            beneficiary: { select: { id: true, name: true, photo: true } },
            invitedBy: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [],
  ]);

  return {
    accessRequestsToApprove,
    invitesForMe,
    totalPending: accessRequestsToApprove.length + invitesForMe.length,
  };
}

/**
 * Lists all outgoing requests made by the user.
 */
export async function listOutgoingRequests(userId: string) {
  const requests = await prisma.careAccessRequest.findMany({
    where: {
      requesterUserId: userId,
      direction: 'REQUEST',
    },
    select: {
      id: true,
      requestedRole: true,
      relationship: true,
      note: true,
      targetPhone: true,
      status: true,
      rejectionReason: true,
      expiresAt: true,
      createdAt: true,
      reviewedAt: true,
      // Only expose beneficiary name once APPROVED to preserve pre-approval privacy
      beneficiary: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return requests.map((r) => ({
    ...r,
    beneficiary: r.status === 'APPROVED' ? r.beneficiary : null,
  }));
}

/**
 * Atomic, idempotent state transition for APPROVE / REJECT of a CareAccessRequest.
 * Used identically by In-App Approval AND (in Step 2) WhatsApp Interactive Webhook!
 */
export async function respondToAccessRequest(params: {
  requestId: string;
  actorUserId: string;
  actorRole?: string;
  action: 'APPROVE' | 'REJECT' | 'CANCEL';
  grantedRole?: 'VIEWER' | 'EDITOR' | 'MANAGER';
  rejectionReason?: string;
}) {
  const reqRecord = await prisma.careAccessRequest.findUnique({
    where: { id: params.requestId },
    include: {
      beneficiary: { select: { id: true, name: true, userId: true } },
      requester: { select: { id: true, name: true, phone: true } },
    },
  });

  if (!reqRecord) {
    throw new ApiError(404, 'Access request not found.');
  }

  // Idempotency guard: if already in target terminal state, return cleanly
  if (reqRecord.status !== 'PENDING') {
    if (
      (params.action === 'APPROVE' && reqRecord.status === 'APPROVED') ||
      (params.action === 'REJECT' && reqRecord.status === 'REJECTED') ||
      (params.action === 'CANCEL' && reqRecord.status === 'CANCELLED')
    ) {
      return { request: reqRecord, membership: null, alreadyProcessed: true };
    }
    throw new ApiError(409, `This request has already been ${reqRecord.status.toLowerCase()}.`);
  }

  if (reqRecord.expiresAt < new Date()) {
    await prisma.careAccessRequest.update({
      where: { id: reqRecord.id },
      data: { status: 'EXPIRED' },
    });
    throw new ApiError(410, 'This access request has expired.');
  }

  // Authorization check depends on direction & action
  if (params.action === 'CANCEL') {
    const canCancel =
      reqRecord.requesterUserId === params.actorUserId ||
      reqRecord.invitedByUserId === params.actorUserId ||
      (await satisfiesLevel(
        await getProfileAccess(params.actorUserId, reqRecord.beneficiaryId, params.actorRole),
        'MANAGE'
      ));
    if (!canCancel) {
      throw new ApiError(403, 'Not authorized to cancel this request.');
    }
    const cancelled = await prisma.careAccessRequest.update({
      where: { id: reqRecord.id },
      data: { status: 'CANCELLED', reviewedByUserId: params.actorUserId, reviewedAt: new Date() },
    });
    return { request: cancelled, membership: null, alreadyProcessed: false };
  }

  // Determine who receives the membership upon approval
  let targetMemberUserId: string;
  if (reqRecord.direction === 'REQUEST') {
    // Only SELF or MANAGER of the beneficiary can approve/reject a Pull request
    const actorAccess = await getProfileAccess(params.actorUserId, reqRecord.beneficiaryId, params.actorRole);
    if (!satisfiesLevel(actorAccess, 'MANAGE')) {
      throw new ApiError(403, 'Only the profile owner or a Care Manager can approve or decline access requests.');
    }
    if (!reqRecord.requesterUserId) {
      throw new ApiError(400, 'Invalid request: missing requester.');
    }
    targetMemberUserId = reqRecord.requesterUserId;
  } else {
    // INVITE direction: the invited user themselves accepts/declines
    const actorUser = await prisma.user.findUnique({ where: { id: params.actorUserId }, select: { phone: true } });
    const actorPhone = actorUser?.phone ? normalizeIndianPhone(actorUser.phone) : null;
    if (reqRecord.targetPhone && actorPhone && reqRecord.targetPhone !== actorPhone) {
      throw new ApiError(403, 'This invite was issued for a different phone number.');
    }
    targetMemberUserId = params.actorUserId;
  }

  if (params.action === 'REJECT') {
    const rejected = await prisma.careAccessRequest.update({
      where: { id: reqRecord.id },
      data: {
        status: 'REJECTED',
        reviewedByUserId: params.actorUserId,
        reviewedAt: new Date(),
        rejectionReason: params.rejectionReason?.trim().slice(0, 250) || null,
      },
    });
    if (reqRecord.direction === 'REQUEST' && reqRecord.requester?.phone) {
      void dispatchAccessDecisionWhatsApp({
        requestId: reqRecord.id,
        requesterPhone: reqRecord.requester.phone,
        requesterName: reqRecord.requester.name,
        beneficiaryName: reqRecord.beneficiary.name,
        decision: 'Declined',
      });
    }
    return { request: rejected, membership: null, alreadyProcessed: false };
  }

  // APPROVE: atomically update request AND upsert CareCircleMember
  const finalRole: CareAccessRole =
    reqRecord.direction === 'REQUEST' && params.grantedRole
      ? params.grantedRole
      : reqRecord.requestedRole === 'SELF'
      ? 'VIEWER'
      : reqRecord.requestedRole;

  const perms = derivePermissionsFromRole(finalRole);

  const result = await prisma.$transaction(async (tx) => {
    // Guard against concurrent double-approval
    const updatedCount = await tx.careAccessRequest.updateMany({
      where: { id: reqRecord.id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        requesterUserId: targetMemberUserId,
        reviewedByUserId: params.actorUserId,
        reviewedAt: new Date(),
      },
    });

    if (updatedCount.count === 0) {
      const current = await tx.careAccessRequest.findUnique({ where: { id: reqRecord.id } });
      return { request: current, membership: null, alreadyProcessed: true };
    }

    const membership = await tx.careCircleMember.upsert({
      where: {
        beneficiaryId_userId: {
          beneficiaryId: reqRecord.beneficiaryId,
          userId: targetMemberUserId,
        },
      },
      create: {
        beneficiaryId: reqRecord.beneficiaryId,
        userId: targetMemberUserId,
        accessRole: finalRole,
        role: perms.legacyRole,
        relationship: reqRecord.relationship || 'Family Member',
        canRenew: perms.canRenew,
        canViewVitals: perms.canViewVitals,
        canBookVisits: perms.canBookVisits,
        canEditDetails: perms.canEditDetails,
        canManageAccess: perms.canManageAccess,
        grantedByUserId: reqRecord.direction === 'REQUEST' ? params.actorUserId : reqRecord.invitedByUserId,
        status: 'active',
      },
      update: {
        accessRole: finalRole,
        role: perms.legacyRole,
        relationship: reqRecord.relationship || undefined,
        canRenew: perms.canRenew,
        canViewVitals: perms.canViewVitals,
        canBookVisits: perms.canBookVisits,
        canEditDetails: perms.canEditDetails,
        canManageAccess: perms.canManageAccess,
        grantedByUserId: reqRecord.direction === 'REQUEST' ? params.actorUserId : reqRecord.invitedByUserId,
        revokedAt: null,
        revokedByUserId: null,
        status: 'active',
      },
    });

    const updatedReq = await tx.careAccessRequest.findUnique({ where: { id: reqRecord.id } });
    return { request: updatedReq, membership, alreadyProcessed: false };
  });

  if (!result.alreadyProcessed && reqRecord.direction === 'REQUEST' && reqRecord.requester?.phone) {
    void dispatchAccessDecisionWhatsApp({
      requestId: reqRecord.id,
      requesterPhone: reqRecord.requester.phone,
      requesterName: reqRecord.requester.name,
      beneficiaryName: reqRecord.beneficiary.name,
      decision: 'Approved',
    });
  }

  return result;
}

/**
 * Claims an invite code from the new CareAccessRequest table, with safe fallback
 * to legacy CareCircleMember.inviteCode rows created prior to migration.
 */
export async function claimInviteCode(userId: string, rawCode: string) {
  const cleanCode = String(rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new ApiError(400, 'Invite code is required.');
  }

  // 1. Check new CareAccessRequest table first
  const inviteReq = await prisma.careAccessRequest.findUnique({
    where: { inviteCode: cleanCode },
    include: { beneficiary: { select: { id: true, name: true } } },
  });

  if (inviteReq) {
    const res = await respondToAccessRequest({
      requestId: inviteReq.id,
      actorUserId: userId,
      action: 'APPROVE',
    });
    return {
      beneficiaryId: inviteReq.beneficiary.id,
      beneficiaryName: inviteReq.beneficiary.name,
      relationship: inviteReq.relationship,
      membership: res.membership,
    };
  }

  // 2. Fallback to legacy care_circle_members.inviteCode (30-day compatibility)
  const legacyMember = await prisma.careCircleMember.findUnique({
    where: { inviteCode: cleanCode },
    include: { beneficiary: { select: { id: true, name: true } } },
  });

  if (!legacyMember) {
    throw new ApiError(404, 'Invalid or expired invite code.');
  }

  // Upsert for claiming user instead of blindly overwriting another user's row (fixes P2002 bug)
  const perms = derivePermissionsFromRole(legacyMember.accessRole || (legacyMember.canEditDetails ? 'EDITOR' : 'VIEWER'));
  const membership = await prisma.careCircleMember.upsert({
    where: { beneficiaryId_userId: { beneficiaryId: legacyMember.beneficiaryId, userId } },
    create: {
      beneficiaryId: legacyMember.beneficiaryId,
      userId,
      accessRole: legacyMember.accessRole || (legacyMember.canEditDetails ? 'EDITOR' : 'VIEWER'),
      role: perms.legacyRole,
      relationship: legacyMember.relationship || 'Family Member',
      canRenew: true,
      canViewVitals: true,
      canBookVisits: perms.canBookVisits,
      canEditDetails: perms.canEditDetails,
      canManageAccess: perms.canManageAccess,
      invitedBy: legacyMember.invitedBy,
      grantedByUserId: legacyMember.invitedBy,
      status: 'active',
    },
    update: {
      status: 'active',
    },
  });

  return {
    beneficiaryId: legacyMember.beneficiary.id,
    beneficiaryName: legacyMember.beneficiary.name,
    relationship: legacyMember.relationship,
    membership,
  };
}

/**
 * Updates a member's access role (VIEWER <-> EDITOR <-> MANAGER).
 * Strictly blocks modifying a SELF row.
 */
export async function updateMemberRole(params: {
  actorUserId: string;
  actorRole?: string;
  beneficiaryId: string;
  memberId: string;
  accessRole?: 'VIEWER' | 'EDITOR' | 'MANAGER';
  canEditDetails?: boolean;
  canRenew?: boolean;
  canViewVitals?: boolean;
  canBookVisits?: boolean;
  relationship?: string;
}) {
  const actorAccess = await getProfileAccess(params.actorUserId, params.beneficiaryId, params.actorRole);
  if (!satisfiesLevel(actorAccess, 'MANAGE')) {
    throw new ApiError(403, 'Only the profile owner or a Care Manager can update member permissions.');
  }

  const member = await prisma.careCircleMember.findUnique({ where: { id: params.memberId } });
  if (!member || member.beneficiaryId !== params.beneficiaryId) {
    throw new ApiError(404, 'Member not found on this care profile.');
  }

  if (member.accessRole === 'SELF') {
    throw new ApiError(400, 'The profile owner (SELF) permissions cannot be restricted.');
  }

  const nextRole: CareAccessRole =
    params.accessRole ||
    (params.canEditDetails !== undefined ? (params.canEditDetails ? 'EDITOR' : 'VIEWER') : member.accessRole);

  const perms = derivePermissionsFromRole(nextRole);

  return prisma.careCircleMember.update({
    where: { id: member.id },
    data: {
      accessRole: nextRole,
      role: perms.legacyRole,
      canViewVitals: params.canViewVitals !== undefined ? Boolean(params.canViewVitals) : perms.canViewVitals,
      canEditDetails: params.canEditDetails !== undefined ? Boolean(params.canEditDetails) : perms.canEditDetails,
      canBookVisits: params.canBookVisits !== undefined ? Boolean(params.canBookVisits) : perms.canBookVisits,
      canRenew: params.canRenew !== undefined ? Boolean(params.canRenew) : perms.canRenew,
      canManageAccess: perms.canManageAccess,
      ...(params.relationship !== undefined && { relationship: params.relationship }),
    },
  });
}

/**
 * Soft-revokes a member's access (keeps audit trail).
 * Strictly blocks revoking the SELF profile owner.
 */
export async function revokeMemberAccess(params: {
  actorUserId: string;
  actorRole?: string;
  beneficiaryId: string;
  memberId: string;
}) {
  const member = await prisma.careCircleMember.findUnique({ where: { id: params.memberId } });
  if (!member || member.beneficiaryId !== params.beneficiaryId) {
    throw new ApiError(404, 'Member not found on this care profile.');
  }

  if (member.accessRole === 'SELF') {
    throw new ApiError(400, 'Cannot revoke the profile owner (SELF) from their own care profile.');
  }

  const isLeavingSelf = member.userId === params.actorUserId;
  if (!isLeavingSelf) {
    const actorAccess = await getProfileAccess(params.actorUserId, params.beneficiaryId, params.actorRole);
    if (!satisfiesLevel(actorAccess, 'MANAGE')) {
      throw new ApiError(403, 'Not authorized to revoke this member.');
    }
  }

  await prisma.careCircleMember.update({
    where: { id: member.id },
    data: {
      status: 'revoked',
      revokedByUserId: params.actorUserId,
      revokedAt: new Date(),
    },
  });

  return { isLeavingSelf };
}
