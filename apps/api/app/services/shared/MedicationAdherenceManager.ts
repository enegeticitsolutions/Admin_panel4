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
        let beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { id: this.beneficiaryId },
                    { userId: this.beneficiaryId },
                    { subscriberId: this.beneficiaryId }
                ]
            }
        });

        if (!beneficiary) {
            const user = await prisma.user.findUnique({ where: { id: this.beneficiaryId } });
            if (user) {
                const { ensureSelfBeneficiaryProfile } = require('../subscriber/beneficiary_service');
                beneficiary = await ensureSelfBeneficiaryProfile(user.id);
            }
        }

        if (beneficiary) {
            this.beneficiaryId = beneficiary.id;
            this.isResolved = true;
        }
    }

    /**
     * Determines whether a medication is due on a given target calendar date
     * based on its startDate/endDate bounds and cadence (daily, alternate, weekly, monthly).
     */
    public static isMedicationDueOnDate(
        med: { startDate: Date | string; endDate?: Date | string | null; frequency?: string; cadence?: string },
        targetDate: Date
    ): boolean {
        const start = new Date(med.startDate);
        start.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        if (target < start) return false;

        if (med.endDate) {
            const end = new Date(med.endDate);
            end.setHours(23, 59, 59, 999);
            if (target > end) return false;
        }

        // Resolve cadence (with backward compatibility for legacy frequency values)
        let cadence = med.cadence || 'daily';
        const freq = med.frequency;
        if (freq === 'alternate' || freq === 'alternate_days') cadence = 'alternate';
        else if (freq === 'weekly') cadence = 'weekly';
        else if (freq === 'fortnightly') cadence = 'fortnightly';
        else if (freq === 'monthly') cadence = 'monthly';

        if (cadence === 'daily') {
            return true;
        }

        const diffTime = target.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (cadence === 'alternate' || cadence === 'alternate_days') {
            return diffDays % 2 === 0;
        }
        if (cadence === 'weekly') {
            return diffDays % 7 === 0;
        }
        if (cadence === 'fortnightly') {
            return diffDays % 14 === 0;
        }
        if (cadence === 'monthly') {
            return target.getDate() === start.getDate();
        }
        return true;
    }

    /**
     * Helper to resolve time slot strings for a medication.
     */
    private getMedicationSlots(med: { timeSlots?: string[]; frequency?: string }): string[] {
        const slots: string[] = med.timeSlots || [];
        if (slots.length > 0) return slots;
        const freqStr = (med.frequency as string) || 'once_daily';
        if (freqStr === 'twice_daily') return ['08:00 AM', '08:00 PM'];
        if (freqStr === 'thrice_daily') return ['08:00 AM', '02:00 PM', '08:00 PM'];
        if (freqStr === 'four_times_daily') return ['08:00 AM', '02:00 PM', '06:00 PM', '08:00 PM'];
        return ['08:00 AM'];
    }

    /**
     * Retrieves all active medications scheduled for a specific calendar date (YYYY-MM-DD),
     * defaulting to today when no date is passed.
     */
    public async getScheduleForDate(dateStr?: string): Promise<any[]> {
        await this.resolveBeneficiaryId();

        const currentTime = new Date();
        const todayStart = new Date(currentTime);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(currentTime);
        todayEnd.setHours(23, 59, 59, 999);

        let targetStart: Date;
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            targetStart = new Date(y, m - 1, d, 0, 0, 0, 0);
        } else {
            targetStart = new Date(todayStart);
        }

        const targetEnd = new Date(targetStart);
        targetEnd.setHours(23, 59, 59, 999);

        const isTodayDate = targetStart.getTime() === todayStart.getTime();
        const isFutureDate = targetStart.getTime() > todayEnd.getTime();

        const medications = await prisma.medication.findMany({
            where: {
                beneficiaryId: this.beneficiaryId,
                isActive: true,
                startDate: { lte: targetEnd },
                OR: [
                    { endDate: null },
                    { endDate: { gte: targetStart } }
                ]
            }
        });

        const dayLogs = await prisma.medicationAdherence.findMany({
            where: {
                beneficiaryId: this.beneficiaryId,
                scheduledTime: {
                    gte: targetStart,
                    lte: targetEnd
                }
            }
        });

        const scheduleSlots: any[] = [];

        for (const med of medications) {
            if (!MedicationAdherenceManager.isMedicationDueOnDate(med, targetStart)) {
                continue;
            }

            const slots = this.getMedicationSlots(med);

            const medLogs = await prisma.medicationAdherence.findMany({
                where: { medicationId: med.id }
            });
            const medTakenCount = medLogs.filter(l => l.taken).length;
            const medAdherencePercentage = medLogs.length > 0
                ? Math.round((medTakenCount / medLogs.length) * 100)
                : 100;

            for (const slot of slots) {
                const scheduledTime = this.parseTimeSlotToDate(slot);
                scheduledTime.setFullYear(targetStart.getFullYear());
                scheduledTime.setMonth(targetStart.getMonth());
                scheduledTime.setDate(targetStart.getDate());

                const matchedLog = dayLogs.find(log =>
                    log.medicationId === med.id &&
                    Math.abs(new Date(log.scheduledTime).getTime() - scheduledTime.getTime()) < 60000
                );

                const isFutureTimeSlot = scheduledTime.getTime() > currentTime.getTime();
                const isFutureSchedule = isFutureDate || isFutureTimeSlot;
                const canMark = isTodayDate && !isFutureTimeSlot;

                let status = 'pending';
                let logId = null;

                if (matchedLog) {
                    status = matchedLog.taken ? 'taken' : 'missed';
                    logId = matchedLog.id;
                } else if (!isFutureSchedule && scheduledTime < currentTime) {
                    status = 'missed';
                }

                scheduleSlots.push({
                    id: med.id,
                    logId,
                    name: med.name,
                    dosage: med.dosage,
                    frequency: (med.frequency || 'once_daily').replace(/_/g, ' '),
                    instructions: med.instructions || 'Take as directed',
                    scheduleTimeText: slot,
                    scheduledTimeIso: scheduledTime.toISOString(),
                    status,
                    adherencePercentage: medAdherencePercentage,
                    isFutureSchedule,
                    futureDateText: isFutureDate
                        ? targetStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : '',
                    isToday: isTodayDate,
                    canMark
                });
            }
        }

        return scheduleSlots.sort((a, b) =>
            new Date(a.scheduledTimeIso).getTime() - new Date(b.scheduledTimeIso).getTime()
        );
    }

    public async getTodaySchedule(): Promise<any[]> {
        return this.getScheduleForDate();
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

        if (scheduledTime.getTime() > now.getTime()) {
            throw new Error('This dose cannot be marked before its scheduled time.');
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
     * Computes 7-day adherence metrics strictly from due doses (scheduledTime <= now)
     * so future doses later today never deflate adherence prematurely.
     */
    private async calculate7DayAdherenceMetrics(): Promise<{
        average: number;
        taken: number;
        missed: number;
        totalExpected: number;
        completedDays: number;
        totalDays: number;
    }> {
        await this.resolveBeneficiaryId();

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const medications = await prisma.medication.findMany({
            where: {
                beneficiaryId: this.beneficiaryId,
                isActive: true,
                startDate: { lte: now },
                OR: [
                    { endDate: null },
                    { endDate: { gte: sevenDaysAgo } }
                ]
            }
        });

        const logs = await prisma.medicationAdherence.findMany({
            where: {
                beneficiaryId: this.beneficiaryId,
                scheduledTime: { gte: sevenDaysAgo, lte: now }
            }
        });

        if (medications.length === 0) {
            return {
                average: 0,
                taken: 0,
                missed: 0,
                totalExpected: 0,
                completedDays: 0,
                totalDays: 7,
            };
        }

        let totalDueDoses = 0;
        let takenDueDoses = 0;
        let completedDays = 0;

        for (let offset = 0; offset < 7; offset++) {
            const dayStart = new Date(sevenDaysAgo);
            dayStart.setDate(sevenDaysAgo.getDate() + offset);

            let dayDue = 0;
            let dayTaken = 0;

            for (const med of medications) {
                if (!MedicationAdherenceManager.isMedicationDueOnDate(med, dayStart)) {
                    continue;
                }
                const slots = this.getMedicationSlots(med);
                for (const slot of slots) {
                    const slotTime = this.parseTimeSlotToDate(slot);
                    slotTime.setFullYear(dayStart.getFullYear());
                    slotTime.setMonth(dayStart.getMonth());
                    slotTime.setDate(dayStart.getDate());

                    // Skip future doses that have not hit their scheduled time yet
                    if (slotTime.getTime() > now.getTime()) {
                        continue;
                    }

                    dayDue++;
                    const matchedTaken = logs.some(
                        (log) =>
                            log.medicationId === med.id &&
                            log.taken &&
                            Math.abs(new Date(log.scheduledTime).getTime() - slotTime.getTime()) < 60000
                    );
                    if (matchedTaken) {
                        dayTaken++;
                    }
                }
            }

            totalDueDoses += dayDue;
            takenDueDoses += dayTaken;
            if (dayDue > 0 && dayTaken === dayDue) {
                completedDays++;
            }
        }

        const missed = Math.max(0, totalDueDoses - takenDueDoses);
        const average = totalDueDoses > 0 ? Math.round((takenDueDoses / totalDueDoses) * 100) : 0;

        return {
            average,
            taken: takenDueDoses,
            missed,
            totalExpected: totalDueDoses,
            completedDays,
            totalDays: 7,
        };
    }

    /**
     * Computes the mathematical adherence percentage over the last 7 days
     * and updates Beneficiary.medicationScore.
     */
    public async recalculateOverallScore(): Promise<number> {
        await this.resolveBeneficiaryId();
        const metrics = await this.calculate7DayAdherenceMetrics();

        await prisma.beneficiary.update({
            where: { id: this.beneficiaryId },
            data: { medicationScore: metrics.average }
        });

        return metrics.average;
    }

    /**
     * Helper: Returns 7-day overall metrics (average score, total taken, missed, completedDays)
     */
    public async getOverallMetrics(): Promise<{
        average: number;
        taken: number;
        missed: number;
        totalExpected: number;
        completedDays: number;
        totalDays: number;
    }> {
        return this.calculate7DayAdherenceMetrics();
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
            hours = 20; // 8:00 PM
            minutes = 0;
        } else if (cleaned === 'BEDTIME') {
            hours = 21; // 9:30 PM
            minutes = 30;
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
