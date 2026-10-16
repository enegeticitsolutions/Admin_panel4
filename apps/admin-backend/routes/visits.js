const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { checkCCAvailability } = require('../services/scheduling');
const { notifyUser } = require('../services/notifications');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const storage = require('../services/storage');
const { dispatchVisitScheduled } = require('../services/notification.dispatcher');
const visitEventDispatcher = require('../services/events/visit-event.dispatcher');
const { rosterEvents } = require('../services/events');
const { resolveFileUrl, resolveFileUrls, extractStorageKey } = require('../services/storage/urlResolver');
const { requirePermission, getVisitFilter } = require('../utils/rbac');


const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ─── Human-readable Visit Code Generator ─────────────────────────────────────
// Safe charset: avoids O/0, I/1, S/5, B/8 — easy to read aloud over the phone.
const VISIT_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateVisitCode() {
  let code = 'V';
  for (let i = 0; i < 8; i++) {
    code += VISIT_CODE_CHARSET[Math.floor(Math.random() * VISIT_CODE_CHARSET.length)];
  }
  return code;
}

// ─── Helper: Deduct from a benefit balance inside a transaction ───────────────
/**
 * Deducts units from a SubscriptionBenefitBalance and creates a PackageHoursLog.
 * @param {object} tx - Prisma transaction client
 * @param {object} opts
 * @param {string}  opts.subscriptionId
 * @param {string}  opts.beneficiaryId
 * @param {string}  opts.benefitId
 * @param {string}  opts.visitId
 * @param {number}  opts.unitsToDeduct - Integer units (1 for visit, Math.ceil(hours) for hours)
 * @param {number}  opts.hoursConsumed - Exact hours as float (for log display)
 * @param {string}  opts.description
 */
async function deductBenefitBalance(tx, opts) {
  const { subscriptionId, beneficiaryId, benefitId, visitId, unitsToDeduct, hoursConsumed, description } = opts;

  const balance = await tx.subscriptionBenefitBalance.findUnique({
    where: { subscriptionId_benefitId: { subscriptionId, benefitId } },
  });

  if (!balance) throw new Error('Benefit not found in this subscription');

  // When a HELD reservation already exists for this visit on this balance, the unit
  // was pre-deducted from availableUnits at scheduling time. Converting HELD→CONSUMED
  // is capacity-neutral (reservedUnits goes down, usedUnits goes up by the same amount).
  // So the net *new* units being added is: unitsToDeduct - heldUnitsForThisVisit.
  // This prevents the false "Insufficient benefit balance" error for visits that have a
  // valid pre-existing HELD lock on an otherwise-exhausted balance.
  let alreadyReservedForThisVisit = 0;
  if (visitId && balance.totalUnits !== -1) {
    const existingHeld = await tx.benefitReservation.findFirst({
      where: { visitId, status: 'HELD', balanceId: balance.id },
      select: { units: true }
    });
    if (existingHeld) {
      alreadyReservedForThisVisit = existingHeld.units;
    }
  }

  const netNewUnits = unitsToDeduct - alreadyReservedForThisVisit;
  if (balance.totalUnits !== -1 && netNewUnits > 0 && (balance.usedUnits + netNewUnits) > (balance.totalUnits - balance.reservedUnits + alreadyReservedForThisVisit)) {
    throw new Error('Insufficient benefit balance');
  }

  const balanceBefore = balance.usedUnits;
  const balanceAfter = balance.usedUnits + unitsToDeduct;

  // Settle any HELD reservation for this visit to CONSUMED
  let reservedUnitsAfter = balance.reservedUnits;
  if (visitId) {
    const reservation = await tx.benefitReservation.findFirst({
      where: { visitId, status: 'HELD' }
    });

    if (reservation) {
      await tx.benefitReservation.update({
        where: { id: reservation.id },
        data: { status: 'CONSUMED' }
      });
      reservedUnitsAfter = Math.max(0, balance.reservedUnits - reservation.units);

      await tx.benefitTransaction.create({
        data: {
          balanceId: balance.id,
          reservationId: reservation.id,
          transactionType: 'CONSUMED',
          units: reservation.units,
          totalBefore: balance.totalUnits,
          totalAfter: balance.totalUnits,
          reservedBefore: balance.reservedUnits,
          reservedAfter: reservedUnitsAfter,
          usedBefore: balance.usedUnits,
          usedAfter: balanceAfter,
          availableBefore: balance.availableUnits,
          availableAfter: Math.max(0, balance.totalUnits - balanceAfter - reservedUnitsAfter),
          reason: description || `Visit Completed: ${visitId}`,
        }
      });
    }
  }

  const newAvailable = Math.max(0, balance.totalUnits - balanceAfter - reservedUnitsAfter);

  await tx.subscriptionBenefitBalance.update({
    where: { id: balance.id },
    data: {
      usedUnits: { increment: unitsToDeduct },
      reservedUnits: reservedUnitsAfter,
      availableUnits: newAvailable,
    },
  });

  await tx.packageHoursLog.create({
    data: {
      subscriptionId,
      beneficiaryId,
      visitId,
      hoursConsumed,
      balanceBefore,
      balanceAfter,
      description,
    },
  });
}

/**
 * Release a HELD benefit reservation when a visit is cancelled, missed, or deleted.
 * Restores the reserved unit back to available quota.
 */
