import prisma from '../../core/database';

export interface HealthSummaryVitalsItem {
  code: string;
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'normal' | 'low' | 'high' | 'abnormal' | 'recorded';
  capturedAt: string;
  source: string;
  recorder: string;
}

export interface HealthSummaryReadingItem {
  id: string;
  vitalName: string;
  vitalCode: string;
  value: string;
  unit: string;
  capturedAt: string;
  displayDate: string;
  displayTime: string;
  status: 'normal' | 'low' | 'high' | 'abnormal' | 'recorded';
  source: 'beneficiary' | 'care_companion';
  recorder: string;
}

export interface HealthSummaryMedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  timeSlots: string[];
  instructions: string | null;
  prescribedBy: string | null;
  startDate: string;
}

export interface HealthSummaryEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

export interface VitalTrendPoint {
  date: string;
  fullDate: string;
  value: number;
  source?: 'care_companion' | 'beneficiary';
  recorder?: string;
}

export interface VitalTrend {
  name: string;
  code: string;
  unit: string;
  dataType: string;
  gridMax: number;
  gridValues: number[];
  color: string;
  v1: VitalTrendPoint[];
  v2?: VitalTrendPoint[];
}

export interface MonthlyVitalStat {
  code: string;
  name: string;
  unit: string;
  min: string;
  max: string;
  avg: string;
  latest: string;
  readingCount: number;
  status: 'normal' | 'low' | 'high' | 'recorded';
}

export interface MonthlyReportData {
  periodLabel: string;
  totalVisits: number;
  adherencePercentage: number;
  takenCount: number;
  missedCount: number;
  vitalsStats: MonthlyVitalStat[];
  overallStatus: 'stable' | 'attention_needed' | 'improving';
}

export interface HealthSummaryData {
  reportId: string;
  generatedAt: string;
  beneficiary: {
    id: string;
    name: string;
    age: number;
    gender: string;
    bloodGroup: string;
    address: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    primaryPhysicianName: string | null;
    primaryPhysicianPhone: string | null;
    primaryPhysicianSpec: string | null;
    emergencyContacts: HealthSummaryEmergencyContact[];
  };
  allergies: string[];
  medicalConditions: string[];
  vitals: HealthSummaryVitalsItem[];
  allReadingsHistory: HealthSummaryReadingItem[];
  weeklyTrends: VitalTrend[];
  monthlyTrends: VitalTrend[];
  vitalsTrends: VitalTrend[]; // full trends with up to 30 readings each
  monthlyReport: MonthlyReportData;
  medications: HealthSummaryMedicationItem[];
  adherence: {
    percentage: number;
    takenCount: number;
    missedCount: number;
    totalScheduled: number;
    status: 'excellent' | 'good' | 'fair' | 'needs_attention';
  };
  careOverview: {
    assignedCompanionName: string | null;
    lastVisitDate: string | null;
    lastVisitMood: string | null;
    notes: string | null;
  };
}

const FALLBACK_COLOR_BY_CODE: Record<string, string> = {
  BP: '#8B5CF6',
  BLOOD_PRESSURE: '#8B5CF6',
  PULSE: '#EF4444',
  HEART_RATE: '#EF4444',
  SPO2: '#10B981',
  OXYGEN_LEVEL: '#10B981',
  TEMP: '#06B6D4',
  TEMPERATURE: '#06B6D4',
  WEIGHT: '#3B82F6',
  BODY_WEIGHT: '#3B82F6',
  BLOOD_GLUCOSE: '#F59E0B',
  SUGAR: '#F59E0B',
};

