import prisma from '../../core/database';
import { generateUUID, generateRandomPhone } from '../../utils/helpers';
import { Prisma } from '@prisma/client';
import { getBeneficiarySathiEligibility } from '../beneficiary/beneficiary_sathi_service';
import { notificationProducer } from '@maihoonna/notifications';
import { resolveFileUrl, resolveFileUrls } from '../storage';

// Map free-text frequencies from the mobile UI to valid DB enum values
const frequencyMap: Record<string, string> = {
  'once daily': 'once_daily',
  'daily': 'once_daily',
  'once a day': 'once_daily',
  'twice daily': 'twice_daily',
  'two times daily': 'twice_daily',
  'twice a day': 'twice_daily',
  'thrice daily': 'thrice_daily',
  'three times daily': 'thrice_daily',
  'thrice a day': 'thrice_daily',
  '4 times daily': 'four_times_daily',
  'four times daily': 'four_times_daily',
  'every 6 hours': 'every_6_hours',
  'every 8 hours': 'every_8_hours',
  'every 12 hours': 'every_12_hours',
  'weekly': 'weekly',
  'fortnightly': 'fortnightly',
  'monthly': 'monthly',
  'as needed': 'as_needed',
  'as required': 'as_needed',
  'prn': 'as_needed',
};

const normalizeFrequency = (raw: string): string => {
  if (!raw) return 'once_daily';
  const key = raw.toLowerCase().trim();
  return frequencyMap[key] ?? 'once_daily'; // fallback to once_daily if unrecognized
};

const normalizeGender = (raw: string): string => {
  if (!raw) return 'prefer_not_to_say';
  const g = raw.toLowerCase().trim();
  if (['male', 'female', 'other', 'prefer_not_to_say'].includes(g)) return g;
  return 'prefer_not_to_say';
};

const parseDob = (dobStr: string | null | undefined): Date | null => {
  if (!dobStr) return null;
  const parts = dobStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    } else if (parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  const parsed = new Date(dobStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};


export const createBeneficiary = async (data: {
  subscriberId: string;
  phone: string; // Add real phone property
  name: string;
  photo?: string;
  age: number;
  gender: string;
  address: string;
  medicalConditions?: string[];
  medications?: string[];
  emergencyContacts?: any[];
  dob?: string;
}) => {
  const phone = data.phone.replace(/\D/g, '').slice(-10);
  const dobDate = parseDob(data.dob);

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: generateUUID(),
        phone,
        name: data.name,
        role: 'beneficiary',
        age: data.age,
        dateOfBirth: dobDate
      },
    });
  }

  const existingBeneficiary = await prisma.beneficiary.findUnique({
    where: { userId: user.id }
  });

  if (existingBeneficiary) {
    return prisma.beneficiary.update({
      where: { id: existingBeneficiary.id },
      data: {
        subscriberId: data.subscriberId,
        name: data.name,
        photo: data.photo || existingBeneficiary.photo,
        age: data.age,
        dateOfBirth: dobDate,
        gender: (data.gender.toLowerCase() === 'male' ? 'male' : data.gender.toLowerCase() === 'female' ? 'female' : 'prefer_not_to_say') as any,
        address: data.address,
        isActive: true,
        status: 'active',
      }
    });
  }

  const newBeneficiary = await prisma.beneficiary.create({
    data: {
      id: generateUUID(),
      userId: user.id,
      subscriberId: data.subscriberId,
      name: data.name,
      photo: data.photo,
      age: data.age,
      dateOfBirth: dobDate,
      gender: (data.gender.toLowerCase() === 'male' ? 'male' : data.gender.toLowerCase() === 'female' ? 'female' : 'prefer_not_to_say') as any,
      address: data.address,
      emergencyContacts: {
        create: (data.emergencyContacts ?? []).map((c: any) => ({
          id: generateUUID(),
          name: c.name,
          phone: c.phone,
          relationship: c.relation || c.relationship || 'Emergency',
        })),
      },
    },
  });

  // NT-005: Dispatch BENEF_PROFILE_CREATED (Decoupled Redis Streams)
  (async () => {
    try {
      const subscriber = await prisma.user.findUnique({
        where: { id: data.subscriberId },
        select: { name: true },
      });
      const subscriberName = subscriber?.name || 'Subscriber';
      const beneficiaryPhone = data.phone?.replace(/\D/g, '').slice(-10);

      if (beneficiaryPhone) {
        await notificationProducer.publish({
          idempotencyKey: `benef-${newBeneficiary.id}-created`,
          channel: 'whatsapp',
          event: 'BENEF_PROFILE_CREATED',
          recipient: { phone: beneficiaryPhone },
          variables: {
            beneficiaryName: data.name,
            subscriberName,
          },
        });
      }
    } catch (err: any) {
      console.error('[BeneficiaryService:Create] Notification Error:', err.message);
    }
  })();

  return newBeneficiary;
};

