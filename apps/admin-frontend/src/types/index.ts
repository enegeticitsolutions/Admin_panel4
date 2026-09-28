/**
 * MaiHoonNa Senior Care Operations Portal - Type Definitions
 * This file contains all TypeScript interfaces and types used across the application
 */

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export type UserRole = 
  | 'master_admin' 
  | 'admin'
  | 'operations_manager' 
  | 'field_manager' 
  | 'care_companion' 
  | 'emergency_coordinator'
  | 'customer_service'
  | 'customer_service_manager'
  | 'saathi_coordinator'
  | 'volunteer'
  | 'command_center';

export interface Permission {
  module: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  biometricEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// ============================================================================
// ZONE & GEOGRAPHY TYPES
// ============================================================================

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface Zone {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  coordinates: GeoCoordinates;
  leaseStartDate: string;
  leaseEndDate: string;
  operationsManagerId?: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// OPERATIONS MANAGER TYPES
// ============================================================================

export interface OperationsManager {
  id: string;
  name: string;
  phone: string;
  email: string;
  assignedZones: string[];
  performanceMetrics: {
    subscriberCount: number;
    beneficiaryCount: number;
    activeVisitsThisMonth: number;
    completionRate: number;
  };
  isActive: boolean;
  joinedDate: string;
}

// ============================================================================
// CARE COMPANION TYPES
// ============================================================================

export interface BackgroundVerification {
  aadhaarNumber: string;
  aadhaarVerified: boolean;
  policeVerificationStatus: 'pending' | 'verified' | 'rejected';
  medicalCheckupDate?: string;
  medicalCheckupStatus: 'pending' | 'completed';
}

export interface CareCompanion {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photo?: string;
  zoneId: string;
  backgroundVerification: BackgroundVerification;
  utilization: number; // Percentage: 0-100
  skills: string[];
  isActive: boolean;
  joinedDate: string;
}

// ============================================================================
// SCHEDULE & VISIT TYPES
// ============================================================================

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface VisitBlock {
  id: string;
  beneficiaryId: string;
  beneficiaryName: string;
  careCompanionId?: string;
  timeSlot: TimeSlot;
  startTime: string;
  endTime: string;
  visitType: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface DailySchedule {
  date: string;
  visits: VisitBlock[];
}

// ============================================================================
// SUBSCRIBER & BENEFICIARY TYPES
// ============================================================================

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  zoneId: string;
  subscriptionId?: string;
  beneficiaryIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface VitalConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  alertThresholds?: {
    min?: number;
    max?: number;
  };
}

export interface ClinicalConfiguration {
  bloodPressure: VitalConfig;
  spO2: VitalConfig;
  temperature: VitalConfig;
  heartRate: VitalConfig;
  bloodSugar: VitalConfig;
  weight: VitalConfig;
}

export interface Beneficiary {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  subscriberId: string;
  photo?: string;
  medicalHistory: string[];
  clinicalConfiguration: ClinicalConfiguration;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  primaryCcId?: string;
  secondaryCcId?: string;
  fieldManagerId?: string;
  isActive: boolean;
  createdAt: string;
  distance?: number;
  nearestZone?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// SUPPORT & TICKETS TYPES
// ============================================================================

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  reportedBy: string;
  reporterRole: UserRole;
  assignedTo?: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// ============================================================================
// ACTIVITY LOG TYPES
// ============================================================================

export type ActivityAction = 
  | 'created' 
  | 'updated' 
  | 'deleted' 
  | 'logged_in' 
  | 'logged_out'
  | 'assigned'
  | 'completed';

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: ActivityAction;
  entity: string;
  entityId: string;
  details: string;
  status: 'success' | 'failure';
  timestamp: string;
  ipAddress?: string;
}

// ============================================================================
// PARTNER & VOLUNTEER TYPES
// ============================================================================

export interface Partner {
  id: string;
  name: string;
  type: 'pharmacy' | 'laboratory' | 'hospital' | 'other';
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  servicesOffered: string[];
  isActive: boolean;
  onboardedDate: string;
}

export interface Volunteer {
  id: string;
  phone: string;
  email?: string | null;
  name: string;
  type?: string;
  age?: number | null;
  gender?: string | null;
  profilePhoto?: string | null;
  status?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';
  previousExperience?: string | null;
  whyJoin?: string | null;
  address?: string | null;
  flatPlot?: string | null;
  streetArea?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zoneId?: string | null;
  regionId?: string | null;
  interests?: string[];
  skills?: string[];
  availableDays?: string[];
  volunteeredHours?: number;
  joinedDate?: string;
  isActive?: boolean;
  showOnWebsite?: boolean;
  totalCreditHours?: number;
  totalCreditPoints?: number;
  monthlyGoalHours?: number;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assignments?: {
    id: string;
    volunteerId: string;
    beneficiaryId: string;
    isActive: boolean;
    beneficiary: {
      id: string;
      name: string;
    };
  }[];
}

// ============================================================================
// SUBSCRIPTION & BENEFIT TYPES (Product Factory)
// ============================================================================

export type BenefitType = 
  | 'nurse_visit' 
  | 'physiotherapy' 
  | 'pharmacy_delivery' 
  | 'lab_test'
  | 'doctor_consultation'
  | 'emergency_support';

export interface Benefit {
  id: string;
  code?: string;
  name: string;
  type?: BenefitType;
  benefitTypeId?: string;
  benefitType?: { id: string; name: string; iconCode?: string; description?: string };
  description?: string;
  defaultUnits?: number;
  unitLabel?: string; // e.g., "visits", "sessions", "deliveries"
  unitCost?: number;
  cost?: number;
  isChargeable?: boolean;
  isActive: boolean;
  isAddon?: boolean;
  addonPrice?: number;
  addonDiscountPrice?: number;
  addonIncludedUnits?: number;
  isGlobal?: boolean;
  regionIds?: string[];
  regions?: any[];
  taxCategory?: string;
  gstRate?: number;
  hsnSacCode?: string;
  isGstExempt?: boolean;
}

export interface PackageBenefit {
  benefitId: string;
  monthlyUnits?: number;
  unitsIncluded?: number;
  unitsPeriod?: 'monthly' | 'yearly' | 'one_time' | 'unlimited' | string;
  allocationBasis?: 'per_billing_cycle' | 'per_subscription_term' | 'min_tenure_required' | string;
  minSubscriptionMonths?: number;
  allowRollover?: boolean;
  maxRolloverUnits?: number;
  isUnlimited?: boolean;
  benefit?: Benefit;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  description?: string;
  benefits: PackageBenefit[];
  packageBenefits?: PackageBenefit[];
  duration?: number;
  totalCost: number;
  basePrice?: number;
  mrp?: number;
  discountPercentage?: number;
  discountThreeMonths?: number;
  discountSixMonths?: number;
  discountAnnual?: number;
  priceThreeMonths?: number;
  priceSixMonths?: number;
  priceTwelveMonths?: number;
  miscellaneousCost?: number;
  isActive: boolean;
  activeFrom: string;
  activeTo: string;
  isGlobal?: boolean;
  isPopular?: boolean;
  isCompared?: boolean;
  createdBy: string;
  createdAt: string;
  regionIds?: string[];
  regions?: any[];
}

// ============================================================================
// STAFF ONBOARDING TYPES
// ============================================================================

export type StaffOnboardingRole =
  | 'care_companion'
  | 'field_manager'
  | 'operations_manager'
  | 'customer_service'
  | 'customer_service_manager'
  | 'saathi_coordinator';

export type StaffOnboardingGender =
  | 'male'
  | 'female'
  | 'other'
  | 'prefer_not_to_say';

export type StaffShiftPreference =
  | 'any'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night';

export type StaffBackgroundCheckType =
  | 'police_clearance'
  | 'address_verification'
  | 'employment_history'
  | 'education_verification'
  | 'identity_verification'
  | 'reference_check';

export type StaffDocumentType =
  | 'aadhaar_front'
  | 'aadhaar_back'
  | 'pan_card'
  | 'nursing_certificate'
  | 'first_aid_certificate'
  | 'offer_letter'
  | 'bgv_report'
  | 'other';

export interface StaffOnboardingDocumentInput {
  documentType: StaffDocumentType;
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  notes?: string;
}

export interface StaffOnboardingZone {
  id: string;
  name: string;
  city: string;
  state: string;
  pincode: string;
  operationsManagerId?: string | null;
  regionId?: string | null;
}

export interface StaffOnboardingTeam {
  id: string;
  name: string;
  zone: string;
  maxCapacity: number;
  currentCapacity: number;
  fieldManagerId: string;
  fieldManagerName: string;
}

export interface StaffOnboardingOperationsManager {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string | null;
  assignedZones: Array<{
    id: string;
    name: string;
    city: string;
    pincode: string;
  }>;
}

export interface StaffOnboardingMetadata {
  zones: StaffOnboardingZone[];
  teams: StaffOnboardingTeam[];
  operationsManagers: StaffOnboardingOperationsManager[];
  specializations: string[];
}

export interface StaffOnboardingPayload {
  role: StaffOnboardingRole;
  personal: {
    fullName: string;
    preferredName?: string;
    dateOfBirth?: string;
    gender: StaffOnboardingGender;
    mobileNumber: string;
    whatsappNumber?: string;
    email?: string;
    alternatePhone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    aadhaarNumber: string;
    panNumber?: string;
    photoUrl?: string;
    newPassword?: string;
  };
  professional: {
    qualification: string;
    bio?: string;
    experience?: number | string;
    nursingRegistrationNumber?: string;
    nursingCouncil?: string;
    previousEmployer?: string;
    maxTeamSize?: number | string;
    languages?: string[];
    specialization?: string[];
    preferredShift?: StaffShiftPreference;
    maxDailyVisits?: number | string;
    willingClinicVisits?: boolean;
    hasTwoWheeler?: boolean;
    canApproveRoster?: boolean;
    canOnboardCCs?: boolean;
    ccType?: string;
  };
  assignment: {
    zoneId?: string;
    zoneIds?: string[];
    teamId?: string;
    reportsToUserId?: string;
    bgvType?: StaffBackgroundCheckType;
    bgvAgency?: string;
    bgvVerified?: boolean;
    kycVerified?: boolean;
  };
  documents: StaffOnboardingDocumentInput[];
}

// ============================================================================
// CALLBACK REQUEST TYPES
// ============================================================================

export interface CallbackRequest {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'called' | 'resolved';
  notes: string | null;
  subscriberId: string | null;
  beneficiaryId: string | null;
  createdAt: string;
  updatedAt: string;
}

