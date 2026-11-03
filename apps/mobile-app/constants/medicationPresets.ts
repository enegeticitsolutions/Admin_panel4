export interface MedicationPresetItem {
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
  badgeColor: string;
  badgeTextColor: string;
  iconName: string;
}

export const COMMON_MEDICATION_PRESETS: MedicationPresetItem[] = [
  {
    id: 'preset-amlodipine',
    name: 'Amlodipine',
    genericName: 'Amlodipine Besylate',
    category: 'Blood Pressure',
    dosage: '5mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 AM'],
    instructions: 'After breakfast for Blood Pressure',
    badgeColor: '#EFF6FF',
    badgeTextColor: '#1D4ED8',
    iconName: 'heart-outline',
  },
  {
    id: 'preset-metformin',
    name: 'Metformin',
    genericName: 'Metformin HCl',
    category: 'Diabetes',
    dosage: '500mg',
    route: 'oral',
    frequency: 'twice_daily',
    timeSlots: ['08:00 AM', '08:00 PM'],
    instructions: 'With or immediately after meals',
    badgeColor: '#ECFDF5',
    badgeTextColor: '#047857',
    iconName: 'fitness-outline',
  },
  {
    id: 'preset-pantoprazole',
    name: 'Pantoprazole (Pan-40)',
    genericName: 'Pantoprazole Sodium',
    category: 'Acidity',
    dosage: '40mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 AM'],
    instructions: 'Empty stomach 30 mins before breakfast',
    badgeColor: '#FFF7ED',
    badgeTextColor: '#C2410C',
    iconName: 'shield-outline',
  },
  {
    id: 'preset-atorvastatin',
    name: 'Atorvastatin',
    genericName: 'Atorvastatin Calcium',
    category: 'Cholesterol',
    dosage: '10mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['08:00 PM'],
    instructions: 'At bedtime after dinner',
    badgeColor: '#F5F3FF',
    badgeTextColor: '#6D28D9',
    iconName: 'pulse-outline',
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
    badgeColor: '#EFF6FF',
    badgeTextColor: '#1D4ED8',
    iconName: 'heart-outline',
  },
  {
    id: 'preset-shelcal',
    name: 'Shelcal 500',
    genericName: 'Calcium 500mg + Vit D3',
    category: 'Calcium & Bone',
    dosage: '500mg',
    route: 'oral',
    frequency: 'once_daily',
    timeSlots: ['02:00 PM'],
    instructions: 'After lunch with a glass of water',
    badgeColor: '#FEF3C7',
    badgeTextColor: '#B45309',
    iconName: 'body-outline',
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
    badgeColor: '#FEE2E2',
    badgeTextColor: '#B91C1C',
    iconName: 'medkit-outline',
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
    instructions: 'When needed for fever or pain (SOS)',
    badgeColor: '#FEF2F2',
    badgeTextColor: '#DC2626',
    iconName: 'thermometer-outline',
  },
];

