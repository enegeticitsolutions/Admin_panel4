/**
 * MaiHoonNa Senior Care Operations Portal - Mock Data
 * This file contains mock data for development and testing
 * Replace these with actual API calls when integrating with a backend
 */

import type {
  User,
  Zone,
  OperationsManager,
  CareCompanion,
  Subscriber,
  Beneficiary,
  SupportTicket,
  ActivityLog,
  Partner,
  Volunteer,
  Benefit,
  SubscriptionPackage,
  VisitBlock,
  StaffOnboardingMetadata,
} from '../types';

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const mockUsers: User[] = [
  {
    id: 'U001',
    name: 'Rajesh Kumar',
    phone: '+91-9876543210',
    email: 'rajesh@maihonna.com',
    role: 'master_admin',
    permissions: [],
    isActive: true,
    biometricEnabled: true,
    createdAt: '2024-01-15',
    lastLoginAt: '2026-03-11T09:30:00',
  },
  {
    id: 'U002',
    name: 'Priya Sharma',
    phone: '+91-9876543211',
    email: 'priya@maihonna.com',
    role: 'operations_manager',
    permissions: [],
    isActive: true,
    biometricEnabled: false,
    createdAt: '2024-02-01',
    lastLoginAt: '2026-03-11T08:15:00',
  },
  {
    id: 'U003',
    name: 'Amit Verma',
    phone: '+91-9876543212',
    email: 'amit@maihonna.com',
    role: 'field_manager',
    permissions: [],
    isActive: true,
    biometricEnabled: true,
    createdAt: '2024-02-15',
    lastLoginAt: '2026-03-10T18:45:00',
  },
];

// ============================================================================
// ZONES
// ============================================================================

export const mockZones: Zone[] = [
  {
    id: 'Z001',
    name: 'Indiranagar Nodal Center',
    address: '123, 100 Feet Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560038',
    coordinates: { latitude: 12.9716, longitude: 77.5946 },
    leaseStartDate: '2024-01-01',
    leaseEndDate: '2026-12-31',
    operationsManagerId: 'OM001',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'Z002',
    name: 'Koramangala Nodal Center',
    address: '456, 5th Block',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560095',
    coordinates: { latitude: 12.9352, longitude: 77.6245 },
    leaseStartDate: '2024-02-01',
    leaseEndDate: '2027-01-31',
    operationsManagerId: 'OM001',
    isActive: true,
    createdAt: '2024-02-01',
  },
  {
    id: 'Z003',
    name: 'Whitefield Nodal Center',
    address: '789, ITPL Main Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560066',
    coordinates: { latitude: 12.9698, longitude: 77.7500 },
    leaseStartDate: '2024-03-01',
    leaseEndDate: '2027-02-28',
    operationsManagerId: 'OM002',
    isActive: true,
    createdAt: '2024-03-01',
  },
];

// ============================================================================
// OPERATIONS MANAGERS
// ============================================================================

export const mockOperationsManagers: OperationsManager[] = [
  {
    id: 'OM001',
    name: 'Suresh Reddy',
    phone: '+91-9876543220',
    email: 'suresh@maihonna.com',
    assignedZones: ['Z001', 'Z002'],
    performanceMetrics: {
      subscriberCount: 45,
      beneficiaryCount: 68,
      activeVisitsThisMonth: 156,
      completionRate: 94.5,
    },
    isActive: true,
    joinedDate: '2024-01-15',
  },
  {
    id: 'OM002',
    name: 'Lakshmi Iyer',
    phone: '+91-9876543221',
    email: 'lakshmi@maihonna.com',
    assignedZones: ['Z003'],
    performanceMetrics: {
      subscriberCount: 32,
      beneficiaryCount: 48,
      activeVisitsThisMonth: 112,
      completionRate: 96.2,
    },
    isActive: true,
    joinedDate: '2024-03-01',
  },
];

// ============================================================================
// CARE COMPANIONS
// ============================================================================

