import prisma from '../../core/database';
import { generateUUID, generateEncounterId, generateVisitCode } from '../../utils/helpers';
import { Prisma, UsageType } from '@prisma/client';
import { benefitLedgerService } from '../shared/benefit_ledger_service';
import { benefitPeriodManager } from '../benefit/BenefitPeriodManager';
import { benefitLedgerEngine } from '../benefit/BenefitLedgerEngine';
import { notificationProducer } from '@maihoonna/notifications';


// â”€â”€â”€ Geo-fencing Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calculates the straight-line distance between two GPS coordinates using
 * the Haversine formula. Returns distance in meters.
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Configurable from .env â€” defaults to 50m (industry standard)
const GEOFENCE_RADIUS_METERS = parseFloat(process.env.GEOFENCE_RADIUS_METERS || '50');

export const createVisit = async (data: {
  beneficiaryId: string;
  careCompanionId: string;
  scheduledTime: Date;
  benefitId?: string | null;
}) => {
  return prisma.visit.create({
    data: { id: generateUUID(), encounterId: generateEncounterId(), visitCode: generateVisitCode(), ...data },
  });
};

export const getVisit = async (visitId: string) => {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new Error('Visit not found');
  return visit;
};

export const getBeneficiaryVisits = async (beneficiaryId: string, limit = 50) => {
  return prisma.visit.findMany({
    where: { beneficiaryId },
    orderBy: { scheduledTime: 'desc' },
    take: limit,
  });
};

export const getCareCompanionVisits = async (ccId: string, date?: string) => {
  const where: Prisma.VisitWhereInput = { careCompanionId: ccId, is3rdParty: false };
  if (date) {
    const d = new Date(date);
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(d.setHours(23, 59, 59, 999));
    where.scheduledTime = { gte: start, lte: end };
  }
  return prisma.visit.findMany({ where, orderBy: { scheduledTime: 'asc' } });
};

export const checkIn = async (data: {
  visitId: string;
  latitude: number;
  longitude: number;
  manualCheckInReason?: string | null;
}) => {
  // 1. Fetch the visit details
  const visit = await prisma.visit.findUnique({
    where: { id: data.visitId },
    select: { beneficiaryId: true, scheduledTime: true, status: true },
  });
  if (!visit) throw new Error('Visit not found');

  if (visit.status === 'completed') {
    throw new Error('Cannot check-in to an already completed visit.');
  }
  if (visit.status === 'cancelled') {
    throw new Error('Cannot check-in to a cancelled visit.');
  }
  if (visit.status === 'missed') {
    throw new Error('Cannot check-in to a missed visit.');
  }

  // Enforce passed date restriction
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const visitScheduledTime = new Date(visit.scheduledTime);
  const startOfScheduledDay = new Date(
    visitScheduledTime.getFullYear(),
    visitScheduledTime.getMonth(),
    visitScheduledTime.getDate()
  );

  if (startOfScheduledDay < startOfToday) {
    throw new Error('Cannot check-in to a visit scheduled for a past date.');
  }

  // 2. Fetch the beneficiary's stored GPS coordinates
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: visit.beneficiaryId },
    select: { latitude: true, longitude: true },
  });

  // 3. Compute geo-distance and determine verification status
  let isGeoVerified = false;
  let geoDistanceMeters: number | null = null;

  const isManualCheckIn = !!(data.manualCheckInReason && data.manualCheckInReason.trim());

  if (beneficiary?.latitude && beneficiary?.longitude) {
    geoDistanceMeters = haversineDistance(
      data.latitude, data.longitude,
      beneficiary.latitude, beneficiary.longitude
    );
    // Only auto-verify if NOT a manual override and within radius
    if (!isManualCheckIn && geoDistanceMeters <= GEOFENCE_RADIUS_METERS) {
      isGeoVerified = true;
    }
  }
  // If beneficiary has no GPS stored, isGeoVerified stays false

  // 4. Update the visit record with all geo fields
  const updatedVisit = await prisma.visit.update({
    where: { id: data.visitId },
    data: {
      checkInTime: new Date(),
      status: 'in_progress',
      locationLat: data.latitude,
      locationLng: data.longitude,
      checkInLat: data.latitude,
      checkInLng: data.longitude,
      isGeoVerified,
      geoDistanceMeters: geoDistanceMeters !== null ? Math.round(geoDistanceMeters) : null,
      manualCheckInReason: data.manualCheckInReason || null,
    },
  });

  // 5. Asynchronous Decoupled Notification Dispatch (Redis Streams)
  (async () => {
    try {
      const fullVisit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: {
          beneficiary: {
            include: {
              subscriber: { select: { id: true, name: true, phone: true } },
              user: { select: { id: true, name: true, phone: true } },
            },
          },
          careCompanion: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      if (!fullVisit) return;
      const ccName = fullVisit.careCompanion?.name || fullVisit.careCompanion?.user?.name || 'Care Mitra';
      const beneficiaryName = fullVisit.beneficiary?.name || 'Beneficiary';
      const checkInTimeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

      // NT-012: VISIT_STARTED to Subscriber
      const subscriberPhone = fullVisit.beneficiary?.subscriber?.phone;
      if (subscriberPhone) {
        await notificationProducer.publish({
          idempotencyKey: `visit-${fullVisit.id}-started`,
          channel: 'whatsapp',
          event: 'VISIT_STARTED',
          recipient: { phone: subscriberPhone },
          variables: {
            ccName,
            beneficiaryName,
            checkInTime: checkInTimeStr,
          },
        });
      }

      // NT-013: MANUAL_CHECKIN_FLAGGED to Field Manager (if manual check-in)
      if (isManualCheckIn) {
        const fmUser = await prisma.user.findFirst({
          where: { role: 'field_manager' },
          select: { phone: true, name: true },
        });
        if (fmUser?.phone) {
          await notificationProducer.publish({
            idempotencyKey: `visit-${fullVisit.id}-manual-checkin`,
            channel: 'whatsapp',
            event: 'MANUAL_CHECKIN_FLAGGED',
            recipient: { phone: fmUser.phone },
            variables: {
              ccName,
              beneficiaryName,
              remarks: data.manualCheckInReason || 'Outside geo-fence override',
            },
          });
        }
      }
    } catch (notifErr: any) {
      console.error('[VisitService:CheckIn] Notification Dispatch Error:', notifErr.message);
    }
  })();

  return updatedVisit;
};


