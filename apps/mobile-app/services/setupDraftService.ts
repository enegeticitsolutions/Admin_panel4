import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETUP_DRAFT_KEY = '@mhn_add_beneficiary_draft';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SetupDraft {
  updatedAt: number;
  step: 'subscriber' | 'beneficiary' | 'medical' | 'emergency' | 'schedule';
  packageId?: string;
  isLinkingFlow?: boolean;
  subscriberData?: {
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    [key: string]: any;
  };
  beneficiaryData?: {
    name?: string;
    phone?: string;
    gender?: string;
    dob?: string;
    age?: string;
    relationship?: string;
    bloodGroup?: string;
    maritalStatus?: string;
    pincode?: string;
    address?: string;
    flatPlot?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    state?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    photoUri?: string | null;
    [key: string]: any;
  };

  medicalData?: {
    physicianName?: string;
    physicianPhone?: string;
    hospital?: string;
    insuranceProvider?: string;
    policyNumber?: string;
    selectedConditions?: string[];
    otherCondition?: string;
    selectedAllergies?: string[];
    selectedMobility?: string[];
    hobbies?: string[];
    dietaryRestrictions?: string[];
    [key: string]: any;
  };
  emergencyContacts?: Array<{
    name: string;
    phone: string;
    relationship: string;
    address?: string;
    isPrimary?: boolean;
    notifyOnVisit?: boolean;
    notifyOnEmergency?: boolean;
  }>;
  preferencesData?: {
    preferredTiming?: string;
    preferredDays?: string[];
    specialInstructions?: string;
    [key: string]: any;
  };
}

/**
 * Persists partial setup draft data to AsyncStorage with a refreshed updatedAt timestamp.
 */
export async function saveSetupDraft(partialDraft: Partial<SetupDraft>): Promise<void> {
  try {
    const existing = await getSetupDraft();
    const merged: SetupDraft = {
      ...(existing || { step: 'beneficiary', updatedAt: Date.now() }),
      ...partialDraft,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('[setupDraftService] Error saving draft:', error);
  }
}

/**
 * Retrieves the currently saved setup draft if not expired (within 7 days).
 */
export async function getSetupDraft(): Promise<SetupDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(SETUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed: SetupDraft = JSON.parse(raw);
    if (!parsed || !parsed.updatedAt) return null;

    // Check expiration (7 days)
    if (Date.now() - parsed.updatedAt > DRAFT_MAX_AGE_MS) {
      await clearSetupDraft();
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('[setupDraftService] Error reading draft:', error);
    return null;
  }
}

/**
 * Clears the active setup draft upon successful submission or user discard.
 */
export async function clearSetupDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SETUP_DRAFT_KEY);
  } catch (error) {
    console.error('[setupDraftService] Error clearing draft:', error);
  }
}

/**
 * Checks if there is a non-empty, actionable draft to resume.
 */
export async function hasValidDraft(): Promise<boolean> {
  const draft = await getSetupDraft();
  return Boolean(
    draft &&
    (draft.beneficiaryData?.name ||
      draft.medicalData?.physicianName ||
      draft.emergencyContacts?.length ||
      draft.subscriberData?.fullName)
  );
}