export const mockCareCompanions: CareCompanion[] = [
  {
    id: 'CC001',
    name: 'Anita Devi',
    phone: '+91-9876543230',
    email: 'anita@maihonna.com',
    zoneId: 'Z001',
    backgroundVerification: {
      aadhaarNumber: '1234-5678-9012',
      aadhaarVerified: true,
      policeVerificationStatus: 'verified',
      medicalCheckupDate: '2024-01-10',
      medicalCheckupStatus: 'completed',
    },
    utilization: 78,
    skills: ['Nursing', 'Elderly Care', 'Physiotherapy'],
    isActive: true,
    joinedDate: '2024-01-20',
  },
  {
    id: 'CC002',
    name: 'Ramesh Kumar',
    phone: '+91-9876543231',
    email: 'ramesh@maihonna.com',
    zoneId: 'Z001',
    backgroundVerification: {
      aadhaarNumber: '2345-6789-0123',
      aadhaarVerified: true,
      policeVerificationStatus: 'verified',
      medicalCheckupDate: '2024-01-15',
      medicalCheckupStatus: 'completed',
    },
    utilization: 92,
    skills: ['Nursing', 'Emergency Care'],
    isActive: true,
    joinedDate: '2024-01-25',
  },
  {
    id: 'CC003',
    name: 'Meena Sharma',
    phone: '+91-9876543232',
    zoneId: 'Z002',
    backgroundVerification: {
      aadhaarNumber: '3456-7890-1234',
      aadhaarVerified: true,
      policeVerificationStatus: 'pending',
      medicalCheckupStatus: 'pending',
    },
    utilization: 65,
    skills: ['Elderly Care', 'Companionship'],
    isActive: true,
    joinedDate: '2024-02-10',
  },
  {
    id: 'CC004',
    name: 'Vijay Singh',
    phone: '+91-9876543233',
    zoneId: 'Z003',
    backgroundVerification: {
      aadhaarNumber: '4567-8901-2345',
      aadhaarVerified: true,
      policeVerificationStatus: 'verified',
      medicalCheckupDate: '2024-03-05',
      medicalCheckupStatus: 'completed',
    },
    utilization: 85,
    skills: ['Physiotherapy', 'Rehabilitation'],
    isActive: true,
    joinedDate: '2024-03-10',
  },
];

// ============================================================================
// SUBSCRIBERS
// ============================================================================

export const mockSubscribers: Subscriber[] = [
  {
    id: 'SUB001',
    name: 'Mr. Ramakrishnan',
    phone: '+91-9876543240',
    email: 'ramakrishnan@gmail.com',
    address: '12, MG Road, Indiranagar, Bangalore',
    zoneId: 'Z001',
    subscriptionId: 'PKG001',
    beneficiaryIds: ['BEN001', 'BEN002'],
    isActive: true,
    createdAt: '2024-02-01',
  },
  {
    id: 'SUB002',
    name: 'Mrs. Kavita Menon',
    phone: '+91-9876543241',
    email: 'kavita@gmail.com',
    address: '45, 4th Cross, Koramangala, Bangalore',
    zoneId: 'Z002',
    subscriptionId: 'PKG002',
    beneficiaryIds: ['BEN003'],
    isActive: true,
    createdAt: '2024-02-15',
  },
  {
    id: 'SUB003',
    name: 'Dr. Ashok Patel',
    phone: '+91-9876543242',
    email: 'ashok@gmail.com',
    address: '78, Whitefield Main Road, Bangalore',
    zoneId: 'Z003',
    subscriptionId: 'PKG001',
    beneficiaryIds: ['BEN004'],
    isActive: true,
    createdAt: '2024-03-01',
  },
];

// ============================================================================
// BENEFICIARIES
// ============================================================================