export const updateVisitDetails = async (data: {
  visitId: string;
  vitals?: any;
  vitalsList?: {
    vitalDefinitionId: string;
    valueNumeric?: number;
    valueNumeric2?: number;
    valueText?: string;
  }[];
  mood?: string;
  medicationAdherence: boolean;
  notes?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existingVisit = await tx.visit.findUnique({ where: { id: data.visitId } });
    if (!existingVisit) throw new Error('Visit not found');

    const visitUpdateData: any = {
      medicationAdherence: data.medicationAdherence,
      mood: data.mood as any,
      notes: existingVisit.notes?.startsWith('__benefitId:') ? data.notes : (data.notes || existingVisit.notes),
    };


    const visit = await tx.visit.update({
      where: { id: data.visitId },
      data: visitUpdateData,
    });

    if (data.vitalsList && Array.isArray(data.vitalsList)) {
      await tx.vitalReading.deleteMany({ where: { visitId: visit.id } });

      const careCompanion = existingVisit.careCompanionId ? await tx.careCompanion.findUnique({
        where: { id: existingVisit.careCompanionId },
        select: { userId: true }
      }) : null;
      const capturedById = careCompanion?.userId || existingVisit.careCompanionId || 'SYSTEM';

      for (const reading of data.vitalsList) {
        const def = await tx.vitalDefinition.findUnique({ where: { id: reading.vitalDefinitionId } });
        let isAbnormal = false;
        if (def) {
          if (def.dataType === 'numeric' && reading.valueNumeric !== null && reading.valueNumeric !== undefined) {
            const val = reading.valueNumeric;
            if ((def.normalMin !== null && val < def.normalMin) || (def.normalMax !== null && val > def.normalMax)) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'dual_numeric' && reading.valueNumeric !== null && reading.valueNumeric !== undefined && reading.valueNumeric2 !== null && reading.valueNumeric2 !== undefined) {
            const val1 = reading.valueNumeric;
            const val2 = reading.valueNumeric2;
            if (
              (def.normalMin !== null && val1 < def.normalMin) || 
              (def.normalMax !== null && val1 > def.normalMax) ||
              (def.normalMin2 !== null && val2 < def.normalMin2) ||
              (def.normalMax2 !== null && val2 > def.normalMax2)
            ) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'boolean' && reading.valueText !== undefined && reading.valueText !== null) {
            const isTrue = reading.valueText.toLowerCase() === 'true' || reading.valueText.toLowerCase() === 'yes';
            if (def.booleanAlertValue !== null && isTrue === def.booleanAlertValue) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'text' && reading.valueText !== undefined && reading.valueText !== null) {
            if (def.alertOptions.includes(reading.valueText)) {
              isAbnormal = true;
            }
          }
        }

        await tx.vitalReading.create({
          data: {
            id: generateUUID(),
            beneficiaryId: visit.beneficiaryId,
            vitalDefinitionId: reading.vitalDefinitionId,
            visitId: visit.id,
            valueNumeric: reading.valueNumeric !== undefined ? reading.valueNumeric : null,
            valueNumeric2: reading.valueNumeric2 !== undefined ? reading.valueNumeric2 : null,
            valueText: reading.valueText || null,
            valueBoolean: reading.valueText !== undefined && reading.valueText !== null ? (reading.valueText.toLowerCase() === 'true' || reading.valueText.toLowerCase() === 'yes') : null,
            isAbnormal,
            capturedById,
            captureMethod: 'manual',
          }
        });
      }
    }

    if (data.mood) {
      const moodValueMap: Record<string, number> = {
        happy: 100,
        neutral: 80,
        sad: 50,
        anxious: 20,
        depressed: 0
      };

      const moodKey = data.mood.toLowerCase();
      if (moodValueMap[moodKey] !== undefined) {
        const currentMoodScore = moodValueMap[moodKey];
        const beneficiary = await tx.beneficiary.findUnique({
          where: { id: visit.beneficiaryId },
          select: { emotionalScore: true }
        });

        if (beneficiary) {
          const alpha = 0.4;
          let newScore = currentMoodScore;
          // Since the schema default is 8.0 (old 1-10 scale), we treat 8.0 as "no score" on the new 0-100 scale.
          if (beneficiary.emotionalScore !== null && beneficiary.emotionalScore !== 8.0) {
             newScore = alpha * currentMoodScore + (1 - alpha) * beneficiary.emotionalScore;
          }

          await tx.beneficiary.update({
            where: { id: visit.beneficiaryId },
            data: { emotionalScore: newScore },
          });
        }
      }
    }

    if ((data as any).medicationsList && Array.isArray((data as any).medicationsList)) {
      const careCompanion = existingVisit.careCompanionId ? await tx.careCompanion.findUnique({
        where: { id: existingVisit.careCompanionId },
        select: { userId: true }
      }) : null;
      const recordedBy = careCompanion?.userId || existingVisit.careCompanionId || 'SYSTEM';

      for (const item of (data as any).medicationsList) {
        const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!validUUIDRegex.test(item.medicationId)) continue;
        const existingRecord = await tx.medicationAdherence.findFirst({
          where: { visitId: visit.id, medicationId: item.medicationId }
        });
        if (existingRecord) {
          await tx.medicationAdherence.update({
            where: { id: existingRecord.id },
            data: { taken: item.taken, recordedBy }
          });
        } else {
          await tx.medicationAdherence.create({
            data: {
              id: generateUUID(),
              medicationId: item.medicationId,
              beneficiaryId: visit.beneficiaryId,
              visitId: visit.id,
              scheduledTime: new Date(),
              taken: item.taken,
              takenTime: item.taken ? new Date() : null,
              recordedBy
            }
          });
        }
      }
    }

    return visit;
  });
};

