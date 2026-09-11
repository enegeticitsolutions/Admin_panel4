import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { resolveFileUrl, resolveFileUrls } from '../../services/storage';

const router = Router();

// Subscriber rates a completed CC visit for their beneficiary
router.post('/:visitId/rate', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const { visitId } = req.params;
        const { rating } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        // Verify the visit belongs to one of this subscriber's beneficiaries
        const beneficiaries = await prisma.beneficiary.findMany({
            where: { subscriberId: userId },
            select: { id: true }
        });
        const beneficiaryIds = beneficiaries.map((b: any) => b.id);

        if (beneficiaryIds.length === 0) {
            return res.status(404).json({ success: false, message: 'No beneficiaries found for this subscriber' });
        }

        const visit = await prisma.visit.findFirst({
            where: { id: visitId as string, beneficiaryId: { in: beneficiaryIds } }
        });

        if (!visit) {
            return res.status(404).json({ success: false, message: 'Visit not found or not authorized' });
        }

        const updated = await (prisma.visit as any).update({
            where: { id: visitId as string },
            data: { subscriberRating: rating }
        });

        res.json({
            success: true,
            message: 'Rating submitted successfully',
            subscriberRating: updated.subscriberRating
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Subscriber fetches full details of a completed CC visit for their beneficiary
router.get('/:visitId/details', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const { visitId } = req.params;

        const beneficiaries = await prisma.beneficiary.findMany({
            where: { subscriberId: userId },
            select: { id: true }
        });
        const beneficiaryIds = beneficiaries.map((b: any) => b.id);

        if (beneficiaryIds.length === 0) {
            return res.status(404).json({ success: false, message: 'No beneficiaries found for this subscriber' });
        }

        const visit: any = await prisma.visit.findFirst({
            where: { id: visitId as string, beneficiaryId: { in: beneficiaryIds } },
            include: {
                beneficiary: true,
                careCompanion: {
                    include: {
                        user: true
                    }
                },
                benefit: {
                    include: {
                        benefitType: true
                    }
                },
                vitalReadings: {
                    include: {
                        vitalDefinition: true
                    }
                },
                medicationAdherenceRecords: {
                    include: {
                        medication: true
                    }
                }
            }
        });

        if (!visit) {
            return res.status(404).json({ success: false, message: 'Visit not found or not authorized' });
        }

        // Parse vitals
        const vitalsList: any[] = [];
        (visit.vitalReadings || []).forEach((r: any) => {
            const def = r.vitalDefinition;
            if (!def) return;
            let valStr = '';
            if (def.dataType === 'dual_numeric') {
                if (r.valueNumeric != null && r.valueNumeric2 != null) {
                    valStr = `${r.valueNumeric}/${r.valueNumeric2} ${def.unit || 'mmHg'}`.trim();
                }
            } else if (def.dataType === 'numeric') {
                if (r.valueNumeric != null) {
                    valStr = `${r.valueNumeric} ${def.unit || ''}`.trim();
                }
            } else if (def.dataType === 'boolean') {
                const isTrue = r.valueBoolean === true || String(r.valueText).toLowerCase() === 'yes';
                valStr = isTrue ? (def.booleanTrueLabel || 'Yes') : (def.booleanFalseLabel || 'No');
            } else if (def.dataType === 'text') {
                if (r.valueText) valStr = r.valueText;
            }

            if (valStr) {
                vitalsList.push({
                    id: def.id,
                    name: def.name,
                    code: def.code,
                    value: valStr,
                    unit: def.unit || ''
                });
            }
        });

        // Parse medications
        const medicationsList = (visit.medicationAdherenceRecords || []).map((mar: any) => ({
            id: mar.medicationId,
            name: mar.medication?.name || 'Medication',
            dosage: mar.medication?.dosage || null,
            instructions: mar.medication?.instructions || null,
            taken: mar.taken === true
        }));

        // Check-in & Check-out formatting with Indian Standard Time (IST)
        const istDateFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
        const istTimeFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

        const schedDate = new Date(visit.scheduledTime);
        const schedDateStr = istDateFormatter.format(schedDate);
        const schedStartTime = istTimeFormatter.format(schedDate);
        const schedEndTime = istTimeFormatter.format(new Date(schedDate.getTime() + (visit.durationMinutes || 60) * 60000));

        const checkInTimeFormatted = visit.checkInTime ? istTimeFormatter.format(new Date(visit.checkInTime)) : null;
        const checkOutTimeFormatted = visit.checkOutTime ? istTimeFormatter.format(new Date(visit.checkOutTime)) : null;

        // Calculate actual duration
        let actualDurationMinutes: number | null = null;
        let durationText = `${visit.durationMinutes || 60} mins`;
        if (visit.checkInTime && visit.checkOutTime) {
            const diffMs = new Date(visit.checkOutTime).getTime() - new Date(visit.checkInTime).getTime();
            let diffMins = Math.round(diffMs / 60000);
            if (diffMins <= 0 && diffMs > 0) diffMins = 1;
            actualDurationMinutes = diffMins;
            durationText = diffMins < 60 ? `${diffMins} mins` : `${parseFloat((diffMins / 60).toFixed(1))} hours`;
        }

        let checkInType = 'Standard Check-in';
        if (visit.checkInTime) {
            if (visit.isGeoVerified) {
                checkInType = `Auto Geofence (Verified${visit.geoDistanceMeters != null ? ` • ${visit.geoDistanceMeters}m` : ''})`;
            } else if (visit.manualCheckInReason) {
                checkInType = 'Manual Check-in (Flagged)';
            }
        }

        let checkOutType = 'Standard Check-out';
        if (visit.checkOutTime) {
            if (visit.manualCheckOutReason) {
                checkOutType = 'Manual Check-out';
            } else if (visit.isGeoVerified) {
                checkOutType = 'Auto Geofence (Verified)';
            }
        }

        // Photos extraction
        const rawPhotos = (() => {
            const raw = visit.imageUrls;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) return parsed;
                } catch {
                    return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
            }
            return [];
        })();

        const [photos, companionPhoto] = await Promise.all([
            resolveFileUrls(rawPhotos, 1800),
            resolveFileUrl(visit.careCompanion?.photo, 1800),
        ]);

        const is3rdParty = Boolean(visit.is3rdParty || (!visit.careCompanionId && !visit.careCompanion));
        const benefitName = visit.benefit?.name || null;
        const benefitCode = visit.benefit?.code || null;
        const benefitCategory = visit.benefit?.benefitType?.name || null;

        res.json({
            success: true,
            data: {
                id: visit.id,
                encounterId: visit.encounterId || visit.visitCode || `ENC-${visit.id.slice(0, 8).toUpperCase()}`,
                status: visit.status,
                is3rdParty,
                benefitId: visit.benefitId || null,
                benefitName,
                benefitCode,
                benefitCategory,
                thirdPartyNotes: visit.thirdPartyNotes || null,
                companionName: is3rdParty ? (benefitName || 'Third-Party Partner Service') : (visit.careCompanion?.name || 'Care Companion'),
                companionPhoto: is3rdParty ? null : companionPhoto,
                companionPhone: is3rdParty ? null : (visit.careCompanion?.user?.phone || null),
                scheduledDate: schedDateStr,
                scheduledTime: visit.scheduledTime,
                scheduledStartTime: schedStartTime,
                scheduledEndTime: schedEndTime,
                scheduledTimeRange: `${schedStartTime} – ${schedEndTime}`,
                durationMinutes: visit.durationMinutes,
                actualDurationMinutes,
                durationText,
                checkInTime: checkInTimeFormatted,
                checkInTimeIso: visit.checkInTime,
                checkInType,
                isGeoVerified: visit.isGeoVerified === true,
                geoDistanceMeters: visit.geoDistanceMeters ?? null,
                manualCheckInReason: visit.manualCheckInReason || null,
                checkOutTime: checkOutTimeFormatted,
                checkOutTimeIso: visit.checkOutTime,
                checkOutType,
                manualCheckOutReason: visit.manualCheckOutReason || null,
                mood: visit.mood ? (visit.mood.charAt(0).toUpperCase() + visit.mood.slice(1).toLowerCase()) : 'Neutral',
                medicationAdherence: visit.medicationAdherence,
                medications: medicationsList,
                vitals: vitalsList,
                notes: visit.visitSummary || visit.notes,
                photos,
                subscriberRating: visit.subscriberRating ?? null,
                beneficiaryRating: visit.beneficiaryRating ?? null,
                activities: visit.activitiesDone || []
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