export const mockBeneficiaries: Beneficiary[] = [
  {
    id: 'BEN001',
    name: 'Mrs. Lakshmi Ramakrishnan',
    age: 78,
    gender: 'female',
    subscriberId: 'SUB001',
    medicalHistory: ['Hypertension', 'Diabetes Type 2', 'Arthritis'],
    clinicalConfiguration: {
      bloodPressure: { enabled: true, frequency: 'daily', alertThresholds: { min: 90, max: 140 } },
      spO2: { enabled: true, frequency: 'daily', alertThresholds: { min: 92 } },
      temperature: { enabled: true, frequency: 'daily', alertThresholds: { min: 97, max: 99 } },
      heartRate: { enabled: true, frequency: 'daily', alertThresholds: { min: 60, max: 100 } },
      bloodSugar: { enabled: true, frequency: 'daily', alertThresholds: { min: 80, max: 140 } },
      weight: { enabled: false, frequency: 'weekly' },
    },
    emergencyContact: {
      name: 'Mr. Ramakrishnan',
      phone: '+91-9876543240',
      relation: 'Husband',
    },
    isActive: true,
    createdAt: '2024-02-01',
  },
  {
    id: 'BEN002',
    name: 'Mr. Ramakrishnan Sr.',
    age: 82,
    gender: 'male',
    subscriberId: 'SUB001',
    medicalHistory: ['Heart Disease', 'High Cholesterol'],
    clinicalConfiguration: {
      bloodPressure: { enabled: true, frequency: 'daily', alertThresholds: { min: 90, max: 130 } },
      spO2: { enabled: true, frequency: 'daily', alertThresholds: { min: 90 } },
      temperature: { enabled: false, frequency: 'weekly' },
      heartRate: { enabled: true, frequency: 'daily', alertThresholds: { min: 55, max: 95 } },
      bloodSugar: { enabled: false, frequency: 'weekly' },
      weight: { enabled: true, frequency: 'weekly' },
    },
    emergencyContact: {
      name: 'Ramakrishnan Jr.',
      phone: '+91-9876543240',
      relation: 'Son',
    },
    isActive: true,
    createdAt: '2024-02-01',
  },
  {
    id: 'BEN003',
    name: 'Mr. Ravi Menon',
    age: 75,
    gender: 'male',
    subscriberId: 'SUB002',
    medicalHistory: ['Diabetes', 'Kidney Disease'],
    clinicalConfiguration: {
      bloodPressure: { enabled: true, frequency: 'daily', alertThresholds: { min: 90, max: 135 } },
      spO2: { enabled: true, frequency: 'daily', alertThresholds: { min: 92 } },
      temperature: { enabled: true, frequency: 'daily', alertThresholds: { min: 97, max: 99 } },
      heartRate: { enabled: true, frequency: 'daily', alertThresholds: { min: 60, max: 100 } },
      bloodSugar: { enabled: true, frequency: 'daily', alertThresholds: { min: 80, max: 130 } },
      weight: { enabled: true, frequency: 'weekly' },
    },
    emergencyContact: {
      name: 'Mrs. Kavita Menon',
      phone: '+91-9876543241',
      relation: 'Wife',
    },
    isActive: true,
    createdAt: '2024-02-15',
  },
  {
    id: 'BEN004',
    name: 'Mrs. Sudha Patel',
    age: 72,
    gender: 'female',
    subscriberId: 'SUB003',
    medicalHistory: ['Osteoporosis', 'Mild Dementia'],
    clinicalConfiguration: {
      bloodPressure: { enabled: true, frequency: 'daily', alertThresholds: { min: 90, max: 140 } },
      spO2: { enabled: false, frequency: 'weekly' },
      temperature: { enabled: true, frequency: 'daily', alertThresholds: { min: 97, max: 99 } },
      heartRate: { enabled: false, frequency: 'weekly' },
      bloodSugar: { enabled: false, frequency: 'weekly' },
      weight: { enabled: true, frequency: 'monthly' },
    },
    emergencyContact: {
      name: 'Dr. Ashok Patel',
      phone: '+91-9876543242',
      relation: 'Husband',
    },
    isActive: true,
    createdAt: '2024-03-01',
  },
];

// ============================================================================
// VISIT BLOCKS / SCHEDULE
// ============================================================================