export const checkOut = async (data: {
  visitId: string;
  latitude?: number;
  longitude?: number;
  manualCheckOutReason?: string | null;
  vitalsList?: {
    vitalDefinitionId: string;
    valueNumeric?: number;
    valueNumeric2?: number;
    valueText?: string;
  }[];
  medicationsList?: {
    medicationId: string;
    taken: boolean;
  }[];
  mood?: string;
  medicationAdherence: boolean;
  notes?: string;
}) => {
  const visit = await prisma.$transaction(async (tx) => {
    // 1. Get the visit to know checkInTime
    const existingVisit = await tx.visit.findUnique({ where: { id: data.visitId } });
    if (!existingVisit) throw new Error('Visit not found');

    const isEdit = existingVisit.status === 'completed';

    const checkOutTime = isEdit ? existingVisit.checkOutTime : new Date();
    let actualMinutes = 0;
    if (!isEdit && existingVisit.checkInTime) {
      actualMinutes = Math.round((checkOutTime!.getTime() - existingVisit.checkInTime.getTime()) / 60000);
    }

    // 2. Map dynamic vitals to standard fields on the Visit record for backward compatibility
    const visitUpdateData: any = {
      checkOutTime,
      // intentionally NOT overwriting durationMinutes to preserve the originally scheduled duration
      status: 'completed',
      medicationAdherence: data.medicationAdherence,
      mood: data.mood as any,
      notes: existingVisit.notes?.startsWith('__benefitId:') ? data.notes : (data.notes || existingVisit.notes),
    };


    // 3. Update the Visit record
    const visit = await tx.visit.update({
      where: { id: data.visitId },
      data: visitUpdateData,
    });

    const careCompanion = existingVisit.careCompanionId ? await tx.careCompanion.findUnique({
      where: { id: existingVisit.careCompanionId },
      select: { userId: true }
    }) : null;
    const careCompanionUserId = careCompanion?.userId || existingVisit.careCompanionId || 'SYSTEM';
    const capturedById = careCompanionUserId;

    // 4. Create Vital Readings if present
    if (data.vitalsList && Array.isArray(data.vitalsList)) {
      if (isEdit) {
        await tx.vitalReading.deleteMany({ where: { visitId: visit.id } });
      }

      for (const reading of data.vitalsList) {
        const def = await tx.vitalDefinition.findUnique({ where: { id: reading.vitalDefinitionId } });
        let isAbnormal = false;

        if (def) {
          if (def.dataType === 'numeric' && reading.valueNumeric !== null && reading.valueNumeric !== undefined) {
            const val = reading.valueNumeric;
            if ((def.normalMin !== null && val < def.normalMin) || (def.normalMax !== null && val > def.normalMax)) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'dual_numeric' && reading.valueNumeric !== null && reading.valueNumeric !== undefined && reading.valueNumeric2 !== null && reading.valueNumeric2 !== undefined) {
            const val1 = reading.valueNumeric;
            const val2 = reading.valueNumeric2;
            if (
              (def.normalMin !== null && val1 < def.normalMin) ||
              (def.normalMax !== null && val1 > def.normalMax) ||
              (def.normalMin2 !== null && val2 < def.normalMin2) ||
              (def.normalMax2 !== null && val2 > def.normalMax2)
            ) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'boolean' && reading.valueText !== undefined && reading.valueText !== null) {
            const isTrue = reading.valueText.toLowerCase() === 'true' || reading.valueText.toLowerCase() === 'yes';
            if (def.booleanAlertValue !== null && isTrue === def.booleanAlertValue) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'text' && reading.valueText !== undefined && reading.valueText !== null) {
            if (def.alertOptions.includes(reading.valueText)) {
              isAbnormal = true;
            }
          }
        }

        await tx.vitalReading.create({
          data: {
            id: generateUUID(),
            beneficiaryId: visit.beneficiaryId,
            vitalDefinitionId: reading.vitalDefinitionId,
            visitId: visit.id,
            valueNumeric: reading.valueNumeric !== undefined ? reading.valueNumeric : null,
            valueNumeric2: reading.valueNumeric2 !== undefined ? reading.valueNumeric2 : null,
            valueText: reading.valueText || null,
            valueBoolean: reading.valueText !== undefined && reading.valueText !== null ? (reading.valueText.toLowerCase() === 'true' || reading.valueText.toLowerCase() === 'yes') : null,
            isAbnormal,
            capturedById,
            captureMethod: 'manual',
          }
        });
      }
    }

    // 5. Deduct from Subscription — ALL deductions happen at CHECKOUT (visit completion).
    //    Deduction is intentionally NOT done at scheduling. This means:
    //      • Missed visits (CC no-show) → nothing deducted → no refund needed
    //      • Cancelled visits           → nothing deducted → no refund needed
    //      • Completed visits           → deduct here, exactly once
    //    Rules:
    //      hour-based benefit    → deduct actual hours (min 1h billing rule)
    //      session/visit benefit → deduct 1 unit
    if (!isEdit && actualMinutes >= 0) {
      const billableMinutes = Math.max(60, actualMinutes);   // floor at 60 min
      const hoursConsumed   = billableMinutes / 60;          // exact float, min 1.0

      const activeSubscription = await tx.subscription.findFirst({
        where: { beneficiaryId: visit.beneficiaryId, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: { benefitBalances: { include: { benefit: true } } }
      });

      if (activeSubscription) {
        // Read the benefitId locked in at scheduling time
        const targetBenefitId: string | null = existingVisit.benefitId || null;

        console.log(`[CHECKOUT] visitId=${visit.id} targetBenefitId=${targetBenefitId}`);

        // Idempotency guard — don't double-deduct if already logged
        const existingLog = await tx.packageHoursLog.findUnique({
          where: { visitId: visit.id }
        });

        if (existingLog) {
          // Already processed (re-run) — update hours record only, don't touch balance
          console.log(`[CHECKOUT] Log already exists for visit ${visit.id} — skipping deduction (idempotent re-run).`);
        } else if (targetBenefitId) {
          // Check for HELD reservation on this visit
          const reservation = await tx.benefitReservation.findUnique({
            where: { visitId: visit.id },
          });

          if (reservation && reservation.status === 'HELD') {
            await benefitLedgerService.consumeReservation(
              {
                reservationId: reservation.id,
                reason: `Visit Checkout Completed. Encounter: ${visit.encounterId}`,
                performedByUserId: existingVisit.careCompanionId || undefined,
              },
              tx
            );
            console.log(`[CHECKOUT] Consumed HELD reservation ${reservation.id} for visit ${visit.id}`);
          } else {
            // Fallback for legacy visits or direct checkout without prior hold
            const benefitToDeduct = activeSubscription.benefitBalances.find(b => b.benefitId === targetBenefitId);
            if (benefitToDeduct) {
              const label = (benefitToDeduct.snapshotUnitLabel || benefitToDeduct.benefit?.unitLabel || '').toLowerCase();
              const isHourBenefit = label.includes('hour') || label.includes('hr');
              const unitsToDeduct = isHourBenefit ? Math.ceil(hoursConsumed) : 1;

              await tx.subscriptionBenefitBalance.update({
                where: { id: benefitToDeduct.id },
                data: { usedUnits: { increment: unitsToDeduct } }
              });

              await tx.benefitTransaction.create({
                data: {
                  balanceId: benefitToDeduct.id,
                  transactionType: 'CONSUMED',
                  units: unitsToDeduct,
                  totalBefore: benefitToDeduct.totalUnits,
                  totalAfter: benefitToDeduct.totalUnits,
                  reservedBefore: benefitToDeduct.reservedUnits,
                  reservedAfter: benefitToDeduct.reservedUnits,
                  usedBefore: benefitToDeduct.usedUnits,
                  usedAfter: benefitToDeduct.usedUnits + unitsToDeduct,
                  availableBefore: Math.max(0, benefitToDeduct.totalUnits - benefitToDeduct.reservedUnits - benefitToDeduct.usedUnits),
                  availableAfter: Math.max(0, benefitToDeduct.totalUnits - benefitToDeduct.reservedUnits - (benefitToDeduct.usedUnits + unitsToDeduct)),
                  reason: `Direct Visit Checkout Completed. Encounter: ${visit.encounterId}`,
                  performedByUserId: existingVisit.careCompanionId,
                }
              });

              // Synchronize BenefitPeriodBalance & BenefitUsage ledger
              try {
                const activePeriod = await benefitPeriodManager.evaluateAndTransitionJIT(activeSubscription.id);
                if (activePeriod) {
                  try {
                    await benefitLedgerEngine.deductUnits({
                      subscriptionId: activeSubscription.id,
                      periodId: activePeriod.id,
                      benefitId: targetBenefitId,
                      quantity: unitsToDeduct,
                      usageType: UsageType.VISIT_COMPLETED,
                      referenceId: visit.id,
                      notes: `Direct Visit Checkout Completed. Encounter: ${visit.encounterId}`,
                      performedByUserId: existingVisit.careCompanionId || undefined,
                    }, tx);
                  } catch (pe) {
                    console.error('[VisitService] Period balance deduction warning:', pe);
                    const pb = await tx.benefitPeriodBalance.findUnique({
                      where: {
                        periodId_benefitId: {
                          periodId: activePeriod.id,
                          benefitId: targetBenefitId,
                        }
                      }
                    });
                    if (pb) {
                      const qty = Math.min(unitsToDeduct, pb.remainingQuantity);
                      await tx.benefitPeriodBalance.update({
                        where: { id: pb.id },
                        data: {
                          usedQuantity: pb.usedQuantity + qty,
                          remainingQuantity: Math.max(0, pb.remainingQuantity - qty)
                        }
                      });
                    }
                  }
                }
              } catch (periodErr) {
                console.error('[VisitService] Period evaluation warning:', periodErr);
              }
            }
          }

          // Create package hours log for audit display
          const benefitToDeduct = activeSubscription.benefitBalances.find(b => b.benefitId === targetBenefitId);
          if (benefitToDeduct) {
            await tx.packageHoursLog.create({
              data: {
                subscriptionId: activeSubscription.id,
                beneficiaryId: visit.beneficiaryId,
                visitId: visit.id,
                hoursConsumed,
                balanceBefore: benefitToDeduct.usedUnits,
                balanceAfter: benefitToDeduct.usedUnits + 1,
                description: `Visit completed. Encounter: ${visit.encounterId}.`
              }
            });
            await tx.subscription.update({
              where: { id: activeSubscription.id },
              data: { visitsCompleted: activeSubscription.visitsCompleted + 1 }
            });
          }
        }
 else {
          // No benefitId on the visit — log for audit only, no balance deduction
          console.warn(`[CHECKOUT] No benefitId on visit ${visit.id} — logging only, no deduction.`);
          await tx.packageHoursLog.create({
            data: {
              subscriptionId: activeSubscription.id,
              beneficiaryId: visit.beneficiaryId,
              visitId: visit.id,
              hoursConsumed: actualMinutes / 60,
              balanceBefore: 0,
              balanceAfter: 0,
              description: `Visit completed (no benefit selected). Actual: ${actualMinutes} min.`
            }
          });
        }
      }
    }


    // 6. Update emotional score based on mood using EWMA
    if (data.mood) {
      const moodValueMap: Record<string, number> = {
        happy: 100,
        neutral: 80,
        sad: 50,
        anxious: 20,
        depressed: 0
      };

      const moodKey = data.mood.toLowerCase();
      if (moodValueMap[moodKey] !== undefined) {
        const currentMoodScore = moodValueMap[moodKey];
        const beneficiary = await tx.beneficiary.findUnique({
          where: { id: visit.beneficiaryId },
          select: { emotionalScore: true }
        });

        if (beneficiary) {
          const alpha = 0.4;
          let newScore = currentMoodScore;
          // Since the schema default is 8.0 (old 1-10 scale), we treat 8.0 as "no score" on the new 0-100 scale.
          if (beneficiary.emotionalScore !== null && beneficiary.emotionalScore !== 8.0) {
             newScore = alpha * currentMoodScore + (1 - alpha) * beneficiary.emotionalScore;
          }

          await tx.beneficiary.update({
            where: { id: visit.beneficiaryId },
            data: { emotionalScore: newScore },
          });
        }
      }
    }

    // 7. Create Medication Adherence records if present
    if ((data as any).medicationsList && Array.isArray((data as any).medicationsList)) {
      const careCompanion = existingVisit.careCompanionId ? await tx.careCompanion.findUnique({
        where: { id: existingVisit.careCompanionId },
        select: { userId: true }
      }) : null;
      const recordedBy = careCompanion?.userId || existingVisit.careCompanionId || 'SYSTEM';

      for (const item of (data as any).medicationsList) {
        // Skip fake medication IDs sent by frontend fallbacks
        const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!validUUIDRegex.test(item.medicationId)) continue;

        await tx.medicationAdherence.deleteMany({
          where: {
            visitId: visit.id,
            medicationId: item.medicationId
          }
        });

        await tx.medicationAdherence.create({
          data: {
            beneficiaryId: visit.beneficiaryId,
            medicationId: item.medicationId,
            visitId: visit.id,
            scheduledTime: new Date(),
            taken: item.taken,
            takenTime: item.taken ? new Date() : null,
            recordedBy
          }
        });
      }
    }

    return visit;
  });

  // 8. Asynchronous Decoupled Notification Dispatch (Redis Streams)
  (async () => {
    try {
      const fullVisit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: {
          beneficiary: {
            include: {
              subscriber: { select: { id: true, name: true, phone: true } },
              user: { select: { id: true, name: true, phone: true } },
            },
          },
          careCompanion: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      if (!fullVisit) return;
      const ccName = fullVisit.careCompanion?.name || fullVisit.careCompanion?.user?.name || 'Care Mitra';
      const beneficiaryName = fullVisit.beneficiary?.name || 'Beneficiary';
      const subscriberPhone = fullVisit.beneficiary?.subscriber?.phone;
      const beneficiaryPhone = fullVisit.beneficiary?.user?.phone;

      // Calculate duration string
      let durationMinutes = fullVisit.durationMinutes || 60;
      if (fullVisit.checkInTime && fullVisit.checkOutTime) {
        durationMinutes = Math.max(1, Math.round((fullVisit.checkOutTime.getTime() - fullVisit.checkInTime.getTime()) / 60000));
      }
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationText = hours > 0 ? `${hours} hr ${mins} min` : `${mins} mins`;

      // NT-014: VISIT_COMPLETED to Subscriber & Beneficiary
      if (subscriberPhone) {
        await notificationProducer.publish({
          idempotencyKey: `visit-${fullVisit.id}-completed-sub`,
          channel: 'whatsapp',
          event: 'VISIT_COMPLETED',
          recipient: { phone: subscriberPhone },
          variables: { ccName, beneficiaryName, duration: durationText },
        });
      }
      if (beneficiaryPhone && beneficiaryPhone !== subscriberPhone) {
        await notificationProducer.publish({
          idempotencyKey: `visit-${fullVisit.id}-completed-benef`,
          channel: 'whatsapp',
          event: 'VISIT_COMPLETED',
          recipient: { phone: beneficiaryPhone },
          variables: { ccName, beneficiaryName, duration: durationText },
        });
      }

      // NT-018: RATING_FEEDBACK_PROMPT to Subscriber
      if (subscriberPhone) {
        await notificationProducer.publish({
          idempotencyKey: `visit-${fullVisit.id}-rating-prompt-sub`,
          channel: 'whatsapp',
          event: 'RATING_FEEDBACK_PROMPT',
          recipient: { phone: subscriberPhone },
          variables: { ccName },
        });
      }

      // NT-020: MOOD_ALERT (if low mood)
      const currentMood = (data.mood || '').toLowerCase();
      if (['sad', 'anxious', 'depressed'].includes(currentMood)) {
        if (subscriberPhone) {
          await notificationProducer.publish({
            idempotencyKey: `visit-${fullVisit.id}-mood-alert`,
            channel: 'whatsapp',
            event: 'MOOD_ALERT',
            recipient: { phone: subscriberPhone },
            variables: {
              beneficiaryName,
              mood: data.mood || 'Low',
              ccName,
            },
          });
        }

        // NT-021: Consecutive Low Mood Check (WELLBEING_CHECK_RECOMMENDED)
        const previousVisit = await prisma.visit.findFirst({
          where: {
            beneficiaryId: fullVisit.beneficiaryId,
            status: 'completed',
            id: { not: fullVisit.id },
          },
          orderBy: { checkOutTime: 'desc' },
          select: { mood: true },
        });

        if (previousVisit?.mood && ['sad', 'anxious', 'depressed'].includes(previousVisit.mood.toLowerCase())) {
          if (subscriberPhone) {
            await notificationProducer.publish({
              idempotencyKey: `visit-${fullVisit.id}-wellbeing-recommended`,
              channel: 'whatsapp',
              event: 'WELLBEING_CHECK_RECOMMENDED',
              recipient: { phone: subscriberPhone },
              variables: { beneficiaryName },
            });
          }
        }
      }

      // NT-030: VITALS_ALERT (if abnormal vitals recorded)
      if (data.vitalsList && Array.isArray(data.vitalsList)) {
        for (const reading of data.vitalsList) {
          const def = await prisma.vitalDefinition.findUnique({ where: { id: reading.vitalDefinitionId } });
          if (!def) continue;
          let isAbnormal = false;
          let displayReading = '';

          if (def.dataType === 'numeric' && reading.valueNumeric != null) {
            displayReading = `${reading.valueNumeric} ${def.unit || ''}`.trim();
            if ((def.normalMin != null && reading.valueNumeric < def.normalMin) || (def.normalMax != null && reading.valueNumeric > def.normalMax)) {
              isAbnormal = true;
            }
          } else if (def.dataType === 'dual_numeric' && reading.valueNumeric != null && reading.valueNumeric2 != null) {
            displayReading = `${reading.valueNumeric}/${reading.valueNumeric2} ${def.unit || ''}`.trim();
            if (
              (def.normalMin != null && reading.valueNumeric < def.normalMin) ||
              (def.normalMax != null && reading.valueNumeric > def.normalMax) ||
              (def.normalMin2 != null && reading.valueNumeric2 < def.normalMin2) ||
              (def.normalMax2 != null && reading.valueNumeric2 > def.normalMax2)
            ) {
              isAbnormal = true;
            }
          }

          if (isAbnormal && subscriberPhone) {
            await notificationProducer.publish({
              idempotencyKey: `vital-${fullVisit.id}-${def.id}-alert`,
              channel: 'whatsapp',
              event: 'VITALS_ALERT',
              recipient: { phone: subscriberPhone },
              variables: {
                beneficiaryName,
                vitalType: def.name,
                reading: displayReading,
                ccName,
              },
            });
            break; // send one summary alert per visit checkout
          }
        }
      }

      // NT-032: MEDICATION_MISSED (if medication unconfirmed/missed)
      if (data.medicationsList && Array.isArray(data.medicationsList)) {
        const missedMed = data.medicationsList.find((m) => !m.taken);
        if (missedMed && subscriberPhone) {
          const medInfo = await prisma.medication.findUnique({
            where: { id: missedMed.medicationId },
            select: { name: true },
          }).catch(() => null);

          const medName = medInfo?.name || 'prescribed medication';
          const scheduledTimeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

          await notificationProducer.publish({
            idempotencyKey: `visit-${fullVisit.id}-med-missed`,
            channel: 'whatsapp',
            event: 'MEDICATION_MISSED',
            recipient: { phone: subscriberPhone },
            variables: {
              beneficiaryName,
              medicationName: medName,
              scheduledTime: scheduledTimeStr,
            },
          });
        }
      }
    } catch (err: any) {
      console.error('[VisitService:CheckOut] Notification Dispatch Error:', err.message);
    }
  })();

  return visit;
};

export const rateVisit = async (data: { visitId: string; rating: number; feedback?: string }) => {
  if (data.rating < 1 || data.rating > 5) throw new Error('Rating must be between 1 and 5');
  const updatedVisit = await prisma.visit.update({
    where: { id: data.visitId },
    data: { rating: data.rating, feedback: data.feedback },
  });

  // NT-065: CC_PERFORMANCE_RATING to Care Mitra
  (async () => {
    try {
      const fullVisit = await prisma.visit.findUnique({
        where: { id: data.visitId },
        include: {
          beneficiary: { select: { name: true } },
          careCompanion: { include: { user: { select: { phone: true } } } },
        },
      });

      const ccPhone = fullVisit?.careCompanion?.user?.phone;
      if (ccPhone) {
        await notificationProducer.publish({
          idempotencyKey: `rating-${data.visitId}`,
          channel: 'whatsapp',
          event: 'CC_PERFORMANCE_RATING',
          recipient: { phone: ccPhone },
          variables: {
            rating: String(data.rating),
            beneficiaryName: fullVisit?.beneficiary?.name || 'Beneficiary',
            comment: data.feedback || 'Visit completed successfully',
          },
        });
      }
    } catch (err: any) {
      console.error('[VisitService:RateVisit] Notification Error:', err.message);
    }
  })();

  return updatedVisit;
};

export const autoUpdateMissedVisits = async () => {
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
};

export const getCareCompanionSchedule = async (userId: string) => {
  await autoUpdateMissedVisits();
  const cc = await prisma.user.findUnique({
    where: { id: userId },
    include: { careCompanionProfile: true },
  });

  if (!cc || !cc.careCompanionProfile) {
    throw new Error('Care Companion profile not found');
  }

  const ccId = cc.careCompanionProfile.id;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const visits = await prisma.visit.findMany({
    where: {
      careCompanionId: ccId,
      OR: [
        {
          status: { in: ['scheduled', 'in_progress'] }
        },
        {
          status: 'completed',
          scheduledTime: { gte: startOfToday }
        }
      ]
    },
    include: {
      beneficiary: true,
    },
    orderBy: {
      scheduledTime: 'asc',
    },
  });

  return visits.map((v) => {
    const scheduledTime = new Date(v.scheduledTime);
    let tabType = 'Upcoming';

    if (scheduledTime < startOfToday) {
      // Past incomplete visits should show on 'Today'
      tabType = 'Today';
    } else if (scheduledTime >= startOfToday && scheduledTime <= endOfToday) {
      tabType = 'Today';
    } else if (scheduledTime >= startOfTomorrow && scheduledTime <= endOfTomorrow) {
      tabType = 'Tomorrow';
    } else if (scheduledTime > endOfTomorrow) {
      tabType = 'Upcoming';
    }

    const ben = v.beneficiary;
    const formattedTime = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(scheduledTime);

    const fullAddress = [ben?.flatPlot, ben?.streetArea, ben?.landmark, ben?.city]
      .filter(Boolean)
      .join(', ') || ben?.address || 'Address not specified';

    return {
      id: v.id,
      visitCode: v.visitCode,
      patientName: ben?.name || 'Unknown Beneficiary',
      // Full structured address for display + 1-tap navigation
      address: fullAddress,
      flatPlot: ben?.flatPlot || null,
      streetArea: ben?.streetArea || null,
      landmark: ben?.landmark || null,
      city: ben?.city || null,
      state: ben?.state || null,
      pincode: ben?.pincode || null,
      latitude: ben?.latitude || null,
      longitude: ben?.longitude || null,
      time: formattedTime,
      scheduledTime: v.scheduledTime.toISOString(),
      checkInTime: v.checkInTime ? v.checkInTime.toISOString() : null,
      checkOutTime: v.checkOutTime ? v.checkOutTime.toISOString() : null,
      durationMinutes: v.durationMinutes,
      distance: null,
      type: v.notes ? 'Special Care' : 'Home Visit',
      status: v.status,
      tabType,
    };
  });
};