export class HealthSummaryService {
  /**
   * Helper to build trend arrays for vitals.
   */
  private static buildTrends(readings: any[], maxPoints: number = 30): VitalTrend[] {
    const grouped = new Map<string, any>();

    // Readings arrive in chronological order (oldest to newest)
    for (const r of readings) {
      const def = r.vitalDefinition;
      if (!def || (def.dataType !== 'numeric' && def.dataType !== 'dual_numeric')) continue;

      const code = def.code.toUpperCase();
      if (!grouped.has(code)) {
        grouped.set(code, {
          name: def.name,
          code,
          unit: def.unit || '',
          dataType: def.dataType,
          color: FALLBACK_COLOR_BY_CODE[code] || '#FE6700',
          gridMax: 200,
          v1: [],
          v2: [],
        });
      }
      const g = grouped.get(code);
      const shortDate = new Date(r.capturedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const fullDate = new Date(r.capturedAt).toISOString().split('T')[0];
      const src = r.source === 'beneficiary' ? 'beneficiary' : 'care_companion';
      const rec = r.source === 'beneficiary' ? 'Self' : (r.capturedBy?.name || 'Care Companion');

      if (r.valueNumeric != null) {
        g.v1.push({ date: shortDate, fullDate, value: r.valueNumeric, source: src, recorder: rec });
      }
      if (def.dataType === 'dual_numeric' && r.valueNumeric2 != null) {
        g.v2.push({ date: shortDate, fullDate, value: r.valueNumeric2, source: src, recorder: rec });
      }
    }

    return Array.from(grouped.values()).map(g => {
      // Keep last N data points per series
      g.v1 = g.v1.slice(-maxPoints);
      g.v2 = g.v2.slice(-maxPoints);

      let maxVal = 0;
      [...g.v1, ...g.v2].forEach((pt: any) => {
        if (pt.value > maxVal) maxVal = pt.value;
      });
      g.gridMax = maxVal > 0 ? Math.ceil(maxVal * 1.2) : 200;

      const step = Math.ceil(g.gridMax / 4);
      g.gridValues = [0, step, step * 2, step * 3, step * 4];
      g.gridMax = g.gridValues[4];

      return g;
    });
  }

  /**
   * Generates a consolidated clinical and care summary for a beneficiary.
   */
  public static async getBeneficiaryHealthSummary(beneficiaryId: string): Promise<HealthSummaryData> {
    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        user: { select: { name: true, phone: true } },
        conditions: {
          where: { isActive: true },
          include: { condition: true }
        },
        emergencyContacts: {
          orderBy: { isPrimary: 'desc' },
          take: 3
        },
        medicationList: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        },
        vitalConfigs: {
          where: { isActive: true },
          include: { vitalDefinition: true }
        }
      }
    });

    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    // 1. Format Blood Group
    const bloodGroupDisplay = (beneficiary.bloodGroup || 'unknown')
      .replace('_positive', '+')
      .replace('_negative', '-')
      .toUpperCase();

    // 2. Active Medical Conditions
    const medicalConditions = beneficiary.conditions
      .map(c => c.condition?.name)
      .filter((name): name is string => Boolean(name));

    // 3. Allergies
    const allergies = Array.isArray(beneficiary.allergies) && beneficiary.allergies.length > 0
      ? beneficiary.allergies
      : [];

    // 4. Latest Vitals (Distinct on vitalDefinitionId)
    const latestReadingRows = await prisma.vitalReading.findMany({
      where: {
        beneficiaryId: beneficiary.id,
        OR: [
          { valueNumeric: { not: null } },
          { valueNumeric2: { not: null } },
          { valueBoolean: { not: null } },
          {
            AND: [
              { valueText: { not: null } },
              { valueText: { not: '' } },
              { valueText: { not: 'N/A' } }
            ]
          }
        ]
      },
      include: {
        vitalDefinition: true,
        capturedBy: { select: { name: true } }
      },
      orderBy: { capturedAt: 'desc' },
      distinct: ['vitalDefinitionId']
    });

    const vitals: HealthSummaryVitalsItem[] = latestReadingRows
      .map((r): HealthSummaryVitalsItem | null => {
        const def = r.vitalDefinition;
        if (!def) return null;

        let displayVal = '--';
        let status: HealthSummaryVitalsItem['status'] = 'recorded';

        if (def.dataType === 'dual_numeric' && r.valueNumeric != null && r.valueNumeric2 != null) {
          displayVal = `${r.valueNumeric}/${r.valueNumeric2}`;
          const isHigh = (def.normalMax != null && r.valueNumeric > def.normalMax) || (def.normalMax2 != null && r.valueNumeric2 > def.normalMax2);
          const isLow = (def.normalMin != null && r.valueNumeric < def.normalMin) || (def.normalMin2 != null && r.valueNumeric2 < def.normalMin2);
          if (isHigh) status = 'high';
          else if (isLow) status = 'low';
          else status = 'normal';
        } else if (def.dataType === 'numeric' && r.valueNumeric != null) {
          displayVal = `${r.valueNumeric}`;
          if (def.normalMax != null && r.valueNumeric > def.normalMax) status = 'high';
          else if (def.normalMin != null && r.valueNumeric < def.normalMin) status = 'low';
          else status = 'normal';
        } else if (def.dataType === 'boolean' && r.valueBoolean != null) {
          displayVal = r.valueBoolean ? (def.booleanTrueLabel || 'Yes') : (def.booleanFalseLabel || 'No');
          status = 'normal';
        } else if (r.valueText) {
          displayVal = r.valueText;
          status = 'recorded';
        }

        let normalRangeStr = 'N/A';
        if (def.dataType === 'dual_numeric' && def.normalMin != null && def.normalMax != null) {
          normalRangeStr = `${def.normalMin}-${def.normalMax}/${def.normalMin2 || 0}-${def.normalMax2 || 0} ${def.unit || ''}`.trim();
        } else if (def.normalMin != null && def.normalMax != null) {
          normalRangeStr = `${def.normalMin} - ${def.normalMax} ${def.unit || ''}`.trim();
        }

        const recorderName = r.source === 'beneficiary' ? 'Self' : (r.capturedBy?.name || 'Care Companion');

        return {
          code: def.code,
          name: def.name,
          value: displayVal,
          unit: def.unit || '',
          normalRange: normalRangeStr,
          status,
          capturedAt: r.capturedAt.toISOString(),
          source: r.source,
          recorder: recorderName
        };
      })
      .filter((v): v is HealthSummaryVitalsItem => v !== null);

    // 4b. Fetch Recent Readings History (Reading-based, up to 200 readings without artificial date cutoff)
    const recentReadings = await prisma.vitalReading.findMany({
      where: {
        beneficiaryId: beneficiary.id,
        OR: [
          { valueNumeric: { not: null } },
          { valueNumeric2: { not: null } },
          { valueText: { not: null } }
        ]
      },
      include: {
        vitalDefinition: true,
        capturedBy: { select: { name: true } }
      },
      orderBy: { capturedAt: 'desc' },
      take: 200
    });

    // Readings in chronological order for graphs
    const chronologicalReadings = [...recentReadings].reverse();

    // Trends: full up to 30 readings, plus 7 and 30 point presets
    const vitalsTrends = this.buildTrends(chronologicalReadings, 30);
    const weeklyTrends = this.buildTrends(chronologicalReadings, 7);
    const monthlyTrends = this.buildTrends(chronologicalReadings, 30);

    // Format individual reading records for the Reading Log Table
    const allReadingsHistory: HealthSummaryReadingItem[] = recentReadings.map(r => {
      const def = r.vitalDefinition;
      const vitalName = def?.name || 'Vital';
      const vitalCode = def?.code || 'VITAL';
      const unit = def?.unit || '';

      let valueStr = '--';
      let status: HealthSummaryReadingItem['status'] = 'recorded';

      if (def?.dataType === 'dual_numeric' && r.valueNumeric != null && r.valueNumeric2 != null) {
        valueStr = `${r.valueNumeric}/${r.valueNumeric2}`;
        const isHigh = (def.normalMax != null && r.valueNumeric > def.normalMax) || (def.normalMax2 != null && r.valueNumeric2 > def.normalMax2);
        const isLow = (def.normalMin != null && r.valueNumeric < def.normalMin) || (def.normalMin2 != null && r.valueNumeric2 < def.normalMin2);
        if (isHigh) status = 'high';
        else if (isLow) status = 'low';
        else status = 'normal';
      } else if (r.valueNumeric != null) {
        valueStr = `${r.valueNumeric}`;
        if (def?.normalMax != null && r.valueNumeric > def.normalMax) status = 'high';
        else if (def?.normalMin != null && r.valueNumeric < def.normalMin) status = 'low';
        else status = 'normal';
      } else if (r.valueText) {
        valueStr = r.valueText;
      }

      const d = new Date(r.capturedAt);
      const displayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const displayTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const recorder = r.source === 'beneficiary' ? 'Self' : (r.capturedBy?.name || 'Care Companion');

      return {
        id: r.id,
        vitalName,
        vitalCode,
        value: valueStr,
        unit,
        capturedAt: r.capturedAt.toISOString(),
        displayDate,
        displayTime,
        status,
        source: (r.source === 'beneficiary' ? 'beneficiary' : 'care_companion') as 'beneficiary' | 'care_companion',
        recorder
      };
    });

    // 4c. Compute Statistical Ranges per Parameter from recent readings
    const statsByCode = new Map<string, { def: any; vals: number[]; latest: string; status: any }>();
    for (const r of recentReadings) {
      const def = r.vitalDefinition;
      if (!def || def.dataType !== 'numeric') continue;
      const code = def.code.toUpperCase();
      if (!statsByCode.has(code)) {
        statsByCode.set(code, { def, vals: [], latest: `${r.valueNumeric}`, status: 'normal' });
      }
      const item = statsByCode.get(code)!;
      if (r.valueNumeric != null) {
        item.vals.push(r.valueNumeric);
      }
    }

    const monthlyVitalsStats: MonthlyVitalStat[] = Array.from(statsByCode.entries()).map(([code, data]) => {
      const minVal = data.vals.length > 0 ? Math.min(...data.vals) : 0;
      const maxVal = data.vals.length > 0 ? Math.max(...data.vals) : 0;
      const avgVal = data.vals.length > 0 ? Math.round(data.vals.reduce((a, b) => a + b, 0) / data.vals.length) : 0;

      return {
        code,
        name: data.def.name,
        unit: data.def.unit || '',
        min: `${minVal}`,
        max: `${maxVal}`,
        avg: `${avgVal}`,
        latest: data.latest,
        readingCount: data.vals.length,
        status: data.status,
      };
    });

    // 5. Active Medications
    const medications: HealthSummaryMedicationItem[] = beneficiary.medicationList.map(m => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      route: m.route,
      timeSlots: m.timeSlots || [],
      instructions: m.instructions || null,
      prescribedBy: m.prescribedBy || null,
      startDate: m.startDate.toISOString().split('T')[0]
    }));

    // 6. Medication Adherence
    const adherenceRecords = await prisma.medicationAdherence.findMany({
      where: { beneficiaryId: beneficiary.id },
      orderBy: { scheduledTime: 'desc' },
      take: 60
    });

    const totalScheduled = adherenceRecords.length;
    const takenCount = adherenceRecords.filter(r => r.taken).length;
    const missedCount = totalScheduled - takenCount;
    const adherencePercent = totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 100;

    let adherenceStatus: HealthSummaryData['adherence']['status'] = 'excellent';
    if (adherencePercent >= 90) adherenceStatus = 'excellent';
    else if (adherencePercent >= 80) adherenceStatus = 'good';
    else if (adherencePercent >= 65) adherenceStatus = 'fair';
    else adherenceStatus = 'needs_attention';

    // 7. Care Overview (Completed visits)
    const completedVisits = await prisma.visit.findMany({
      where: {
        beneficiaryId: beneficiary.id,
        status: 'completed'
      },
      include: {
        careCompanion: {
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { checkOutTime: 'desc' },
      take: 10
    });

    const lastVisit = completedVisits[0] || null;

    const careOverview = {
      assignedCompanionName: lastVisit?.careCompanion?.user?.name || null,
      lastVisitDate: lastVisit?.checkOutTime ? lastVisit.checkOutTime.toISOString().split('T')[0] : null,
      lastVisitMood: lastVisit?.mood || null,
      notes: lastVisit?.notes || null
    };

    // 8. Consolidated Report Object
    const now = new Date();
    const periodLabel = `Recent Clinical History (Last 30 Logged Readings)`;

    const monthlyReport: MonthlyReportData = {
      periodLabel,
      totalVisits: completedVisits.length,
      adherencePercentage: adherencePercent,
      takenCount,
      missedCount,
      vitalsStats: monthlyVitalsStats,
      overallStatus: adherencePercent >= 80 ? 'stable' : 'attention_needed',
    };

    const reportId = `HS-${beneficiary.id.slice(0, 8).toUpperCase()}-${now.getTime().toString().slice(-6)}`;

    return {
      reportId,
      generatedAt: now.toISOString(),
      beneficiary: {
        id: beneficiary.id,
        name: beneficiary.name,
        age: beneficiary.age,
        gender: beneficiary.gender,
        bloodGroup: bloodGroupDisplay,
        address: beneficiary.address,
        city: beneficiary.city || null,
        state: beneficiary.state || null,
        pincode: beneficiary.pincode || null,
        primaryPhysicianName: beneficiary.primaryPhysicianName || null,
        primaryPhysicianPhone: beneficiary.primaryPhysicianPhone || null,
        primaryPhysicianSpec: beneficiary.primaryPhysicianSpec || null,
        emergencyContacts: beneficiary.emergencyContacts.map(c => ({
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
          isPrimary: c.isPrimary
        }))
      },
      allergies,
      medicalConditions,
      vitals,
      allReadingsHistory,
      weeklyTrends,
      monthlyTrends,
      vitalsTrends,
      monthlyReport,
      medications,
      adherence: {
        percentage: adherencePercent,
        takenCount,
        missedCount,
        totalScheduled,
        status: adherenceStatus
      },
      careOverview
    };
  }
}
