import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { notificationProducer } from '@maihoonna/notifications';

const router = Router();

// ── Fallback icon/color for vital codes that have no iconCode stored in DB ───
// This is only a UI fallback — vitals themselves are 100% driven by the DB.
const FALLBACK_COLOR_BY_CODE: Record<string, string> = {
    BP: '#8B5CF6', BLOOD_PRESSURE: '#8B5CF6',
    PULSE: '#EF4444', HEART_RATE: '#EF4444',
    SPO2: '#10B981', OXYGEN_LEVEL: '#10B981',
    TEMP: '#06B6D4', TEMPERATURE: '#06B6D4',
    WEIGHT: '#3B82F6',
    BLOOD_GLUCOSE: '#F59E0B',
};
const DEFAULT_COLOR = '#6B7280';
const DEFAULT_ICON = 'clipboard-pulse';

// ── Helper: format a VitalReading value to display string ─────────────────────
function formatReadingValue(r: any, def: any): string {
    if (!def) return '--';
    if (r.valueNumeric != null && r.valueNumeric2 != null) {
        return `${r.valueNumeric}/${r.valueNumeric2}${def.unit ? ' ' + def.unit : ''}`;
    } else if (def.dataType === 'boolean' && r.valueBoolean != null) {
        return r.valueBoolean ? (def.booleanTrueLabel ?? 'Yes') : (def.booleanFalseLabel ?? 'No');
    } else if (def.dataType === 'text' && r.valueText) {
        return r.valueText;
    } else if (r.valueNumeric != null) {
        return `${r.valueNumeric}${def.unit ? ' ' + def.unit : ''}`;
    }
    return '--';
}