async function releaseVisitBenefitReservation(tx, visitId, reason = 'Visit cancelled/missed') {
  if (!visitId) return;
  const reservation = await tx.benefitReservation.findFirst({
    where: { visitId, status: 'HELD' },
    include: { balance: true }
  });

  if (!reservation) return;

  await tx.benefitReservation.update({
    where: { id: reservation.id },
    data: { status: 'RELEASED' }
  });

  if (reservation.balance) {
    const bal = reservation.balance;
    const reservedAfter = Math.max(0, bal.reservedUnits - reservation.units);
    const availableAfter = Math.max(0, bal.totalUnits - bal.usedUnits - reservedAfter);

    await tx.subscriptionBenefitBalance.update({
      where: { id: bal.id },
      data: {
        reservedUnits: reservedAfter,
        availableUnits: availableAfter,
      }
    });

    await tx.benefitTransaction.create({
      data: {
        balanceId: bal.id,
        reservationId: reservation.id,
        transactionType: 'RELEASED',
        units: reservation.units,
        totalBefore: bal.totalUnits,
        totalAfter: bal.totalUnits,
        reservedBefore: bal.reservedUnits,
        reservedAfter,
        usedBefore: bal.usedUnits,
        usedAfter: bal.usedUnits,
        availableBefore: bal.availableUnits,
        availableAfter,
        reason,
      }
    });
    console.log(`[RESERVATION RELEASED] Released reservation ${reservation.id} for visit ${visitId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/visits
 * Schedule a new visit and optionally deduct a visit-count benefit.
 * Body: { beneficiaryId, careCompanionId, scheduledTime, durationMinutes, benefitId? }
 *
 * Deduction logic:
 *  - If benefitId is provided, find the benefit's unitLabel:
 *      "visits" → deduct 1 unit immediately at scheduling
 *      "hours"  → defer deduction to checkout (PATCH /:id/complete)
 */
router.post('/', async (req, res) => {
  const {
    beneficiaryId,
    careCompanionId,
    scheduledTime,
    durationMinutes,
    benefitId,
    subscriptionId,
    is3rdParty,
    thirdPartyNotes,
  } = req.body;

  const isThirdPartyVisit = is3rdParty === true || careCompanionId === 'THIRD_PARTY';

  if (!beneficiaryId || (!careCompanionId && !isThirdPartyVisit) || !scheduledTime || !durationMinutes || !benefitId) {
    return res.status(400).json({ success: false, message: 'Missing required fields (benefit type is mandatory)' });
  }

  const startTime = new Date(scheduledTime);
  if (startTime.getTime() < Date.now() - 60000) {
    return res.status(400).json({ success: false, message: 'Cannot schedule a visit in the past' });
  }

  try {
    // 1. Check CC Availability (only for internal CC visits)
    if (!isThirdPartyVisit && careCompanionId) {
      const availability = await checkCCAvailability(careCompanionId, startTime, durationMinutes);
      if (!availability.isAvailable) {
        return res.status(409).json({ success: false, message: availability.reason });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // A. Create the Visit — store benefitId as a proper FK column
      const visit = await tx.visit.create({
        data: {
          encounterId: `V-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          visitCode: generateVisitCode(),
          beneficiaryId,
          careCompanionId: isThirdPartyVisit ? null : careCompanionId,
          is3rdParty: isThirdPartyVisit,
          thirdPartyNotes: thirdPartyNotes || null,
          scheduledTime: startTime,
          durationMinutes,
          status: 'scheduled',
          benefitId: benefitId || null,
        },
        include: {
          beneficiary: { select: { name: true, userId: true, subscriberId: true } },
          careCompanion: { select: { name: true, userId: true } },
        },
      });

      // B. Create a HELD BenefitReservation in the double-entry ledger so units are reserved
      //    The unit is converted to CONSUMED at checkout, or RELEASED if cancelled/missed.
      if (benefitId) {
        let bal = null;
        let selectedSub = null;

        // 1. If explicit subscriptionId was provided, check if it has available balance
        if (subscriptionId) {
          const explicitSub = await tx.subscription.findFirst({
            where: {
              id: subscriptionId,
              beneficiaryId,
              isActive: true,
            },
            include: { benefitBalances: { where: { benefitId } } }
          });
          if (explicitSub && explicitSub.benefitBalances && explicitSub.benefitBalances.length > 0) {
            const candidateBal = explicitSub.benefitBalances[0];
            const candidateAvail = candidateBal.totalUnits === -1 ? 999999 : (candidateBal.totalUnits - candidateBal.reservedUnits - candidateBal.usedUnits);
            if (candidateAvail > 0) {
              bal = candidateBal;
              selectedSub = explicitSub;
            }
          }
        }

        // 2. If no subscriptionId provided or that package was exhausted, find any active subscription with availableUnits > 0
        //    Order by earliest endDate so expiring packages are consumed first (FIFO)
        if (!bal) {
          const candidateSubs = await tx.subscription.findMany({
            where: {
              beneficiaryId,
              isActive: true,
              endDate: { gte: new Date() },
              benefitBalances: {
                some: { benefitId }
              }
            },
            include: { benefitBalances: { where: { benefitId } } },
            orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }]
          });

          for (const sub of candidateSubs) {
            const candidateBal = sub.benefitBalances[0];
            if (candidateBal) {
              const candidateAvail = candidateBal.totalUnits === -1 ? 999999 : (candidateBal.totalUnits - candidateBal.reservedUnits - candidateBal.usedUnits);
              if (candidateAvail > 0) {
                bal = candidateBal;
                selectedSub = sub;
                break;
              }
            }
          }
        }

        if (!bal) {
          throw new Error('Insufficient benefit balance available for this visit across active packages');
        }

        const reservedBefore = bal.reservedUnits;
        const usedBefore = bal.usedUnits;
        const totalBefore = bal.totalUnits;
        const availableBefore = bal.totalUnits === -1 ? 999999 : Math.max(0, bal.totalUnits - bal.reservedUnits - bal.usedUnits);

        const reservedAfter = reservedBefore + 1;
        const availableAfter = bal.totalUnits === -1 ? 999999 : Math.max(0, availableBefore - 1);

        const resHold = await tx.benefitReservation.create({
          data: {
            balanceId: bal.id,
            beneficiaryId,
            units: 1,
            status: 'HELD',
            visitId: visit.id,
          }
        });

        await tx.benefitTransaction.create({
          data: {
            balanceId: bal.id,
            reservationId: resHold.id,
            transactionType: 'RESERVED',
            units: -1,
            totalBefore, totalAfter: totalBefore,
            reservedBefore, reservedAfter,
            usedBefore, usedAfter: usedBefore,
            availableBefore, availableAfter,
            reason: `Visit Scheduled Encounter: ${visit.encounterId} (Plan: ${selectedSub?.packageType || selectedSub?.id || 'Active'})`,
            performedByUserId: req.user?.id || null
          }
        });

        await tx.subscriptionBenefitBalance.update({
          where: { id: bal.id },
          data: { reservedUnits: reservedAfter, availableUnits: availableAfter }
        });

        console.log(`[VISIT SCHEDULE] Reserved 1 unit (HELD reservation ${resHold.id} on sub ${bal.subscriptionId}) for visit ${visit.id}`);
      }


      // C. Activity Log
      await tx.activityLog.create({
        data: {
          userId: visit.beneficiary.userId,
          type: 'VISIT',
          action: 'VISIT_SCHEDULED',
          details: {
            visitId: visit.id,
            encounterId: visit.encounterId,
            beneficiaryId,
            beneficiaryName: visit.beneficiary?.name,
            careCompanionId,
            careCompanionName: visit.careCompanion?.name,
            scheduledTime,
            durationMinutes,
            actorName: req.user?.name || 'System Admin',
            actorPhone: req.user?.phone || 'Static Login',
          },
        },
      });

      return visit;
    });

    // Fire Omnichannel Notifications (FCM Push + WhatsApp) asynchronously
    visitEventDispatcher.dispatchVisitScheduled(result);

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('POST /visits error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/visits/:id/complete
 * Marks a visit as completed, records checkIn/checkOut times,
 * and deducts hours from the subscription benefit balance.
 *
 * Hours billing rule:
 *   - If actual duration < 60 mins → charge 1 full hour (minimum billing unit)
 *   - If actual duration >= 60 mins → charge actual minutes (as decimal hours)
 *   Formula: Math.max(60, actualMinutes) / 60
 *
 * Body: { checkInTime, checkOutTime, benefitId? (override), notes?, visitSummary? }
 */
router.patch('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { checkInTime, checkOutTime, benefitId: overrideBenefitId, notes, visitSummary } = req.body;

  if (!checkInTime || !checkOutTime) {
    return res.status(400).json({ success: false, message: 'checkInTime and checkOutTime are required' });
  }

  try {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);

    if (checkOut <= checkIn) {
      return res.status(400).json({ success: false, message: 'checkOutTime must be after checkInTime' });
    }

    const actualMinutes = Math.round((checkOut - checkIn) / 60000);

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true, userId: true } },
        careCompanion: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (visit.status === 'completed') return res.status(400).json({ success: false, message: 'Visit is already completed' });
    if (visit.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cannot complete a cancelled visit' });
    if (visit.status === 'missed') return res.status(400).json({ success: false, message: 'Cannot complete a missed visit' });

    // Determine which benefitId to charge at checkout.
    // Now stored as a proper FK on the visit record — no notes parsing needed.
    let hoursBenefitId = overrideBenefitId || visit.benefitId || null;

    const result = await prisma.$transaction(async (tx) => {
      // Update visit status — never touch notes to extract benefitId anymore
      const updatedVisit = await tx.visit.update({
        where: { id },
        data: {
          status: 'completed',
          checkInTime: checkIn,
          checkOutTime: checkOut,
          durationMinutes: actualMinutes,
          notes: notes || visit.notes,
          visitSummary: visitSummary || visit.visitSummary,
        },
        include: {
          beneficiary: { select: { name: true, userId: true } },
          careCompanion: { select: { name: true, userId: true } },
        },
      });

      // ── Deduct benefit at CHECKOUT (the only place deduction happens) ──────────
      // Deduction was intentionally NOT done at scheduling.
      // This ensures missed visits (CC no-show) never consume the user's benefit.
      if (hoursBenefitId) {
        const benefit = await tx.benefit.findUnique({
          where: { id: hoursBenefitId },
          select: { id: true, name: true, unitLabel: true },
        });

        if (benefit) {
          const unitLabelLower = (benefit.unitLabel || '').toLowerCase();
          const isHourBased = unitLabelLower.includes('hour') || unitLabelLower.includes('hr');
          // Session/visit-count: anything not hour-based (includes 'visit', 'session', or no label)
          const isSessionBased = !isHourBased;

          console.log(`[COMPLETE] benefitId=${hoursBenefitId} name="${benefit.name}" unitLabel="${benefit.unitLabel}" → isHourBased=${isHourBased} isSessionBased=${isSessionBased}`);

          // If a reservation exists for this visit, use its exact subscription!
          const existingReservation = await tx.benefitReservation.findFirst({
            where: { visitId: id, status: 'HELD' },
            include: { balance: true }
          });

          let subscription = null;
          if (existingReservation?.balance?.subscriptionId) {
            subscription = await tx.subscription.findUnique({
              where: { id: existingReservation.balance.subscriptionId }
            });
          }

          if (!subscription) {
            const activeSubs = await tx.subscription.findMany({
              where: {
                beneficiaryId: visit.beneficiaryId,
                isActive: true,
                endDate: { gte: new Date() },
                benefitBalances: { some: { benefitId: hoursBenefitId } }
              },
              include: { benefitBalances: { where: { benefitId: hoursBenefitId } } },
              orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }]
            });

            subscription = activeSubs.find(s => {
              const b = s.benefitBalances[0];
              return b && (b.totalUnits === -1 || (b.usedUnits + 1) <= b.totalUnits);
            }) || activeSubs[0] || null;
          }

          if (!subscription) {
            console.warn(`[COMPLETE] No active subscription found for beneficiary ${visit.beneficiaryId} — skipping deduction.`);
          } else if (isHourBased) {
            // HOUR-BASED: charge actual duration (min 1h billing rule)
            //   < 60 min  → charge exactly 1h
            //   >= 60 min → charge actual time
            const billableMinutes = Math.max(60, actualMinutes);
            const hoursConsumed = billableMinutes / 60;

            console.log(`[COMPLETE] Hour-based — deducting ${hoursConsumed}h from "${benefit.name}" (sub=${subscription.id})`);
            await deductBenefitBalance(tx, {
              subscriptionId: subscription.id,
              beneficiaryId: visit.beneficiaryId,
              benefitId: hoursBenefitId,
              visitId: id,
              unitsToDeduct: hoursConsumed,
              hoursConsumed,
              description: `Visit completed: ${visit.encounterId} — ${actualMinutes} min, billed as ${hoursConsumed.toFixed(2)}h`,
            });

            await tx.subscription.update({
              where: { id: subscription.id },
              data: { hoursUsed: { increment: hoursConsumed } },
            });
          } else {
            // SESSION/VISIT-COUNT: charge 1 unit for completing this visit
            console.log(`[COMPLETE] Session-based — deducting 1 unit from "${benefit.name}" (sub=${subscription.id})`);
            await deductBenefitBalance(tx, {
              subscriptionId: subscription.id,
              beneficiaryId: visit.beneficiaryId,
              benefitId: hoursBenefitId,
              visitId: id,
              unitsToDeduct: 1,
              hoursConsumed: actualMinutes / 60,
              description: `Visit completed: ${visit.encounterId} — session benefit "${benefit.name}" consumed`,
            });

            await tx.subscription.update({
              where: { id: subscription.id },
              data: { visitsCompleted: { increment: 1 } },
            });
          }
        }
      }

      // Activity log
      await tx.activityLog.create({
        data: {
          userId: updatedVisit.beneficiary.userId,
          type: 'VISIT',
          action: 'VISIT_COMPLETED',
          details: {
            visitId: id,
            encounterId: visit.encounterId,
            beneficiaryId: visit.beneficiaryId,
            careCompanionId: visit.careCompanionId,
            actualMinutes,
            actorName: req.user?.name || 'System',
          },
        },
      });

      return updatedVisit;
    });

    // Trigger VISIT_COMPLETED event notification (Push + WhatsApp)
    visitEventDispatcher.dispatchVisitCompleted(result, actualMinutes);

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('PATCH /visits/:id/complete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/visits/check-availability
// ─────────────────────────────────────────────────────────────────────────────
router.get('/check-availability', async (req, res) => {
  const { careCompanionId, scheduledTime, durationMinutes } = req.query;
  try {
    if (!careCompanionId || !scheduledTime || !durationMinutes) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }
    const availability = await checkCCAvailability(
      careCompanionId,
      new Date(scheduledTime),
      parseInt(durationMinutes)
    );
    res.json({ success: true, data: availability });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/visits/service-requests ─────────────────────────────────────────
// Aggregated Visit/Service Requests with Multi-Select Filters
// NOTE: Must be registered BEFORE /:id to avoid being swallowed as a visit ID.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/service-requests', async (req, res) => {
  try {
    const {
      beneficiaryIds,
      careCompanionIds,
      teamIds,
      zoneIds,
      isRead,
      search,
      startDate,
      endDate,
    } = req.query;

    const where = {};

    // Filter by read status
    if (isRead === 'true') {
      where.isRead = true;
    } else if (isRead === 'false') {
      where.isRead = false;
    }

    // Filter by date range (created date or preferred date)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        where.createdAt.lte = endD;
      }
    }

    // Beneficiary filter
    const beneficiaryWhere = {};

    if (beneficiaryIds) {
      const bIds = String(beneficiaryIds).split(',').map((s) => s.trim()).filter(Boolean);
      if (bIds.length > 0) {
        beneficiaryWhere.id = { in: bIds };
      }
    }

    if (teamIds) {
      const tIds = String(teamIds).split(',').map((s) => s.trim()).filter(Boolean);
      if (tIds.length > 0) {
        beneficiaryWhere.teamId = { in: tIds };
      }
    }

    if (careCompanionIds) {
      const ccIds = String(careCompanionIds).split(',').map((s) => s.trim()).filter(Boolean);
      if (ccIds.length > 0) {
        beneficiaryWhere.OR = [
          { primaryCcId: { in: ccIds } },
          { secondaryCcId: { in: ccIds } },
        ];
      }
    }

    if (Object.keys(beneficiaryWhere).length > 0) {
      where.beneficiary = beneficiaryWhere;
    }

    const requests = await prisma.serviceRequest.findMany({
      where,
      include: {
        beneficiary: {
          include: {
            user: { select: { id: true, name: true, phone: true, location: true } },
            team: { select: { id: true, name: true } },
            primaryCC: { include: { user: { select: { name: true, phone: true } } } },
            secondaryCC: { include: { user: { select: { name: true, phone: true } } } },
            subscriptions: {
              where: { isActive: true },
              include: {
                package: { select: { name: true } },
                benefitBalances: {
                  include: {
                    benefit: { select: { id: true, name: true, unitLabel: true } }
                  }
                }
              },
              take: 1
            }
          }
        },
        subscriber: { select: { id: true, name: true, phone: true } },
        requestedByUser: { select: { id: true, name: true, phone: true } },
        benefit: {
          select: {
            id: true,
            name: true,
            unitLabel: true,
            benefitType: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Optional text search filter
    let filtered = requests;
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      filtered = requests.filter((r) => {
        const bName = r.beneficiary?.name?.toLowerCase() || '';
        const sName = r.subscriber?.name?.toLowerCase() || '';
        const benefitName = r.benefit?.name?.toLowerCase() || '';
        const pincode = r.beneficiary?.pincode || '';
        return bName.includes(q) || sName.includes(q) || benefitName.includes(q) || pincode.includes(q);
      });
    }

    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('GET /api/visits/service-requests error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/visits/:id - Get a single visit by ID
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true, user: { select: { phone: true } }, latitude: true, longitude: true, primaryCcId: true, secondaryCcId: true } },
        careCompanion: { select: { id: true, name: true, user: { select: { phone: true } } } },
        benefit: { select: { id: true, name: true, unitLabel: true } },
        medicationAdherenceRecords: true,
        vitalReadings: {
          include: {
            vitalDefinition: { select: { id: true, name: true, unit: true, dataType: true, code: true, booleanTrueLabel: true, booleanFalseLabel: true } },
            capturedBy: { select: { id: true, name: true } }
          }
        }
      },
    });

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    let resolvedImageUrls = visit.imageUrls;
    if (visit.imageUrls) {
      try {
        const urls = await resolveFileUrls(visit.imageUrls, 1800);
        resolvedImageUrls = JSON.stringify(urls);
      } catch (e) {
        console.error('Failed to parse imageUrls for visit', visit.id, e);
      }
    }

    // Flatten the phone number to make it easier for the frontend
    const formattedVisit = {
      ...visit,
      imageUrls: resolvedImageUrls,
      beneficiary: visit.beneficiary ? {
        ...visit.beneficiary,
        phone: visit.beneficiary.user?.phone
      } : null,
      careCompanion: visit.careCompanion ? {
        ...visit.careCompanion,
        phone: visit.careCompanion.user?.phone
      } : null
    };

    res.json({ success: true, data: formattedVisit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/visits/:id/edit - Admin edits visit notes/summary/follow-up
// Logs every field that changed to activity_logs
// Body: { notes?, visitSummary?, followUpRequired?, followUpNotes?, followUpDate?,
//         escalateToManager?, escalationReason?, actorName? }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/resolve-change', async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
    const visit = await prisma.visit.findUnique({ where: { id } });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    
    let updateData = {
      changeRequestStatus: status,
      changeResolutionReason: reason || null,
    };

    if (status === 'accepted') {
      try {
        if (visit.changePreferredDate && visit.changePreferredTime) {
          const newDateStr = `${visit.changePreferredDate} ${visit.changePreferredTime}`;
          const newScheduledTime = new Date(newDateStr);
          if (!isNaN(newScheduledTime.getTime())) {
            updateData.scheduledTime = newScheduledTime;
          }
        }
      } catch (e) {
        console.error("Error parsing new scheduled time", e);
      }
    }

    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, visit: updatedVisit });
  } catch (error) {
    console.error('Error resolving visit change:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/edit', async (req, res) => {
  const { id } = req.params;
  const {
    notes,
    visitSummary,
    followUpRequired,
    followUpNotes,
    followUpDate,
    escalateToManager,
    escalationReason,
    actorName,
    imageUrls, // Array<string> — the FULL updated list after admin deletions
    checkInTime,
    checkOutTime,
  } = req.body;

  try {
    const existing = await prisma.visit.findUnique({
      where: { id },
      select: {
        notes: true, visitSummary: true, followUpRequired: true,
        followUpNotes: true, followUpDate: true, escalateToManager: true,
        escalationReason: true, imageUrls: true, beneficiaryId: true,
        checkInTime: true, checkOutTime: true, durationMinutes: true,
        beneficiary: { select: { userId: true } }
      }
    });

    if (!existing) return res.status(404).json({ success: false, message: 'Visit not found' });

    // Build diff for audit log
    const changes = {};
    const updateData = {};

    const track = (field, newVal) => {
      if (newVal !== undefined && newVal !== existing[field]) {
        changes[field] = { from: existing[field], to: newVal };
        updateData[field] = newVal;
      }
    };

    track('notes', notes);
    track('visitSummary', visitSummary);
    track('followUpRequired', followUpRequired);
    track('followUpNotes', followUpNotes);
    track('escalateToManager', escalateToManager);
    track('escalationReason', escalationReason);
    if (followUpDate !== undefined) {
      const d = followUpDate ? new Date(followUpDate) : null;
      const oldD = existing.followUpDate ? new Date(existing.followUpDate).toISOString() : null;
      const newD = d ? d.toISOString() : null;
      if (oldD !== newD) {
        changes.followUpDate = { from: oldD, to: newD };
        updateData.followUpDate = d;
      }
    }
    // imageUrls: admin sent the new full array (after deletions or additions)
    if (imageUrls !== undefined) {
      const cleanKeys = Array.isArray(imageUrls)
        ? imageUrls.map(img => extractStorageKey(img) || img).filter(Boolean)
        : [];
      const newJson = JSON.stringify(cleanKeys);
      if (newJson !== existing.imageUrls) {
        changes.imageUrls = { from: existing.imageUrls, to: newJson };
        updateData.imageUrls = newJson;
      }
    }
    // checkInTime
    if (checkInTime !== undefined) {
      const d = checkInTime ? new Date(checkInTime) : null;
      const oldD = existing.checkInTime ? new Date(existing.checkInTime).toISOString() : null;
      const newD = d ? d.toISOString() : null;
      if (oldD !== newD) {
        changes.checkInTime = { from: oldD, to: newD };
        updateData.checkInTime = d;
      }
    }
    // checkOutTime
    if (checkOutTime !== undefined) {
      const d = checkOutTime ? new Date(checkOutTime) : null;
      const oldD = existing.checkOutTime ? new Date(existing.checkOutTime).toISOString() : null;
      const newD = d ? d.toISOString() : null;
      if (oldD !== newD) {
        changes.checkOutTime = { from: oldD, to: newD };
        updateData.checkOutTime = d;
      }
    }

    // Automatically recalculate durationMinutes if check-in & check-out times are available
    const finalIn = updateData.checkInTime !== undefined ? updateData.checkInTime : existing.checkInTime;
    const finalOut = updateData.checkOutTime !== undefined ? updateData.checkOutTime : existing.checkOutTime;
    if (finalIn && finalOut) {
      const inMs = new Date(finalIn).getTime();
      const outMs = new Date(finalOut).getTime();
      if (outMs >= inMs) {
        const diffMinutes = Math.max(1, Math.round((outMs - inMs) / 60000));
        if (diffMinutes !== existing.durationMinutes) {
          changes.durationMinutes = { from: existing.durationMinutes, to: diffMinutes };
          updateData.durationMinutes = diffMinutes;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ success: true, data: existing, message: 'No changes detected' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.visit.update({ where: { id }, data: updateData });

      // Activity log
      await tx.activityLog.create({
        data: {
          userId: existing.beneficiary?.userId || existing.beneficiaryId,
          type: 'VISIT',
          action: 'VISIT_EDITED',
          details: {
            visitId: id,
            editedBy: actorName || req.user?.name || 'Admin',
            changes,
            editedAt: new Date().toISOString(),
          },
        },
      });

      return updatedVisit;
    });

    res.json({ success: true, data: updated, changesLogged: changes });
  } catch (err) {
    console.error('PATCH /visits/:id/edit error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/visits/:id/upload-image - Upload a new image for a visit
// Accepts multipart/form-data with field "image"
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/upload-image', uploadMemory.single('image'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  try {
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filePath = `visit-images/${id}/${uuidv4()}${ext}`;

    const { url } = await storage.upload(req.file.buffer, filePath, req.file.mimetype);

    // Append URL to the visit's imageUrls JSON array
    const visit = await prisma.visit.findUnique({ where: { id }, select: { imageUrls: true } });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

    let existing = [];
    try { existing = visit.imageUrls ? JSON.parse(visit.imageUrls) : []; } catch (_) {}
    const cleanKey = extractStorageKey(url) || filePath;
    existing.push(cleanKey);

    await prisma.visit.update({ where: { id }, data: { imageUrls: JSON.stringify(existing) } });

    const resolvedUrl = await resolveFileUrl(cleanKey, 1800);
    const resolvedImageUrls = await resolveFileUrls(existing, 1800);

    res.json({ success: true, data: { url: resolvedUrl, imageUrls: resolvedImageUrls } });
  } catch (err) {
    console.error('POST /visits/:id/upload-image error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/visits - Get all visits (optionally filtered)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { beneficiaryId, careCompanionId, date, fmUserId, visitCode, hasChangeRequest } = req.query;
  try {
    // Auto-update missed visits
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    try {
      const expiredVisits = await prisma.visit.findMany({
        where: {
          status: 'scheduled',
          scheduledTime: { lt: startOfToday },
        },
        select: { id: true }
      });

      if (expiredVisits.length > 0) {
        for (const ev of expiredVisits) {
          await releaseVisitBenefitReservation(prisma, ev.id, 'Auto-marked missed by system');
        }
      }

      await prisma.visit.updateMany({
        where: {
          status: 'scheduled',
          scheduledTime: {
            lt: startOfToday,
          },
        },
        data: {
          status: 'missed',
        },
      });
    } catch (err) {
      console.error('Error auto-updating missed visits:', err);
    }
    const where = {};
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;

    // Filter by human-readable visitCode (case-insensitive partial match, ignoring leading #)
    if (visitCode) {
      const cleanCode = String(visitCode).replace(/^#/, '').trim().toUpperCase();
      if (cleanCode) {
        where.visitCode = { contains: cleanCode, mode: 'insensitive' };
      }
    }
    if (date) {
      if (date === 'next_7') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
        where.scheduledTime = { gte: start, lte: end };
      } else {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.scheduledTime = { gte: start, lte: end };
      }
    }
    if (hasChangeRequest === 'true') {
      where.changeRequestedAt = { not: null };
    }
    // RBAC: scope by zone (OM) or team (FM)
    const roleFilter = await getVisitFilter(req.user);
    Object.assign(where, roleFilter);

    // Filter by Field Manager and/or Care Companion
    if (fmUserId) {
      const fmScopeCondition = {
        OR: [
          {
            careCompanion: {
              team: { fieldManager: { userId: fmUserId } },
            },
          },
          {
            beneficiary: {
              OR: [
                { team: { fieldManager: { userId: fmUserId } } },
                { primaryCC: { team: { fieldManager: { userId: fmUserId } } } },
                { secondaryCC: { team: { fieldManager: { userId: fmUserId } } } },
              ],
            },
          },
        ],
      };

      if (careCompanionId === 'THIRD_PARTY' || careCompanionId === 'null') {
        where.AND = [
          ...(where.AND || []),
          fmScopeCondition,
          {
            OR: [
              { is3rdParty: true },
              { careCompanionId: null },
            ],
          },
        ];
      } else if (careCompanionId) {
        where.careCompanionId = careCompanionId;
      } else {
        where.AND = [
          ...(where.AND || []),
          fmScopeCondition,
        ];
      }
    } else {
      if (careCompanionId === 'THIRD_PARTY' || careCompanionId === 'null') {
        where.OR = [
          { is3rdParty: true },
          { careCompanionId: null },
        ];
      } else if (careCompanionId) {
        where.careCompanionId = careCompanionId;
      }
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        beneficiary: { select: { id: true, name: true, latitude: true, longitude: true, primaryCcId: true, secondaryCcId: true } },
        benefit: { select: { id: true, name: true, unitLabel: true } },
        careCompanion: {
          select: {
            id: true,
            name: true,
            team: {
              select: {
                id: true,
                fieldManager: { select: { id: true, userId: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    // Attach geo-fencing fields + visitCode to each visit for the admin UI
    const visitsWithGeo = await Promise.all(visits.map(async (v) => {
      let resolvedImageUrls = v.imageUrls;
      if (v.imageUrls) {
        try {
          const urls = await resolveFileUrls(v.imageUrls, 1800);
          resolvedImageUrls = JSON.stringify(urls);
        } catch (e) {
          console.error('Failed to parse imageUrls for visit', v.id, e);
        }
      }

      return {
        ...v,
        imageUrls: resolvedImageUrls,
        visitCode: v.visitCode,
        isGeoVerified: v.isGeoVerified,
        geoDistanceMeters: v.geoDistanceMeters,
        manualCheckInReason: v.manualCheckInReason,
        checkInLat: v.checkInLat,
        checkInLng: v.checkInLng,
      };
    }));

    res.json({ success: true, data: visitsWithGeo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/visits/:id - Cancel or delete a scheduled visit and release quota
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { can } = require('../utils/rbac');
  if (!can(req.user, 'visits.delete') && !can(req.user, 'visits.cancel_status')) {
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions to cancel/delete visits' });
  }

  try {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { name: true, userId: true, subscriberId: true } },
        careCompanion: { select: { name: true, userId: true } },
      },
    });

    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (visit.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel or delete a completed visit' });
    }

    const isPermanent = req.query.permanent === 'true';

    await prisma.$transaction(async (tx) => {
      // Release any HELD benefit reservation so senior quota is restored
      await releaseVisitBenefitReservation(tx, id, isPermanent ? 'Visit permanently deleted' : 'Visit cancelled via admin');

      if (isPermanent) {
        // Cascade delete reservations, transactions link, and package logs
        await tx.benefitReservation.deleteMany({ where: { visitId: id } });
        await tx.packageHoursLog.deleteMany({ where: { visitId: id } });
        await tx.visit.delete({ where: { id } });
        console.log(`[DELETE VISIT] Visit ${id} permanently removed from database.`);
      } else {
        await tx.visit.update({ where: { id }, data: { status: 'cancelled' } });

        // Idempotency safety: if somehow a log exists, remove it.
        const log = await tx.packageHoursLog.findUnique({ where: { visitId: id } });
        if (log) {
          console.warn(`[CANCEL VISIT] Found unexpected log for visit ${id} — removing orphan log.`);
          await tx.packageHoursLog.delete({ where: { id: log.id } });
        }
        console.log(`[CANCEL VISIT] Visit ${id} cancelled and reserved benefit released.`);
      }
    });

    // Trigger VISIT_CANCELLED event notification (Push + WhatsApp)
    visitEventDispatcher.dispatchVisitCancelled(visit);

    res.json({
      success: true,
      message: isPermanent ? 'Visit deleted permanently and quota released' : 'Visit cancelled successfully and quota released'
    });
  } catch (err) {
    console.error('DELETE /visits/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/visits/:id - Update an upcoming scheduled visit
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { careCompanionId, scheduledTime, durationMinutes } = req.body;

  if (!scheduledTime || !durationMinutes) {
    return res.status(400).json({ success: false, message: 'Missing required fields (scheduledTime, durationMinutes)' });
  }

  try {
    const existingVisit = await prisma.visit.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { name: true, userId: true } },
        careCompanion: { select: { name: true, userId: true } },
      },
    });

    if (!existingVisit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (!['scheduled', 'missed', 'completed', 'cancelled'].includes(existingVisit.status)) {
      return res.status(400).json({ success: false, message: 'Only scheduled, missed, completed, or cancelled visits can be modified or rescheduled' });
    }

    const startTime = new Date(scheduledTime);

    if (startTime.getTime() < Date.now() - 60000) {
      return res.status(400).json({ success: false, message: 'Cannot reschedule a visit to a past date/time' });
    }

    const isThirdParty = careCompanionId === 'THIRD_PARTY' || (!careCompanionId && existingVisit.is3rdParty);
    const targetCcId = isThirdParty ? null : (careCompanionId || existingVisit.careCompanionId);

    if (!isThirdParty && targetCcId) {
      if (
        targetCcId !== existingVisit.careCompanionId ||
        startTime.getTime() !== new Date(existingVisit.scheduledTime).getTime() ||
        durationMinutes !== existingVisit.durationMinutes
      ) {
        const availability = await checkCCAvailability(targetCcId, startTime, durationMinutes, id);
        if (!availability.isAvailable) {
          return res.status(409).json({ success: false, message: availability.reason });
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // If the visit is being reactivated / rescheduled from a non-scheduled state ('missed', 'completed', 'cancelled')
      if (existingVisit.status !== 'scheduled') {
        const benefitId = existingVisit.benefitId;
        const beneficiaryId = existingVisit.beneficiaryId;

        // 1. Check if there is already a HELD reservation for this visit
        let existingHeld = await tx.benefitReservation.findFirst({
          where: { visitId: id, status: 'HELD' }
        });

        // 2. If it was completed, check if it had a CONSUMED reservation that should be reverted back to HELD
        if (existingVisit.status === 'completed' && !existingHeld) {
          const consumedRes = await tx.benefitReservation.findFirst({
            where: { visitId: id, status: 'CONSUMED' },
            include: { balance: true }
          });
          if (consumedRes && consumedRes.balance) {
            const bal = consumedRes.balance;
            await tx.benefitReservation.update({
              where: { id: consumedRes.id },
              data: { status: 'HELD' }
            });
            const usedAfter = Math.max(0, bal.usedUnits - consumedRes.units);
            const reservedAfter = bal.reservedUnits + consumedRes.units;
            const availableAfter = bal.totalUnits === -1 ? 999999 : Math.max(0, bal.totalUnits - usedAfter - reservedAfter);
            await tx.subscriptionBenefitBalance.update({
              where: { id: bal.id },
              data: {
                usedUnits: usedAfter,
                reservedUnits: reservedAfter,
                availableUnits: availableAfter
              }
            });

            await tx.benefitTransaction.create({
              data: {
                balanceId: bal.id,
                reservationId: consumedRes.id,
                transactionType: 'RESERVED',
                units: -consumedRes.units,
                totalBefore: bal.totalUnits,
                totalAfter: bal.totalUnits,
                reservedBefore: bal.reservedUnits,
                reservedAfter,
                usedBefore: bal.usedUnits,
                usedAfter,
                availableBefore: bal.availableUnits,
                availableAfter,
                reason: `Reactivated/Rescheduled Completed Visit: ${existingVisit.visitCode || id}`,
                performedByUserId: req.user?.id || null,
              }
            });

            // Adjust subscription completed count
            await tx.subscription.update({
              where: { id: bal.subscriptionId },
              data: {
                visitsCompleted: { decrement: 1 }
              }
            }).catch(() => {});

            existingHeld = consumedRes;
          }
        }

        // 3. If still no HELD reservation and a benefit is linked, reserve 1 unit from active package
        if (!existingHeld && benefitId) {
          const candidateSubs = await tx.subscription.findMany({
            where: {
              beneficiaryId,
              isActive: true,
              endDate: { gte: new Date() },
              benefitBalances: { some: { benefitId } }
            },
            include: { benefitBalances: { where: { benefitId } } },
            orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }]
          });

          let targetBal = null;
          for (const sub of candidateSubs) {
            const b = sub.benefitBalances[0];
            if (b) {
              const avail = b.totalUnits === -1 ? 999999 : (b.totalUnits - b.reservedUnits - b.usedUnits);
              if (avail > 0) {
                targetBal = b;
                break;
              }
            }
          }

          if (!targetBal) {
            throw new Error('Cannot reschedule visit: Insufficient benefit balance in active packages');
          }

          const reservedBefore = targetBal.reservedUnits;
          const availableBefore = targetBal.totalUnits === -1 ? 999999 : Math.max(0, targetBal.totalUnits - targetBal.reservedUnits - targetBal.usedUnits);
          const reservedAfter = reservedBefore + 1;
          const availableAfter = targetBal.totalUnits === -1 ? 999999 : Math.max(0, availableBefore - 1);

          const newRes = await tx.benefitReservation.create({
            data: {
              balanceId: targetBal.id,
              beneficiaryId,
              units: 1,
              status: 'HELD',
              visitId: id,
            }
          });

          await tx.benefitTransaction.create({
            data: {
              balanceId: targetBal.id,
              reservationId: newRes.id,
              transactionType: 'RESERVED',
              units: -1,
              totalBefore: targetBal.totalUnits,
              totalAfter: targetBal.totalUnits,
              reservedBefore,
              reservedAfter,
              usedBefore: targetBal.usedUnits,
              usedAfter: targetBal.usedUnits,
              availableBefore,
              availableAfter,
              reason: `Rescheduled ${existingVisit.status} Visit: ${existingVisit.visitCode || id}`,
              performedByUserId: req.user?.id || null,
            }
          });

          await tx.subscriptionBenefitBalance.update({
            where: { id: targetBal.id },
            data: { reservedUnits: reservedAfter, availableUnits: availableAfter }
          });
        }
      }

      const updateData = {
        status: 'scheduled',
        careCompanionId: targetCcId,
        is3rdParty: isThirdParty,
        scheduledTime: startTime,
        durationMinutes
      };
      if (existingVisit.status !== 'scheduled') {
        updateData.checkInTime = null;
        updateData.checkOutTime = null;
      }

      const updatedVisit = await tx.visit.update({
        where: { id },
        data: updateData,
        include: {
          beneficiary: { select: { name: true, userId: true, subscriberId: true } },
          careCompanion: { select: { name: true, userId: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: updatedVisit.beneficiary.userId,
          type: 'VISIT',
          action: 'VISIT_UPDATED',
          details: {
            visitId: updatedVisit.id,
            encounterId: updatedVisit.encounterId,
            beneficiaryId: updatedVisit.beneficiaryId,
            beneficiaryName: updatedVisit.beneficiary?.name,
            careCompanionId: updatedVisit.careCompanionId,
            careCompanionName: updatedVisit.careCompanion?.name,
            oldScheduledTime: existingVisit.scheduledTime,
            newScheduledTime: startTime,
            actorName: req.user?.name || 'System Admin',
          },
        },
      });

      return updatedVisit;
    });

    // Trigger VISIT_RESCHEDULED event notification (Push + WhatsApp)
    visitEventDispatcher.dispatchVisitRescheduled(result, existingVisit.scheduledTime);

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('PUT /visits/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/visits/:id/status - Update visit status (completed, missed, cancelled)
// Deducts package benefit balance when marked COMPLETED
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, note, hoursConsumed } = req.body;

  const normalizedStatus = String(status || '').toLowerCase().trim();
  if (!['completed', 'missed', 'cancelled'].includes(normalizedStatus)) {
    return res.status(400).json({ success: false, message: "Status must be 'completed', 'missed', or 'cancelled'" });
  }

  try {
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true, userId: true, subscriberId: true } },
        careCompanion: { select: { id: true, name: true, userId: true } },
        benefit: true,
      }
    });

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let updateData = { status: normalizedStatus };
      if (normalizedStatus === 'completed') {
        updateData.checkOutTime = new Date();
      }
      if (note) {
        updateData.notes = visit.notes ? `${visit.notes}\n[Admin note: ${note}]` : `[Admin note: ${note}]`;
      }

      const updatedVisit = await tx.visit.update({
        where: { id },
        data: updateData,
        include: {
          beneficiary: { select: { id: true, name: true } },
          careCompanion: { select: { id: true, name: true } },
          benefit: true,
        }
      });

      // Deduction & Reservation lifecycle when status updates
      if (normalizedStatus === 'completed') {
        const hoursBenefitId = visit.benefitId;
        if (hoursBenefitId && visit.beneficiaryId) {
          const benefit = await tx.benefit.findUnique({
            where: { id: hoursBenefitId },
            select: { id: true, name: true, unitLabel: true },
          });

          if (benefit) {
            const unitLabelLower = (benefit.unitLabel || '').toLowerCase();
            const isHourBased = unitLabelLower.includes('hour') || unitLabelLower.includes('hr');
            const units = parseFloat(hoursConsumed) || 1;

            // 1. Check if this visit has a HELD reservation in the double-entry ledger
            const existingReservation = await tx.benefitReservation.findFirst({
              where: { visitId: id, status: 'HELD' },
              include: { balance: true }
            });

            let targetSubscriptionId = existingReservation?.balance?.subscriptionId || null;

            // 2. If no HELD reservation, find the best active subscription that has available balance for this benefit
            if (!targetSubscriptionId) {
              const activeSubsWithBalance = await tx.subscription.findMany({
                where: {
                  beneficiaryId: visit.beneficiaryId,
                  isActive: true,
                  endDate: { gte: new Date() },
                  benefitBalances: {
                    some: { benefitId: hoursBenefitId }
                  }
                },
                include: {
                  benefitBalances: {
                    where: { benefitId: hoursBenefitId }
                  }
                },
                orderBy: [
                  { endDate: 'asc' },
                  { createdAt: 'desc' }
                ]
              });

              // Select the first subscription that actually has enough balance
              const subWithUnits = activeSubsWithBalance.find(s => {
                const b = s.benefitBalances[0];
                if (!b) return false;
                if (b.totalUnits === -1) return true;
                return (b.usedUnits + units) <= b.totalUnits;
              });

              if (subWithUnits) {
                targetSubscriptionId = subWithUnits.id;
              } else if (activeSubsWithBalance.length > 0) {
                targetSubscriptionId = activeSubsWithBalance[0].id;
              }
            }

            if (targetSubscriptionId) {
              await deductBenefitBalance(tx, {
                subscriptionId: targetSubscriptionId,
                beneficiaryId: visit.beneficiaryId,
                benefitId: hoursBenefitId,
                visitId: id,
                unitsToDeduct: units,
                hoursConsumed: units,
                description: note || `Completed visit for ${benefit.name}`,
              });

              if (isHourBased) {
                await tx.subscription.update({
                  where: { id: targetSubscriptionId },
                  data: { hoursUsed: { increment: units } },
                });
              } else {
                await tx.subscription.update({
                  where: { id: targetSubscriptionId },
                  data: { visitsCompleted: { increment: 1 } },
                });
              }
            } else {
              console.warn(`[COMPLETE STATUS] No matching subscription with benefit ${hoursBenefitId} found for beneficiary ${visit.beneficiaryId}`);
            }
          }
        }
      } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'missed') {
        // Release HELD reservation when cancelled or marked missed
        await releaseVisitBenefitReservation(tx, id, `Status updated to ${normalizedStatus}`);
      }

      return updatedVisit;
    });

    res.json({ success: true, message: `Visit status updated to ${normalizedStatus}`, data: result });
  } catch (err) {
    console.error('PATCH /visits/:id/status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CC Roster Approval & Feedback Endpoints ─────────────────────────────────

router.post('/roster/approve', async (req, res) => {
  const { date, periodType, zoneId } = req.body;
  if (!date || !periodType || !zoneId) {
    return res.status(400).json({ success: false, message: 'Missing date, periodType, or zoneId' });
  }
  const approvedBy = req.user?.id || 'static-login-admin';
  try {
    const approvalDate = new Date(date);
    const existing = await prisma.rosterApproval.findUnique({
      where: {
        date_zoneId_periodType: {
          date: approvalDate,
          zoneId,
          periodType
        }
      }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Roster is already approved for this period.' });
    }

    const approval = await prisma.rosterApproval.create({
      data: {
        date: approvalDate,
        periodType,
        zoneId,
        approvedBy
      }
    });

    // Trigger Roster Approved Event Dispatcher
    rosterEvents.dispatchRosterApproved({
      zoneId,
      date: approvalDate,
      periodType,
      approvedByName: req.user?.name || 'Admin'
    });

    res.status(201).json({ success: true, data: approval });
  } catch (error) {
    console.error('Error approving roster:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/roster/approvals', async (req, res) => {
  const { date, periodType, zoneId } = req.query;
  try {
    const where = {};
    if (date) where.date = new Date(date);
    if (periodType) where.periodType = periodType;
    if (zoneId) where.zoneId = zoneId;

    const approvals = await prisma.rosterApproval.findMany({
      where,
      orderBy: { approvedAt: 'desc' }
    });

    res.json({ success: true, data: approvals });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/roster/feedback', async (req, res) => {
  const { date, zoneId, ccId, feedback } = req.body;
  if (!date || !feedback) {
    return res.status(400).json({ success: false, message: 'Missing date or feedback text' });
  }
  const submittedBy = req.user?.id || 'static-login-admin';
  try {
    const feedbackDate = new Date(date);
    const existing = await prisma.rosterFeedback.findFirst({
      where: {
        date: feedbackDate,
        zoneId: zoneId || null,
        ccId: ccId || null
      }
    });

    let result;
    if (existing) {
      result = await prisma.rosterFeedback.update({
        where: { id: existing.id },
        data: {
          feedback,
          submittedBy,
          updatedAt: new Date()
        }
      });
    } else {
      result = await prisma.rosterFeedback.create({
        data: {
          date: feedbackDate,
          zoneId: zoneId || null,
          ccId: ccId || null,
          feedback,
          submittedBy
        }
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/roster/feedbacks', async (req, res) => {
  const { date, zoneId } = req.query;
  try {
    const where = {};
    if (date) where.date = new Date(date);
    if (zoneId) where.zoneId = zoneId;

    const feedbacks = await prisma.rosterFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: feedbacks });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
