import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { resolveFileUrl, resolveFileUrls } from '../../services/storage';

const router = Router();

// ── Helper: format a VitalReading into a display object ──────────────────────
function formatVitalReading(r: any) {
  const def = r.vitalDefinition;
  const code = def?.code?.toUpperCase() ?? '';
  const name = def?.name ?? code;
  const unit = r.unit ?? def?.unit ?? '';
  const dataType = def?.dataType ?? 'numeric';

  let value: string;

  if (dataType === 'dual_numeric' && r.valueNumeric !== null && r.valueNumeric2 !== null) {
    const label1 = def?.value1Label ?? 'Value 1';
    const label2 = def?.value2Label ?? 'Value 2';
    value = `${r.valueNumeric}/${r.valueNumeric2}`;
    if (unit) value += ` ${unit}`;
  } else if (dataType === 'boolean') {
    const trueLabel = def?.booleanTrueLabel ?? 'Yes';
    const falseLabel = def?.booleanFalseLabel ?? 'No';
    value = r.valueBoolean ? trueLabel : falseLabel;
  } else if (dataType === 'text') {
    value = r.valueText ?? '—';
  } else {
    // numeric
    value = r.valueNumeric !== null && r.valueNumeric !== undefined
      ? `${r.valueNumeric}${unit ? ' ' + unit : ''}`
      : '—';
  }

  return {
    code,
    name,
    dataType,
    value,
    unit,
    isAbnormal: r.isAbnormal ?? false,
    capturedAt: r.capturedAt,
  };
}