// ── Helper: get recorder display label ────────────────────────────────────────
function getRecorderLabel(r: any): string {
    if (r.source === 'beneficiary') return 'Self';
    if (r.capturedBy) {
        return r.capturedBy.name || 'Care Companion';
    }
    return 'Care Companion';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /beneficiary/medical-records/vital-definitions
// Returns all active vital definitions assigned to the authenticated beneficiary.
// Used by VitalEntrySheet to build input fields.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vital-definitions', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: { OR: [{ id: userId }, { userId }] },
            include: {
                vitalConfigs: {
                    where: { isActive: true },
                    include: {
                        vitalDefinition: {
                            select: {
                                id: true, code: true, name: true, unit: true,
                                dataType: true, iconCode: true, displayOrder: true,
                                normalMin: true, normalMax: true,
                                normalMin2: true, normalMax2: true,
                                value1Label: true, value2Label: true,
                                booleanTrueLabel: true, booleanFalseLabel: true,
                                textOptions: true,
                            }
                        }
                    }
                }
            }
        }) as any;

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        const definitions = (beneficiary.vitalConfigs || [])
            .map((c: any) => c.vitalDefinition)
            .filter(Boolean)
            .filter((def: any, idx: number, arr: any[]) => arr.findIndex(d => d!.code === def!.code) === idx); // deduplicate

        res.json({ success: true, data: definitions });
    } catch (error: any) {
        console.error('Vital definitions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /beneficiary/medical-records/vitals
// Accepts a batch of vitals from the beneficiary (self-reported).
// Inserts VitalReading rows with source='beneficiary', visitId=null.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/vitals', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: { OR: [{ id: userId }, { userId }] },
        }) as any;

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        const { vitalsList } = req.body as {
            vitalsList: Array<{
                vitalDefinitionId: string;
                valueNumeric?: number;
                valueNumeric2?: number;
                valueText?: string;
                valueBoolean?: boolean;
            }>;
        };

        if (!Array.isArray(vitalsList) || vitalsList.length === 0) {
            return res.status(400).json({ success: false, message: 'vitalsList must be a non-empty array' });
        }

        // Validate that all vitalDefinitionIds belong to this beneficiary's active configs
        const activeConfigs = await prisma.beneficiaryVitalConfig.findMany({
            where: { beneficiaryId: beneficiary.id, isActive: true },
            select: { vitalDefinitionId: true }
        });
        const allowedIds = new Set(activeConfigs.map(c => c.vitalDefinitionId));

        const validVitals = vitalsList.filter(v => allowedIds.has(v.vitalDefinitionId));
        if (validVitals.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid vital definitions found for this beneficiary' });
        }

        const now = new Date();
        const readings = await prisma.vitalReading.createMany({
            data: validVitals.map(v => ({
                beneficiaryId: beneficiary.id,
                vitalDefinitionId: v.vitalDefinitionId,
                valueNumeric: v.valueNumeric ?? null,
                valueNumeric2: v.valueNumeric2 ?? null,
                valueText: v.valueText ?? null,
                valueBoolean: v.valueBoolean ?? null,
                capturedById: userId,
                capturedAt: now,
                source: 'beneficiary',
                captureMethod: 'manual',
            }))
        });

        // ── Fire-and-forget abnormal range notification ────────────────────────
        (async () => {
            try {
                // Batch-fetch definitions to check normalMin / normalMax
                const defIds = [...new Set(validVitals.map(v => v.vitalDefinitionId))];
                const defRows = await prisma.vitalDefinition.findMany({ where: { id: { in: defIds } } });
                const defMap = new Map(defRows.map(d => [d.id, d]));

                const abnormalAlerts: { vitalName: string; unit: string; value: string; min: string; max: string; diff: string }[] = [];

                for (const reading of validVitals) {
                    const def = defMap.get(reading.vitalDefinitionId);
                    if (!def) continue;

                    if (def.dataType === 'numeric' && reading.valueNumeric != null) {
                        const val = reading.valueNumeric;
                        const belowMin = def.normalMin !== null && val < def.normalMin;
                        const aboveMax = def.normalMax !== null && val > def.normalMax;
                        if (belowMin || aboveMax) {
                            const diff = belowMin ? def.normalMin! - val : val - def.normalMax!;
                            abnormalAlerts.push({
                                vitalName: def.name,
                                unit: def.unit || '',
                                value: `${val}`,
                                min: def.normalMin != null ? `${def.normalMin}` : 'N/A',
                                max: def.normalMax != null ? `${def.normalMax}` : 'N/A',
                                diff: `${Math.abs(diff).toFixed(1)}`,
                            });
                        }
                    } else if (def.dataType === 'dual_numeric' && reading.valueNumeric != null && reading.valueNumeric2 != null) {
                        const val1 = reading.valueNumeric;
                        const val2 = reading.valueNumeric2;
                        let maxDiff = 0;
                        let isAbnormal = false;

                        if (def.normalMin !== null && val1 < def.normalMin) { isAbnormal = true; maxDiff = Math.max(maxDiff, def.normalMin - val1); }
                        else if (def.normalMax !== null && val1 > def.normalMax) { isAbnormal = true; maxDiff = Math.max(maxDiff, val1 - def.normalMax); }
                        if (def.normalMin2 !== null && val2 < def.normalMin2) { isAbnormal = true; maxDiff = Math.max(maxDiff, def.normalMin2 - val2); }
                        else if (def.normalMax2 !== null && val2 > def.normalMax2) { isAbnormal = true; maxDiff = Math.max(maxDiff, val2 - def.normalMax2); }

                        if (isAbnormal) {
                            abnormalAlerts.push({
                                vitalName: def.name,
                                unit: def.unit || '',
                                value: `${val1}/${val2}`,
                                min: `${def.normalMin ?? 'N/A'}/${def.normalMin2 ?? 'N/A'}`,
                                max: `${def.normalMax ?? 'N/A'}/${def.normalMax2 ?? 'N/A'}`,
                                diff: `${maxDiff.toFixed(1)}`,
                            });
                        }
                    }
                }

                if (abnormalAlerts.length === 0) return;

                // Fetch the Subscriber's phone linked to this Beneficiary
                const fullBeneficiary = await prisma.beneficiary.findUnique({
                    where: { id: beneficiary.id },
                    include: {
                        subscriber: { select: { phone: true } },
                        user: { select: { phone: true } },
                    },
                }) as any;

                const subscriberPhone = fullBeneficiary?.subscriber?.phone;
                const beneficiaryName = fullBeneficiary?.name || 'Beneficiary';

                for (const alert of abnormalAlerts) {
                    if (subscriberPhone) {
                        await notificationProducer.publish({
                            idempotencyKey: `vital-self-${beneficiary.id}-${alert.vitalName}-${now.getTime()}`,
                            channel: 'whatsapp',
                            event: 'VITALS_ALERT',
                            recipient: { phone: subscriberPhone },
                            variables: {
                                beneficiaryName,
                                vitalName: alert.vitalName,
                                value: `${alert.value}${alert.unit ? ' ' + alert.unit : ''}`,
                                normalRange: `${alert.min}-${alert.max}${alert.unit ? ' ' + alert.unit : ''}`,
                                exceededBy: `${alert.diff}${alert.unit ? ' ' + alert.unit : ''}`,
                                ccName: 'Self (Beneficiary)',
                            },
                        });
                    }
                }
            } catch (notifErr: any) {
                console.error('[MedicalRecords:SelfVitals] Abnormal Notification Error:', notifErr.message);
            }
        })();

        res.status(201).json({ success: true, data: { created: readings.count } });
    } catch (error: any) {
        console.error('Beneficiary vitals save error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /beneficiary/medical-records/me
// Returns latest readings, trend charts (both CC + self-reported), and history.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: { OR: [{ id: userId }, { userId }] },
            include: {
                vitalConfigs: {
                    where: { isActive: true },
                    include: {
                        vitalDefinition: {
                            select: {
                                id: true, code: true, name: true, unit: true,
                                dataType: true, iconCode: true, displayOrder: true,
                                normalMin: true, normalMax: true,
                                normalMin2: true, normalMax2: true,
                                value1Label: true, value2Label: true,
                                booleanTrueLabel: true, booleanFalseLabel: true,
                            }
                        }
                    }
                }
            }
        }) as any;

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        // ── 1. All readings — both CC and self-reported ───────────────────────
        const allReadings = await prisma.vitalReading.findMany({
            where: { beneficiaryId: beneficiary.id },
            include: {
                vitalDefinition: {
                    select: { code: true, name: true, unit: true, dataType: true, iconCode: true, displayOrder: true, booleanTrueLabel: true, booleanFalseLabel: true }
                },
                capturedBy: {
                    select: { name: true }
                }
            },
            orderBy: { capturedAt: 'desc' }
        }) as any[];

        // Build "latest by code" map — enriched with recorder/source info
        const latestByCode: Record<string, {
            v1: number | null; v2: number | null; text: string | null; bool: boolean | null;
            source: string; recorder: string; recordedAt: string;
        }> = {};
        for (const r of allReadings) {
            const code = r.vitalDefinition?.code?.toUpperCase();
            if (code && !latestByCode[code]) {
                latestByCode[code] = {
                    v1: r.valueNumeric,
                    v2: r.valueNumeric2,
                    text: r.valueText,
                    bool: r.valueBoolean,
                    source: r.source,
                    recorder: getRecorderLabel(r),
                    recordedAt: r.capturedAt.toISOString(),
                };
            }
        }

        // ── 2. Build latestReadings from active vitalConfigs ─────────────────
        const activeConfigs = [...(beneficiary.vitalConfigs || [])];
        activeConfigs.sort((a, b) =>
            (a.vitalDefinition?.displayOrder ?? 99) - (b.vitalDefinition?.displayOrder ?? 99)
        );

        const seenCodes = new Set<string>();
        const latestReadings: any[] = [];

        for (const config of activeConfigs) {
            const def = config.vitalDefinition;
            if (!def || seenCodes.has(def.code)) continue;
            seenCodes.add(def.code);

            const code = def.code.toUpperCase();
            const reading = latestByCode[code];

            let displayValue = '--';
            if (reading) {
                if (def.dataType === 'dual_numeric' && reading.v1 != null && reading.v2 != null) {
                    displayValue = `${reading.v1}/${reading.v2}${def.unit ? ' ' + def.unit : ''}`;
                } else if (def.dataType === 'boolean' && reading.bool != null) {
                    displayValue = reading.bool ? (def.booleanTrueLabel ?? 'Yes') : (def.booleanFalseLabel ?? 'No');
                } else if (def.dataType === 'text' && reading.text) {
                    displayValue = reading.text;
                } else if (reading.v1 != null) {
                    displayValue = `${reading.v1}${def.unit ? ' ' + def.unit : ''}`;
                }
            }

            latestReadings.push({
                code,
                name: def.name,
                icon: def.iconCode || DEFAULT_ICON,
                color: FALLBACK_COLOR_BY_CODE[code] || DEFAULT_COLOR,
                value: displayValue,
                unit: def.unit || '',
                dataType: def.dataType,
                hasReading: !!reading,
                source: reading?.source ?? null,
                recorder: reading?.recorder ?? null,
                recordedAt: reading?.recordedAt ?? null,
            });
        }

        // Fallback: no configs — pull from whatever has readings
        if (activeConfigs.length === 0) {
            for (const r of allReadings) {
                const def = r.vitalDefinition;
                if (!def) continue;
                const code = def.code.toUpperCase();
                if (seenCodes.has(code)) continue;
                seenCodes.add(code);

                const reading = latestByCode[code];
                let displayValue = '--';
                if (reading?.v1 != null && reading.v2 != null) displayValue = `${reading.v1}/${reading.v2}`;
                else if (reading?.v1 != null) displayValue = `${reading.v1}${def.unit ? ' ' + def.unit : ''}`;
                else if (reading?.text) displayValue = reading.text;

                latestReadings.push({
                    code,
                    name: def.name,
                    icon: def.iconCode || DEFAULT_ICON,
                    color: FALLBACK_COLOR_BY_CODE[code] || DEFAULT_COLOR,
                    value: displayValue,
                    unit: def.unit || '',
                    dataType: def.dataType,
                    hasReading: !!reading,
                    source: reading?.source ?? null,
                    recorder: reading?.recorder ?? null,
                    recordedAt: reading?.recordedAt ?? null,
                });
            }
        }

        // ── 3. Trends — both sources, last 30 days, carry-forward ────────────
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);

        const recentReadings = allReadings
            .filter(r => new Date(r.capturedAt) >= fromDate)
            .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

        const grouped = new Map<string, any>();
        for (const r of recentReadings) {
            const def = r.vitalDefinition;
            if (!def || (def.dataType !== 'numeric' && def.dataType !== 'dual_numeric')) continue;

            const code = def.code.toUpperCase();
            if (!grouped.has(code)) {
                grouped.set(code, {
                    name: def.name,
                    code,
                    unit: def.unit || '',
                    dataType: def.dataType,
                    icon: def.iconCode || DEFAULT_ICON,
                    color: FALLBACK_COLOR_BY_CODE[code] || '#6366F1',
                    gridMax: 200,
                    v1: [],
                    v2: [],
                });
            }
            const g = grouped.get(code);
            const shortDate = new Date(r.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const fullDate = new Date(r.capturedAt).toISOString().split('T')[0];
            const src = r.source || 'care_companion';
            const rec = getRecorderLabel(r);

            if (r.valueNumeric != null) g.v1.push({ date: shortDate, fullDate, value: r.valueNumeric, source: src, recorder: rec });
            if (def.dataType === 'dual_numeric' && r.valueNumeric2 != null) g.v2.push({ date: shortDate, fullDate, value: r.valueNumeric2, source: src, recorder: rec });
        }

        const trends = Array.from(grouped.values()).map(g => {
            // Keep last 7 data points per series
            g.v1 = g.v1.slice(-7);
            g.v2 = g.v2.slice(-7);

            // Carry-forward: if no data for a date slot, fill from previous known value
            let maxVal = 0;
            [...g.v1, ...g.v2].forEach((pt: any) => { if (pt.value > maxVal) maxVal = pt.value; });
            g.gridMax = maxVal > 0 ? Math.ceil(maxVal * 1.2) : 200;

            const step = Math.ceil(g.gridMax / 4);
            g.gridValues = [0, step, step * 2, step * 3, step * 4];
            g.gridMax = g.gridValues[4];

            return g;
        });

        // ── 4. History — CC visit vitals + self-reported entries ──────────────
        // 4a. Completed visit vitals
        const completedVisits = await prisma.visit.findMany({
            where: { beneficiaryId: beneficiary.id, status: 'completed' },
            include: {
                vitalReadings: {
                    include: {
                        vitalDefinition: {
                            select: { name: true, unit: true, dataType: true, iconCode: true, booleanTrueLabel: true, booleanFalseLabel: true }
                        },
                        capturedBy: { select: { name: true } }
                    }
                },
                careCompanion: {
                    include: { user: { select: { name: true } } }
                }
            },
            orderBy: { checkOutTime: 'desc' },
            take: 20,
        }) as any[];

        const visitHistory = completedVisits
            .map(v => {
                const dateObj = v.checkOutTime || v.scheduledTime || new Date();
                const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const ccName = v.careCompanion?.user?.name || 'Care Companion';

                const vitals = v.vitalReadings.map((r: any) => {
                    const def = r.vitalDefinition;
                    if (!def) return null;
                    return {
                        name: def.name,
                        value: formatReadingValue(r, def).trim(),
                        icon: def.iconCode || DEFAULT_ICON,
                        source: r.source || 'care_companion',
                        recorder: getRecorderLabel(r),
                    };
                }).filter(Boolean);

                return { id: v.id, date, recorder: ccName, recorderType: 'care_companion', vitals };
            })
            .filter(h => h.vitals.length > 0);

        // 4b. Self-reported vitals (no visitId, source='beneficiary'), grouped by day
        const selfReadings = allReadings.filter(r => !r.visitId && r.source === 'beneficiary');
        const selfByDay = new Map<string, any>();
        for (const r of selfReadings) {
            const def = r.vitalDefinition;
            if (!def) continue;
            const day = r.capturedAt.toISOString().split('T')[0];
            if (!selfByDay.has(day)) {
                selfByDay.set(day, {
                    id: `self-${day}`,
                    date: r.capturedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    recorder: 'Self',
                    recorderType: 'beneficiary',
                    vitals: [],
                });
            }
            selfByDay.get(day).vitals.push({
                name: def.name,
                value: formatReadingValue(r, def).trim(),
                icon: def.iconCode || DEFAULT_ICON,
                source: 'beneficiary',
                recorder: 'Self',
            });
        }
        const selfHistory = Array.from(selfByDay.values()).filter(h => h.vitals.length > 0);

        // Merge and sort by date descending
        const history = [...visitHistory, ...selfHistory].sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        res.json({
            success: true,
            data: { latestReadings, trends, history }
        });
    } catch (error: any) {
        console.error('Beneficiary medical records error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