export const mockTodayVisits: VisitBlock[] = [
  {
    id: 'V001',
    beneficiaryId: 'BEN001',
    beneficiaryName: 'Mrs. Lakshmi Ramakrishnan',
    careCompanionId: 'CC001',
    timeSlot: 'morning',
    startTime: '08:00',
    endTime: '09:00',
    visitType: 'Nursing Care',
    status: 'completed',
  },
  {
    id: 'V002',
    beneficiaryId: 'BEN002',
    beneficiaryName: 'Mr. Ramakrishnan Sr.',
    careCompanionId: 'CC001',
    timeSlot: 'morning',
    startTime: '09:30',
    endTime: '10:30',
    visitType: 'Health Monitoring',
    status: 'completed',
  },
  {
    id: 'V003',
    beneficiaryId: 'BEN003',
    beneficiaryName: 'Mr. Ravi Menon',
    careCompanionId: 'CC002',
    timeSlot: 'afternoon',
    startTime: '14:00',
    endTime: '15:00',
    visitType: 'Physiotherapy',
    status: 'in_progress',
  },
  {
    id: 'V004',
    beneficiaryId: 'BEN004',
    beneficiaryName: 'Mrs. Sudha Patel',
    careCompanionId: 'CC004',
    timeSlot: 'evening',
    startTime: '17:00',
    endTime: '18:00',
    visitType: 'Companionship',
    status: 'scheduled',
  },
];

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export const mockSupportTickets: SupportTicket[] = [
  {
    id: 'TKT001',
    title: 'Unable to mark visit as completed',
    description: 'The mobile app is not allowing me to mark today\'s morning visit as completed.',
    reportedBy: 'Anita Devi',
    reporterRole: 'care_companion',
    assignedTo: 'Support Team Lead',
    priority: 'high',
    status: 'in_progress',
    category: 'Technical',
    createdAt: '2026-03-11T09:15:00',
    updatedAt: '2026-03-11T09:45:00',
  },
  {
    id: 'TKT002',
    title: 'Subscriber payment issue',
    description: 'Subscriber Mr. Ramakrishnan reports that auto-debit failed this month.',
    reportedBy: 'Suresh Reddy',
    reporterRole: 'operations_manager',
    assignedTo: 'Finance Team',
    priority: 'medium',
    status: 'open',
    category: 'Billing',
    createdAt: '2026-03-10T14:30:00',
    updatedAt: '2026-03-10T14:30:00',
  },
  {
    id: 'TKT003',
    title: 'Request for additional training',
    description: 'Need training on new vitals monitoring device.',
    reportedBy: 'Meena Sharma',
    reporterRole: 'care_companion',
    priority: 'low',
    status: 'open',
    category: 'Training',
    createdAt: '2026-03-09T11:20:00',
    updatedAt: '2026-03-09T11:20:00',
  },
  {
    id: 'TKT004',
    title: 'Beneficiary requested schedule change',
    description: 'Mrs. Lakshmi prefers evening visits instead of morning.',
    reportedBy: 'Amit Verma',
    reporterRole: 'field_manager',
    assignedTo: 'Scheduling Team',
    priority: 'medium',
    status: 'resolved',
    category: 'Scheduling',
    createdAt: '2026-03-08T16:00:00',
    updatedAt: '2026-03-09T10:00:00',
    resolvedAt: '2026-03-09T10:00:00',
  },
];

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export const mockActivityLogs: ActivityLog[] = [
  {
    id: 'LOG001',
    userId: 'U001',
    userName: 'Rajesh Kumar',
    userRole: 'master_admin',
    action: 'created',
    entity: 'User',
    entityId: 'U003',
    details: 'Created new Field Manager account for Amit Verma',
    status: 'success',
    timestamp: '2026-03-11T09:30:15',
    ipAddress: '192.168.1.100',
  },
  {
    id: 'LOG002',
    userId: 'U002',
    userName: 'Priya Sharma',
    userRole: 'operations_manager',
    action: 'updated',
    entity: 'Zone',
    entityId: 'Z001',
    details: 'Updated lease end date for Indiranagar Nodal Center',
    status: 'success',
    timestamp: '2026-03-11T08:45:22',
    ipAddress: '192.168.1.105',
  },
  {
    id: 'LOG003',
    userId: 'U003',
    userName: 'Amit Verma',
    userRole: 'field_manager',
    action: 'assigned',
    entity: 'Visit',
    entityId: 'V004',
    details: 'Assigned CC004 to evening visit for BEN004',
    status: 'success',
    timestamp: '2026-03-11T07:20:10',
    ipAddress: '192.168.1.110',
  },
  {
    id: 'LOG004',
    userId: 'CC001',
    userName: 'Anita Devi',
    userRole: 'care_companion',
    action: 'completed',
    entity: 'Visit',
    entityId: 'V001',
    details: 'Completed morning nursing visit for BEN001',
    status: 'success',
    timestamp: '2026-03-11T09:05:00',
  },
  {
    id: 'LOG005',
    userId: 'U001',
    userName: 'Rajesh Kumar',
    userRole: 'master_admin',
    action: 'logged_in',
    entity: 'System',
    entityId: 'AUTH',
    details: 'Master Admin logged in via biometric authentication',
    status: 'success',
    timestamp: '2026-03-11T09:30:00',
    ipAddress: '192.168.1.100',
  },
];

