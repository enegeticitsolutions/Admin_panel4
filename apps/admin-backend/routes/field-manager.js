/**
 * Field Manager Portal Routes
 * All endpoints scoped to the authenticated Field Manager's team only.
 * Mount at: /api/field-manager
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// ── Helper: Get the FM's FieldManager profile ID from their userId ─────────────
async function getFmProfileId(userId) {
  const fm = await prisma.fieldManager.findUnique({
    where: { userId },
    select: { id: true },
  });
  return fm?.id || null;
}

// ── Helper: Get team IDs managed by this FM ──────────────────────────────────
async function getFmTeamIds(fmProfileId) {
  const teams = await prisma.team.findMany({
    where: { fieldManagerId: fmProfileId },
    select: { id: true },
  });
  return teams.map((t) => t.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/field-manager/my-team
// Returns all CCs in the FM's team(s) with availability and assignment stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-team', async (req, res) => {
  try {
    const isFM = req.user?.role === 'field_manager';
    const isOM = req.user?.role === 'operations_manager';
    const isAdmin =
      req.user?.role === 'master_admin' || req.user?.role === 'admin';

    let ccWhere = { user: { isActive: true } };
    const { fmId } = req.query; // Optional: specific FM ID to view

    if (isFM || ((isAdmin || isOM) && fmId)) {
      const targetFmId = isFM ? await getFmProfileId(req.user.id) : fmId;
      
      if (!targetFmId) {
        return res
          .status(404)
          .json({ success: false, message: 'Field Manager profile not found' });
      }
      
      const teamIds = await getFmTeamIds(targetFmId);

      // Filter CCs whose teamId is in FM's teams
      ccWhere = {
        teamId: { in: teamIds },
        user: { isActive: true },
      };
    }
    // Admin: no team filter — sees all CCs

    const companions = await prisma.careCompanion.findMany({
      where: ccWhere,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            isActive: true,
            staffProfile: {
              select: {
                teamId: true,
                zoneId: true,
                employmentStatus: true,
              },
            },
          },
        },
        team: { select: { id: true, name: true } },
        primaryFor: { where: { isActive: true }, select: { id: true } },
        secondaryFor: { where: { isActive: true }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    // For each CC, count today's visits to determine availability
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const ccIds = companions.map((c) => c.id);
    const todayVisits = await prisma.visit.findMany({
      where: {
        careCompanionId: { in: ccIds },
        scheduledTime: { gte: today, lt: tomorrow },
        status: { in: ['scheduled', 'in_progress'] },
      },
      select: { careCompanionId: true, status: true, scheduledTime: true },
    });

    const visitMapByCC = {};
    todayVisits.forEach((v) => {
      if (!visitMapByCC[v.careCompanionId])
        visitMapByCC[v.careCompanionId] = [];
      visitMapByCC[v.careCompanionId].push(v);
    });

    const mapped = companions.map((cc) => ({
      id: cc.id,
      userId: cc.userId,
      name: cc.name,
      phone: cc.user?.phone || '',
      zone: cc.zone,
      ccType: cc.ccType,
      isAvailable: cc.isAvailable,
      teamId: cc.teamId,
      teamName: cc.team?.name || null,
      primaryBeneficiariesCount: cc.primaryFor?.length || 0,
      secondaryBeneficiariesCount: cc.secondaryFor?.length || 0,
      todayVisitCount: visitMapByCC[cc.id]?.length || 0,
      activeVisitCount: (visitMapByCC[cc.id] || []).filter(
        (v) => v.status === 'in_progress'
      ).length,
      employmentStatus: cc.user?.staffProfile?.employmentStatus || 'active',
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error('GET /field-manager/my-team error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/field-manager/my-team/schedule?date=YYYY-MM-DD
// Returns all visits for the FM's team CCs on the given date (defaults to today)
// Also returns future visits (next 7 days) if date is not specified
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-team/schedule', async (req, res) => {
  try {
    const isFM = req.user?.role === 'field_manager';
    let ccIds = null;

    if (isFM) {
      const fmProfileId = await getFmProfileId(req.user.id);
      if (!fmProfileId) {
        return res
          .status(404)
          .json({ success: false, message: 'Field Manager profile not found' });
      }
      const teamIds = await getFmTeamIds(fmProfileId);

      const ccProfiles = await prisma.careCompanion.findMany({
        where: {
          teamId: { in: teamIds },
          user: { isActive: true },
        },
        select: { id: true },
      });
      ccIds = ccProfiles.map((c) => c.id);
    }

    // Date range: if date specified use that day, else today + 7 days ahead
    let dateStart, dateEnd;
    if (req.query.date) {
      dateStart = new Date(req.query.date);
      dateStart.setHours(0, 0, 0, 0);
      dateEnd = new Date(req.query.date);
      dateEnd.setHours(23, 59, 59, 999);
    } else {
      dateStart = new Date();
      dateStart.setHours(0, 0, 0, 0);
      dateEnd = new Date();
      dateEnd.setDate(dateEnd.getDate() + 7);
      dateEnd.setHours(23, 59, 59, 999);
    }

    const visitWhere = {
      scheduledTime: { gte: dateStart, lte: dateEnd },
    };
    if (ccIds !== null) {
      visitWhere.careCompanionId = { in: ccIds };
    }

    const visits = await prisma.visit.findMany({
      where: visitWhere,
      include: {
        careCompanion: {
          select: { id: true, name: true, zone: true, isAvailable: true },
        },
        beneficiary: {
          select: { id: true, name: true, address: true, pincode: true },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    const mapped = visits.map((v) => ({
      id: v.id,
      encounterId: v.encounterId,
      status: v.status,
      scheduledTime: v.scheduledTime,
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      durationMinutes: v.durationMinutes,
      careCompanionId: v.careCompanionId,
      careCompanionName: v.careCompanion?.name || 'Unassigned',
      ccIsAvailable: v.careCompanion?.isAvailable ?? true,
      beneficiaryId: v.beneficiaryId,
      beneficiaryName: v.beneficiary?.name || 'Unknown',
      beneficiaryAddress: v.beneficiary?.address || '',
      beneficiaryPincode: v.beneficiary?.pincode || '',
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error('GET /field-manager/my-team/schedule error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/field-manager/beneficiaries
// Returns beneficiaries under this FM (with active subscription info)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/beneficiaries', async (req, res) => {
  try {
    const isFM = req.user?.role === 'field_manager';
    const isAdmin = req.user?.role === 'master_admin' || req.user?.role === 'admin';
    const isOM = req.user?.role === 'operations_manager';

    // Allow admins/ops-managers to scope by a specific FM userId
    const { fmId } = req.query;

    let where = { isActive: true };

    if (isFM) {
      const fmProfileId = await getFmProfileId(req.user.id);
      const teamIds = await getFmTeamIds(fmProfileId);
      const ccProfiles = await prisma.careCompanion.findMany({
        where: { teamId: { in: teamIds } },
        select: { id: true },
      });
      const ccIds = ccProfiles.map((c) => c.id);

      where = {
        isActive: true,
        OR: [
          { teamId: { in: teamIds } },
          { primaryCcId: { in: ccIds } },
          { secondaryCcId: { in: ccIds } },
        ],
      };
    } else if ((isAdmin || isOM) && fmId) {
      // Admin / Ops Manager viewing a specific FM's beneficiaries
      const targetProfileId = await getFmProfileId(fmId);
      const targetTeamIds = targetProfileId ? await getFmTeamIds(targetProfileId) : [];
      where = { isActive: true, teamId: { in: targetTeamIds } };
    }

    const now = new Date();
    const { status } = req.query; // 'active' | 'expired' | 'all'

    const beneficiaries = await prisma.beneficiary.findMany({
      where,
      include: {
        primaryCC: { select: { id: true, userId: true, name: true, isAvailable: true } },
        secondaryCC: { select: { id: true, userId: true, name: true, isAvailable: true } },
        subscriptions: {
          orderBy: { endDate: 'desc' },
          include: { package: { select: { id: true, name: true, type: true } } },
          take: 3,
        },
        serviceRequests: {
          where: { isRead: false },
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' },
    });

    let mapped = beneficiaries.map((b) => {
      // Find active, unexpired subscription
      const activeSub = (b.subscriptions || []).find(
        (s) => s.isActive && new Date(s.endDate) >= now && !s.cancelledAt
      );
      // Latest subscription regardless of expiry
      const latestSub = (b.subscriptions || [])[0] || null;

      const hasActivePackage = Boolean(activeSub);
      const isPackageExpired = Boolean(!activeSub && latestSub);

      return {
        id: b.id,
        userId: b.userId,
        name: b.name,
        age: b.age,
        gender: b.gender,
        address: b.address,
        city: b.city,
        pincode: b.pincode,
        primaryCcId: b.primaryCcId,
        primaryCcUserId: b.primaryCC?.userId || null,
        primaryCcName: b.primaryCC?.name || null,
        secondaryCcId: b.secondaryCcId,
        secondaryCcUserId: b.secondaryCC?.userId || null,
        secondaryCcName: b.secondaryCC?.name || null,
        teamId: b.teamId,
        activePackage: activeSub?.package?.name || null,
        subscriptionId: activeSub?.id || null,
        packageEndDate: activeSub?.endDate || latestSub?.endDate || null,
        lastPackageName: latestSub?.package?.name || null,
        hasActivePackage,
        isPackageExpired,
        hasUnreadRequests: (b.serviceRequests || []).length > 0,
      };
    });

    if (status === 'active') {
      mapped = mapped.filter((b) => b.hasActivePackage);
    } else if (status === 'expired') {
      mapped = mapped.filter((b) => !b.hasActivePackage);
    }

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error('GET /field-manager/beneficiaries error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/field-manager/beneficiaries/:id/benefit-usage
// Returns individual benefit balances for a beneficiary (Nurse visits: 8/12 used)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/beneficiaries/:id/benefit-usage', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify FM access
    if (req.user?.role === 'field_manager') {
      const fmProfileId = await getFmProfileId(req.user.id);
      const teamIds = await getFmTeamIds(fmProfileId);
      const ccProfiles = await prisma.careCompanion.findMany({
        where: { teamId: { in: teamIds } },
        select: { id: true },
      });
      const ccIds = ccProfiles.map((c) => c.id);

      const ben = await prisma.beneficiary.findUnique({
        where: { id },
        select: {
          teamId: true,
          primaryCcId: true,
          secondaryCcId: true,
        },
      });

      if (!ben)
        return res
          .status(404)
          .json({ success: false, message: 'Beneficiary not found' });

      const hasAccess =
        (ben.teamId && teamIds.includes(ben.teamId)) ||
        (ben.primaryCcId && ccIds.includes(ben.primaryCcId)) ||
        (ben.secondaryCcId && ccIds.includes(ben.secondaryCcId));

      if (!hasAccess) {
        return res
          .status(403)
          .json({
            success: false,
            message: 'Access denied to this beneficiary',
          });
      }
    }

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: { beneficiaryId: id, isActive: true },
      include: {
        package: { select: { id: true, name: true } },
        benefitBalances: {
          include: {
            benefit: {
              select: {
                id: true,
                name: true,
                unitLabel: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.json({
        success: true,
        data: { subscription: null, benefitBalances: [], hoursLog: [] },
      });
    }

    // Get hours usage log (last 20 entries)
    const hoursLog = await prisma.packageHoursLog.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { loggedAt: 'desc' },
      take: 20,
      include: {
        visit: {
          include: {
            careCompanion: { select: { name: true } },
          },
        },
      },
    });

    const benefitBalances = subscription.benefitBalances.map((b) => ({
      benefitId: b.benefitId,
      benefitName: b.benefit?.name,
      unitLabel: b.benefit?.unitLabel || 'units',
      description: b.benefit?.description,
      totalUnits: b.totalUnits,
      usedUnits: b.usedUnits,
      remainingUnits: Math.max(0, b.totalUnits - b.usedUnits),
      usagePercent:
        b.totalUnits > 0 ? Math.round((b.usedUnits / b.totalUnits) * 100) : 0,
    }));

    const hoursLogMapped = hoursLog.map((l) => ({
      id: l.id,
      hoursConsumed: l.hoursConsumed,
      balanceBefore: l.balanceBefore,
      balanceAfter: l.balanceAfter,
      description: l.description,
      loggedAt: l.loggedAt,
      careCompanionName: l.visit?.careCompanion?.name || 'System',
    }));

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          packageName: subscription.package?.name,
          hoursTotal: subscription.hoursTotal,
          hoursUsed: subscription.hoursUsed,
          hoursRemaining: Math.max(
            0,
            subscription.hoursTotal - subscription.hoursUsed
          ),
        },
        benefitBalances,
        hoursLog: hoursLogMapped,
      },
    });
  } catch (err) {
    console.error(
      'GET /field-manager/beneficiaries/:id/benefit-usage error:',
      err
    );
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/field-manager/my-team/cc/:id/availability
// Toggles the isAvailable status of a Care Companion
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/my-team/cc/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isAvailable must be a boolean' });
    }

    // Verify FM access if role is FM
    if (req.user?.role === 'field_manager') {
      const fmProfileId = await getFmProfileId(req.user.id);
      const teamIds = await getFmTeamIds(fmProfileId);

      const cc = await prisma.careCompanion.findFirst({
        where: { id, teamId: { in: teamIds } },
      });

      if (!cc) {
        return res.status(404).json({ success: false, message: 'Care Companion not found in your team' });
      }
    }

    const updated = await prisma.careCompanion.update({
      where: { id },
      data: { isAvailable },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PATCH /my-team/cc/:id/availability error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
