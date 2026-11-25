import { Router, Request, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { notificationProducer } from '@maihoonna/notifications';
import { resolveFileUrl, resolveFileUrls } from '../../services/storage';
import { getProfileAccess } from '../../services/access/profile_access_service';

const router = Router();

// Dashboard for Beneficiary (Secure me route — strictly resolves caller's own SELF profile)
router.get('/dashboard/me', authenticate, async (req: AuthRequest, res: Response) => {
    return handleBeneficiaryDashboard(req, res, true);
});

// Dashboard for Beneficiary (Explicit beneficiaryId or userId)
router.get('/dashboard/:beneficiaryId', authenticate, async (req: AuthRequest, res: Response) => {
    return handleBeneficiaryDashboard(req, res, false);
});

async function handleBeneficiaryDashboard(req: AuthRequest, res: Response, isSelfRoute: boolean) {
    try {
        const targetId = isSelfRoute ? req.userId! : (req.params.beneficiaryId as string);

        // On /dashboard/me, strictly match caller's OWN Care Profile (prevents dual-role users loading a parent's profile)
        const beneficiary = await prisma.beneficiary.findFirst({
            where: isSelfRoute
                ? { userId: targetId, status: { not: 'deleted' } }
                : {
                    OR: [{ id: targetId }, { userId: targetId }],
                    status: { not: 'deleted' },
                },
            include: {
                primaryCC: {
                    include: { user: true }
                },
            },
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found for this user' });
        }

        // Single-query unified authorization check
        const access = await getProfileAccess(req.userId, beneficiary.id, req.userRole);
        if (!access.canView) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to beneficiary dashboard' });
        }

        // Determine greeting based on time in IST (server time assumption or static for now)
        const currentHour = new Date().getHours();
        let greeting = 'Good Evening';
        if (currentHour < 12) greeting = 'Good Morning';
        else if (currentHour < 17) greeting = 'Good Afternoon';

        // Get next visit
        const nextVisit = await prisma.visit.findFirst({
            where: {
                beneficiaryId: beneficiary.id,
                scheduledTime: { gte: new Date() },
                status: 'scheduled',
            },
            orderBy: { scheduledTime: 'asc' },
        });

        // Calculate Adherence (Mock formula based on records, or just a static high number for demo if no records)
        const adherenceRecords = await prisma.medicationAdherence.findMany({
            where: { beneficiaryId: beneficiary.id },
        });

        let adherencePercentage = 95; // Default high for demo purporses
        if (adherenceRecords.length > 0) {
            const taken = adherenceRecords.filter(r => r.taken).length;
            adherencePercentage = Math.round((taken / adherenceRecords.length) * 100);
        }

        // Get today's medications
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const medications = await prisma.medication.findMany({
            where: {
                beneficiaryId: beneficiary.id,
                isActive: true,
            },
            include: {
                adherenceRecords: {
                    where: {
                        scheduledTime: { gte: today, lt: tomorrow }
                    }
                }
            }
        });

        // Format medications
        const todaysMedications = medications.map(med => {
            // Find if they took it today
            const takenToday = med.adherenceRecords.some(r => r.taken);
            return {
                id: med.id,
                name: med.name,
                dosage: med.dosage,
                condition: med.frequency, // We might not have a direct condition field on Medication model
                time: med.timeSlots[0] || '08:00 AM', // Take first timeslot or default
                completed: takenToday,
                adherenceScore: adherencePercentage // using overall adherence for individual as per design mockup
            }
        });

        // Get active subscription
        const activeSub = await prisma.subscription.findFirst({
            where: { beneficiaryId: beneficiary.id, isActive: true },
            include: { package: true }
        });

        // Get pending/prepaid subscription if no active subscription
        let pendingSub: any = null;
        if (!activeSub) {
            pendingSub = await prisma.subscription.findFirst({
                where: { beneficiaryId: beneficiary.id, isActive: false },
                orderBy: { createdAt: 'desc' },
                include: { package: true }
            });
        }

        res.json({
            success: true,
            data: {
                beneficiaryId: beneficiary.id,
                beneficiaryName: beneficiary.name,
                verificationStatus: beneficiary.verificationStatus || 'verified',
                isActive: beneficiary.isActive !== false,
                isPendingVerification: beneficiary.verificationStatus === 'pending' || !beneficiary.isActive,
                greeting,
                firstName: beneficiary.name.split(' ')[0], // Assuming first part of name
                emotionalScore: beneficiary.emotionalScore === 8.0 ? 85 : beneficiary.emotionalScore,
                nextVisit: nextVisit ? nextVisit.scheduledTime : null,
                adherence: `${adherencePercentage}%`,
                subscription: activeSub ? {
                    packageName: activeSub.package?.name,
                    hoursTotal: activeSub.hoursTotal,
                    hoursUsed: activeSub.hoursUsed,
                    remainingHours: Math.max(0, activeSub.hoursTotal - activeSub.hoursUsed)
                } : null,
                pendingSubscription: pendingSub ? {
                    id: pendingSub.id,
                    packageName: pendingSub.package?.name || pendingSub.packageType,
                    packageType: pendingSub.packageType,
                    status: 'pending',
                } : null,
                careCoordinator: (beneficiary.primaryCC && (beneficiary.primaryCC as any).user?.isActive !== false) ? {
                    id: beneficiary.primaryCC.id,
                    name: beneficiary.primaryCC.name,
                    role: 'Primary Care Coordinator',
                    bio: beneficiary.primaryCC.bio || 'Experienced care companion.',
                    photo: beneficiary.primaryCC.photo ? await resolveFileUrl(beneficiary.primaryCC.photo, 1800) : null,
                    phone: (beneficiary.primaryCC as any).user?.phone || null
                } : null,
                todaysMedications
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Fetch Care Team
router.get('/:userId/team', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.params.userId as string;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: { userId: userId },
            include: {
                primaryCC: { include: { user: true } },
                secondaryCC: { include: { user: true } },
                team: {
                    include: {
                        fieldManager: {
                            include: {
                                user: true
                            }
                        }
                    }
                }, 
            },
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        const access = await getProfileAccess(req.userId, beneficiary.id, req.userRole);
        if (!access.canView) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to beneficiary visits' });
        }

        const team = [];

        if (beneficiary.primaryCC && (beneficiary.primaryCC as any).user?.isActive !== false) {
            team.push({
                id: beneficiary.primaryCC.id,
                level: 'Primary',
                name: beneficiary.primaryCC.name,
                role: 'Primary Care Coordinator',
                bio: beneficiary.primaryCC.bio || '',
                photo: beneficiary.primaryCC.photo ? await resolveFileUrl(beneficiary.primaryCC.photo, 1800) : null,
                phone: (beneficiary.primaryCC as any).user?.phone || null
            });
        }

        if (beneficiary.secondaryCC && (beneficiary.secondaryCC as any).user?.isActive !== false) {
            team.push({
                id: beneficiary.secondaryCC.id,
                level: 'Secondary',
                name: beneficiary.secondaryCC.name,
                role: 'Secondary Care Coordinator',
                bio: beneficiary.secondaryCC.bio || '',
                photo: beneficiary.secondaryCC.photo ? await resolveFileUrl(beneficiary.secondaryCC.photo, 1800) : null,
                phone: (beneficiary.secondaryCC as any).user?.phone || null
            });
        }

        if (beneficiary.team && beneficiary.team.fieldManager) {
            const fmProfile = beneficiary.team.fieldManager;
            team.push({
                id: fmProfile.id,
                level: 'Field Manager',
                name: fmProfile.name || 'Field Manager',
                role: 'Field Manager',
                bio: fmProfile.bio || '',
                photo: fmProfile.photo ? await resolveFileUrl(fmProfile.photo, 1800) : null, 
                phone: fmProfile.phone || fmProfile.user?.phone || null
            });
        }

        res.json({ success: true, data: team });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Log a call
router.post('/log-call', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { callerId, receiverId } = req.body;

        if (!callerId || !receiverId) {
            return res.status(400).json({ success: false, message: 'callerId and receiverId are required' });
        }

        const log = await prisma.callLog.create({
            data: {
                callerId,
                receiverId
            }
        });

        res.json({ success: true, data: log });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Fetch Scheduled/Upcoming and Past Visits
router.get('/:userId/visits', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.params.userId as string;

        let beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [{ userId }, { id: userId }],
                status: { not: 'deleted' },
            },
        });

        if (!beneficiary) {
            beneficiary = await prisma.beneficiary.findFirst({
                where: {
                    subscriberId: userId,
                    status: { not: 'deleted' },
                },
                orderBy: { createdAt: 'asc' },
            });
        }

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        const access = await getProfileAccess(req.userId, beneficiary.id, req.userRole);
        if (!access.canView) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to beneficiary visits' });
        }

        const visits = await prisma.visit.findMany({
            where: {
                beneficiaryId: beneficiary.id,
            },
            include: {
                beneficiary: {
                    select: { id: true, name: true, streetArea: true, city: true, address: true },
                },
                careCompanion: {
                    include: {
                        user: { select: { phone: true } },
                    },
                },
                benefit: {
                    include: { benefitType: true },
                },
                vitalReadings: {
                    include: { vitalDefinition: true },
                },
            },
            orderBy: {
                scheduledTime: 'desc',
            },
        });

        const upcomingRaw = visits.filter(v => v.status === 'scheduled' || v.status === 'in_progress').reverse();
        const pastRaw = visits.filter(v => v.status !== 'scheduled' && v.status !== 'in_progress');

        const formatTimeShort = (d: Date) => {
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
        };

        const formatTimeWindowPart = (d: Date) => {
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            hours = hours % 12 || 12;
            return `${hours}:${minutes}`;
        };

        const getRelativeDayLabel = (d: Date) => {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Tomorrow';
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        };

        const formatVisit = async (v: any, isUpcoming: boolean) => {
            const dateObj = new Date(v.scheduledTime);
            const defaultMins = (v.durationMinutes && v.durationMinutes >= 15) ? v.durationMinutes : 120;
            const endObj = new Date(dateObj.getTime() + defaultMins * 60000);
            const arrivalStartObj = new Date(dateObj.getTime() - 15 * 60000);

            const formattedTime = formatTimeShort(dateObj);
            const formattedEndTime = formatTimeShort(endObj);
            const timeRange = `${formattedTime} – ${formattedEndTime}`;
            const arrivalWindow = `${formatTimeWindowPart(arrivalStartObj)}–${formatTimeWindowPart(dateObj)}`;

            const formattedDateUpcoming = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            });
            const formattedDatePast = dateObj.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
            });
            const fullDateTime = `${dateObj.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
            })}, ${formattedTime}`;

            let dateStr = isUpcoming ? formattedDateUpcoming : formattedDatePast;
            if (!isUpcoming && v.status === 'completed' && v.checkOutTime) {
                const checkOutDateObj = new Date(v.checkOutTime);
                if (dateObj.toDateString() !== checkOutDateObj.toDateString()) {
                    const formattedDateCheckOut = checkOutDateObj.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                    });
                    dateStr = `Scheduled: ${formattedDatePast} | Completed: ${formattedDateCheckOut}`;
                }
            }

            let durationText = '';
            if (v.status === 'completed' && v.checkInTime && v.checkOutTime) {
                const diffMs = new Date(v.checkOutTime).getTime() - new Date(v.checkInTime).getTime();
                let diffMins = Math.round(diffMs / 60000);
                if (diffMins <= 0 && diffMs > 0) diffMins = 1;
                if (diffMins < 60) {
                    durationText = `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
                } else {
                    const durationHours = parseFloat((diffMins / 60).toFixed(1));
                    durationText = `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
                }
            } else {
                const durationHours = parseFloat((defaultMins / 60).toFixed(1));
                durationText = `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
            }

            // Extract vitals for timeline/report display
            const vitalsList: Array<{ id?: string; name: string; code?: string; value: string; unit?: string }> = [];
            (v.vitalReadings || []).forEach((r: any) => {
                const def = r.vitalDefinition;
                if (!def) return;
                let valStr = '';
                if (def.dataType === 'dual_numeric') {
                    if (r.valueNumeric != null && r.valueNumeric2 != null) {
                        valStr = `${r.valueNumeric}/${r.valueNumeric2}`;
                    }
                } else if (def.dataType === 'numeric') {
                    if (r.valueNumeric != null) {
                        valStr = `${r.valueNumeric}${def.unit && def.unit === '%' ? '%' : ''}`;
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
                        unit: def.unit || '',
                    });
                }
            });

            // Photos extraction
            const rawPhotos = (() => {
                const raw = (v as any).imageUrls;
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
                resolveFileUrl(v.careCompanion?.photo, 1800),
            ]);

            const companionName = v.careCompanion?.name || v.benefit?.name || 'Care Companion';
            const companionFirstName = companionName.split(' ')[0] || companionName;
            const companionInitials = companionName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p: string) => p[0]?.toUpperCase() || '')
                .join('') || 'CC';

            const visitTitle = v.benefit?.name || v.notes || 'Saathi Care Visit';
            const locationLabel = v.beneficiary?.streetArea || v.beneficiary?.city || 'Home Visit';

            return {
                id: v.id,
                title: visitTitle,
                beneficiaryId: beneficiary.id,
                beneficiaryName: v.beneficiary?.name || beneficiary.name,
                location: locationLabel,
                date: dateStr,
                shortDate: formattedDatePast,
                fullDateTime,
                relativeDayLabel: getRelativeDayLabel(dateObj),
                dayShort: dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
                dayNumber: String(dateObj.getDate()),
                time: formattedTime,
                timeRange,
                arrivalWindow,
                duration: durationText,
                companionName,
                companionFirstName,
                companionInitials,
                companionPhoto,
                companionPhone: v.careCompanion?.user?.phone || null,
                companionRating: v.careCompanion?.rating ?? 5.0,
                companionVerified: v.careCompanion?.isVerified ?? true,
                type: v.benefit?.benefitType?.name || 'Home Visit',
                status: v.status,
                visitSummary: v.visitSummary || null,
                notes: v.visitSummary || v.notes || null,
                mood: v.mood ? (v.mood.charAt(0).toUpperCase() + v.mood.slice(1).toLowerCase()) : null,
                vitals: vitalsList,
                photos,
                checkInTime: v.checkInTime ? formatTimeShort(new Date(v.checkInTime)) : null,
                checkOutTime: v.checkOutTime ? formatTimeShort(new Date(v.checkOutTime)) : null,
                changeRequestedAt: v.changeRequestedAt,
                changeRequestStatus: v.changeRequestStatus,
                changeResolutionReason: v.changeResolutionReason,
                rawScheduledTime: v.scheduledTime,
            };
        };

        const [upcoming, past] = await Promise.all([
            Promise.all(upcomingRaw.map(v => formatVisit(v, true))),
            Promise.all(pastRaw.map(v => formatVisit(v, false))),
        ]);

        res.json({ 
            success: true, 
            data: { upcoming, past, beneficiaryId: beneficiary.id } 
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/visits/:visitId/request-change', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const visitId = req.params.visitId as string;
        const { preferredDate, preferredTime, reason } = req.body;
        
        const visit = await prisma.visit.findUnique({ where: { id: visitId } });
        if (!visit) {
            return res.status(404).json({ success: false, message: 'Visit not found' });
        }
        
        const now = new Date();
        const scheduled = new Date(visit.scheduledTime);
        const diffHours = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (diffHours < 48) {
            return res.status(400).json({ success: false, message: 'Changes can only be requested at least 48 hours before the scheduled time.' });
        }
        
        await prisma.visit.update({
            where: { id: visitId },
            data: {
                changeRequestedAt: new Date(),
                changePreferredDate: preferredDate,
                changePreferredTime: preferredTime,
                changeReason: reason,
                changeRequestStatus: 'pending',
                changeResolutionReason: null
            }
        });

        // Respond to client immediately to eliminate API latency
        res.json({ success: true, message: 'Change request submitted successfully.' });

        // Asynchronous fire-and-forget notification in background task
        setImmediate(async () => {
            try {
                const fullVisit = await prisma.visit.findUnique({
                    where: { id: visitId },
                    include: {
                        beneficiary: {
                            include: {
                                subscriber: true,
                                user: true
                            }
                        },
                        careCompanion: true
                    }
                });
                const recipientPhone = fullVisit?.beneficiary?.subscriber?.phone || fullVisit?.beneficiary?.user?.phone;
                if (recipientPhone) {
                    const companionName = fullVisit?.careCompanion?.name || 'Care Mitra';
                    const formattedDetails = `${preferredDate || 'New date'} at ${preferredTime || 'New time'}`;
                    await notificationProducer.publish({
                        idempotencyKey: `visit-change-req-${visitId}-${Date.now()}`,
                        channel: 'whatsapp',
                        event: 'APPOINTMENT_RESCHEDULED_CANCELLED',
                        recipient: { phone: recipientPhone },
                        variables: {
                            appointmentType: `care visit with ${companionName}`,
                            status: 'submitted for rescheduling',
                            newDetails: `Requested for ${formattedDetails}. Care team will confirm shortly.`
                        }
                    });
                }
            } catch (notifErr: any) {
                console.error('[DashboardRoutes] Background WhatsApp notification error:', notifErr.message);
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Sub-routes modularization for scalability
import interactionsRouter from './interactions.routes';
import medicalRecordsRouter from './medical-records.routes';
import profileRouter from './profile.routes';
import healthSummaryRouter from './health-summary.routes';

router.use('/interactions', interactionsRouter);
router.use('/medical-records', medicalRecordsRouter);
router.use('/profile', profileRouter);
router.use('/health-summary', healthSummaryRouter);

export default router;