export const getBeneficiary = async (beneficiaryId: string) => {
  const b = await prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
  if (!b) throw new Error('Beneficiary not found');
  return b;
};

export const getSubscriberBeneficiaries = async (subscriberId: string) => {
  return prisma.beneficiary.findMany({ where: { subscriberId, status: { not: 'deleted' } } });
};

export const getSathiEligibleBeneficiaries = async (subscriberId: string) => {
  const beneficiaries = await prisma.beneficiary.findMany({ where: { subscriberId } });
  
  const eligibleBeneficiaries = [];
  for (const b of beneficiaries) {
    const eligibility = await getBeneficiarySathiEligibility(b.id);
    if (eligibility.eligible) {
      eligibleBeneficiaries.push(b);
    }
  }
  
  return eligibleBeneficiaries;
};

export const updateBeneficiary = async (beneficiaryId: string, updates: any) => {
  const { medicalConditions, medications, emergencyContacts, vitalsData, ...coreUpdates } = updates;

  return prisma.$transaction(async (tx) => {
    // 1. Update Core Beneficiary Fields
    // Sanitize coreUpdates: remove NaN/undefined and normalize enum-like fields
    const sanitizedCore: any = {};
    Object.entries(coreUpdates).forEach(([key, value]) => {
      if (value === undefined || (typeof value === 'number' && isNaN(value))) return;
      if (key === 'gender') {
        sanitizedCore[key] = normalizeGender(value as string);
      } else {
        sanitizedCore[key] = value;
      }
    });

    const beneficiary = await tx.beneficiary.update({
      where: { id: beneficiaryId },
      data: sanitizedCore,
      include: { user: true }
    });

    // 2. Sync Medications (Replace Completely as per user request)
    if (medications) {
      // Remove old medications
      await tx.medication.deleteMany({
        where: { beneficiaryId }
      });

      // Add new ones
      if (medications.length > 0) {
        await tx.medication.createMany({
          data: medications.map((m: any) => ({
            id: generateUUID(),
            beneficiaryId,
            name: m.name,
            dosage: m.dosage,
            frequency: normalizeFrequency(m.frequency) as any,
            timeSlots: m.timeSlots || [],
            setReminders: !!m.setReminders,
            instructions: m.instructions || '',
            startDate: new Date(), // Default to now if not provided
          }))
        });
      }
    }

    // 3. Sync Medical Conditions
    if (medicalConditions) {
      // Remove current links
      await tx.beneficiaryCondition.deleteMany({
        where: { beneficiaryId }
      });

      // Link new ones
      for (const condName of medicalConditions) {
        // Find or create the master medical condition entry
        let condition = await tx.medicalCondition.findUnique({
          where: { name: condName }
        });

        if (!condition) {
          condition = await tx.medicalCondition.create({
            data: {
              id: generateUUID(),
              name: condName,
              slug: condName.toLowerCase().replace(/\s+/g, '-'),
              category: 'General'
            }
          });
        }

        // Link beneficiary to this condition
        await tx.beneficiaryCondition.create({
          data: {
            id: generateUUID(),
            beneficiaryId,
            conditionId: condition.id
          }
        });
      }
    }

    // 4. Sync Vitals Configuration (Dynamic Relational System)
    if (vitalsData && typeof vitalsData === 'object') {
      const vitalIds = Object.keys(vitalsData);
      
      for (const vitalDefId of vitalIds) {
        const isActive = !!vitalsData[vitalDefId];
        
        await tx.beneficiaryVitalConfig.upsert({
          where: {
            beneficiaryId_vitalDefinitionId: {
              beneficiaryId,
              vitalDefinitionId: vitalDefId,
            }
          },
          update: { isActive },
          create: {
            beneficiaryId,
            vitalDefinitionId: vitalDefId,
            isActive,
            frequency: 'every_visit',
          }
        });
      }
    }

    // 5. Log Activity
    await tx.activityLog.create({
      data: {
        id: generateUUID(),
        userId: beneficiary.subscriberId, // The subscriber who made the update
        type: 'PROFILE',
        action: 'BENEFICIARY_UPDATED',
        details: {
          beneficiaryId,
          beneficiaryName: beneficiary.name,
          updatedFields: Object.keys(updates)
        } as any
      }
    });

    return beneficiary;
  });
};

