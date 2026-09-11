import { Router, Request, Response } from 'express';
import { authenticate, validate } from '../shared/deps';
import { createVisitSchema, checkInSchema, checkOutSchema, rateVisitSchema, saveDetailsSchema } from '../../schemas/visit';
import * as visitService from '../../services/care_companion/visit_service';
import prisma from '../../core/database';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();

router.post('/', authenticate, validate(createVisitSchema), async (req: Request, res: Response) => {
  const visit = await visitService.createVisit(req.body);
  res.status(201).json({ success: true, data: visit });
});

router.get('/beneficiary/:beneficiaryId', authenticate, async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const visits = await visitService.getBeneficiaryVisits(req.params.beneficiaryId as string, limit);
  res.json({ success: true, data: visits });
});

router.get('/care_companion/:ccId', authenticate, async (req: Request, res: Response) => {
  const visits = await visitService.getCareCompanionVisits(req.params.ccId as string, req.query.date as string);
  res.json({ success: true, data: visits });
});

router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { careCompanionProfile: true }
    });

    if (!user || !user.careCompanionProfile) {
      return res.status(404).json({ success: false, message: 'Care Companion profile not found' });
    }

    const ccId = user.careCompanionProfile.id;

    // Run auto-transition check
    await visitService.autoUpdateMissedVisits();

    const completedVisits = await prisma.visit.findMany({
      where: {
        careCompanionId: ccId,
        status: { in: ['completed', 'missed', 'cancelled'] },
      },
      include: {
        beneficiary: {
          include: {
            vitalConfigs: {
              where: { isActive: true },
              include: {
                vitalDefinition: true
              }
            }
          }
        },
        medicationAdherenceRecords: {
          include: {
            medication: true
          }
        },
        vitalReadings: {
          include: {
            vitalDefinition: true
          }
        }
      },
      orderBy: {
        scheduledTime: 'desc',
      },
    });

    const totalVisitsCount = completedVisits.filter(v => v.status === 'completed').length;
    const totalMinutes = completedVisits.filter(v => v.status === 'completed').reduce((sum, v) => sum + (v.durationMinutes || 0), 0);
    const totalHoursVal = totalMinutes / 60;
    const avgHoursVal = totalVisitsCount > 0 ? (totalHoursVal / totalVisitsCount) : 0;

    const stats = {
      totalVisits: totalVisitsCount.toString(),
      totalHours: totalHoursVal.toFixed(1),
      avgHours: avgHoursVal.toFixed(1),
    };

    // Pre-fetch latest versions of all beneficiary vital definitions to resolve code changes
    const allConfigCodes = new Set<string>();
    completedVisits.forEach(v => {
      (v.beneficiary.vitalConfigs || []).forEach(vc => {
        allConfigCodes.add(vc.vitalDefinition.code);
      });
    });

    const latestDefinitions = await prisma.vitalDefinition.findMany({
      where: {
        code: { in: Array.from(allConfigCodes) },
        isLatestVersion: true
      }
    });
    const latestDefMap = new Map<string, any>();
    latestDefinitions.forEach(def => latestDefMap.set(def.code, def));

    const visits = completedVisits.map((v) => {
      const addressParts = [];
      if (v.beneficiary.flatPlot) addressParts.push(v.beneficiary.flatPlot);
      if (v.beneficiary.streetArea) addressParts.push(v.beneficiary.streetArea);
      if (v.beneficiary.city) addressParts.push(v.beneficiary.city);
      const patientAddress = addressParts.join(', ') || 'N/A';

      const dateObj = v.checkOutTime || v.scheduledTime || new Date();
      const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

      // Dynamically resolve beneficiary's required vitals (deduplicated by code)
      const uniqueCodes = new Set<string>();
      const configs = (v.beneficiary.vitalConfigs || []).filter(c => {
        // Filter out legacy split BP codes
        const code = c.vitalDefinition.code;
        if (code === 'BP_SYS' || code === 'BP_DIA' || code === 'BP_SYSTOLIC' || code === 'BP_DIASTOLIC') return false;

        if (uniqueCodes.has(code)) return false;
        uniqueCodes.add(code);
        return true;
      });

      const vitalsList = configs.map(c => {
        const def = latestDefMap.get(c.vitalDefinition.code) || c.vitalDefinition;
        const reading = v.vitalReadings.find(r => r.vitalDefinition.code === def.code);

        let value = 'N/A';
        if (reading) {
          if (def.dataType === 'dual_numeric') {
            value = reading.valueNumeric !== null && reading.valueNumeric2 !== null
              ? `${reading.valueNumeric}/${reading.valueNumeric2}${def.unit ? ' ' + def.unit : ''}`
              : 'N/A';
          } else if (def.dataType === 'numeric') {
            value = reading.valueNumeric !== null
              ? `${reading.valueNumeric}${def.unit ? ' ' + def.unit : ''}`
              : 'N/A';
          } else if (def.dataType === 'boolean') {
            const isTrue = reading.valueBoolean === true || String(reading.valueText).toLowerCase() === 'yes';
            value = isTrue ? (def.booleanTrueLabel || 'Yes') : (def.booleanFalseLabel || 'No');
          } else if (def.dataType === 'text') {
            value = reading.valueText !== null && reading.valueText !== '' ? reading.valueText : 'N/A';
          }
        }

        return {
          name: def.name,
          value
        };
      });

      const meds = v.medicationAdherenceRecords
        .filter(m => m.taken)
        .map(m => {
          const suffix = m.medication.dosage ? ` ${m.medication.dosage}` : '';
          return `${m.medication.name}${suffix}`;
        });

      const formattedMood = v.mood ? (v.mood.charAt(0).toUpperCase() + v.mood.slice(1).toLowerCase()) : null;

      return {
        id: v.id,
        visitCode: v.visitCode,
        rawDate: dateObj.toISOString(),
        patientName: v.beneficiary.name,
        address: patientAddress,
        date: dateStr,
        duration: v.status === 'completed' ? `${v.durationMinutes || 0} mins` : '—',
        tags: v.status === 'completed' 
          ? ['Home Visit', v.medicationAdherence ? 'Meds Taken' : 'Meds Flagged']
          : v.status === 'cancelled'
            ? ['Home Visit', 'Cancelled Visit']
            : ['Home Visit', 'Missed Visit'],
        status: v.status,
        mood: formattedMood,
        followUpRequired: !!v.followUpRequired,
        isExpanded: false,
        details: v.status === 'completed' ? {
          vitals: vitalsList,
          meds,
          mood: formattedMood || 'N/A',
          notes: v.notes || 'No visit notes captured.',
        } : null
      };
    });

    res.json({
      success: true,
      data: {
        stats,
        visits,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/check-in', authenticate, validate(checkInSchema), async (req: Request, res: Response) => {
  try {
    const visit = await visitService.checkIn(req.body);
    res.json({
      success: true,
      data: {
        id: visit.id,
        status: visit.status,
        checkInTime: visit.checkInTime,
        isGeoVerified: visit.isGeoVerified,
        geoDistanceMeters: visit.geoDistanceMeters,
        manualCheckInReason: visit.manualCheckInReason,
      }
    });
  } catch (e: unknown) {
    res.status(404).json({ success: false, message: (e as Error).message });
  }
});

router.post('/check-out', authenticate, validate(checkOutSchema), async (req: Request, res: Response) => {
  try {
    const visit = await visitService.checkOut(req.body);
    res.json({ success: true, data: visit });
  } catch (e: unknown) {
    console.error("Checkout Error:", e);
    res.status(404).json({ success: false, message: (e as Error).message });
  }
});

router.post('/save-details', authenticate, validate(saveDetailsSchema), async (req: Request, res: Response) => {
  try {
    const visit = await visitService.updateVisitDetails(req.body);
    res.json({ success: true, data: visit });
  } catch (e: unknown) {
    res.status(404).json({ success: false, message: (e as Error).message });
  }
});

router.post('/rate', authenticate, validate(rateVisitSchema), async (req: Request, res: Response) => {
  try {
    const visit = await visitService.rateVisit(req.body);
    res.json({ success: true, data: visit });
  } catch (e: unknown) {
    res.status(400).json({ success: false, message: (e as Error).message });
  }
});

router.get('/:visitId/details', authenticate, async (req: Request, res: Response) => {
  try {
    const visitId = req.params.visitId as string;
    
    // Fetch visit and beneficiary
    const visit: any = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        beneficiary: true,
        vitalReadings: true,
        medicationAdherenceRecords: true,
      }
    });

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    // Fetch dynamic vitals config for the beneficiary
    const configs = await prisma.beneficiaryVitalConfig.findMany({
      where: {
        beneficiaryId: visit.beneficiaryId,
        isActive: true,
      },
      include: {
        vitalDefinition: true,
      },
      orderBy: {
        vitalDefinition: {
          displayOrder: 'asc',
        }
      }
    });

    const configCodes = [...new Set(configs.map(c => c.vitalDefinition.code))];
    const latestDefinitions = await prisma.vitalDefinition.findMany({
      where: {
        code: { in: configCodes },
        isLatestVersion: true
      }
    });

    const latestDefMap = new Map();
    latestDefinitions.forEach(def => latestDefMap.set(def.code, def));

    const uniqueCodes = new Set();
    const deduplicatedConfigs = configs.filter(c => {
      if (uniqueCodes.has(c.vitalDefinition.code)) return false;
      uniqueCodes.add(c.vitalDefinition.code);
      return true;
    });

    const requiredVitalsRaw = deduplicatedConfigs.map(c => {
      const def = latestDefMap.get(c.vitalDefinition.code) || c.vitalDefinition;
      return {
        id: def.id,
        code: def.code,
        name: def.name,
        description: def.description,
        unit: def.unit,
        dataType: def.dataType,
        value1Label: def.value1Label,
        value2Label: def.value2Label,
        textOptions: def.textOptions,
        booleanTrueLabel: def.booleanTrueLabel || 'Yes',
        booleanFalseLabel: def.booleanFalseLabel || 'No',
        isMandatory: c.isMandatory,
      };
    });

    const requiredVitals = requiredVitalsRaw.filter(v => {
      // 1. Remove legacy duplicate split-fields for Blood Pressure if dual_numeric BP is active
      if (v.code === 'BP_SYS' || v.code === 'BP_DIA' || v.code === 'BP_SYSTOLIC' || v.code === 'BP_DIASTOLIC') return false;

      return true;
    });

    // Fetch active medications within active timeline for the beneficiary
    const now = new Date();
    const medications = await prisma.medication.findMany({
      where: {
        beneficiaryId: visit.beneficiaryId,
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      },
      select: {
        id: true,
        name: true,
        dosage: true,
        frequency: true,
        instructions: true,
      }
    });

    // Fetch active package benefits for the beneficiary
    const activeSub = await prisma.subscription.findFirst({
      where: { beneficiaryId: visit.beneficiaryId, isActive: true },
      include: {
        benefitBalances: {
          include: {
            benefit: true
          }
        }
      }
    });

    const formattedBenefits = (activeSub?.benefitBalances || []).map((bal: any) => {
      return {
        benefitId: bal.benefitId,
        benefitName: bal.benefit?.name || 'Benefit',
        unitLabel: bal.benefit?.unitLabel || 'units',
        remainingUnits: Math.max(0, bal.totalUnits - bal.usedUnits),
      };
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch service requests for the beneficiary from today onwards
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        beneficiaryId: visit.beneficiaryId,
        preferredDate: {
          gte: today
        }
      },
      orderBy: { preferredDate: 'asc' },
      include: {
        benefit: { select: { name: true } },
        requestedByUser: { select: { name: true } },
        subscriber: { select: { name: true } }
      }
    });

    const formattedRequests = serviceRequests.map((sr: any) => {
      return {
        id: sr.id,
        benefitName: sr.benefit?.name || 'Service',
        preferredDate: sr.preferredDate,
        preferredTiming: sr.preferredTiming,
        isRead: sr.isRead,
        requestedByUserId: sr.requestedByUserId,
        requestedByRole: sr.requestedByRole,
        requesterName: sr.requestedByUser?.name || sr.subscriber?.name || null
      };
    });

    res.json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          encounterId: visit.encounterId,
          scheduledTime: visit.scheduledTime,
          checkInTime: visit.checkInTime,
          checkOutTime: visit.checkOutTime,
          status: visit.status,
          notes: visit.notes,
          mood: visit.mood,
          manualCheckInReason: visit.manualCheckInReason,
          // Geo-fencing fields for the mobile app
          isGeoVerified: visit.isGeoVerified,
          geoDistanceMeters: visit.geoDistanceMeters,
          vitalReadings: visit.vitalReadings,
          medicationAdherenceRecords: visit.medicationAdherenceRecords,
        },
        beneficiary: {
          id: visit.beneficiary.id,
          name: visit.beneficiary.name,
          age: visit.beneficiary.age,
          gender: visit.beneficiary.gender || 'N/A',
          address: visit.beneficiary.address || 'N/A',
          flatPlot: visit.beneficiary.flatPlot,
          streetArea: visit.beneficiary.streetArea,
          city: visit.beneficiary.city,
          pincode: visit.beneficiary.pincode,
          photo: visit.beneficiary.photo ? await resolveFileUrl(visit.beneficiary.photo, 1800) : null,
          // GPS coordinates for client-side geo-fencing preview
          latitude: visit.beneficiary.latitude || null,
          longitude: visit.beneficiary.longitude || null,
        },
        requiredVitals,
        activeMedications: medications.map(m => ({
          id: m.id,
          name: `${m.name} ${m.dosage}`.trim(),
          frequency: m.frequency,
          instructions: m.instructions,
        })),
        benefits: formattedBenefits,
        serviceRequests: formattedRequests,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;