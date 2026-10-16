import prisma from '../../core/database';
import { generateUUID } from '../../utils/helpers';

export class MedicationAdherenceManager {
    private beneficiaryId: string;
    private isResolved = false;

    constructor(beneficiaryId: string) {
        if (!beneficiaryId) {
            throw new Error('Beneficiary ID is required to instantiate MedicationAdherenceManager');
        }
        this.beneficiaryId = beneficiaryId;
    }

    /**
     * Helper to transparently resolve beneficiaryId to Profile ID if given a User ID
     */
    private async resolveBeneficiaryId(): Promise<void> {
        if (this.isResolved) return;
        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { id: this.beneficiaryId },
                    { userId: this.beneficiaryId }
                ]
            }
        });

        if (beneficiary) {
            this.beneficiaryId = beneficiary.id;
            this.isResolved = true;
        }
    }

    /**
     * Retrieves all active medications scheduled for today.
     * If no medications are active for today, scans forward to find the most upcoming
     * active medication start date and generates the schedule timeline for that day instead,
     * beautifully preventing empty screens.
     */
    public async getTodaySchedule(): Promise<any[]> {
        await this.resolveBeneficiaryId();

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Helper to generate schedule slots for a specific calendar range
        const generateSlotsForDay = async (start: Date, end: Date, isFuture: boolean, futureText: string) => {
            // 1. Fetch active medications active in this range
            const medications = await prisma.medication.findMany({
                where: {
                    beneficiaryId: this.beneficiaryId,
                    isActive: true,
                    startDate: { lte: end },
                    OR: [
                        { endDate: null },
                        { endDate: { gte: start } }
                    ]
                }
            });

            // 2. Fetch existing adherence logs recorded for this range
            const dayLogs = await prisma.medicationAdherence.findMany({
                where: {
                    beneficiaryId: this.beneficiaryId,
                    scheduledTime: {
                        gte: start,
                        lte: end
                    }
                }
            });

            const scheduleSlots: any[] = [];
            const currentTime = new Date();

            for (const med of medications) {
                // Translate frequency & time slots
                let slots: string[] = med.timeSlots || [];
                if (slots.length === 0) {
                    if (med.frequency === 'once_daily') {
                        slots = ['08:00 AM'];
                    } else if (med.frequency === 'twice_daily') {
                        slots = ['08:00 AM', '08:00 PM'];
                    } else if (med.frequency === 'thrice_daily') {
                        slots = ['08:00 AM', '02:00 PM', '08:00 PM'];
                    } else {
                        slots = ['08:00 AM']; // fallback
                    }
                }

                // Calculate adherence rate specifically for this medication (all-time / 30-days)
                const medLogs = await prisma.medicationAdherence.findMany({
                    where: {
                        medicationId: med.id,
                    }
                });
                const medTakenCount = medLogs.filter(l => l.taken).length;
                const medTotalLogged = medLogs.length;
                const medAdherencePercentage = medTotalLogged > 0 
                    ? Math.round((medTakenCount / medTotalLogged) * 100) 
                    : 100;

                for (const slot of slots) {
                    // Parse time slot e.g., "08:00 AM" or "morning" or "evening"
                    const scheduledTime = this.parseTimeSlotToDate(slot);
                    // Force the parsed time's day/month/year to match the query day start
                    scheduledTime.setFullYear(start.getFullYear());
                    scheduledTime.setMonth(start.getMonth());
                    scheduledTime.setDate(start.getDate());

                    // Find if there is a matching log for this medication at this scheduled hour today
                    const matchedLog = dayLogs.find(log => 
                        log.medicationId === med.id && 
                        Math.abs(new Date(log.scheduledTime).getTime() - scheduledTime.getTime()) < 60000 // within 1 minute
                    );

                    let status = 'pending';
                    let logId = null;

                    if (matchedLog) {
                        status = matchedLog.taken ? 'taken' : 'missed';
                        logId = matchedLog.id;
                    } else if (scheduledTime < currentTime) {
                        status = 'missed'; // Past scheduled time with no log counts as missed
                    }

                    const isTodaySlot = scheduledTime >= todayStart && scheduledTime <= todayEnd;
                    const canMark = !isFuture && isTodaySlot;

                    scheduleSlots.push({
                        id: med.id,
                        logId,
                        name: med.name,
                        dosage: med.dosage,
                        frequency: med.frequency.replace(/_/g, ' '),
                        instructions: med.instructions || 'Take as directed',
                        scheduleTimeText: slot,
                        scheduledTimeIso: scheduledTime.toISOString(),
                        status,
                        adherencePercentage: medAdherencePercentage,
                        isFutureSchedule: isFuture,
                        futureDateText: futureText,
                        isToday: isTodaySlot,
                        canMark
                    });
                }
            }

            return scheduleSlots.sort((a, b) => 
                new Date(a.scheduledTimeIso).getTime() - new Date(b.scheduledTimeIso).getTime()
            );
        };

        // First attempt: generate schedule for today
        let slots = await generateSlotsForDay(todayStart, todayEnd, false, '');

        // If today has no medications, scan forward to find the next available medication's start date
        if (slots.length === 0) {
            const nextMed = await prisma.medication.findFirst({
                where: {
                    beneficiaryId: this.beneficiaryId,
                    isActive: true,
                    startDate: { gt: todayEnd }
                },
                orderBy: {
                    startDate: 'asc'
                }
            });

            if (nextMed) {
                const nextDate = new Date(nextMed.startDate);
                const nextStart = new Date(nextDate);
                nextStart.setHours(0, 0, 0, 0);

                const nextEnd = new Date(nextDate);
                nextEnd.setHours(23, 59, 59, 999);

                const futureText = nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                slots = await generateSlotsForDay(nextStart, nextEnd, true, futureText);
            }
        }

        return slots;
    }

    public async logAdherence(
        medicationId: string,
        scheduledTimeIso: string,
        taken: boolean,
        recordedBy: string
    ): Promise<any> {
        await this.resolveBeneficiaryId();
        const scheduledTime = new Date(scheduledTimeIso);
        
        // Strict Today validation: Adherence can ONLY be marked on the scheduled day (Today)
        const now = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

        if (scheduledTime < todayStart || scheduledTime > todayEnd) {
            throw new Error('Medication adherence can only be marked on the scheduled day (Today). Past or future doses cannot be modified.');
        }

        let finalRecordedBy = recordedBy;
        
        // Self-healing validation for recordedBy to prevent DB foreign key violations
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(recordedBy)) {
            const ben = await prisma.beneficiary.findUnique({
                where: { id: this.beneficiaryId },
                select: { userId: true }
            });
            if (ben) {
                finalRecordedBy = ben.userId;
            }
        }

        // Find if there's an existing log for today
        const existingLog = await prisma.medicationAdherence.findFirst({
            where: {
                medicationId,
                scheduledTime
            }
        });

        if (existingLog) {
            // Update
            await prisma.medicationAdherence.update({
                where: { id: existingLog.id },
                data: {
                    taken,
                    takenTime: taken ? new Date() : null,
                    recordedBy: finalRecordedBy
                }
            });
        } else {
            // Create
            await prisma.medicationAdherence.create({
                data: {
                    id: generateUUID(),
                    beneficiaryId: this.beneficiaryId,
                    medicationId,
                    scheduledTime,
                    taken,
                    takenTime: taken ? new Date() : null,
                    recordedBy: finalRecordedBy
                }
            });
        }

        // Recalculate global adherence score for this beneficiary
        const score = await this.recalculateOverallScore();

        return { success: true, updatedOverallScore: score };
    }

    /**
     * Computes expected vs taken doses over the last 30 days based on active medications
     * and their daily frequencies rather than merely counting existing log rows.
     */
    private async calculate30DayAdherenceMetrics(): Promise<{
        average: number;
        taken: number;
        missed: number;
        totalExpected: number;
    }> {
        await this.resolveBeneficiaryId();

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        // 1. Fetch all active medications for this beneficiary
        const medications = await prisma.medication.findMany({
            where: {
                beneficiaryId: this.beneficiaryId,
                isActive: true,
                startDate: { lte: now },
                OR: [
                    { endDate: null },
                    { endDate: { gte: thirtyDaysAgo } }
                ]
            }
        });

        // 2. Fetch all recorded adherence logs for the last 30 days
        const logs = await prisma.medicationAdherence.findMany({
            where: {
                beneficiaryId: this.beneficiaryId,
                scheduledTime: { gte: thirtyDaysAgo, lte: now }
            }
        });

        const takenLogsCount = logs.filter(l => l.taken).length;

        // If no medications are configured at all, return 100% adherence and 0 taken / 0 missed
        if (medications.length === 0) {
            const taken = logs.filter(l => l.taken).length;
            const missed = logs.filter(l => !l.taken).length;
            const score = logs.length > 0 ? Math.round((taken / logs.length) * 100) : 100;
            return {
                average: score,
                taken,
                missed,
                totalExpected: logs.length
            };
        }

        // 3. Calculate expected scheduled doses for active medications over the 30-day window
        let totalExpectedDoses = 0;

        for (const med of medications) {
            // Determine daily frequency
            let dailyDoses = (med.timeSlots && med.timeSlots.length > 0) ? med.timeSlots.length : 0;
            if (dailyDoses === 0) {
                if (med.frequency === 'once_daily') dailyDoses = 1;
                else if (med.frequency === 'twice_daily') dailyDoses = 2;
                else if (med.frequency === 'thrice_daily') dailyDoses = 3;
                else if (med.frequency === 'four_times_daily') dailyDoses = 4;
                else dailyDoses = 1;
            }

            // Start of active window for this medication
            const effectiveStart = new Date(Math.max(new Date(med.startDate).getTime(), thirtyDaysAgo.getTime()));
            effectiveStart.setHours(0, 0, 0, 0);

            // End of active window for this medication (up to now)
            const effectiveEnd = med.endDate && new Date(med.endDate) < now
                ? new Date(med.endDate)
                : now;

            const diffTime = effectiveEnd.getTime() - effectiveStart.getTime();
            if (diffTime >= 0) {
                const daysActive = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
                totalExpectedDoses += daysActive * dailyDoses;
            }
        }

        // Total expected is at least the count of logs recorded
        const totalExpected = Math.max(totalExpectedDoses, logs.length);
        const taken = takenLogsCount;
        const missed = Math.max(0, totalExpected - taken);
        const average = totalExpected > 0 ? Math.min(100, Math.max(0, Math.round((taken / totalExpected) * 100))) : 100;

        return {
            average,
            taken,
            missed,
            totalExpected
        };
    }

    /**
     * Computes the mathematical adherence percentage over the last 30 days
     * and updates Beneficiary.medicationScore.
     */
    public async recalculateOverallScore(): Promise<number> {
        await this.resolveBeneficiaryId();
        const metrics = await this.calculate30DayAdherenceMetrics();

        // Persist to database
        await prisma.beneficiary.update({
            where: { id: this.beneficiaryId },
            data: { medicationScore: metrics.average }
        });

        return metrics.average;
    }

    /**
     * Helper: Returns today's overall metrics (average score, total taken, total missed/skipped)
     */
    public async getOverallMetrics(): Promise<{ average: number, taken: number, missed: number }> {
        const metrics = await this.calculate30DayAdherenceMetrics();
        return {
            average: metrics.average,
            taken: metrics.taken,
            missed: metrics.missed
        };
    }


    /**
     * Private helper to translate time slot string ("08:00 AM") or names ("morning") to JS Date object
     */
    private parseTimeSlotToDate(slot: string): Date {
        const date = new Date();
        let hours = 8;
        let minutes = 0;

        // Clean time string and split
        const cleaned = slot.trim().toUpperCase();

        if (cleaned === 'MORNING') {
            hours = 8;
            minutes = 0;
        } else if (cleaned === 'AFTERNOON') {
            hours = 14; // 2:00 PM
            minutes = 0;
        } else if (cleaned === 'EVENING') {
            hours = 18; // 6:00 PM
            minutes = 0;
        } else if (cleaned === 'NIGHT') {
            hours = 21; // 9:00 PM
            minutes = 30; // 9:30 PM
        } else {
            const timeParts = cleaned.split(':');
            if (timeParts.length >= 2) {
                hours = parseInt(timeParts[0], 10);
                minutes = parseInt(timeParts[1].substring(0, 2), 10);

                if (cleaned.endsWith('PM') && hours < 12) {
                    hours += 12;
                } else if (cleaned.endsWith('AM') && hours === 12) {
                    hours = 0;
                }
            }
        }

        date.setHours(hours, minutes, 0, 0);
        return date;
    }
}