export const getCareCompanions = async (zone?: string) => {
  return prisma.careCompanion.findMany({
    where: { isAvailable: true, ...(zone ? { zone } : {}) },
  });
};

export const getCareCompanion = async (ccId: string) => {
  const cc = await prisma.careCompanion.findUnique({ where: { id: ccId } });
  if (!cc) throw new Error('Care companion not found');
  return cc;
};

export const getBeneficiaryProfile = async (beneficiaryId: string) => {
  const now = new Date();

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      conditions: {
        include: {
          condition: true
        }
      },
      medicationList: {
        where: {
          isActive: true,
          startDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gte: now } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      },
      medicalRecords: {
        where: { isActive: true },
        orderBy: { recordDate: 'desc' }
      },
      vitalConfigs: {
        where: { isActive: true },
        include: {
          vitalDefinition: true
        }
      },
      subscriptions: {
        where: { isActive: true },
        include: {
          benefitBalances: {
            include: {
              benefit: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!beneficiary) throw new Error('Beneficiary not found');

  // Calculate Hours Used ONLY for benefits labeled as 'hours'
  let hoursUsedPercent = 0;
  const activeSub = beneficiary.subscriptions[0];
  if (activeSub && activeSub.benefitBalances.length > 0) {
    const hourBalances = activeSub.benefitBalances.filter(
      b => b.benefit.unitLabel?.toLowerCase().includes('hour')
    );
    const totalUnits = hourBalances.reduce((sum, b) => sum + (b.totalUnits || 0), 0);
    const usedUnits = hourBalances.reduce((sum, b) => sum + (b.usedUnits || 0), 0);
    if (totalUnits > 0) {
      hoursUsedPercent = Math.round((usedUnits / totalUnits) * 100);
    }
  }

  // Query next visit separately (maximum of 1 record)
  const nextVisit = await prisma.visit.findFirst({
    where: {
      beneficiaryId: beneficiary.id,
      status: 'scheduled',
      scheduledTime: { gt: now }
    },
    include: {
      careCompanion: {
        include: {
          user: true
        }
      },
      benefit: {
        include: {
          benefitType: true
        }
      }
    },
    orderBy: { scheduledTime: 'asc' }
  });

  // Query past visits separately (maximum of 10 records)
  const pastVisits = await prisma.visit.findMany({
    where: {
      beneficiaryId: beneficiary.id,
      OR: [
        { status: 'completed' },
        { status: 'cancelled' },
        { scheduledTime: { lte: now } }
      ],
      ...(nextVisit ? { id: { not: nextVisit.id } } : {})
    },
    include: {
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
    },
    orderBy: { scheduledTime: 'desc' },
    take: 10
  });

  // Get latest vital readings from VitalReading table efficiently using Postgres DISTINCT ON
  // Get latest vital readings from VitalReading table efficiently using Postgres DISTINCT ON, filtering out empty entries
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
    include: { vitalDefinition: true },
    orderBy: { capturedAt: 'desc' },
    distinct: ['vitalDefinitionId'],
  });

  // ── Last Happiness Score from visits (same pattern as vitals: most recent visit with mood recorded) ──
  const lastVisitWithMood = await prisma.visit.findFirst({
    where: {
      beneficiaryId: beneficiary.id,
      mood: { not: null },
    },
    orderBy: { scheduledTime: 'desc' },
    select: { mood: true, scheduledTime: true },
  });

  const MOOD_SCORE_MAP: Record<string, number> = {
    happy: 100,
    neutral: 80,
    sad: 50,
    anxious: 20,
    depressed: 0,
  };
  const lastHappinessScore: number | null = lastVisitWithMood?.mood
    ? (MOOD_SCORE_MAP[lastVisitWithMood.mood.toLowerCase()] ?? null)
    : null;

  // Build a lookup: code -> latest VitalReading value
  const latestByCode: Record<string, { v1: number | null; v2: number | null; text: string | null }> = {};
  for (const r of latestReadingRows) {
    const code = r.vitalDefinition?.code?.toUpperCase();
    if (code && !latestByCode[code]) {
      latestByCode[code] = { v1: r.valueNumeric, v2: r.valueNumeric2, text: r.valueText };
    }
  }

  const vitalsData = [];

  const hasVisitsOrVitals = latestReadingRows.length > 0 || pastVisits.length > 0 || !!nextVisit;
  const isDefaultData = !hasVisitsOrVitals;

  // ── Mapping tables for known system vital codes ──────────────────────────────
  // icon, color, and the function to get the current reading value string
  const VITAL_META: Record<string, { icon: string; color: string; getValue: (r: typeof latestByCode) => string | null; trend: string }> = {
    'PULSE':         { icon: 'heart-pulse',      color: '#EF4444', trend: 'Normal', getValue: r => r['PULSE']?.v1        != null ? `${r['PULSE'].v1} bpm`                            : null },
    'HEART_RATE':    { icon: 'heart-pulse',      color: '#EF4444', trend: 'Normal', getValue: r => r['HEART_RATE']?.v1   != null ? `${r['HEART_RATE'].v1} bpm`                       : null },
    'BP':            { icon: 'blood-bag',         color: '#8B5CF6', trend: 'Normal', getValue: r => r['BP']?.v1           != null ? `${r['BP'].v1}/${r['BP'].v2 ?? '?'}`              : null },
    'BLOOD_GLUCOSE': { icon: 'water',             color: '#F59E0B', trend: 'Normal', getValue: r => r['BLOOD_GLUCOSE']?.v1 != null ? `${r['BLOOD_GLUCOSE'].v1} mg/dL`               : null },
    'TEMP':          { icon: 'thermometer',       color: '#06B6D4', trend: 'Normal', getValue: r => r['TEMP']?.v1         != null ? `${r['TEMP'].v1} °C`                             : null },
    'TEMPERATURE':   { icon: 'thermometer',       color: '#06B6D4', trend: 'Normal', getValue: r => r['TEMPERATURE']?.v1  != null ? `${r['TEMPERATURE'].v1} °C`                    : null },
    'SPO2':          { icon: 'air-humidifier',    color: '#10B981', trend: 'Good',   getValue: r => r['SPO2']?.v1         != null ? `${r['SPO2'].v1}%`                              : null },
    'OXYGEN_LEVEL':  { icon: 'air-humidifier',    color: '#10B981', trend: 'Good',   getValue: r => r['OXYGEN_LEVEL']?.v1 != null ? `${r['OXYGEN_LEVEL'].v1}%`                     : null },
    'WEIGHT':        { icon: 'scale-bathroom',    color: '#3B82F6', trend: 'Stable', getValue: r => r['WEIGHT']?.v1       != null ? `${r['WEIGHT'].v1} kg`                          : null },
    'PAIN':          { icon: 'emoticon-sad',      color: '#F97316', trend: 'Normal', getValue: _r => null },
    'RESP':          { icon: 'lungs',             color: '#14B8A6', trend: 'Normal', getValue: _r => null },
    'BP_SYSTOLIC':   { icon: 'arrow-up-bold',     color: '#8B5CF6', trend: 'Normal', getValue: r => r['BP']?.v1           != null ? `${r['BP'].v1} mmHg`                            : null },
    'BP_DIASTOLIC':  { icon: 'arrow-down-bold',   color: '#7C3AED', trend: 'Normal', getValue: r => r['BP']?.v2           != null ? `${r['BP'].v2} mmHg`                            : null },
  };

  // Build vitalsData from the relational vitalConfigs (covers system vitals + custom admin vitals)
  const activeConfigs = (beneficiary as any).vitalConfigs || [];

  // Sort by vitalDefinition.displayOrder so the order matches admin configuration
  activeConfigs.sort((a: any, b: any) =>
    (a.vitalDefinition?.displayOrder ?? 99) - (b.vitalDefinition?.displayOrder ?? 99)
  );

  const uniqueCodes = new Set<string>();
  const uniqueNames = new Set<string>();
  const deduplicatedConfigs = activeConfigs.filter((config: any) => {
    const code = config.vitalDefinition?.code;
    const name = config.vitalDefinition?.name;
    if (!code || !name) return false;
    
    // If we already saw this exact code or this exact visual name, it's a duplicate
    if (uniqueCodes.has(code) || uniqueNames.has(name.toLowerCase())) return false;
    
    uniqueCodes.add(code);
    uniqueNames.add(name.toLowerCase());
    return true;
  });

  for (const config of deduplicatedConfigs) {
    const def = config.vitalDefinition;
    if (!def) continue;

    const meta = VITAL_META[def.code] ?? {
      icon: 'clipboard-pulse',   // generic fallback for custom vitals
      color: '#6B7280',
      trend: 'Normal',
      getValue: (r: any) => {
        const reading = r[def.code?.toUpperCase()];
        if (!reading) return null;
        if (reading.v1 != null && reading.v2 != null) return `${reading.v1}/${reading.v2} ${def.unit || ''}`.trim();
        if (reading.v1 != null) return `${reading.v1} ${def.unit || ''}`.trim();
        if (reading.text) return reading.text;
        return null;
      },
    };

    const rawValue = meta.getValue(latestByCode);
    const displayValue = rawValue ?? `-- ${def.unit || ''}`.trim();

    vitalsData.push({
      label:  def.name,
      value:  displayValue,
      icon:   meta.icon,
      color:  meta.color,
      trend:  meta.trend,
      code:   def.code,          // pass code to frontend for future filtering
    });
  }

  // ── Fallback: if no relational configs exist yet, show any vitals we have readings for ──
  if (activeConfigs.length === 0) {
    for (const code of Object.keys(latestByCode)) {
      const meta = VITAL_META[code] ?? {
        icon: 'clipboard-pulse', color: '#6B7280', trend: 'Normal', getValue: (_r: any) => null
      };
      const reading = latestByCode[code];
      let displayValue = `-- `;
      if (reading.v1 != null && reading.v2 != null) displayValue = `${reading.v1}/${reading.v2}`;
      else if (reading.v1 != null) displayValue = `${reading.v1}`;
      else if (reading.text) displayValue = reading.text;
      vitalsData.push({ label: code, value: displayValue, icon: meta.icon, color: meta.color, trend: meta.trend, code });
    }
  }


  // trendData is now empty — chart trends are served by GET /subscriber/vitals/trends/:beneficiaryId
  const vitalsTrends: any[] = [];

  const computedEmotionalScore = isDefaultData ? 100 : (beneficiary.emotionalScore === 8.0 ? 85 : beneficiary.emotionalScore);

  const resolvedBeneficiaryPhoto = await resolveFileUrl(beneficiary.photo, 1800);

  const resolvedNextVisit = nextVisit ? await (async () => {
    const is3rdPartyNext = Boolean(nextVisit.is3rdParty || (!nextVisit.careCompanionId && !nextVisit.careCompanion));
    const benefitName = nextVisit.benefit?.name || null;
    const companionPhoto = is3rdPartyNext ? null : await resolveFileUrl(nextVisit.careCompanion?.photo, 1800);
    return {
      id: nextVisit.id,
      is3rdParty: is3rdPartyNext,
      benefitId: nextVisit.benefitId || null,
      benefitName,
      benefitCode: nextVisit.benefit?.code || null,
      benefitCategory: nextVisit.benefit?.benefitType?.name || null,
      thirdPartyNotes: nextVisit.thirdPartyNotes || null,
      companionName: is3rdPartyNext ? (benefitName || 'Third-Party Partner Service') : (nextVisit.careCompanion?.name || 'Care Companion'),
      companionPhoto,
      companionPhone: is3rdPartyNext ? null : (nextVisit.careCompanion?.user?.phone || null),
      dateStr: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' }).format(nextVisit.scheduledTime),
      timeStr: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(nextVisit.scheduledTime),
      scheduledTime: nextVisit.scheduledTime.toISOString(),
      durationMinutes: nextVisit.durationMinutes,
    };
  })() : null;

  const resolvedTimeline = await Promise.all(pastVisits.map(async (v: any) => {
    const istDateFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
    const istTimeFormatter = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

    const schedDate = new Date(v.scheduledTime);
    const schedDateStr = istDateFormatter.format(schedDate);
    const schedStartTime = istTimeFormatter.format(schedDate);
    const schedEndTime = istTimeFormatter.format(new Date(schedDate.getTime() + (v.durationMinutes && v.durationMinutes >= 15 ? v.durationMinutes : 60) * 60000));

    const checkInTime = v.checkInTime ? new Date(v.checkInTime) : null;
    const checkOutTime = v.checkOutTime ? new Date(v.checkOutTime) : null;

    const checkInTimeFormatted = checkInTime ? istTimeFormatter.format(checkInTime) : null;
    const checkOutTimeFormatted = checkOutTime ? istTimeFormatter.format(checkOutTime) : null;

    const defaultMins = (v.durationMinutes && v.durationMinutes >= 15) ? v.durationMinutes : 60;
    let scheduledDurationText = '';
    if (defaultMins < 60) {
      scheduledDurationText = `${defaultMins} mins`;
    } else {
      const durationHours = parseFloat((defaultMins / 60).toFixed(1));
      scheduledDurationText = `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
    }

    // Calculate actual duration strictly from check-in and check-out times
    let durationText = '';
    let actualDurationText: string | null = null;
    let actualDurationMinutes: number | null = null;
    
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
      actualDurationText = durationText;
    } else {
      durationText = scheduledDurationText;
    }

    // Extract vital readings
    const vitalsList: any[] = [];
    (v.vitalReadings || []).forEach((r: any) => {
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

    const bpReading = vitalsList.find(vl => vl.code === 'BP' || vl.name?.toLowerCase().includes('blood pressure'));
    const hrReading = vitalsList.find(vl => vl.code === 'PULSE' || vl.code === 'HEART_RATE' || vl.name?.toLowerCase().includes('heart rate') || vl.name?.toLowerCase().includes('pulse'));
    const bsReading = vitalsList.find(vl => vl.code === 'BLOOD_GLUCOSE' || vl.name?.toLowerCase().includes('sugar') || vl.name?.toLowerCase().includes('glucose'));

    // Extract medication adherence records
    const medicationsList = (v.medicationAdherenceRecords || []).map((mar: any) => ({
      id: mar.medicationId,
      name: mar.medication?.name || 'Medication',
      dosage: mar.medication?.dosage || null,
      instructions: mar.medication?.instructions || null,
      taken: mar.taken === true
    }));

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
      if (v.manualCheckOutReason) {
        checkOutType = 'Manual Check-out';
      } else if (v.isGeoVerified) {
        checkOutType = 'Auto Geofence (Verified)';
      }
    }

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

    const is3rdParty = Boolean(v.is3rdParty || (!v.careCompanionId && !v.careCompanion));
    const benefitName = v.benefit?.name || null;
    const benefitCode = v.benefit?.code || null;
    const benefitCategory = v.benefit?.benefitType?.name || null;

    return {
      id: v.id,
      encounterId: v.encounterId || v.visitCode || `ENC-${v.id.slice(0, 8).toUpperCase()}`,
      status: v.status,
      is3rdParty,
      benefitId: v.benefitId || null,
      benefitName,
      benefitCode,
      benefitCategory,
      thirdPartyNotes: v.thirdPartyNotes || null,
      companionName: is3rdParty ? (benefitName || 'Third-Party Partner Service') : (v.careCompanion?.name || 'Care Companion'),
      companionPhoto: is3rdParty ? null : companionPhoto,
      companionPhone: is3rdParty ? null : (v.careCompanion?.user?.phone || null),
      scheduledDate: schedDateStr,
      scheduledTime: v.scheduledTime ? new Date(v.scheduledTime).toISOString() : null,
      scheduledStartTime: schedStartTime,
      scheduledEndTime: schedEndTime,
      scheduledTimeRange: `${schedStartTime} – ${schedEndTime}`,
      dateStr: `${schedDateStr} • ${schedStartTime} – ${schedEndTime}`,
      duration: durationText,
      scheduledDurationText,
      actualDurationText,
      actualDurationMinutes,
      rated: v.subscriberRating !== null && v.subscriberRating !== undefined,
      rating: v.subscriberRating ?? null,          // subscriber's rating of the CC
      beneficiaryRating: v.beneficiaryRating ?? null, // beneficiary's rating of the CC
      activities: v.activitiesDone || [],
      bp: bpReading?.value || null,
      heartRate: hrReading?.value || null,
      bloodSugar: bsReading?.value || null,
      notes: v.visitSummary || v.notes,
      // Detailed fields for Subscriber encounter modal
      checkInTime: checkInTimeFormatted,
      checkInTimeIso: v.checkInTime ? new Date(v.checkInTime).toISOString() : null,
      checkInType,
      isGeoVerified: v.isGeoVerified === true,
      geoDistanceMeters: v.geoDistanceMeters ?? null,
      manualCheckInReason: v.manualCheckInReason || null,
      checkOutTime: checkOutTimeFormatted,
      checkOutTimeIso: v.checkOutTime ? new Date(v.checkOutTime).toISOString() : null,
      checkOutType,
      manualCheckOutReason: v.manualCheckOutReason || null,
      mood: v.mood ? (v.mood.charAt(0).toUpperCase() + v.mood.slice(1).toLowerCase()) : 'Neutral',
      medicationAdherence: v.medicationAdherence,
      medications: medicationsList,
      vitals: vitalsList,
      photos
    };
  }));

  return {
    ...beneficiary,
    photo: resolvedBeneficiaryPhoto,
    emotionalScore: computedEmotionalScore,
    lastHappinessScore,   // null if no mood ever recorded in any visit
    isDefaultData,
    hoursUsedPercent,
    vitalsData,
    vitalsTrends,
    nextVisit: resolvedNextVisit,
    timeline: resolvedTimeline
  };
};

export const updateMedicalRecord = async (recordId: string, data: { title: string }) => {
  return prisma.medicalRecord.update({
    where: { id: recordId },
    data: { title: data.title }
  });
};

export const deleteMedicalRecord = async (recordId: string) => {
  return prisma.medicalRecord.update({
    where: { id: recordId },
    data: { isActive: false } // Soft delete
  });
};

export const createMedicalRecord = async (
  subscriberId: string,
  beneficiaryId: string,
  data: {
    title: string;
    fileUrl: string;
    fileKey?: string;
    mimeType: string;
    fileSizeBytes: number;
  }
) => {
  return prisma.medicalRecord.create({
    data: {
      id: generateUUID(),
      beneficiaryId,
      uploadedBy: subscriberId,
      title: data.title,
      fileUrl: data.fileUrl,
      fileKey: data.fileKey,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      recordType: 'prescription', // default to prescription as in schema
    }
  });
};

export const getBeneficiaryPendingDetails = async (beneficiaryId: string) => {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    include: {
      user: true,
      conditions: {
        include: {
          condition: true
        }
      },
      medicationList: true,
      emergencyContacts: true,
      schedulePreference: true,
      vitalConfigs: {
        include: {
          vitalDefinition: true
        }
      },
      subscriptions: {
        where: { isActive: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          package: true,
          packageVersion: {
            include: {
              versionBenefits: {
                include: {
                  benefit: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!beneficiary) {
    throw new Error('Beneficiary not found');
  }

  return {
    ...beneficiary,
    phone: beneficiary.user?.phone || '',
    dateOfBirth: beneficiary.dateOfBirth || beneficiary.user?.dateOfBirth || null
  };
};

export const addMedication = async (beneficiaryId: string, data: {
  name: string;
  dosage: string;
  frequency?: string;
  instructions?: string;
  startDate?: string;
  endDate?: string;
}) => {
  // Helper: parse dates in either DD-MM-YYYY or ISO (YYYY-MM-DD) format safely
  const parseDate = (raw: string): Date => {
    // DD-MM-YYYY → YYYY-MM-DD
    const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = raw.match(ddmmyyyy);
    if (match) {
      return new Date(`${match[3]}-${match[2]}-${match[1]}`);
    }
    return new Date(raw);
  };

  return prisma.medication.create({
    data: {
      id: generateUUID(),
      beneficiaryId,
      name: data.name.trim(),
      dosage: (data.dosage || 'Take as directed').trim(),
      frequency: (data.frequency as any) || 'once_daily',
      instructions: data.instructions ? data.instructions.trim() : null,
      startDate: data.startDate ? parseDate(data.startDate) : new Date(),
      endDate: data.endDate ? parseDate(data.endDate) : null,
      isActive: true,
    }
  });
};

export const deleteMedication = async (medicationId: string) => {
  return prisma.medication.update({
    where: { id: medicationId },
    data: { isActive: false }
  });
};

export const deleteBeneficiary = async (subscriberId: string, beneficiaryId: string) => {
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
  });

  if (!beneficiary) {
    throw new Error('Beneficiary not found');
  }

  if (beneficiary.subscriberId !== subscriberId) {
    throw new Error('Unauthorized: You can only delete your own beneficiaries');
  }

  // Prevent deleting "Self" profile as a beneficiary
  const isSelf = (beneficiary.relationship || '').toLowerCase() === 'self' || beneficiary.userId === subscriberId;
  if (isSelf) {
    throw new Error('Your own profile cannot be deleted as a beneficiary. Please use Delete Account in Security Settings.');
  }

  // Prevent re-deleting an already deleted beneficiary
  if (beneficiary.status === 'deleted') {
    throw new Error('Beneficiary has already been removed from your list.');
  }

  // Set status to 'deleted' — this hides the beneficiary from subscriber views
  // while keeping the record intact for admin/operational purposes
  await prisma.$transaction(async (tx) => {
    // 1. Mark beneficiary status as deleted
    await tx.beneficiary.update({
      where: { id: beneficiaryId },
      data: { status: 'deleted' }
    });

    // 2. Deactivate any active subscriptions linked to this beneficiary
    await tx.subscription.updateMany({
      where: { beneficiaryId, isActive: true },
      data: { isActive: false }
    });
  });

  return { success: true, message: 'Beneficiary removed successfully' };
};