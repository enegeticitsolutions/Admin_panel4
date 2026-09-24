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
const { resolveFileUrl } = require('../services/storage/urlResolver');
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

  if (balance.totalUnits !== -1 && (balance.usedUnits + unitsToDeduct) > balance.totalUnits) {
    throw new Error('Insufficient benefit balance');
  }

  const balanceBefore = balance.usedUnits;
  const balanceAfter = balance.usedUnits + unitsToDeduct;

  await tx.subscriptionBenefitBalance.update({
    where: { id: balance.id },
    data: { usedUnits: { increment: unitsToDeduct } },
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
        const activeSub = await tx.subscription.findFirst({
          where: { beneficiaryId, isActive: true },
          include: { benefitBalances: { where: { benefitId } } }
        });

        if (activeSub && activeSub.benefitBalances && activeSub.benefitBalances.length > 0) {
          const bal = activeSub.benefitBalances[0];
          const available = Math.max(0, bal.totalUnits - bal.reservedUnits - bal.usedUnits);

          if (bal.totalUnits > 0 && available <= 0) {
            throw new Error('Insufficient benefit balance available for this visit');
          }

          const reservedBefore = bal.reservedUnits;
          const usedBefore = bal.usedUnits;
          const totalBefore = bal.totalUnits;
          const availableBefore = available;

          const reservedAfter = reservedBefore + 1;
          const availableAfter = availableBefore - 1;

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
              reason: `Visit Scheduled Encounter: ${visit.encounterId}`,
              performedByUserId: req.user?.id || null
            }
          });

          await tx.subscriptionBenefitBalance.update({
            where: { id: bal.id },
            data: { reservedUnits: reservedAfter, availableUnits: availableAfter }
          });

          console.log(`[VISIT SCHEDULE] Reserved 1 unit (HELD reservation ${resHold.id}) for visit ${visit.id}`);
        }
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

          const subscription = await tx.subscription.findFirst({
            where: { beneficiaryId: visit.beneficiaryId, isActive: true, endDate: { gte: new Date() } },
          });

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
        const rawUrls = JSON.parse(visit.imageUrls);
        if (Array.isArray(rawUrls)) {
          const urls = await Promise.all(rawUrls.map(resolveFileUrl));
          resolvedImageUrls = JSON.stringify(urls);
        }
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
    // imageUrls: admin sent the new full array (after deletions)
    if (imageUrls !== undefined) {
      const newJson = JSON.stringify(imageUrls);
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
    existing.push(url);

    await prisma.visit.update({ where: { id }, data: { imageUrls: JSON.stringify(existing) } });

    const resolvedUrl = await resolveFileUrl(url);
    const resolvedImageUrls = await Promise.all(existing.map(resolveFileUrl));

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
    if (careCompanionId) where.careCompanionId = careCompanionId;
    // Filter by human-readable visitCode (case-insensitive partial match)
    if (visitCode) {
      where.visitCode = { contains: String(visitCode).toUpperCase(), mode: 'insensitive' };
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

    if (fmUserId) {
      where.careCompanion = {
        team: { fieldManager: { userId: fmUserId } },
      };
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        beneficiary: { select: { id: true, name: true, latitude: true, longitude: true, primaryCcId: true, secondaryCcId: true } },
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
          const rawUrls = JSON.parse(v.imageUrls);
          if (Array.isArray(rawUrls)) {
            const urls = await Promise.all(rawUrls.map(resolveFileUrl));
            resolvedImageUrls = JSON.stringify(urls);
          }
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
// DELETE /api/visits/:id - Cancel a scheduled visit
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requirePermission('visits.delete'), async (req, res) => {
  const { id } = req.params;
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
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed visit' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.visit.update({ where: { id }, data: { status: 'cancelled' } });

      // No benefit refund needed on cancel:
      // Deduction only happens at checkout (visit completion), NOT at scheduling.
      // If the visit never completed (being cancelled now), no balance was ever touched.
      // Idempotency safety: if somehow a log exists (e.g. completed then re-cancelled), remove it.
      const log = await tx.packageHoursLog.findUnique({ where: { visitId: id } });
      if (log) {
        console.warn(`[CANCEL VISIT] Found unexpected log for visit ${id} — removing orphan log (no balance change).`);
        await tx.packageHoursLog.delete({ where: { id: log.id } });
      }

      console.log(`[CANCEL VISIT] Visit ${id} cancelled. No benefit deduction had occurred — no refund needed.`);
    });

    // Trigger VISIT_CANCELLED event notification (Push + WhatsApp)
    visitEventDispatcher.dispatchVisitCancelled(visit);

    res.json({ success: true, message: 'Visit cancelled successfully' });
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

  if (!careCompanionId || !scheduledTime || !durationMinutes) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
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
    if (existingVisit.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Only scheduled visits can be modified' });
    }

    const startTime = new Date(scheduledTime);

    if (startTime.getTime() < Date.now() - 60000) {
      return res.status(400).json({ success: false, message: 'Cannot reschedule a visit to a past date/time' });
    }

    if (
      careCompanionId !== existingVisit.careCompanionId ||
      startTime.getTime() !== new Date(existingVisit.scheduledTime).getTime() ||
      durationMinutes !== existingVisit.durationMinutes
    ) {
      const availability = await checkCCAvailability(careCompanionId, startTime, durationMinutes, id);
      if (!availability.isAvailable) {
        return res.status(409).json({ success: false, message: availability.reason });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.visit.update({
        where: { id },
        data: { careCompanionId, scheduledTime: startTime, durationMinutes },
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

      // Deduction logic when marked COMPLETED
      if (normalizedStatus === 'completed' && visit.benefitId && visit.beneficiaryId) {
        const existingLog = await tx.packageHoursLog.findUnique({ where: { visitId: id } });
        if (!existingLog) {
          const activeSub = await tx.subscription.findFirst({
            where: { beneficiaryId: visit.beneficiaryId, isActive: true },
            include: { benefitBalances: { where: { benefitId: visit.benefitId } } }
          });

          if (activeSub && activeSub.benefitBalances && activeSub.benefitBalances.length > 0) {
            const bal = activeSub.benefitBalances[0];
            // Use provided hoursConsumed or fall back to 1 unit
            const units = parseFloat(hoursConsumed) || 1;
            const balanceBefore = bal.availableUnits;
            const balanceAfter = Math.max(0, bal.availableUnits - units);

            await tx.subscriptionBenefitBalance.update({
              where: { id: bal.id },
              data: {
                usedUnits: { increment: units },
                availableUnits: balanceAfter
              }
            });

            await tx.packageHoursLog.create({
              data: {
                subscriptionId: activeSub.id,
                beneficiaryId: visit.beneficiaryId,
                visitId: id,
                hoursConsumed: units,
                balanceBefore,
                balanceAfter,
                description: note || `Completed visit for ${visit.benefit?.name || 'benefit'}`,
              }
            });
          }
        }
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