// ============================================================================
// PARTNERS
// ============================================================================

export const mockPartners: (Partial<Partner> & Record<string, any>)[] = [
  {
    id: 'PTR001',
    name: 'Apollo Pharmacy',
    type: 'pharmacy',
    phone: '+91-80-12345678',
    email: 'support@apollopharmacy.com',
    address: 'Multiple locations across Bangalore',
    contactPerson: 'Mr. Sunil Kumar',
    servicesOffered: ['Prescription Delivery', 'OTC Medicines', 'Medical Supplies'],
    isActive: true,
    onboardedDate: '2024-01-10',
  },
  {
    id: 'PTR002',
    name: 'Dr. Lal PathLabs',
    type: 'laboratory',
    phone: '+91-80-23456789',
    email: 'care@lalpathlabs.com',
    address: '456, MG Road, Bangalore',
    contactPerson: 'Dr. Meena Iyer',
    servicesOffered: ['Blood Tests', 'Home Sample Collection', 'Diagnostic Imaging'],
    isActive: true,
    onboardedDate: '2024-01-15',
  },
  {
    id: 'PTR003',
    name: 'Fortis Hospital',
    type: 'hospital',
    phone: '+91-80-34567890',
    email: 'info@fortis.com',
    address: '789, Bannerghatta Road, Bangalore',
    contactPerson: 'Dr. Rajesh Rao',
    servicesOffered: ['Emergency Services', 'Specialist Consultations', 'Ambulance'],
    isActive: true,
    onboardedDate: '2024-02-01',
  },
];

// ============================================================================
// VOLUNTEERS
// ============================================================================

export const mockVolunteers: Volunteer[] = [
  {
    id: 'VOL001',
    name: 'Arjun Nair',
    phone: '+91-9876543250',
    email: 'arjun@gmail.com',
    type: 'saathi',
    skills: ['Companionship', 'Reading', 'Light Exercise'],
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    zoneId: 'Z001',
    volunteeredHours: 45,
    isActive: true,
    joinedDate: '2024-02-20',
  },
  {
    id: 'VOL002',
    name: 'Sneha Patel',
    phone: '+91-9876543251',
    email: 'sneha@gmail.com',
    type: 'saathi',
    skills: ['Art & Craft', 'Music', 'Storytelling'],
    availableDays: ['Tuesday', 'Thursday', 'Saturday'],
    zoneId: 'Z002',
    volunteeredHours: 32,
    isActive: true,
    joinedDate: '2024-03-05',
  },
  {
    id: 'VOL003',
    name: 'Karthik Ramesh',
    phone: '+91-9876543252',
    type: 'saathi',
    skills: ['Tech Support', 'Companionship'],
    availableDays: ['Saturday', 'Sunday'],
    zoneId: 'Z003',
    volunteeredHours: 18,
    isActive: true,
    joinedDate: '2024-03-15',
  },
];

// ============================================================================
// BENEFITS LIBRARY (for Product Factory)
// ============================================================================

