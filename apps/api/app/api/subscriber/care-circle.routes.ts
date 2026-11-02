import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Generate a friendly 8-character invite code (e.g., CC-482910)
function generateInviteCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `CC-${digits}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriber/care-circle/:beneficiaryId
// Fetch all members of a Care Circle for a beneficiary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:beneficiaryId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const beneficiaryId = req.params.beneficiaryId as string;

    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        subscriber: {
          select: { id: true, name: true, phone: true, email: true, profilePhoto: true }
        },
        careCircleMembers: {
          where: { status: { in: ['active', 'invited'] } },
          include: {
            user: {
              select: { id: true, name: true, phone: true, email: true, profilePhoto: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Access check: User must be primary sponsor OR the beneficiary themselves (self-profile) OR an active care circle member
    const isPrimarySponsor = beneficiary.subscriberId === userId || beneficiary.userId === userId;
    const isMember = beneficiary.careCircleMembers.some((m) => m.userId === userId && m.status === 'active');

    if (!isPrimarySponsor && !isMember && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied: You are not part of this Care Circle' });
    }

    // Format response
    const primarySponsor = {
      userId: beneficiary.subscriber.id,
      name: beneficiary.subscriber.name || 'Primary Sponsor',
      phone: beneficiary.subscriber.phone,
      email: beneficiary.subscriber.email,
      profilePhoto: beneficiary.subscriber.profilePhoto,
      role: 'primary_sponsor',
      relationship: beneficiary.relationship || 'Sponsor',
      isPrimary: true,
      canRenew: true,
      canViewVitals: true,
      canBookVisits: true,
      canEditDetails: true,
      status: 'active'
    };

    const members = beneficiary.careCircleMembers.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name || 'Co-Caregiver',
      phone: m.user.phone,
      email: m.user.email,
      profilePhoto: m.user.profilePhoto,
      role: m.role,
      relationship: m.relationship || 'Family Member',
      isPrimary: false,
      canRenew: m.canRenew,
      canViewVitals: m.canViewVitals,
      canBookVisits: m.canBookVisits,
      canEditDetails: m.canEditDetails,
      status: m.status,
      inviteCode: m.inviteCode,
      createdAt: m.createdAt
    }));

    res.json({
      success: true,
      data: {
        beneficiaryId: beneficiary.id,
        beneficiaryName: beneficiary.name,
        isCurrentUserPrimarySponsor: isPrimarySponsor,
        totalMembers: members.length + 1,
        primarySponsor,
        members
      }
    });
  } catch (error: any) {
    console.error('[CareCircle GET error]:', error);
    res.status(500).json({ success: false, message: 'Failed to load Care Circle members', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriber/care-circle/invite
// Invite a family member to the Care Circle
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      beneficiaryId,
      phone,
      name,
      relationship = 'Family Member',
      role = 'viewer',
      canEditDetails = false,
      canRenew = true,
      canViewVitals = true,
      canBookVisits = true
    } = req.body;

    if (!beneficiaryId || !phone) {
      return res.status(400).json({ success: false, message: 'beneficiaryId and phone are required' });
    }

    // Clean phone number (strip whitespace and common prefixes)
    let cleanPhone = String(phone).replace(/\s+/g, '').replace(/^(\+91)/, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number' });
    }

    // Verify requesting user is the primary sponsor OR profile owner of this beneficiary
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      select: { id: true, name: true, subscriberId: true, userId: true }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    const isOwnerOrSelf = beneficiary.subscriberId === userId || beneficiary.userId === userId;
    if (!isOwnerOrSelf && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the primary sponsor or profile owner can invite members to this Care Circle' });
    }

    // Check if target user exists or create a placeholder user
    let targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: `+91${cleanPhone}` }
        ]
      }
    });

    if (!targetUser) {
      // Create user record for seamless future login
      targetUser = await prisma.user.create({
        data: {
          phone: cleanPhone,
          name: name || undefined,
          role: 'subscriber',
          isVerified: false,
          status: 'active'
        }
      });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ success: false, message: 'You cannot invite yourself to your own Care Circle' });
    }

    const effectiveRole = role || (canEditDetails ? 'editor' : 'viewer');

    // Check if already in Care Circle
    const existingMembership = await prisma.careCircleMember.findUnique({
      where: {
        beneficiaryId_userId: {
          beneficiaryId,
          userId: targetUser.id
        }
      }
    });

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return res.status(409).json({ success: false, message: 'This user is already an active member of this Care Circle' });
      }
      // Re-activate if was removed or pending
      const reactivated = await prisma.careCircleMember.update({
        where: { id: existingMembership.id },
        data: {
          status: 'active',
          role: effectiveRole,
          relationship,
          canRenew: Boolean(canRenew),
          canViewVitals: Boolean(canViewVitals),
          canBookVisits: Boolean(canBookVisits),
          canEditDetails: Boolean(canEditDetails),
          invitedBy: userId
        }
      });
      return res.json({
        success: true,
        message: `${name || 'Family member'} has been re-added to ${beneficiary.name}'s Care Circle`,
        data: reactivated
      });
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    // Ensure uniqueness
    const codeConflict = await prisma.careCircleMember.findUnique({ where: { inviteCode } });
    if (codeConflict) {
      inviteCode = `CC-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const newMember = await prisma.careCircleMember.create({
      data: {
        beneficiaryId,
        userId: targetUser.id,
        role: effectiveRole,
        relationship,
        canRenew: Boolean(canRenew),
        canViewVitals: Boolean(canViewVitals),
        canBookVisits: Boolean(canBookVisits),
        canEditDetails: Boolean(canEditDetails),
        status: 'active', // Instantly active so co-caregiver sees it immediately when logged in
        inviteCode,
        invitedBy: userId
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: `${name || 'Family member'} added to ${beneficiary.name}'s Care Circle`,
      data: {
        ...newMember,
        inviteCode,
        shareText: `Join ${beneficiary.name}'s Care Circle on MaiHoonNa to monitor visits, vitals, and coordinate care. Download the app or enter code ${inviteCode}.`
      }
    });
  } catch (error: any) {
    console.error('[CareCircle invite error]:', error);
    res.status(500).json({ success: false, message: 'Failed to invite Care Circle member', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriber/care-circle/join
// Join a Care Circle via an invite code
// ─────────────────────────────────────────────────────────────────────────────
router.post('/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ success: false, message: 'Invite code is required' });
    }

    const cleanCode = inviteCode.trim().toUpperCase();

    const memberEntry = await prisma.careCircleMember.findUnique({
      where: { inviteCode: cleanCode },
      include: {
        beneficiary: {
          select: { id: true, name: true, subscriber: { select: { name: true } } }
        }
      }
    });

    if (!memberEntry) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invite code' });
    }

    // Update the membership with the actual user ID and activate
    const updated = await prisma.careCircleMember.update({
      where: { id: memberEntry.id },
      data: {
        userId,
        status: 'active'
      }
    });

    res.json({
      success: true,
      message: `You are now connected to ${memberEntry.beneficiary.name}'s Care Circle!`,
      data: {
        beneficiaryId: memberEntry.beneficiary.id,
        beneficiaryName: memberEntry.beneficiary.name,
        relationship: memberEntry.relationship,
        membership: updated
      }
    });
  } catch (error: any) {
    console.error('[CareCircle join error]:', error);
    res.status(500).json({ success: false, message: 'Failed to join Care Circle', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/subscriber/care-circle/:beneficiaryId/members/:memberId
// Remove a member from the Care Circle
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:beneficiaryId/members/:memberId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { beneficiaryId, memberId } = req.params;

    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      select: { subscriberId: true, userId: true }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    const member = await prisma.careCircleMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.beneficiaryId !== beneficiaryId) {
      return res.status(404).json({ success: false, message: 'Care Circle member not found' });
    }

    // Permission: Primary sponsor or profile owner can remove anyone; members can remove themselves (leave)
    const isPrimarySponsor = beneficiary.subscriberId === userId || beneficiary.userId === userId;
    const isSelf = member.userId === userId;

    if (!isPrimarySponsor && !isSelf && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to remove this member' });
    }

    await prisma.careCircleMember.delete({
      where: { id: memberId }
    });

    res.json({
      success: true,
      message: isSelf ? 'You have left this Care Circle' : 'Member removed from Care Circle'
    });
  } catch (error: any) {
    console.error('[CareCircle remove error]:', error);
    res.status(500).json({ success: false, message: 'Failed to remove member', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/subscriber/care-circle/:beneficiaryId/members/:memberId/permissions
// Update a member's permissions
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:beneficiaryId/members/:memberId/permissions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { beneficiaryId, memberId } = req.params;
    const { canRenew, canViewVitals, canBookVisits, canEditDetails, role, relationship } = req.body;

    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      select: { subscriberId: true, userId: true }
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    const isPrimarySponsor = beneficiary.subscriberId === userId || beneficiary.userId === userId;
    if (!isPrimarySponsor && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the primary sponsor or profile owner can update member permissions' });
    }

    const updated = await prisma.careCircleMember.update({
      where: { id: memberId },
      data: {
        ...(canRenew !== undefined && { canRenew: Boolean(canRenew) }),
        ...(canViewVitals !== undefined && { canViewVitals: Boolean(canViewVitals) }),
        ...(canBookVisits !== undefined && { canBookVisits: Boolean(canBookVisits) }),
        ...(canEditDetails !== undefined && {
          canEditDetails: Boolean(canEditDetails),
          role: Boolean(canEditDetails) ? 'editor' : 'viewer'
        }),
        ...(role !== undefined && { role }),
        ...(relationship !== undefined && { relationship })
      }
    });

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      data: updated
    });
  } catch (error: any) {
    console.error('[CareCircle permissions error]:', error);
    res.status(500).json({ success: false, message: 'Failed to update permissions', error: error.message });
  }
});

export default router;
