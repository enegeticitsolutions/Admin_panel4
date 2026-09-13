const express = require('express');
const router = express.Router();
const path = require('path');

const { prisma } = require('../lib/prisma');
const { checkCCAvailability } = require('../services/scheduling');
const { calculateDistance } = require('../utils/location');
const { notifyMany } = require('../services/notifications');
const { calculateAge } = require('../utils/age');
const { dispatchCareCompanionAssigned } = require('../services/notification.dispatcher');
const { rosterEvents } = require('../services/events');
const { isSathiBenefit } = require('../utils/systemBenefits');

// ── GET /api/beneficiaries ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, searchBy, page, limit, sortBy, sortOrder = 'desc', filterBy = 'all', statusFilter = 'active', includeInactive, teamId } = req.query;
    const filterParams = {};

    if (includeInactive !== 'true') {
      filterParams.isActive = true;
    }

    if (statusFilter === 'active') {
      filterParams.subscriptions = {
        some: {
          isActive: true,
          endDate: { gt: new Date() }
        }
      };
    } else if (statusFilter === 'expired') {
      filterParams.subscriptions = {
        none: {
          isActive: true,
          endDate: { gt: new Date() }
        }
      };
    }

    if (teamId) {
      filterParams.teamId = teamId;
    }

    // RBAC Filtering
    if (req.user && req.user.role === 'field_manager') {
      filterParams.teamId = { not: null }; // Simplified until we have team resolution here
    }

    if (filterBy === 'unassigned') {
      filterParams.teamId = null;
    } else if (filterBy === 'assigned') {
      filterParams.teamId = { not: null };
    }

    const searchStr = (typeof search === 'string' && search.trim()) ? search.trim() : null;
    if (searchStr) {
      if (searchBy === 'name') {
        filterParams.name = { contains: searchStr, mode: 'insensitive' };
      } else if (searchBy === 'city') {
        filterParams.city = { contains: searchStr, mode: 'insensitive' };
      } else if (searchBy === 'pincode') {
        filterParams.pincode = { contains: searchStr };
      } else {
        filterParams.OR = [
          { name: { contains: searchStr, mode: 'insensitive' } },
          { city: { contains: searchStr, mode: 'insensitive' } },
          { pincode: { contains: searchStr } },
        ];
      }
    }

    // Fetch user's managed zones for distance calculation
    let managedZones = [];
    if (req.user && (req.user.role === 'operations_manager' || req.user.role === 'admin' || req.user.role === 'master_admin')) {
      const zoneQuery = { where: { isActive: true } };
      if (req.user.role === 'operations_manager') {
        zoneQuery.where.operationsManagerId = req.user.id;
      }
      managedZones = await prisma.zone.findMany({
        ...zoneQuery,
        select: { id: true, name: true, latitude: true, longitude: true, pincode: true }
      });
    }

    const listQuery = {
      where: filterParams,
      orderBy: sortBy && sortBy !== 'distance' ? [ { [sortBy]: sortOrder }, { id: 'desc' } ] : [ { createdAt: 'desc' }, { id: 'desc' } ],
      include: {
        user: { select: { phone: true } },
        subscriber: {
          select: { name: true, phone: true, email: true },
        },
        primaryCC: {
          select: { id: true, name: true, zone: true, userId: true },
        },
        secondaryCC: {
          select: { id: true, name: true, zone: true, userId: true },
        },
        team: {
          select: { id: true, name: true },
        },
        emergencyContacts: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    };

    const isDistanceSort = sortBy === 'distance';

    const allBeneficiaries = await prisma.beneficiary.findMany(listQuery);

    // Fetch subscriptions to calculate dynamic package status and benefit entitlements
    const beneficiaryIds = allBeneficiaries.map((b) => b.id);
    const subscriptions = await prisma.subscription.findMany({
      where: { beneficiaryId: { in: beneficiaryIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        package: {
          select: {
            name: true,
            packageBenefits: {
              include: {
                benefit: {
                  include: {
                    benefitType: { select: { code: true, name: true } }
                  }
                }
              }
            }
          }
        },
        packageVersion: {
          include: {
            versionBenefits: {
              include: {
                benefit: {
                  include: {
                    benefitType: { select: { code: true, name: true } }
                  }
                }
              }
            }
          }
        },
        benefitBalances: {
          include: {
            benefit: {
              include: {
                benefitType: { select: { code: true, name: true } }
              }
            }
          }
        }
      },
    });

    const now = new Date();
    const subMap = {};
    subscriptions.forEach((s) => {
      if (!subMap[s.beneficiaryId]) subMap[s.beneficiaryId] = [];
      subMap[s.beneficiaryId].push(s);
    });

    let mapped = allBeneficiaries.map((b) => {
      const benSubs = subMap[b.id] || [];
      const activeSubs = benSubs.filter((s) => s.isActive && new Date(s.endDate) > now);
      const activeSub = activeSubs[0] || null;
      const expiredSub = benSubs.find((s) => new Date(s.endDate) <= now || !s.isActive);

      let packageStatus = 'none'; // 'active' | 'expired' | 'none'
      if (activeSub) {
        packageStatus = 'active';
      } else if (expiredSub || benSubs.length > 0) {
        packageStatus = 'expired';
      }

      // Check if senior has Sathi Benefit either via package, package version, or purchased add-on
      const hasSathiBenefit = activeSubs.some((sub) => {
        // 1. Add-on purchases / Ledger balances (creates/updates SubscriptionBenefitBalance)
        const hasAddonOrBalance = (sub.benefitBalances || []).some(
          (bal) => isSathiBenefit(bal.benefit) && ((bal.totalUnits - bal.usedUnits) > 0 || (bal.availableUnits || 0) > 0 || (bal.totalUnits || 0) > 0)
        );
        if (hasAddonOrBalance) return true;

        // 2. Package Version Benefits
        const hasVersionBenefit = (sub.packageVersion?.versionBenefits || []).some(
          (pvb) => isSathiBenefit(pvb.benefit)
        );
        if (hasVersionBenefit) return true;

        // 3. Base Package Benefits
        const hasPackageBenefit = (sub.package?.packageBenefits || []).some(
          (pb) => isSathiBenefit(pb.benefit)
        );
        if (hasPackageBenefit) return true;

        return false;
      });

      // Calculate distance to nearest managed zone
      let minDistance = null;
      let nearestZoneName = null;

      if (managedZones.length > 0 && b.latitude && b.longitude) {
        managedZones.forEach(zone => {
          if (zone.latitude && zone.longitude) {
            const dist = calculateDistance(b.latitude, b.longitude, zone.latitude, zone.longitude);
            if (minDistance === null || dist < minDistance) {
              minDistance = dist;
              nearestZoneName = zone.name;
            }
          }
        });
      }

      return {
        id: b.id,
        userId: b.userId,
        name: b.name,
        phone: b.user?.phone || null,
        photo: b.photo,
        dateOfBirth: b.dateOfBirth || null,
        age: b.dateOfBirth ? (calculateAge(b.dateOfBirth) ?? b.age) : b.age,
        gender: b.gender,
        address: b.address,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        latitude: b.latitude,
        longitude: b.longitude,
        medicalConditions: b.medicalConditions || [],
        medications: b.medications || [],
        emotionalScore: b.emotionalScore,
        emergencyContacts: b.emergencyContacts,
        subscriberId: b.subscriberId,
        subscriberName: b.subscriber?.name || null,
        subscriberPhone: b.subscriber?.phone || null,
        primaryCcId: b.primaryCcId,
        secondaryCcId: b.secondaryCcId,
        teamId: b.teamId,
        careCompanion: b.primaryCC?.name || null,
        careCompanionZone: b.primaryCC?.zone || null,
        secondaryCareCompanion: b.secondaryCC?.name || null,
        teamName: b.team?.name || null,
        activePackage: activeSub?.package?.name || null,
        packageStatus,
        isPackageExpired: packageStatus === 'expired',
        subscriptionEndDate: activeSub?.endDate || expiredSub?.endDate || null,
        isActive: b.isActive,
        createdAt: b.createdAt,
        distance: minDistance ? parseFloat(minDistance.toFixed(2)) : null,
        nearestZone: nearestZoneName,
        hasSathiBenefit
      };
    });

    // ── Apply Status Filter ('active' package | 'expired' package | 'all') ─────────
    if (statusFilter === 'active') {
      mapped = mapped.filter((b) => b.packageStatus === 'active');
    } else if (statusFilter === 'expired') {
      mapped = mapped.filter((b) => b.packageStatus === 'expired');
    }

    // Handle distance sorting
    if (isDistanceSort) {
      mapped.sort((a, b) => {
        const distA = a.distance === null ? Infinity : a.distance;
        const distB = b.distance === null ? Infinity : b.distance;
        return sortOrder === 'asc' ? distA - distB : distB - distA;
      });
    }

    const totalCount = mapped.length;

    // Only apply pagination if page or limit query parameters were explicitly passed
    if (req.query.page || req.query.limit) {
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const paginatedData = mapped.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      const totalPages = Math.ceil(totalCount / limitNum) || 1;

      return res.json({
        success: true,
        data: {
          data: paginatedData,
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
        }
      });
    }

    res.json({
      success: true,
      data: mapped
    });
  } catch (err) {
    console.error('GET /beneficiaries error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch beneficiaries' });
  }
});

