import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../shared/deps';
import prisma from '../../core/database';
import { resolveFileUrl } from '../../services/storage/urlResolver';
import { listIncomingRequests, ensureProfileAccessOnCreate } from '../../services/access/profile_access_service';

const router = Router();

router.get('/subscriber/:subscriberId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const targetSubscriberId = req.params.subscriberId as string;

  // Prevent IDOR: Users can only view their own subscriber dashboard unless admin/staff
  if (authReq.userId !== targetSubscriberId && authReq.userRole !== 'admin' && authReq.userRole !== 'super_admin' && authReq.userRole !== 'field_manager') {
    return res.status(403).json({ success: false, message: 'Access denied: Unauthorized to view this subscriber dashboard.' });
  }

  const beneficiaries = await prisma.beneficiary.findMany({
    where: { subscriberId: targetSubscriberId, status: { not: 'deleted' } },
    include: {
      visits: {
        orderBy: { scheduledTime: 'desc' },
        take: 5,
        select: {
          id: true,
          visitCode: true,
          encounterId: true,
          status: true,
          scheduledTime: true,
          mood: true,
        },
      },
      primaryCC: {
        include: {
          user: {
            select: { isActive: true },
          },
        },
      },
    },
  });

  const dashboardData = beneficiaries.map((b: any) => {
    const cc = b.primaryCC && b.primaryCC.user?.isActive ? b.primaryCC : null;
    return {
      beneficiary: {
        id: b.id,
        name: b.name,
        age: b.age,
        emotionalScore: b.emotionalScore === 8.0 ? 85 : (b.emotionalScore || 85),
        address: b.address,
      },
      recentVisits: (b.visits || []).map((v: any) => ({
        id: v.id,
        visitCode: v.visitCode,
        encounterId: v.encounterId,
        status: v.status,
        scheduledTime: v.scheduledTime,
        mood: v.mood,
      })),
      careCompanion: cc ? { id: cc.id, name: cc.name, zone: cc.zone, isAvailable: cc.isAvailable } : null,
    };
  });

  res.json({ success: true, data: { beneficiaries: dashboardData } });
});

router.get('/care-companion/:ccId', authenticate, async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const visits = await prisma.visit.findMany({
    where: {
      careCompanionId: req.params.ccId as string,
      scheduledTime: { gte: today, lt: tomorrow },
    },
    orderBy: { scheduledTime: 'asc' },
  });

  res.json({
    success: true,
    data: {
      todayVisits: visits.map((v: any) => ({
        id: v.id,
        visitCode: v.visitCode,
        encounterId: v.encounterId,
        beneficiaryId: v.beneficiaryId,
        scheduledTime: v.scheduledTime,
        status: v.status,
      })),
      totalVisits: visits.length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
    },
  });
});

import * as subscriptionService from '../../services/subscriber/subscription_service';

// Secure "My Dashboard" route
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  // Redirect to the unified handler using the token's userId
  req.params.userId = req.userId!;
  return handleUserDashboard(req, res);
});

// Advanced User Dashboard (Mobile Phase 1)
router.get('/user/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  return handleUserDashboard(req, res);
});