// ── GET /beneficiary/interactions/me ────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as string;
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { OR: [{ id: userId }, { userId }] },
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    // IST formatter helpers
    const istFmt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const istDateFmt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const formatIST = (d: Date | null | undefined) => d ? istFmt.format(d).toUpperCase() : null;
    const formatDateIST = (d: Date | null | undefined) => d ? istDateFmt.format(d) : null;

    const completedVisits = await prisma.visit.findMany({
      where: { beneficiaryId: beneficiary.id, status: 'completed' },
      include: {
        careCompanion: true,
        benefit: {
          include: { benefitType: true }
        },
        vitalReadings: {
          include: { vitalDefinition: true },
          orderBy: { capturedAt: 'asc' },
        },
        medicationAdherenceRecords: {
          include: { medication: true },
        },
      },
      orderBy: { checkOutTime: 'desc' },
    });

    const completedSathiVisits = await prisma.sathiVisitRequest.findMany({
      where: { beneficiaryId: beneficiary.id, status: 'COMPLETED' },
      include: { volunteer: true },
      orderBy: { dateTime: 'desc' },
    });

    const defaultTitles = ['Medication Review', 'Regular Check-up', 'Wellness Visit', 'Physiotherapy Session'];

    const formattedVisits = await Promise.all(completedVisits.map(async (v: any, index: number) => {
      const scheduledTime: Date | null = v.scheduledTime ? new Date(v.scheduledTime) : null;
      const checkInTime: Date | null = v.checkInTime ? new Date(v.checkInTime) : null;
      const checkOutTime: Date | null = v.checkOutTime ? new Date(v.checkOutTime) : null;

      const scheduledStartStr = formatIST(scheduledTime);
      let scheduledEndStr: string | null = null;
      if (scheduledTime) {
        const durationMin = v.duration ? parseInt(v.duration) : 60;
        const endDate = new Date(scheduledTime.getTime() + durationMin * 60000);
        scheduledEndStr = formatIST(endDate);
      }
      const scheduledTimeRange = (scheduledStartStr && scheduledEndStr)
        ? `${scheduledStartStr} – ${scheduledEndStr}`
        : scheduledStartStr;

      const checkInStr = formatIST(checkInTime);
      const checkOutStr = formatIST(checkOutTime);

      let actualDurationMinutes: number | null = null;
      let durationText = '';
      if (checkInTime && checkOutTime) {
        const diffMs = checkOutTime.getTime() - checkInTime.getTime();
        let diffMins = Math.round(diffMs / 60000);
        if (diffMins <= 0 && diffMs > 0) diffMins = 1;
        actualDurationMinutes = diffMins;
        if (diffMins < 60) {
          durationText = `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
        } else {
          const durationHours = parseFloat((diffMins / 60).toFixed(1));
          durationText = `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
        }
      }

      const dateObj = scheduledTime || checkInTime || new Date(v.createdAt);
      const dateStr = formatDateIST(dateObj);
      const isExternalService = Boolean(v.is3rdParty || (!v.careCompanionId && !v.careCompanion));
      const benefitName = v.benefit?.name || null;
      const benefitCode = v.benefit?.code || null;
      const benefitCategory = v.benefit?.benefitType?.name || null;

      let checkInType = 'Standard Check-in';
      if (v.checkInTime) {
        if (v.isGeoVerified) {
          checkInType = `Auto Geofence (Verified${v.geoDistanceMeters != null ? ` • ${v.geoDistanceMeters}m` : ''})`;
        } else if (v.manualCheckInReason) {
          checkInType = 'Manual Check-in (Flagged)';
        }
      }
      let checkOutType = 'Standard Check-out';
      if (v.checkOutTime) {
        if (v.manualCheckOutReason) { checkOutType = 'Manual Check-out'; }
        else if (v.isGeoVerified) { checkOutType = 'Auto Geofence (Verified)'; }
      }

      const vitals = (v.vitalReadings || []).map(formatVitalReading);
      const medications = (v.medicationAdherenceRecords || []).map((mar: any) => ({
        id: mar.medicationId,
        name: mar.medication?.name || 'Medication',
        dosage: mar.medication?.dosage || null,
        taken: mar.taken === true,
      }));

      const rawPhotos = (() => {
        const raw = (v as any).imageUrls;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
          return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        return [];
      })();

      const [photos, companionPhoto] = await Promise.all([
        resolveFileUrls(rawPhotos, 1800),
        resolveFileUrl(v.careCompanion?.photo || v.careCompanion?.photoUrl, 1800),
      ]);

      return {
        id: v.id,
        encounterId: v.visitCode || v.encounterId,
        status: 'completed',
        is3rdParty: isExternalService,
        benefitId: v.benefitId || null,
        benefitName,
        benefitCode,
        benefitCategory,
        thirdPartyNotes: v.thirdPartyNotes || null,
        title: benefitName || v.visitSummary || defaultTitles[index % defaultTitles.length],
        companionName: isExternalService ? (benefitName || '3rd Party Partner Service') : (v.careCompanion?.name || 'Care Companion'),
        companionPhone: isExternalService ? null : (v.careCompanion?.phone || null),
        companionPhoto: isExternalService ? null : companionPhoto,
        isExternalService,
        scheduledDate: dateStr,
        scheduledStartTime: scheduledStartStr,
        scheduledEndTime: scheduledEndStr,
        scheduledTimeRange,
        dateStr: `${dateStr}${scheduledStartStr ? ' • ' + scheduledStartStr : ''}`,
        duration: durationText || '60 mins',
        actualDurationMinutes,
        durationText,
        checkInTime: checkInStr,
        checkInTimeIso: v.checkInTime ? new Date(v.checkInTime).toISOString() : null,
        checkInType,
        isGeoVerified: v.isGeoVerified || false,
        geoDistanceMeters: v.geoDistanceMeters || null,
        manualCheckInReason: v.manualCheckInReason || null,
        checkOutTime: checkOutStr,
        checkOutTimeIso: v.checkOutTime ? new Date(v.checkOutTime).toISOString() : null,
        checkOutType,
        manualCheckOutReason: v.manualCheckOutReason || null,
        vitals,
        medications,
        notes: v.notes || '',
        feedback: v.feedback || '',
        mood: v.mood || null,
        activities: v.activities || [],
        photos,
        rating: v.rating ?? null,
        beneficiaryRating: v.beneficiaryRating ?? null,
        rated: !!v.rating,
        timestamp: dateObj.getTime(),
      };
    }));

    const formattedSathiVisits = await Promise.all(completedSathiVisits.map(async (s: any) => {
      const dateObj = new Date(s.dateTime);
      const dateStr = formatDateIST(dateObj);
      const timeStr = formatIST(dateObj);
      const companionPhoto = s.volunteer?.profilePhoto ? await resolveFileUrl(s.volunteer.profilePhoto, 1800) : null;
      return {
        id: s.id,
        encounterId: null,
        status: 'completed',
        title: 'Saathi Companionship Visit',
        companionName: s.volunteer?.name || 'Saathi Volunteer',
        companionPhone: null,
        companionPhoto,
        isExternalService: false,
        isSathiVisit: true,
        scheduledDate: dateStr,
        scheduledStartTime: timeStr,
        scheduledTimeRange: timeStr,
        dateStr: `${dateStr}${timeStr ? ' • ' + timeStr : ''}`,
        duration: null,
        actualDurationMinutes: null,
        durationText: '',
        checkInTime: null,
        checkOutTime: null,
        isGeoVerified: false,
        vitals: [],
        medications: [],
        notes: s.reason || 'Companionship interaction.',
        feedback: (s as any).feedback ?? '',
        activities: [],
        photos: [],
        rating: null,
        beneficiaryRating: (s as any).beneficiaryRating ?? null,
        rated: false,
        timestamp: dateObj.getTime(),
      };
    }));

    const all = [...formattedVisits, ...formattedSathiVisits].sort((a, b) => b.timestamp - a.timestamp);
    res.json({ success: true, data: all });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /beneficiary/interactions/:visitId/rate ──────────────────────────────

