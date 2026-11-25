import prisma from '../../core/database';
import { generateUUID } from '../../utils/helpers';
import { MedicationAdherenceManager } from './MedicationAdherenceManager';
import { ensureSelfBeneficiaryProfile } from '../subscriber/beneficiary_service';

export interface MedicationPreset {
  id: string;
  name: string;
  genericName: string;
  category: string;
  dosage: string;
  route: string;
  cadence?: string;
  frequency: string;
  timeSlots: string[];
  instructions: string;
}

export const COMMON_MEDICATION_PRESETS: MedicationPreset[] = [
  {
    id: 'preset-amlodipine',
    name: 'Amlodipine',
    genericName: 'Amlodipine Besylate',
    category: 'Blood Pressure',
    dosage: '5mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 AM'],
    instructions: 'After breakfast for Blood Pressure control',
  },
  {
    id: 'preset-metformin',
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    category: 'Diabetes',
    dosage: '500mg',
    route: 'oral',
    frequency: 'twice_daily',
    timeSlots: ['08:00 AM', '08:00 PM'],
    instructions: 'With or immediately after meals',
  },
  {
    id: 'preset-pantoprazole',
    name: 'Pantoprazole (Pan-40)',
    genericName: 'Pantoprazole Sodium',
    category: 'Acidity & Digestion',
    dosage: '40mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 AM'],
    instructions: 'Empty stomach 30 mins before breakfast',
  },
  {
    id: 'preset-atorvastatin',
    name: 'Atorvastatin',
    genericName: 'Atorvastatin Calcium',
    category: 'Heart & Cholesterol',
    dosage: '10mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 PM'],
    instructions: 'At bedtime after dinner',
  },
  {
    id: 'preset-telmisartan',
    name: 'Telmisartan (Telma-40)',
    genericName: 'Telmisartan',
    category: 'Blood Pressure',
    dosage: '40mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 AM'],
    instructions: 'Morning after food',
  },
  {
    id: 'preset-shelcal',
    name: 'Shelcal 500',
    genericName: 'Calcium 500mg + Vitamin D3',
    category: 'Bone & Supplements',
    dosage: '500mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['02:00 PM'],
    instructions: 'After lunch with a glass of water',
  },
  {
    id: 'preset-ecosprin',
    name: 'Ecosprin 75',
    genericName: 'Aspirin (Enteric Coated)',
    category: 'Heart',
    dosage: '75mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['02:00 PM'],
    instructions: 'After lunch (Blood Thinner)',
  },
  {
    id: 'preset-dolo',
    name: 'Dolo 650',
    genericName: 'Paracetamol',
    category: 'Pain & Fever',
    dosage: '650mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 AM'],
    instructions: 'When needed for fever or body pain (after food)',
  },
];

export const getMedicationPresets = () => {
  return COMMON_MEDICATION_PRESETS;
};

export const getBeneficiaryMedications = async (beneficiaryId: string) => {
  // Resolve beneficiary ID if user ID was passed
  let beneficiary = await prisma.beneficiary.findFirst({
    where: {
      OR: [
        { id: beneficiaryId },
        { userId: beneficiaryId },
        { subscriberId: beneficiaryId }
      ]
    }
  });

  if (!beneficiary) {
    const user = await prisma.user.findUnique({ where: { id: beneficiaryId } });
    if (user) {
      beneficiary = await ensureSelfBeneficiaryProfile(user.id);
    }
  }

  const actualId = beneficiary ? beneficiary.id : beneficiaryId;

  return prisma.medication.findMany({
    where: { beneficiaryId: actualId, isActive: true },
    orderBy: { createdAt: 'desc' }
  });
};