async function handleUserDashboard(req: AuthRequest, res: Response) {
  try {
    const userId = req.params.userId as string;

    // Security check: A user should only be able to see their own dashboard
    // unless they are an admin/staff
    if (req.userId !== userId && req.userRole !== 'admin' && req.userRole !== 'field_manager') {
      console.warn(`[Dashboard] User ${req.userId} attempting to access dashboard for ${userId}`);
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const targetBeneficiaryId = req.query.beneficiaryId as string | undefined;

    const now = new Date();

    // ── Unified single-index lookup via care_circle_members (covers SELF, MANAGER, EDITOR, VIEWER) ──
    const membershipInclude = {
      beneficiary: {
        include: {
          careCircleMembers: {
            where: { status: 'active' },
            select: {
              id: true,
              userId: true,
              accessRole: true,
              role: true,
              relationship: true,
              canRenew: true,
              canViewVitals: true,
              canEditDetails: true,
              canManageAccess: true,
            },
          },
        },
      },
    };

    const [initialMemberships, ownedOrSelfBeneficiaries, incomingRequests] = await Promise.all([
      prisma.careCircleMember.findMany({
        where: {
          userId,
          status: 'active',
          beneficiary: { status: { not: 'deleted' } },
        },
        include: membershipInclude,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.beneficiary.findMany({
        where: {
          OR: [{ subscriberId: userId }, { userId }],
          status: { not: 'deleted' },
        },
        select: {
          id: true,
          userId: true,
          subscriberId: true,
          relationship: true,
        },
      }),
      listIncomingRequests(userId),
    ]);

    let memberships = initialMemberships;
    const existingMemberBenIds = new Set(memberships.map((m) => m.beneficiaryId));
    const missingBeneficiaries = ownedOrSelfBeneficiaries.filter((b) => !existingMemberBenIds.has(b.id));

    // Self-heal missing CareCircleMember rows for legacy/unlinked-flow beneficiaries
    if (missingBeneficiaries.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const b of missingBeneficiaries) {
          await ensureProfileAccessOnCreate(tx, {
            beneficiaryId: b.id,
            beneficiaryUserId: b.userId,
            sponsorUserId: b.subscriberId,
            relationship: b.relationship,
            grantSponsorManager: Boolean(b.subscriberId),
          });
        }
      });

      memberships = await prisma.careCircleMember.findMany({
        where: {
          userId,
          status: 'active',
          beneficiary: { status: { not: 'deleted' } },
        },
        include: membershipInclude,
        orderBy: { createdAt: 'asc' },
      });
    }

    const membershipByBenId = new Map(memberships.map((m) => [m.beneficiaryId, m]));
    const beneficiaries = memberships.map((m) => m.beneficiary);

    const accessibleBenIds = beneficiaries.map((b: any) => b.id);

    // ── Live Latest Vitals (CC + self-recorded, ordered newest first) & Next Upcoming Visit per beneficiary ──
    const [recentVitalRows, upcomingVisitRows, moodVisitRows] = accessibleBenIds.length > 0
      ? await Promise.all([
          prisma.vitalReading.findMany({
            where: {
              beneficiaryId: { in: accessibleBenIds },
              OR: [
                { valueNumeric: { not: null } },
                { valueNumeric2: { not: null } },
                {
                  AND: [
                    { valueText: { not: null } },
                    { valueText: { not: '' } },
                    { valueText: { not: 'N/A' } },
                  ],
                },
              ],
            },
            include: {
              vitalDefinition: { select: { code: true } },
            },
            orderBy: { capturedAt: 'desc' },
          }),
          prisma.visit.findMany({
            where: {
              beneficiaryId: { in: accessibleBenIds },
              scheduledTime: { gte: now },
              status: { in: ['scheduled', 'in_progress'] },
            },
            orderBy: { scheduledTime: 'asc' },
            include: {
              careCompanion: { include: { user: { select: { name: true } } } },
            },
          }),
          prisma.visit.findMany({
            where: {
              beneficiaryId: { in: accessibleBenIds },
              mood: { not: null },
            },
            orderBy: { scheduledTime: 'desc' },
            select: { beneficiaryId: true, mood: true },
          }),
        ])
      : [[], [], []];

    const latestVitalsByBenId = new Map<string, {
      bloodPressure: string | null;
      bloodPressureStatus: string | null;
      pulseRate: number | null;
      pulseStatus: string | null;
      spo2: number | null;
      spo2Status: string | null;
    }>();

    for (const r of recentVitalRows as any[]) {
      const code = r.vitalDefinition?.code?.toUpperCase();
      if (!code) continue;
      let entry = latestVitalsByBenId.get(r.beneficiaryId);
      if (!entry) {
        entry = {
          bloodPressure: null,
          bloodPressureStatus: null,
          pulseRate: null,
          pulseStatus: null,
          spo2: null,
          spo2Status: null,
        };
        latestVitalsByBenId.set(r.beneficiaryId, entry);
      }

      if (code === 'BP' && entry.bloodPressure === null && r.valueNumeric != null) {
        const sys = Math.round(r.valueNumeric);
        const dia = r.valueNumeric2 != null ? Math.round(r.valueNumeric2) : null;
        entry.bloodPressure = dia != null ? `${sys}/${dia}` : `${sys}`;
        if (sys >= 140 || (dia != null && dia >= 90)) entry.bloodPressureStatus = 'High';
        else if (sys >= 120 || (dia != null && dia >= 80)) entry.bloodPressureStatus = 'Elevated';
        else if (sys < 90 || (dia != null && dia < 60)) entry.bloodPressureStatus = 'Low';
        else entry.bloodPressureStatus = 'Normal';
      } else if ((code === 'PULSE' || code === 'HEART_RATE') && entry.pulseRate === null && r.valueNumeric != null) {
        const pulse = Math.round(r.valueNumeric);
        entry.pulseRate = pulse;
        entry.pulseStatus = pulse > 100 ? 'High' : pulse < 60 ? 'Low' : 'Normal';
      } else if ((code === 'SPO2' || code === 'OXYGEN_LEVEL') && entry.spo2 === null && r.valueNumeric != null) {
        const spo2 = Math.round(r.valueNumeric);
        entry.spo2 = spo2;
        entry.spo2Status = spo2 < 92 ? 'Low' : spo2 <= 94 ? 'Borderline' : 'Good';
      }
    }

    const nextVisitByBenId = new Map<string, {
      scheduledTime: Date;
      companionName: string | null;
      status: string;
    }>();

    for (const v of upcomingVisitRows as any[]) {
      if (!nextVisitByBenId.has(v.beneficiaryId)) {
        nextVisitByBenId.set(v.beneficiaryId, {
          scheduledTime: v.scheduledTime,
          companionName: v.careCompanion?.user?.name || null,
          status: v.status,
        });
      }
    }

    const MOOD_SCORE_MAP: Record<string, number> = {
      happy: 100,
      neutral: 80,
      sad: 50,
      anxious: 20,
      depressed: 0,
    };
    const happinessByBenId = new Map<string, { score: number | null; mood: string | null }>();
    for (const mv of moodVisitRows as any[]) {
      if (!happinessByBenId.has(mv.beneficiaryId) && mv.mood) {
        const lower = String(mv.mood).toLowerCase();
        const label = lower.charAt(0).toUpperCase() + lower.slice(1);
        happinessByBenId.set(mv.beneficiaryId, {
          score: MOOD_SCORE_MAP[lower] ?? null,
          mood: label,
        });
      }
    }

    // ── Subscriptions: Direct purchases OR active plans belonging to accessible beneficiaries ──
    const allUserSubscriptions = await prisma.subscription.findMany({
      where: {
        OR: [
          { subscriberId: userId },
          ...(accessibleBenIds.length > 0 ? [{ beneficiaryId: { in: accessibleBenIds } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        package: true,
        benefitBalances: {
          include: {
            benefit: true
          }
        }
      }
    });

    // Derive active and queued subscriptions in memory
    // NOTE: Unassigned subscriptions (beneficiaryId = null) never expire until assigned to a beneficiary
    const allActiveSubscriptions = allUserSubscriptions.filter((s: any) =>
      s.isActive &&
      !s.isQueued &&
      s.cancellationNote !== 'QUEUED' &&
      (!s.beneficiaryId || !s.endDate || new Date(s.endDate) > now)
    );

    const queuedSubscriptions = allUserSubscriptions.filter((s: any) =>
      (s.isQueued === true || s.cancellationNote === 'QUEUED') && s.beneficiaryId
    );

    // Auto-deactivate any expired subscriptions in the background only for assigned subscriptions
    const hasExpiredActive = allUserSubscriptions.some((s: any) => s.isActive && s.beneficiaryId && new Date(s.endDate) <= now);
    if (hasExpiredActive) {
      prisma.subscription.updateMany({
        where: {
          subscriberId: userId,
          isActive: true,
          beneficiaryId: { not: null },
          endDate: { lte: now }
        },
        data: {
          isActive: false
        }
      }).catch((e: any) => console.warn('[Dashboard] Auto-deactivate sub error:', e.message));
    }

    let effectiveBeneficiaryId = targetBeneficiaryId;
    if (!effectiveBeneficiaryId && beneficiaries.length === 1) {
      effectiveBeneficiaryId = beneficiaries[0].id;
    }

    let benIds = beneficiaries.map((b: any) => b.id);
    if (effectiveBeneficiaryId && benIds.includes(effectiveBeneficiaryId)) {
      benIds = [effectiveBeneficiaryId];
    }

    const activeSubscriptions = effectiveBeneficiaryId 
      ? allActiveSubscriptions.filter((s: any) => s.beneficiaryId === effectiveBeneficiaryId)
      : allActiveSubscriptions;

    // Calculate visits this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let visitsThisWeek = 0;
    let completedVisitsThisWeek = 0;

    if (benIds.length > 0) {
      visitsThisWeek = await prisma.visit.count({
        where: {
          beneficiaryId: { in: benIds },
          scheduledTime: { gte: oneWeekAgo }
        }
      });

      completedVisitsThisWeek = await prisma.visit.count({
        where: {
          beneficiaryId: { in: benIds },
          scheduledTime: { gte: oneWeekAgo },
          status: 'completed'
        }
      });
    }

    // Map beneficiaries with dynamic subscription health, expiration status, and queued plans
    const mappedBeneficiaries = await Promise.all(beneficiaries.map(async (b: any) => {
      const benSubs = allUserSubscriptions.filter((s: any) => s.beneficiaryId === b.id);
      const activeSubs = benSubs.filter((s: any) => s.isActive && new Date(s.endDate) > now && !s.isQueued && s.cancellationNote !== 'QUEUED');
      const activeSub = activeSubs[0] || null;
      const queuedSubs = benSubs.filter((s: any) => (s.isQueued === true || s.cancellationNote === 'QUEUED'));
      const queuedSub = queuedSubs[0] || null;
      const expiredSub = benSubs.find((s: any) => (new Date(s.endDate) <= now || !s.isActive) && !s.isQueued && s.cancellationNote !== 'QUEUED');

      let packageStatus: 'active' | 'expired' | 'pending' | 'none' = 'none';
      if (b.verificationStatus === 'pending') {
        packageStatus = 'pending';
      } else if (activeSub) {
        packageStatus = 'active';
      } else if (expiredSub || benSubs.length > 0) {
        packageStatus = 'expired';
      }

      const resolvedPhoto = b.photo ? await resolveFileUrl(b.photo, 1800) : null;
      const membership = membershipByBenId.get(b.id);
      const accessRole = membership?.accessRole || (b.userId === userId ? 'SELF' : b.subscriberId === userId ? 'MANAGER' : 'VIEWER');
      const isCareCircle = accessRole === 'EDITOR' || accessRole === 'VIEWER';
      const careCircleRole = membership?.role || (accessRole === 'SELF' ? 'self' : accessRole === 'MANAGER' ? 'primary_sponsor' : 'viewer');
      const canRenew = true; // Recharge is decoupled from care permissions
      const canViewVitals = membership?.canViewVitals ?? true;
      const canEditDetails = accessRole === 'SELF' || accessRole === 'MANAGER' || accessRole === 'EDITOR' || Boolean(membership?.canEditDetails);
      const canManageAccess = accessRole === 'SELF' || accessRole === 'MANAGER' || Boolean(membership?.canManageAccess);

      const isSelf = b.userId === userId || accessRole === 'SELF';
      const isOwnerSubscriber = b.subscriberId === userId;
      let displayRelationship: string | null = null;
      if (isSelf) {
        displayRelationship = 'Self';
      } else if (isOwnerSubscriber) {
        displayRelationship = b.relationship || null;
      } else {
        // For Care Circle members with shared access, use their own membership relationship, NOT the subscriber's
        displayRelationship = membership?.relationship || null;
      }

      return {
        ...b,
        isSelf,
        relationship: displayRelationship,
        subscriberRelationship: b.relationship,
        photo: resolvedPhoto,
        accessRole,
        isCareCircleMember: isCareCircle,
        careCircleRole,
        canRenew,
        canViewVitals,
        canEditDetails,
        canManageAccess,
        careCircleMembersCount: b.careCircleMembers?.length || 1,
        packageStatus,
        isExpired: packageStatus === 'expired',
        subscriptionEndDate: activeSub?.endDate || expiredSub?.endDate || null,
        hasQueuedPlan: !!queuedSub,
        queuedPlan: queuedSub ? {
          id: queuedSub.id,
          packageName: queuedSub.package?.name || queuedSub.packageType,
          startDate: queuedSub.startDate,
          endDate: queuedSub.endDate,
        } : null,
        activeSubscriptionsCount: activeSubs.length,
        latestVitals: latestVitalsByBenId.get(b.id) || null,
        nextVisit: nextVisitByBenId.get(b.id) || null,
        happinessScore:
          happinessByBenId.get(b.id)?.score ??
          (b.emotionalScore === 8.0 ? null : (b.emotionalScore ?? null)),
        happinessMood: happinessByBenId.get(b.id)?.mood || null,
        // Only map default Prisma seed score (8.0) → null; real scores pass through as-is
        emotionalScore: b.emotionalScore === 8.0 ? null : (b.emotionalScore ?? null)
      };
    }));

    // Average Happiness (Scoped)
    const scopedBeneficiaries = mappedBeneficiaries.filter((b: any) => benIds.includes(b.id));
    let avgHappiness: number | null = null;
    const scoredBeneficiaries = scopedBeneficiaries.filter((b: any) => b.emotionalScore !== null && b.emotionalScore !== undefined);
    if (scoredBeneficiaries.length > 0) {
      const totalScore = scoredBeneficiaries.reduce((sum: any, b: any) => sum + b.emotionalScore, 0);
      avgHappiness = Math.round(totalScore / scoredBeneficiaries.length);
    }

    // Active Hours (Actual aggregation from hourly benefit balances if available, fallback to subscription columns)
    let activeHours = 0;
    let totalHours = 0;

    activeSubscriptions.forEach((sub: any) => {
      const hourBalances = (sub.benefitBalances || []).filter(
        (b: any) => b.benefit.unitLabel?.toLowerCase().includes('hour')
      );
      if (hourBalances.length > 0) {
        activeHours += hourBalances.reduce((sum: number, b: any) => sum + (b.usedUnits || 0), 0);
        totalHours += hourBalances.reduce((sum: number, b: any) => sum + (b.totalUnits || 0), 0);
      } else {
        activeHours += sub.hoursUsed || 0;
        totalHours += sub.hoursTotal || 0;
      }
    });

    const remainingHours = Math.max(0, totalHours - activeHours);

    // Recent Updates (Last 3 notes filled by Care Companions)
    let recentUpdates: any[] = [];
    if (benIds.length > 0) {
      const recentVisitsWithNotes = await prisma.visit.findMany({
        where: {
          beneficiaryId: { in: benIds },
          notes: { not: null, notIn: ["", " "] }
        },
        orderBy: { scheduledTime: 'desc' },
        take: 3,
        include: { 
          careCompanion: {
            include: { user: true }
          } 
        }
      });

      recentUpdates = recentVisitsWithNotes
        .filter((v: any) => v.careCompanion?.user?.isActive !== false) // Filter out notes from deactivated staff
        .map((v: any) => ({
          id: v.id,
          visitId: v.id,
          beneficiaryId: v.beneficiaryId,
          title: "Care Companion Update",
          date: v.scheduledTime,
          isNew: true,
          body: v.notes || "Visit completed smoothly."
        }));
    }

    const selfProfile = mappedBeneficiaries.find((b: any) => b.accessRole === 'SELF') || null;
    const managedProfiles = mappedBeneficiaries.filter((b: any) => b.accessRole === 'MANAGER');
    const sharedProfiles = mappedBeneficiaries.filter((b: any) => b.accessRole === 'EDITOR' || b.accessRole === 'VIEWER');

    res.json({
      success: true,
      activeSubscriptions: allActiveSubscriptions,
      queuedSubscriptions,
      beneficiaries: mappedBeneficiaries,
      selfProfile,
      managedProfiles,
      sharedProfiles,
      pendingIncomingRequestsCount: incomingRequests.totalPending,
      topStats: {
        happinessScore: avgHappiness,
        visitsThisWeek: { total: visitsThisWeek, completed: completedVisitsThisWeek },
        activeHours: { used: activeHours, remaining: remainingHours },
        totalCarePlans: allActiveSubscriptions.length || 0
      },
      recentUpdates
    });
  } catch (error: any) {
    console.error('[Dashboard Error]:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}

export default router;