export const mockBenefits: Benefit[] = [
  {
    id: 'BNF001',
    name: 'Nurse Visit',
    type: 'nurse_visit',
    description: 'Professional nursing care at home including health monitoring and medication management',
    defaultUnits: 12,
    unitLabel: 'visits',
    isActive: true,
  },
  {
    id: 'BNF002',
    name: 'Physiotherapy Session',
    type: 'physiotherapy',
    description: 'Certified physiotherapist for rehabilitation and mobility exercises',
    defaultUnits: 8,
    unitLabel: 'sessions',
    isActive: true,
  },
  {
    id: 'BNF003',
    name: 'Pharmacy Delivery',
    type: 'pharmacy_delivery',
    description: 'Free medicine delivery from partner pharmacies',
    defaultUnits: 4,
    unitLabel: 'deliveries',
    isActive: true,
  },
  {
    id: 'BNF004',
    name: 'Lab Test',
    type: 'lab_test',
    description: 'Home sample collection and diagnostic tests',
    defaultUnits: 2,
    unitLabel: 'tests',
    isActive: true,
  },
  {
    id: 'BNF005',
    name: 'Doctor Consultation',
    type: 'doctor_consultation',
    description: 'Tele-consultation with specialist doctors',
    defaultUnits: 3,
    unitLabel: 'consultations',
    isActive: true,
  },
  {
    id: 'BNF006',
    name: 'Emergency Support',
    type: 'emergency_support',
    description: '24/7 emergency helpline and ambulance coordination',
    defaultUnits: 1,
    unitLabel: 'service',
    isActive: true,
  },
];

// ============================================================================
// SUBSCRIPTION PACKAGES
// ============================================================================

export const mockSubscriptionPackages: SubscriptionPackage[] = [
  {
    id: 'PKG001',
    name: 'Essential Care Package',
    duration: 12,
    benefits: [
      { benefitId: 'BNF001', monthlyUnits: 12 },
      { benefitId: 'BNF003', monthlyUnits: 4 },
      { benefitId: 'BNF006', monthlyUnits: 1 },
    ],
    totalCost: 15000,
    isActive: true,
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    createdBy: 'U001',
    createdAt: '2024-01-01',
  },
  {
    id: 'PKG002',
    name: 'Premium Care Package',
    duration: 12,
    benefits: [
      { benefitId: 'BNF001', monthlyUnits: 20 },
      { benefitId: 'BNF002', monthlyUnits: 8 },
      { benefitId: 'BNF003', monthlyUnits: 6 },
      { benefitId: 'BNF004', monthlyUnits: 2 },
      { benefitId: 'BNF005', monthlyUnits: 3 },
      { benefitId: 'BNF006', monthlyUnits: 1 },
    ],
    totalCost: 28000,
    isActive: true,
    activeFrom: '2024-01-01',
    activeTo: '2026-12-31',
    createdBy: 'U001',
    createdAt: '2024-01-01',
  },
];

// ============================================================================
// STAFF ONBOARDING METADATA
// ============================================================================

export const mockStaffOnboardingMetadata: StaffOnboardingMetadata = {
  zones: [
    { id: 'Z001', name: 'Indiranagar Nodal Center', city: 'Bangalore', state: 'Karnataka', pincode: '560038', operationsManagerId: 'OM001' },
    { id: 'Z002', name: 'Koramangala Nodal Center', city: 'Bangalore', state: 'Karnataka', pincode: '560095', operationsManagerId: 'OM001' },
    { id: 'Z003', name: 'Whitefield Nodal Center', city: 'Bangalore', state: 'Karnataka', pincode: '560066', operationsManagerId: 'OM002' },
  ],
  teams: [
    { id: 'T001', name: 'Team Alpha', zone: 'Z001', maxCapacity: 15, currentCapacity: 10, fieldManagerId: 'FM001', fieldManagerName: 'Amit Verma' },
    { id: 'T002', name: 'Team Beta', zone: 'Z002', maxCapacity: 15, currentCapacity: 5, fieldManagerId: 'FM002', fieldManagerName: 'Sunita Rao' },
  ],
  operationsManagers: [
    { 
      id: 'OM-PROFILE-001', 
      userId: 'U002', 
      name: 'Priya Sharma', 
      phone: '+91-9876543211', 
      email: 'priya@maihonna.com', 
      assignedZones: [
        { id: 'Z001', name: 'Indiranagar Nodal Center', city: 'Bangalore', pincode: '560038' },
        { id: 'Z002', name: 'Koramangala Nodal Center', city: 'Bangalore', pincode: '560095' }
      ] 
    },
  ],
  specializations: ['Nursing', 'Physiotherapy', 'Dementia Care', 'Post-Op Recovery', 'Palliative Care']
};
