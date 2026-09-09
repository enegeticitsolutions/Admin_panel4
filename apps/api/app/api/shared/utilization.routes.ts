import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from './deps';
import { benefitPeriodManager } from '../../services/benefit/BenefitPeriodManager';
import { benefitLedgerEngine } from '../../services/benefit/BenefitLedgerEngine';

const router = Router();

// GET /api/shared/utilization
// Subscriber: Returns summary of all beneficiaries
// Beneficiary: Returns detailed utilization for self
// Subscriber (with ?beneficiaryId=xxx): Returns detailed utilization for that beneficiary (if owned)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;
    const { beneficiaryId } = req.query;

    if (!userId || !userRole) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 1: Beneficiary requesting their own detailed utilization
    // ─────────────────────────────────────────────────────────────────
    if (userRole === 'beneficiary') {
      const beneficiary = await prisma.beneficiary.findFirst({
        where: {
          OR: [{ id: userId }, { userId: userId }]
        },
        select: {
          id: true,
          subscriptions: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              package: { select: { id: true, name: true, type: true } },
              benefitBalances: {
                include: {
                  benefit: { select: { id: true, name: true, unitLabel: true, benefitType: { select: { name: true } } } }
                }
              }
            }
          }
        }
      });

      if (!beneficiary) {
        return res.status(404).json({ success: false, message: 'Beneficiary not found' });
      }

      return res.json({ success: true, data: await buildDetailedUtilization(beneficiary) });
    }

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 2: Subscriber requesting a specific beneficiary's details
    // ─────────────────────────────────────────────────────────────────
    if (userRole === 'subscriber' && beneficiaryId) {
      if (String(beneficiaryId).startsWith('unlinked-')) {
        const subId = String(beneficiaryId).replace('unlinked-', '');
        const unlinkedSubscription = await prisma.subscription.findFirst({
          where: { id: subId, subscriberId: userId, isActive: true },
          include: {
            package: { select: { id: true, name: true, type: true } },
            benefitBalances: {
              include: {
                benefit: { select: { id: true, name: true, unitLabel: true, benefitType: { select: { name: true } } } }
              }
            }
          }
        });

        if (!unlinkedSubscription) {
          return res.status(404).json({ success: false, message: 'Unlinked subscription not found' });
        }

        const formattedBenefits = (unlinkedSubscription.benefitBalances || []).map((bal: any) => {
          const remaining = Math.max(0, bal.totalUnits - bal.usedUnits);
          const usagePercent = bal.totalUnits > 0 ? Math.round((bal.usedUnits / bal.totalUnits) * 100) : 0;
          return {
            benefitId: bal.benefitId,
            benefitName: bal.benefit?.name,
            unitLabel: bal.benefit?.unitLabel || 'units',
            benefitTypeName: bal.benefit?.benefitType?.name || null,
            totalUnits: bal.totalUnits,
            usedUnits: bal.usedUnits,
            remainingUnits: remaining,
            usagePercent,
            isLowBalance: bal.totalUnits > 0 && (remaining / bal.totalUnits) < 0.2,
            isExhausted: bal.totalUnits > 0 && remaining === 0,
          };
        });

        return res.json({
          success: true,
          data: {
            type: 'detail',
            subscription: {
              id: unlinkedSubscription.id,
              packageName: unlinkedSubscription.package?.name || unlinkedSubscription.packageType,
              packageType: unlinkedSubscription.packageType,
              startDate: unlinkedSubscription.startDate,
              endDate: unlinkedSubscription.endDate,
              isActive: unlinkedSubscription.isActive,
            },
            benefits: formattedBenefits,
            recentLogs: []
          }
        });
      }

      // Ensure the requested beneficiary belongs to this subscriber
      const beneficiary = await prisma.beneficiary.findFirst({
        where: {
          id: String(beneficiaryId),
          subscriberId: userId,
          isActive: true
        },
        select: {
          id: true,
          subscriptions: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              package: { select: { id: true, name: true, type: true } },
              benefitBalances: {
                include: {
                  benefit: { select: { id: true, name: true, unitLabel: true, benefitType: { select: { name: true } } } }
                }
              }
            }
          }
        }
      });

      if (!beneficiary) {
        return res.status(404).json({ success: false, message: 'Beneficiary not found or unauthorized' });
      }

      return res.json({ success: true, data: await buildDetailedUtilization(beneficiary) });
    }

    // ─────────────────────────────────────────────────────────────────
    // SCENARIO 3: Subscriber requesting summary of all beneficiaries
    // ─────────────────────────────────────────────────────────────────
    if (userRole === 'subscriber' && !beneficiaryId) {
      // 1. Fetch normal beneficiaries
      const beneficiaries = await prisma.beneficiary.findMany({
        where: { subscriberId: userId, isActive: true },
        select: {
          id: true,
          name: true,
          age: true,
          subscriptions: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              package: { select: { id: true, name: true, type: true } },
              benefitBalances: {
                include: {
                  benefit: { select: { id: true, name: true, unitLabel: true } }
                }
              }
            }
          }
        }
      });

      // 2. Fetch unlinked active subscriptions
      const unlinkedSubscriptions = await prisma.subscription.findMany({
        where: { subscriberId: userId, isActive: true, beneficiaryId: null },
        include: { package: { select: { name: true } } }
      });

      // If they have no beneficiaries at all, AND have an unlinked sub, return unlinked detailed view
      if (beneficiaries.length === 0 && unlinkedSubscriptions.length > 0) {
        const unlinkedSubscription = unlinkedSubscriptions[0];
        const detailedSubscription = await prisma.subscription.findUnique({
          where: { id: unlinkedSubscription.id },
          include: {
            package: { select: { id: true, name: true, type: true } },
            benefitBalances: {
              include: {
                benefit: { select: { id: true, name: true, unitLabel: true, benefitType: { select: { name: true } } } }
              }
            }
          }
        });

        if (detailedSubscription) {
          const formattedBenefits = (detailedSubscription.benefitBalances || []).map((bal: any) => {
            const remaining = Math.max(0, bal.totalUnits - bal.usedUnits);
            const usagePercent = bal.totalUnits > 0 ? Math.round((bal.usedUnits / bal.totalUnits) * 100) : 0;
            return {
              benefitId: bal.benefitId,
              benefitName: bal.benefit?.name,
              unitLabel: bal.benefit?.unitLabel || 'units',
              benefitTypeName: bal.benefit?.benefitType?.name || null,
              totalUnits: bal.totalUnits,
              usedUnits: bal.usedUnits,
              remainingUnits: remaining,
              usagePercent,
              isLowBalance: bal.totalUnits > 0 && (remaining / bal.totalUnits) < 0.2,
              isExhausted: bal.totalUnits > 0 && remaining === 0,
            };
          });

          return res.json({
            success: true,
            data: {
              type: 'detail',
              subscription: {
                id: detailedSubscription.id,
                packageName: detailedSubscription.package?.name || detailedSubscription.packageType,
                packageType: detailedSubscription.packageType,
                startDate: detailedSubscription.startDate,
                endDate: detailedSubscription.endDate,
                isActive: detailedSubscription.isActive,
              },
              benefits: formattedBenefits,
              recentLogs: []
            }
          });
        }
      }

      // 3. Map unlinked subscriptions to summary objects
      const unlinkedSummaries = unlinkedSubscriptions.map(sub => ({
        beneficiaryId: `unlinked-${sub.id}`,
        beneficiaryName: 'Unassigned Care Plan',
        age: 0,
        activePackage: sub.package?.name || sub.packageType,
        hasLowBalance: false,
        hasExhausted: false,
        isUnlinked: true
      }));

      // 4. Map normal beneficiaries to summary objects
      const normalSummaries = beneficiaries.map(b => {
        const activeSub = b.subscriptions?.[0] || null;
        const benefits = (activeSub?.benefitBalances || []).map(bal => {
          const remaining = Math.max(0, bal.totalUnits - bal.usedUnits);
          const usagePercent = bal.totalUnits > 0 ? Math.round((bal.usedUnits / bal.totalUnits) * 100) : 0;
          return {
            benefitId: bal.benefitId,
            benefitName: bal.benefit?.name,
            totalUnits: bal.totalUnits,
            usedUnits: bal.usedUnits,
            remainingUnits: remaining,
            usagePercent,
            isLowBalance: bal.totalUnits > 0 && remaining / bal.totalUnits < 0.2,
            isExhausted: bal.totalUnits > 0 && remaining === 0,
          };
        });
        return {
          type: 'summary',
          beneficiaryId: b.id,
          beneficiaryName: b.name,
          age: b.age,
          activePackage: activeSub?.package?.name || null,
          subscriptionEndDate: activeSub?.endDate || null,
          benefits,
          hasLowBalance: benefits.some(x => x.isLowBalance),
          hasExhausted: benefits.some(x => x.isExhausted),
        };
      });

      return res.json({ 
        success: true, 
        data: [
          ...normalSummaries.filter(s => s.activePackage !== null), 
          ...unlinkedSummaries
        ] 
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid request parameters' });
  } catch (error: any) {
    console.error('GET /api/shared/utilization error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to build detailed utilization response for a single beneficiary
export async function buildDetailedUtilization(beneficiary: any) {
  const activeSub = beneficiary.subscriptions?.[0] || null;
  
  let formattedBenefits: any[] = [];
  let recentLogs: any[] = [];
  let periodInfo: any = null;

  if (activeSub) {
    // 1. Evaluate Just-In-Time active monthly period
    const activePeriod = await benefitPeriodManager.evaluateAndTransitionJIT(activeSub.id);

    if (activePeriod) {
      const totalPeriods = await prisma.benefitPeriod.count({ where: { subscriptionId: activeSub.id } });
      periodInfo = {
        periodId: activePeriod.id,
        periodNumber: activePeriod.periodNumber,
        totalPeriods,
        startDate: activePeriod.startDate,
        endDate: activePeriod.endDate,
        status: activePeriod.status,
      };

      const periodBalances = await prisma.benefitPeriodBalance.findMany({
        where: { periodId: activePeriod.id },
        include: {
          benefit: { select: { id: true, name: true, unitLabel: true, benefitType: { select: { name: true } } } }
        }
      });

      if (periodBalances.length > 0) {
        formattedBenefits = periodBalances.map((pb: any) => {
          // Check if subscriptionBenefitBalance has tracked usage that wasn't synced to period balance
          const matchingBal = (activeSub.benefitBalances || []).find((b: any) => b.benefitId === pb.benefitId);
          const effectiveUsed = Math.max(pb.usedQuantity, matchingBal?.usedUnits || 0);
          const total = pb.totalAllocation;
          const remaining = Math.max(0, total - effectiveUsed);
          const usagePercent = total > 0 ? Math.round((effectiveUsed / total) * 100) : 0;

          // Auto-sync period balance in background if legacy balance tracked higher usage
          if (matchingBal && matchingBal.usedUnits > pb.usedQuantity) {
            prisma.benefitPeriodBalance.update({
              where: { id: pb.id },
              data: {
                usedQuantity: matchingBal.usedUnits,
                remainingQuantity: Math.max(0, pb.totalAllocation - matchingBal.usedUnits)
              }
            }).catch(e => console.error('[utilization.routes] Auto-sync period balance failed:', e));
          }

          return {
            benefitId: pb.benefitId,
            benefitName: pb.snapshotName || pb.benefit?.name,
            unitLabel: pb.snapshotUnitLabel || pb.benefit?.unitLabel || 'units',
            benefitTypeName: pb.benefit?.benefitType?.name || null,
            baseAllocation: pb.baseAllocation,
            rolloverAllocation: pb.rolloverAllocation,
            totalUnits: total,
            usedUnits: effectiveUsed,
            remainingUnits: remaining,
            usagePercent,
            isLowBalance: total > 0 && (remaining / total) < 0.2,
            isExhausted: total > 0 && remaining === 0,
          };
        });
      }
    }

    // Fallback to subscriptionBenefitBalance if no period balances generated yet
    if (formattedBenefits.length === 0) {
      formattedBenefits = (activeSub.benefitBalances || []).map((bal: any) => {
        const remaining = Math.max(0, bal.totalUnits - bal.usedUnits);
        const usagePercent = bal.totalUnits > 0 ? Math.round((bal.usedUnits / bal.totalUnits) * 100) : 0;
        return {
          benefitId: bal.benefitId,
          benefitName: bal.benefit?.name,
          unitLabel: bal.benefit?.unitLabel || 'units',
          benefitTypeName: bal.benefit?.benefitType?.name || null,
          baseAllocation: bal.totalUnits,
          rolloverAllocation: 0,
          totalUnits: bal.totalUnits,
          usedUnits: bal.usedUnits,
          remainingUnits: remaining,
          usagePercent,
          isLowBalance: bal.totalUnits > 0 && (remaining / bal.totalUnits) < 0.2,
          isExhausted: bal.totalUnits > 0 && remaining === 0,
        };
      });
    }

    // Fetch immutable usage ledger logs
    const usageLedger = await benefitLedgerEngine.getSubscriptionLedger(activeSub.id);
    const mappedUsage = usageLedger.map((u: any) => ({
      id: u.id,
      visitId: u.referenceId,
      hoursConsumed: u.quantity,
      balanceBefore: u.balanceBefore,
      balanceAfter: u.balanceAfter,
      description: u.notes || `${u.usageType.replace(/_/g, ' ')} (${u.quantity > 0 ? `-${u.quantity}` : `+${Math.abs(u.quantity)}`})`,
      loggedAt: u.createdAt,
      careCompanionName: 'Care Team',
      ccType: u.usageType,
      visitStatus: 'COMPLETED',
      actualMinutes: null,
      isRequest: false
    }));

    const rawLogs = await prisma.packageHoursLog.findMany({
      where: { subscriptionId: activeSub.id, beneficiaryId: beneficiary.id },
      orderBy: { loggedAt: 'desc' },
      take: 30,
      include: {
        visit: {
          select: {
            checkInTime: true,
            checkOutTime: true,
            status: true,
            careCompanion: { select: { user: { select: { name: true } }, ccType: true } }
          }
        }
      }
    });

    const mappedLogs = rawLogs.map(log => {
      let actualMinutes = null;
      if (log.visit?.checkInTime && log.visit?.checkOutTime) {
        const ms = new Date(log.visit.checkOutTime).getTime() - new Date(log.visit.checkInTime).getTime();
        actualMinutes = Math.round(ms / 60000);
      }
      return {
        id: log.id,
        visitId: log.visitId,
        hoursConsumed: log.hoursConsumed,
        balanceBefore: log.balanceBefore,
        balanceAfter: log.balanceAfter,
        description: log.description,
        loggedAt: log.loggedAt,
        careCompanionName: log.visit?.careCompanion?.user?.name || 'Unknown',
        ccType: log.visit?.careCompanion?.ccType || null,
        visitStatus: log.visit?.status || null,
        actualMinutes,
        isRequest: false
      };
    });

    // Fetch completed Sathi volunteer visits
    const rawVolLogs = await prisma.volunteerVisitLog.findMany({
      where: {
        beneficiaryId: beneficiary.id,
        status: 'completed'
      },
      orderBy: { checkOutTime: 'desc' },
      take: 30,
      include: {
        volunteer: {
          select: { name: true, phone: true }
        }
      }
    });

    const mappedVolLogs = rawVolLogs.map(vl => {
      let actualMinutes = vl.minutesLogged ? Math.round(vl.minutesLogged) : null;
      if (!actualMinutes && vl.checkInTime && vl.checkOutTime) {
        actualMinutes = Math.round((new Date(vl.checkOutTime).getTime() - new Date(vl.checkInTime).getTime()) / 60000);
      }
      return {
        id: vl.id,
        visitId: vl.id,
        hoursConsumed: vl.hoursEarned || (actualMinutes ? actualMinutes / 60 : 0),
        balanceBefore: vl.beneficiaryBalanceBefore,
        balanceAfter: vl.beneficiaryBalanceAfter,
        description: vl.notes ? `Sathi Visit: ${vl.notes}` : `Sathi Companion Visit (${(vl.hoursEarned || 0).toFixed(1)} hrs)`,
        loggedAt: vl.checkOutTime || vl.createdAt,
        careCompanionName: vl.volunteer?.name || 'Sathi Volunteer',
        ccType: 'SATHI_COMPANION',
        visitStatus: 'COMPLETED',
        actualMinutes,
        isRequest: false
      };
    });

    // Fetch service requests as activity logs
    const serviceReqs = await prisma.serviceRequest.findMany({
      where: { beneficiaryId: beneficiary.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        benefit: { select: { name: true } }
      }
    });

    const mappedRequests = serviceReqs.map(sr => {
      const formattedDate = new Date(sr.preferredDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      return {
        id: sr.id,
        visitId: null,
        hoursConsumed: 0,
        balanceBefore: null,
        balanceAfter: null,
        description: `Service Requested: ${sr.benefit?.name || 'Custom Service'} on ${formattedDate} (${sr.preferredTiming})`,
        loggedAt: sr.createdAt,
        careCompanionName: 'Requested by Subscriber',
        ccType: sr.preferredTiming,
        visitStatus: sr.isRead ? 'READ' : 'PENDING',
        actualMinutes: null,
        isRequest: true
      };
    });

    // Combine logs and deduplicate by referenceId or id
    const combinedLogs = [...mappedLogs, ...mappedVolLogs, ...mappedUsage, ...mappedRequests];
    const seenKeys = new Set<string>();
    const dedupedLogs = combinedLogs.filter(item => {
      const key = item.visitId || item.id;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    recentLogs = dedupedLogs.sort(
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    ).slice(0, 30);
  }

  return {
    type: 'detail',
    beneficiaryId: beneficiary.id,
    beneficiaryName: beneficiary.name,
    subscription: activeSub ? {
      id: activeSub.id,
      packageName: activeSub.package?.name,
      packageType: activeSub.package?.type,
      startDate: activeSub.startDate,
      endDate: activeSub.endDate,
      isActive: activeSub.isActive,
    } : null,
    benefits: formattedBenefits,
    recentLogs
  };
}

router.post('/request-service', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, userRole } = req;
    const { beneficiaryId, benefitId, preferredDate, preferredTiming, additionalNote } = req.body;

    if (!userId || !userRole) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!beneficiaryId || !benefitId || !preferredDate || !preferredTiming) {
      return res.status(400).json({ success: false, message: 'Missing required parameters: beneficiaryId, benefitId, preferredDate, and preferredTiming are required.' });
    }

    // Resolve subscriberId if userRole is subscriber
    const subscriberId = userRole === 'subscriber' ? userId : null;

    // Validate benefit balance is not exhausted and resolve real beneficiaryId/subscriberId
    const cleanBenId = String(beneficiaryId).replace('unlinked-', '');
    const activeSub = await prisma.subscription.findFirst({
      where: {
        OR: [
          { beneficiaryId: beneficiaryId },
          { id: cleanBenId },
          { beneficiaryId: cleanBenId }
        ],
        isActive: true
      },
      include: {
        benefitBalances: {
          where: { benefitId: benefitId }
        }
      }
    });

    if (activeSub && activeSub.benefitBalances && activeSub.benefitBalances.length > 0) {
      const balance = activeSub.benefitBalances[0];
      const remaining = balance.totalUnits - balance.usedUnits;
      if (balance.totalUnits > 0 && remaining <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Benefit exhausted. Connect with support team to renew or upgrade your package.'
        });
      }
    }

    const targetBeneficiaryId = activeSub?.beneficiaryId || cleanBenId;
    const targetSubscriberId = activeSub?.subscriberId || (userRole === 'subscriber' ? userId : null);

    const request = await prisma.serviceRequest.create({
      data: {
        beneficiaryId: targetBeneficiaryId,
        subscriberId: targetSubscriberId,
        benefitId,
        preferredDate: new Date(preferredDate),
        preferredTiming,
        additionalNote: additionalNote || null,
        isRead: false,
        requestedByUserId: userId,
        requestedByRole: userRole
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Service request submitted successfully.',
      data: request
    });
  } catch (error: any) {
    console.error('POST /api/shared/utilization/request-service error:', error);
    res.status(500).json({ success: false, message: error.message || 'An error occurred while saving the service request.' });
  }
});

// GET /api/shared/utilization/ledger/:beneficiaryId — Complete immutable transaction ledger history
router.get('/ledger/:beneficiaryId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const beneficiaryId = String(req.params.beneficiaryId || '');
    const { userId, userRole } = req;

    // Check authorization: beneficiary viewing self OR subscriber viewing owned beneficiary OR admin
    if (userRole === 'beneficiary') {
      const ben = await prisma.beneficiary.findFirst({
        where: { OR: [{ id: userId }, { userId: userId }] }
      });
      if (!ben || ben.id !== beneficiaryId) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    } else if (userRole === 'subscriber') {
      const ben = await prisma.beneficiary.findFirst({
        where: { id: beneficiaryId, subscriberId: userId }
      });
      if (!ben) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    } else if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'field_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const activeSub = await prisma.subscription.findFirst({
      where: { beneficiaryId, isActive: true },
      include: {
        benefitBalances: {
          include: {
            benefit: { select: { id: true, name: true, unitLabel: true } },
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            reservations: {
              where: { status: 'HELD' },
              orderBy: { createdAt: 'desc' },
            }
          }
        }
      }
    });

    if (!activeSub) {
      return res.json({ success: true, data: { balances: [], transactions: [], reservations: [] } });
    }

    const allTransactions: any[] = [];
    const allReservations: any[] = [];

    const balances = activeSub.benefitBalances.map((bal: any) => {
      const reserved = bal.reservedUnits || 0;
      const used = bal.usedUnits || 0;
      const available = bal.availableUnits !== undefined && bal.availableUnits !== null ? bal.availableUnits : Math.max(0, bal.totalUnits - reserved - used);

      (bal.transactions || []).forEach((tx: any) => {
        allTransactions.push({
          ...tx,
          benefitId: bal.benefitId,
          benefitName: bal.benefit?.name,
          unitLabel: bal.benefit?.unitLabel || 'units',
        });
      });

      (bal.reservations || []).forEach((resItem: any) => {
        allReservations.push({
          ...resItem,
          benefitId: bal.benefitId,
          benefitName: bal.benefit?.name,
        });
      });

      return {
        balanceId: bal.id,
        benefitId: bal.benefitId,
        benefitName: bal.benefit?.name,
        unitLabel: bal.benefit?.unitLabel || 'units',
        totalUnits: bal.totalUnits,
        reservedUnits: reserved,
        usedUnits: used,
        availableUnits: available,
      };
    });

    allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      success: true,
      data: {
        subscriptionId: activeSub.id,
        balances,
        transactions: allTransactions,
        activeReservations: allReservations,
      }
    });
  } catch (error: any) {
    console.error('GET /api/shared/utilization/ledger error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