// ── GET /api/beneficiaries/available-staff?pincode=XXXXX ─────────────────────
// Returns CCs and FMs available in the zone matching the given pincode
router.get('/available-staff', async (req, res) => {
  const { pincode } = req.query;
  if (!pincode)
    return res
      .status(400)
      .json({ success: false, message: 'pincode is required' });

  try {
    // Find zone(s) matching the pincode
    const matchingZones = await prisma.zone.findMany({
      where: { pincode: String(pincode), isActive: true },
      select: { id: true, name: true, pincode: true },
    });

    let zoneIds = matchingZones.map((z) => z.id);

    if (req.user && req.user.role === 'field_manager' && req.user.zoneId) {
      zoneIds = zoneIds.filter((id) => id === req.user.zoneId);
    }

    const zoneNames = matchingZones.map(z => z.name);
    const { fieldManagerUserId, teamId } = req.query;

    console.log('[available-staff] pincode:', pincode, 'teamId:', teamId, 'fieldManagerUserId:', fieldManagerUserId, 'zoneNames:', zoneNames);

    let careCompanions = [];
    let fieldManagers = [];

    // PRIMARY PATH: If a specific Team is assigned to this beneficiary, use only that Team's CCs
    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: String(teamId) },
        include: {
          fieldManager: { include: { user: true } },
          careCompanions: { include: { user: true } }
        }
      });
      if (team) {
        if (team.fieldManager) {
           fieldManagers = [{ id: team.fieldManager.id, userId: team.fieldManager.userId, name: team.fieldManager.name, zone: team.fieldManager.zone, isAvailable: team.fieldManager.isAvailable ?? true }];
        }
        careCompanions = team.careCompanions.filter(cc => cc.user?.isActive !== false).map(cc => ({
           id: cc.id, userId: cc.userId,
           name: cc.name || cc.user?.name,
           zone: cc.zone, isAvailable: cc.isAvailable ?? true,
        }));
      }
    } else if (fieldManagerUserId) {
      const fm = await prisma.fieldManager.findUnique({
        where: { userId: String(fieldManagerUserId) },
        include: {
          user: true,
          teams: {
            include: {
              careCompanions: { include: { user: true } }
            }
          }
        }
      });

      console.log('[available-staff] FM found:', fm?.name, 'teams:', fm?.teams?.length);

      if (fm) {
        fieldManagers = [{ id: fm.id, userId: fm.userId, name: fm.name, zone: fm.zone, isAvailable: fm.isAvailable }];
        const ccMap = new Map();
        for (const team of fm.teams) {
          console.log('[available-staff] team:', team.name, 'CCs:', team.careCompanions.length);
          for (const cc of team.careCompanions) {
            if (!ccMap.has(cc.id) && cc.user?.isActive !== false) {
              ccMap.set(cc.id, {
                id: cc.id, userId: cc.userId,
                name: cc.name || cc.user?.name,
                zone: cc.zone, isAvailable: cc.isAvailable ?? true,
              });
            }
          }
        }
        careCompanions = Array.from(ccMap.values());
      }
    }

    // FALLBACK PATH: No FM assigned — find FMs in zone and show their CCs
    if (careCompanions.length === 0) {
      console.log('[available-staff] fallback: zone-based search, zoneNames:', zoneNames);
      const fmsInZone = await prisma.fieldManager.findMany({
        where: {
          ...(zoneNames.length > 0 ? { zone: { in: zoneNames } } : {}),
          user: { isActive: true }
        },
        include: {
          user: true,
          teams: { include: { careCompanions: { include: { user: true } } } }
        }
      });

      fieldManagers = fmsInZone.map(fm => ({
        id: fm.id, userId: fm.userId, name: fm.name, zone: fm.zone, isAvailable: fm.isAvailable ?? true,
      }));

      const ccMap = new Map();
      for (const fm of fmsInZone) {
        for (const team of fm.teams) {
          for (const cc of team.careCompanions) {
            if (!ccMap.has(cc.id) && cc.user?.isActive !== false) {
              ccMap.set(cc.id, {
                id: cc.id, userId: cc.userId,
                name: cc.name || cc.user?.name,
                zone: cc.zone, isAvailable: cc.isAvailable ?? true,
              });
            }
          }
        }
      }
      careCompanions = Array.from(ccMap.values());
      console.log('[available-staff] zone fallback CCs:', careCompanions.length);
    }

    // FINAL FALLBACK: Still empty - return all CCs in zone by zone string
    if (careCompanions.length === 0 && zoneNames.length > 0) {
      console.log('[available-staff] final fallback: CCs by zone string');
      const directCCs = await prisma.careCompanion.findMany({
        where: { zone: { in: zoneNames }, user: { isActive: true } },
        include: { user: true }
      });
      careCompanions = directCCs.map(cc => ({
        id: cc.id, userId: cc.userId, name: cc.name || cc.user?.name,
        zone: cc.zone, isAvailable: cc.isAvailable ?? true,
      }));
      console.log('[available-staff] final fallback CCs:', careCompanions.length);
    }

    res.json({
      success: true,
      data: { careCompanions, fieldManagers, zones: matchingZones },
    });
  } catch (err) {
    console.error('GET /beneficiaries/available-staff error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/beneficiaries/:id/assign-staff ───────────────────────────────────
// Body: { primaryCcId, secondaryCcId, teamId }  (all optional, null to unassign)
// Side-effects on new primary CC assignment:
//   1. Notifies the CC        → "New Assignment"
//   2. Notifies the Beneficiary user → "Care Companion Assigned"
//   3. Notifies the Subscriber       → "A CC has been assigned to your family member"
//   4. Creates an upcoming Visit     → scheduled for 2 days from now at 10 AM
router.put('/:id/assign-staff', async (req, res) => {
  const { id } = req.params;
  const { primaryCcId, secondaryCcId, teamId } = req.body;
  try {
    // Fetch full beneficiary for notifications
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id },
      select: {
        name: true,
        primaryCcId: true,
        secondaryCcId: true,
        userId: true,
        subscriberId: true,
        subscriber: { select: { phone: true } },
        address: true,
      },
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    console.log(`[AssignStaff] Ben: ${id}, Team: ${teamId}, PrimaryCC: ${primaryCcId}, SecondaryCC: ${secondaryCcId}`);

    const data = {};
    let newPrimaryCC = null;     // { id, name, userId } of newly assigned primary CC
    let newSecondaryCcUserId = null;

    const { getConfigValue } = require('../utils/config');

    // ── Validate & track new primary CC ─────────────────────────────────────
    if (primaryCcId !== undefined) {
      if (primaryCcId) {
        const count = await prisma.beneficiary.count({
          where: { primaryCcId, isActive: true },
        });
        const cc = await prisma.careCompanion.findUnique({
          where: { id: primaryCcId },
          select: { id: true, name: true, userId: true, maxPrimaryBeneficiaries: true },
        });
        const maxPrimary = await getConfigValue('max_primary_cc', 5);
        const limit = cc?.maxPrimaryBeneficiaries || maxPrimary;
        if (count >= limit) {
          return res.status(400).json({
            success: false,
            message: `Care Companion ${cc?.name || ''} has reached maximum primary capacity (${limit})`,
          });
        }
        // Only treat as "new" if it wasn't already assigned
        if (beneficiary.primaryCcId !== primaryCcId && cc?.userId) {
          newPrimaryCC = cc;
        }
      }
      data.primaryCcId = primaryCcId || null;
    }

    // ── Validate & track new secondary CC ────────────────────────────────────
    if (secondaryCcId !== undefined) {
      if (secondaryCcId) {
        const count = await prisma.beneficiary.count({
          where: { secondaryCcId, isActive: true },
        });
        const cc = await prisma.careCompanion.findUnique({
          where: { id: secondaryCcId },
          select: { name: true, userId: true, maxSecondaryBeneficiaries: true },
        });
        const maxSecondary = await getConfigValue('max_secondary_cc', 5);
        const limit = cc?.maxSecondaryBeneficiaries || maxSecondary;
        if (count >= limit) {
          return res.status(400).json({
            success: false,
            message: `Care Companion ${cc?.name || ''} has reached maximum secondary capacity (${limit})`,
          });
        }
        if (beneficiary.secondaryCcId !== secondaryCcId && cc?.userId) {
          newSecondaryCcUserId = cc.userId;
        }
      }
      data.secondaryCcId = secondaryCcId || null;
    }

    if (teamId !== undefined) {
      if (teamId) {
        if (beneficiary.teamId !== teamId) {
          const maxBens = await getConfigValue('max_beneficiary_per_team', 10);
          const count = await prisma.beneficiary.count({
            where: { teamId, isActive: true },
          });
          if (count >= maxBens) {
            return res.status(400).json({
              success: false,
              message: `Selected team has reached maximum beneficiary capacity (${maxBens})`,
            });
          }
        }
      }
      data.teamId = teamId || null;
    }

    // ── DB Transaction: update + activity log ────────────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      const benUpdate = await tx.beneficiary.update({
        where: { id },
        data,
        include: {
          user: { select: { id: true } },
          primaryCC: { select: { id: true, name: true, zone: true } },
          secondaryCC: { select: { id: true, name: true, zone: true } },
          team: { select: { id: true, name: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: benUpdate.userId,
          type: 'TEAM',
          action: 'TEAM_EDITED',
          details: {
            entity: 'beneficiary',
            entityId: id,
            primaryCcId,
            secondaryCcId,
            teamId,
            updatedByRole: req.user?.role || 'system',
            updatedByName: req.user?.name || 'Admin',
          },
        },
      });

      return benUpdate;
    });

    // ── Post-transaction: notifications + upcoming visit ─────────────────────
    // (Outside transaction so a push failure never rolls back the DB update)
    if (newPrimaryCC) {
      // Build notification list
      const notifications = [
        // 1. Notify the Care Companion
        {
          userId: newPrimaryCC.userId,
          type: 'system',
          title: '👋 New Beneficiary Assignment',
          body: `You have been assigned as the Primary Care Companion for ${beneficiary.name}. Please check your schedule for upcoming visits.`,
          data: { beneficiaryId: id, type: 'cc_assignment' },
        },
      ];

      // 2. Notify the Beneficiary (if they have a user account)
      if (beneficiary.userId) {
        notifications.push({
          userId: beneficiary.userId,
          type: 'system',
          title: '🤝 Care Companion Assigned',
          body: `${newPrimaryCC.name} has been assigned as your Care Companion and will be in touch soon.`,
          data: { ccId: newPrimaryCC.id, type: 'cc_assignment' },
        });
      }

      // 3. Notify the Subscriber (family member who enrolled)
      if (beneficiary.subscriberId && beneficiary.subscriberId !== beneficiary.userId) {
        notifications.push({
          userId: beneficiary.subscriberId,
          type: 'system',
          title: '✅ Care Companion Assigned',
          body: `${newPrimaryCC.name} has been assigned to take care of ${beneficiary.name}.`,
          data: { beneficiaryId: id, ccId: newPrimaryCC.id, type: 'cc_assignment' },
        });
      }

      // 4. Notify secondary CC if newly assigned
      if (newSecondaryCcUserId) {
        notifications.push({
          userId: newSecondaryCcUserId,
          type: 'system',
          title: '👋 Secondary Assignment',
          body: `You have been assigned as the Secondary Care Companion for ${beneficiary.name}.`,
          data: { beneficiaryId: id, type: 'cc_assignment' },
        });
      }

      // Send all notifications (non-blocking)
      notifyMany(prisma, notifications).catch(err =>
        console.error('[AssignStaff] Notification batch error:', err.message)
      );
      
      // Fire Omnichannel CC_ASSIGNED Event Dispatcher (FCM Push + WhatsApp)
      rosterEvents.dispatchCareCompanionAssigned({
        beneficiaryId: id,
        ccName: newPrimaryCC.name || 'Your Care Companion',
        primaryOrSecondary: 'Primary'
      });
      
      // (Auto-visit creation removed — admin must schedule visits explicitly)
    } else if (newSecondaryCcUserId) {
      // Only secondary CC changed — still notify them
      notifyMany(prisma, [
        {
          userId: newSecondaryCcUserId,
          type: 'system',
          title: '👋 Secondary Assignment',
          body: `You have been assigned as the Secondary Care Companion for ${beneficiary.name}.`,
          data: { beneficiaryId: id, type: 'cc_assignment' },
        },
      ]).catch(err => console.error('[AssignStaff] Secondary CC notification error:', err.message));
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /beneficiaries/:id/assign-staff error:', err);
    if (err.code === 'P2025')
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/beneficiaries/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const b = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        subscriber: true,
        primaryCC: true,
        secondaryCC: true,
        team: { include: { fieldManager: true } },
        emergencyContacts: true,
        visits: { orderBy: { scheduledTime: 'desc' } },
        medicationList: { where: { isActive: true } },
        conditions: { include: { condition: true }, where: { isActive: true } },
        vitalReadings: { include: { vitalDefinition: true } },
        vitalConfigs: { include: { vitalDefinition: true } },
        medicalRecords: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!b)
      return res
        .status(404)
        .json({ success: false, message: 'Beneficiary not found' });
        
    // Maintain backwards compatibility for frontend
    if (b.team && b.team.fieldManager) {
      b.fieldManager = b.team.fieldManager;
      b.fieldManagerId = b.team.fieldManagerId;
    } else {
      b.fieldManager = null;
      b.fieldManagerId = null;
    }
    
    // Map medicationList to medications for frontend compatibility
    b.medications = b.medicationList;

    // Attach dynamic vital readings to visits (match by visitId or encounterId)
    b.visits = b.visits.map(v => ({
      ...v,
      readings: b.vitalReadings.filter(r => (r.visitId && r.visitId === v.id) || (r.encounterId && v.encounterId && r.encounterId === v.encounterId))
    }));

    const sub = await prisma.subscription.findFirst({
      where: { beneficiaryId: b.id, isActive: true },
      include: { package: true },
    });

    // Compute sanitized live care scores
    let emotionalScore = b.emotionalScore != null ? Number(b.emotionalScore) : null;
    if (emotionalScore !== null && emotionalScore > 10) {
      emotionalScore = Math.round(emotionalScore);
    } else if (emotionalScore !== null) {
      emotionalScore = parseFloat(emotionalScore.toFixed(1));
    }

    let healthScore = b.healthScore != null ? parseFloat(Number(b.healthScore).toFixed(1)) : 8.0;
    if (b.vitalReadings && b.vitalReadings.length > 0) {
      const normalCount = b.vitalReadings.filter(r => !r.isAbnormal).length;
      const ratio = normalCount / b.vitalReadings.length;
      const condPenalty = Math.min(2.0, (b.conditions?.length || 0) * 0.4);
      healthScore = parseFloat(Math.max(5.0, Math.min(10.0, (ratio * 10) - condPenalty)).toFixed(1));
    } else if (b.conditions && b.conditions.length > 0) {
      healthScore = parseFloat(Math.max(6.0, 10 - (b.conditions.length * 0.5)).toFixed(1));
    }

    let medicationScore = 100;
    if (!b.medications || b.medications.length === 0) {
      medicationScore = null;
    }

    res.json({
      success: true,
      data: { 
        ...b, 
        emotionalScore,
        healthScore,
        medicationScore,
        phone: b.user?.phone || null,
        dateOfBirth: b.dateOfBirth || null,
        age: b.dateOfBirth ? (calculateAge(b.dateOfBirth) ?? b.age) : b.age,
        subscriptions: sub ? [sub] : [] 
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/beneficiaries/:id ───────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Extracted allowable fields from body
    // Using a whitelist prevents malicious overwriting of relational IDs
    const { 
      name, age, gender, address, city, state, pincode, relationship, 
      primaryPhysicianName, primaryPhysicianPhone, primaryPhysicianSpec, 
      emotionalScore, medicalConditions, medications, isActive, dateOfBirth,
      emergencyContactName, emergencyContactPhone, emergencyContactRelationship
    } = req.body;

    const b = await prisma.beneficiary.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    let parsedAge = age !== undefined ? Number(age) : undefined;
    if (parsedAge !== undefined && isNaN(parsedAge)) parsedAge = b.age;

    // If a new dateOfBirth is provided, override age calculation
    if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
      const computedAge = calculateAge(dateOfBirth);
      if (computedAge !== null) parsedAge = computedAge;
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (parsedAge !== undefined) dataToUpdate.age = parsedAge;
    if (dateOfBirth !== undefined) dataToUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) dataToUpdate.gender = gender;
    if (address !== undefined) dataToUpdate.address = address;
    if (city !== undefined) dataToUpdate.city = city;
    if (state !== undefined) dataToUpdate.state = state;
    if (pincode !== undefined) dataToUpdate.pincode = pincode;
    if (relationship !== undefined) dataToUpdate.relationship = relationship;
    if (primaryPhysicianName !== undefined) dataToUpdate.primaryPhysicianName = primaryPhysicianName;
    if (primaryPhysicianPhone !== undefined) dataToUpdate.primaryPhysicianPhone = primaryPhysicianPhone;
    if (primaryPhysicianSpec !== undefined) dataToUpdate.primaryPhysicianSpec = primaryPhysicianSpec;
    if (emotionalScore !== undefined) dataToUpdate.emotionalScore = Number(emotionalScore);
    // Don't include relational fields in the core update — handle them separately
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    // Use a transaction to safely update core fields + relations
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update core beneficiary fields
      const ben = await tx.beneficiary.update({
        where: { id },
        data: dataToUpdate
      });

      // Update corresponding User record if age/dob/name changed
      const userUpdate = {};
      if (name !== undefined) userUpdate.name = name;
      if (parsedAge !== undefined) userUpdate.age = parsedAge;
      if (dateOfBirth !== undefined) userUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: ben.userId },
          data: userUpdate
        });
      }

      // 2. Sync Medical Conditions (delete old links, create new ones)
      if (medicalConditions !== undefined && Array.isArray(medicalConditions)) {
        // Remove current condition links
        await tx.beneficiaryCondition.deleteMany({ where: { beneficiaryId: id } });

        // Re-link new conditions
        for (const condName of medicalConditions) {
          if (!condName) continue;
          const normalizedName = condName.trim();
          const slug = normalizedName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');
          let condition = await tx.medicalCondition.findFirst({
            where: {
              OR: [
                { name: { equals: normalizedName, mode: 'insensitive' } },
                { slug: slug }
              ]
            }
          });
          if (!condition) {
            condition = await tx.medicalCondition.create({
              data: {
                name: normalizedName,
                slug: slug,
                category: 'General'
              }
            });
          }
          await tx.beneficiaryCondition.create({
            data: { beneficiaryId: id, conditionId: condition.id }
          });
        }
      }

      // 3. Sync Medications (Overwrite old with new)
      if (medications !== undefined && Array.isArray(medications)) {
        // Remove old medications (Cascade will handle adherence records)
        await tx.medication.deleteMany({ where: { beneficiaryId: id } });

        // Create new medications
        for (const m of medications) {
          if (!m || !m.name) continue;
          await tx.medication.create({
            data: {
              beneficiaryId: id,
              name: m.name,
              dosage: m.dosage || '',
              frequency: m.frequency || 'once_daily',
              timeSlots: m.timeSlots || [],
              setReminders: !!m.setReminders,
              startDate: m.startDate ? new Date(m.startDate) : new Date(),
              endDate: m.endDate ? new Date(m.endDate) : null,
              isActive: true,
            }
          });
        }
      }

      // 4. Sync/Update Primary Emergency Contact
      if (emergencyContactName !== undefined || emergencyContactPhone !== undefined || emergencyContactRelationship !== undefined) {
        const existingPrimary = await tx.emergencyContact.findFirst({
          where: { beneficiaryId: id, isPrimary: true }
        });

        if (existingPrimary) {
          await tx.emergencyContact.update({
            where: { id: existingPrimary.id },
            data: {
              name: emergencyContactName !== undefined ? emergencyContactName : existingPrimary.name,
              phone: emergencyContactPhone !== undefined ? emergencyContactPhone : existingPrimary.phone,
              relationship: emergencyContactRelationship !== undefined ? emergencyContactRelationship : existingPrimary.relationship,
            }
          });
        } else {
          await tx.emergencyContact.create({
            data: {
              beneficiaryId: id,
              name: emergencyContactName || 'Emergency Contact',
              phone: emergencyContactPhone || '',
              relationship: emergencyContactRelationship || 'Emergency',
              isPrimary: true
            }
          });
        }
      }

      const changedFields = Object.keys(dataToUpdate).filter(key => b[key] !== dataToUpdate[key]);

      if (changedFields.length > 0 || medications !== undefined) {
        // Log who updated this beneficiary (The Admin)
        await tx.activityLog.create({
          data: {
            userId: req.user?.id || ben.userId, 
            type: 'PROFILE',
            action: 'PROFILE_UPDATED',
            details: {
              entity: 'beneficiary',
              entityId: id,
              beneficiaryName: ben.name,
              changes: changedFields,
              medicationsOverwritten: medications !== undefined,
              updatedBy: req.user?.name || 'Administrator'
            }
          }
        });
      }

      return ben;
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(`PUT /beneficiaries/:id error:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/beneficiaries/:id/medications ──────────────────────────────────
router.post('/:id/medications', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dosage, frequency, timeSlots, setReminders } = req.body;

    const b = await prisma.beneficiary.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    const newMed = await prisma.medication.create({
      data: {
        beneficiaryId: id,
        name,
        dosage,
        frequency: frequency || 'once_daily',
        timeSlots: timeSlots || [],
        setReminders: Boolean(setReminders),
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        isActive: true,
      }
    });

    res.json({ success: true, data: newMed });
  } catch (err) {
    console.error(`POST /beneficiaries/:id/medications error:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/beneficiaries/:id/medications/:medicationId ───────────────────
// "Stop" a medication
router.delete('/:id/medications/:medicationId', async (req, res) => {
  try {
    const { medicationId } = req.params;
    await prisma.medication.update({
      where: { id: medicationId },
      data: { 
        isActive: false,
        endDate: new Date()
      }
    });
    res.json({ success: true, message: 'Medication stopped' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/beneficiaries/:id/conditions ───────────────────────────────────
router.post('/:id/conditions', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, message: 'Condition name required' });

    const normalizedName = name.trim();
    const slug = normalizedName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    // Check if condition exists globally by name or slug
    let condition = await prisma.medicalCondition.findFirst({
      where: {
        OR: [
          { name: { equals: normalizedName, mode: 'insensitive' } },
          { slug: slug }
        ]
      }
    });

    if (!condition) {
      condition = await prisma.medicalCondition.create({
        data: { 
          name: normalizedName,
          slug: slug,
          category: 'General'
        }
      });
    }

    // Link it
    const linked = await prisma.beneficiaryCondition.upsert({
      where: { beneficiaryId_conditionId: { beneficiaryId: id, conditionId: condition.id } },
      update: { isActive: true },
      create: { beneficiaryId: id, conditionId: condition.id }
    });

    res.json({ success: true, data: linked });
  } catch (err) {
    console.error(`POST /beneficiaries/:id/conditions error:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/beneficiaries/:id/conditions/:conditionId ─────────────────────
// "Remove" a condition
router.delete('/:id/conditions/:conditionId', async (req, res) => {
  try {
    const { id, conditionId } = req.params;
    await prisma.beneficiaryCondition.update({
      where: { 
        beneficiaryId_conditionId: { 
          beneficiaryId: id, 
          conditionId: conditionId 
        } 
      },
      data: { isActive: false }
    });
    res.json({ success: true, message: 'Condition removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/beneficiaries/service-requests/unread ───────────────────────────
// Get all unread service requests for beneficiaries managed by selected FM
router.get('/service-requests/unread', async (req, res) => {
  try {
    const isFM = req.user?.role === 'field_manager';
    const isAdmin = req.user?.role === 'master_admin' || req.user?.role === 'admin';
    const isOM = req.user?.role === 'operations_manager';
    const { fmId } = req.query;

    let beneficiaryWhereFilter = { isActive: true };

    if (isFM || ((isAdmin || isOM) && fmId)) {
      const targetFmUserId = isFM ? req.user.id : fmId;
      
      const fm = await prisma.fieldManager.findUnique({
        where: { userId: targetFmUserId },
        select: { id: true }
      });
      
      if (fm) {
        const teams = await prisma.team.findMany({
          where: { fieldManagerId: fm.id },
          select: { id: true }
        });
        const teamIds = teams.map((t) => t.id);
        
        const ccProfiles = await prisma.careCompanion.findMany({
          where: { teamId: { in: teamIds } },
          select: { id: true }
        });
        const ccIds = ccProfiles.map((c) => c.id);
        
        beneficiaryWhereFilter = {
          isActive: true,
          OR: [
            { teamId: { in: teamIds } },
            { primaryCcId: { in: ccIds } },
            { secondaryCcId: { in: ccIds } }
          ]
        };
      }
    }

    const requests = await prisma.serviceRequest.findMany({
      where: {
        isRead: false,
        beneficiary: beneficiaryWhereFilter
      },
      select: {
        id: true,
        beneficiaryId: true
      }
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('GET /beneficiaries/service-requests/unread error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/beneficiaries/:id/service-requests ───────────────────────────────
// Get all unread service requests for a beneficiary
router.get('/:id/service-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const requests = await prisma.serviceRequest.findMany({
      where: {
        beneficiaryId: id
      },
      include: {
        benefit: {
          select: {
            name: true,
            unitLabel: true
          }
        },
        requestedByUser: {
          select: {
            id: true,
            name: true
          }
        },
        subscriber: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('GET /beneficiaries/:id/service-requests error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/beneficiaries/service-requests/:requestId/read ──────────────────
// Mark a service request as read
router.post('/service-requests/:requestId/read', async (req, res) => {
  try {
    const { requestId } = req.params;
    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { isRead: true }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('POST /beneficiaries/service-requests/:requestId/read error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