export const createMedication = async (data: {
  beneficiaryId: string;
  name: string;
  genericName?: string | null;
  dosage: string;
  route?: string;
  frequency?: string;
  timeSlots?: string[];
  instructions?: string | null;
  sideEffects?: string | null;
  prescribedBy?: string | null;
  startDate?: Date | string;
  endDate?: Date | string | null;
  totalDays?: number | null;
  refillReminderDays?: number | null;
  setReminders?: boolean;
  isActive?: boolean;
}) => {
  // Resolve actual beneficiary profile ID if given a User ID
  let targetBeneficiaryId = data.beneficiaryId;
  let beneficiary = await prisma.beneficiary.findFirst({
    where: {
      OR: [
        { id: data.beneficiaryId },
        { userId: data.beneficiaryId },
        { subscriberId: data.beneficiaryId }
      ]
    }
  });

  if (!beneficiary) {
    const user = await prisma.user.findUnique({ where: { id: data.beneficiaryId } });
    if (user) {
      beneficiary = await ensureSelfBeneficiaryProfile(user.id);
    }
  }

  if (beneficiary) {
    targetBeneficiaryId = beneficiary.id;
  }

  // Resolve cadence (Daily, Alternate, Weekly, Monthly)
  let cadence = (data as any).cadence || 'daily';
  if (cadence === 'alternate_days') cadence = 'alternate';

  // Normalize frequency (Once daily, Twice daily, Thrice daily, 4x daily)
  let normalizedFreq = data.frequency || 'once_daily';
  if (normalizedFreq === 'daily') {
    cadence = 'daily';
    normalizedFreq = 'once_daily';
  } else if (normalizedFreq === 'alternate' || normalizedFreq === 'alternate_days') {
    cadence = 'alternate';
    normalizedFreq = 'once_daily';
  } else if (normalizedFreq === 'weekly') {
    cadence = 'weekly';
    normalizedFreq = 'once_daily';
  } else if (normalizedFreq === 'monthly') {
    cadence = 'monthly';
    normalizedFreq = 'once_daily';
  }

  // Calculate default time slots if missing or empty, aligned with worker schedules
  let timeSlots = data.timeSlots || [];
  if (timeSlots.length === 0) {
    if (normalizedFreq === 'once_daily') {
      timeSlots = ['08:00 AM'];
    } else if (normalizedFreq === 'twice_daily') {
      timeSlots = ['08:00 AM', '08:00 PM'];
    } else if (normalizedFreq === 'thrice_daily') {
      timeSlots = ['08:00 AM', '02:00 PM', '08:00 PM'];
    } else if (normalizedFreq === 'four_times_daily') {
      timeSlots = ['08:00 AM', '02:00 PM', '06:00 PM', '08:00 PM'];
    } else {
      timeSlots = ['08:00 AM'];
    }
  }

  // Calculate startDate and endDate
  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  let endDate = data.endDate ? new Date(data.endDate) : null;
  if (!endDate && data.totalDays && data.totalDays > 0) {
    endDate = new Date(startDate.getTime() + data.totalDays * 24 * 60 * 60 * 1000);
  }

  return prisma.medication.create({
    data: {
      id: generateUUID(),
      beneficiaryId: targetBeneficiaryId,
      name: data.name,
      genericName: data.genericName || null,
      dosage: data.dosage,
      route: (data.route || 'oral') as any,
      cadence: cadence as any,
      frequency: normalizedFreq as any,
      timeSlots,
      instructions: data.instructions || null,
      sideEffects: data.sideEffects || null,
      prescribedBy: data.prescribedBy || null,
      startDate,
      endDate,
      totalDays: data.totalDays || null,
      refillReminderDays: data.refillReminderDays || null,
      setReminders: data.setReminders ?? true,
      isActive: data.isActive ?? true,
    } as any,
  });
};

export const updateMedication = async (
  id: string,
  data: {
    name?: string;
    genericName?: string | null;
    dosage?: string;
    route?: string;
    cadence?: string;
    frequency?: string;
    timeSlots?: string[];
    instructions?: string | null;
    sideEffects?: string | null;
    prescribedBy?: string | null;
    startDate?: Date | string;
    endDate?: Date | string | null;
    totalDays?: number | null;
    refillReminderDays?: number | null;
    setReminders?: boolean;
    isActive?: boolean;
  }
) => {
  const updateData: any = { ...data };
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  }
  if (data.cadence) {
    let c = data.cadence;
    if (c === 'alternate_days') c = 'alternate';
    updateData.cadence = c as any;
  }
  if (data.frequency) {
    let freq = data.frequency;
    if (freq === 'daily') freq = 'once_daily';
    if (freq === 'alternate') freq = 'alternate_days';
    updateData.frequency = freq as any;
  }
  if (data.route) updateData.route = data.route as any;

  return prisma.medication.update({
    where: { id },
    data: updateData as any,
  });
};

export const deleteMedication = async (id: string) => {
  return prisma.medication.update({
    where: { id },
    data: { isActive: false },
  });
};

export const createAdherenceRecord = async (data: {
  beneficiaryId: string;
  medicationId: string;
  scheduledTime: Date;
  taken: boolean;
  takenTime?: Date;
  recordedBy: string;
}) => {
  return prisma.medicationAdherence.create({ data: { id: generateUUID(), ...data } });
};

/**
 * Instantiate MedicationAdherenceManager to get dynamic schedule for a target date (defaults to today).
 */
export const getTodayMedications = async (beneficiaryId: string, dateStr?: string) => {
  const manager = new MedicationAdherenceManager(beneficiaryId);
  return manager.getScheduleForDate(dateStr);
};

/**
 * Instantiate MedicationAdherenceManager to log a dose adherence event.
 */
export const logAdherence = async (
  beneficiaryId: string,
  medicationId: string,
  scheduledTimeIso: string,
  taken: boolean,
  recordedBy: string
) => {
  const manager = new MedicationAdherenceManager(beneficiaryId);
  return manager.logAdherence(medicationId, scheduledTimeIso, taken, recordedBy);
};

/**
 * Instantiate MedicationAdherenceManager to get average scores and summary counts.
 */
export const getMedicationMetrics = async (beneficiaryId: string) => {
  const manager = new MedicationAdherenceManager(beneficiaryId);
  return manager.getOverallMetrics();
};