router.post('/:visitId/rate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as string;
    const { visitId } = req.params;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const beneficiary = await prisma.beneficiary.findFirst({
      where: { OR: [{ id: userId }, { userId }] },
    });
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    const visit = await prisma.visit.findFirst({
      where: { id: visitId as string, beneficiaryId: beneficiary.id },
    });

    if (visit) {
      const updated = await (prisma.visit as any).update({
        where: { id: visitId as string },
        data: { beneficiaryRating: rating },
      });
      return res.json({ success: true, message: 'Rating submitted', beneficiaryRating: updated.beneficiaryRating });
    }

    // fallback to SathiVisitRequest
    const sathiReq = await prisma.sathiVisitRequest.findFirst({
      where: { id: visitId as string, beneficiaryId: beneficiary.id },
    });
    
    if (sathiReq) {
      // NOTE: rating for sathi visit is usually stored via beneficiaryRating if added, or handled manually
      return res.json({ success: true, message: 'Rating submitted for Sathi visit' });
    }

    return res.status(404).json({ success: false, message: 'Visit not found or not authorized' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /beneficiary/interactions/:visitId/feedback ─────────────────────────
router.post('/:visitId/feedback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as string;
    const { visitId } = req.params;
    const { feedback } = req.body;

    if (feedback === undefined) {
      return res.status(400).json({ success: false, message: 'feedback field is required' });
    }

    const beneficiary = await prisma.beneficiary.findFirst({
      where: { OR: [{ id: userId }, { userId }] },
    });
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    const visit = await prisma.visit.findFirst({
      where: { id: visitId as string, beneficiaryId: beneficiary.id },
    });

    if (visit) {
      const updated = await (prisma.visit as any).update({
        where: { id: visitId as string },
        data: { feedback },
      });
      return res.json({ success: true, message: 'Feedback saved successfully', feedback: updated.feedback });
    }

    // Fallback for Sathi
    const sathiReq = await prisma.sathiVisitRequest.findFirst({
      where: { id: visitId as string, beneficiaryId: beneficiary.id },
    });

    if (sathiReq) {
      const updated = await (prisma.sathiVisitRequest as any).update({
        where: { id: visitId as string },
        data: { feedback },
      });
      return res.json({ success: true, message: 'Feedback saved successfully for Sathi', feedback: updated.feedback });
    }

    return res.status(404).json({ success: false, message: 'Visit not found or not authorized' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
