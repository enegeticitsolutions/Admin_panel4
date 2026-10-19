export interface SoapContext {
  beneficiaryName: string;
  beneficiaryAge?: number | null;
  beneficiaryGender?: string | null;
  segment?: string; // S1 to S6
  knownConditions?: string[];
  allergies?: string[];
  scheduledMedicines?: string[];
  previousVisitFlags?: string;
  rawNotes: string;
  mood?: string;
  vitalsList?: Array<{ name: string; value: string | number; unit?: string }>;
  medicationsList?: Array<{ name: string; taken: boolean; scheduledTime?: string }>;
}

export type EscalationLevel =
  | 'None'
  | 'Inform Field Manager (24 h)'
  | 'Care Manager review (same day)'
  | 'ERC now';

export interface SoapResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  overallStatus: 'Stable' | 'Improved' | 'Needs attention' | 'Urgent';
  escalationLevel: EscalationLevel;
  escalationReasons: string[];
  familyConnectSummary: string;
  followUpPrompts: string[];
  formattedNotes: string;
  aiModelId: string;
  generatedAt: string;
}

export interface IAiService {
  transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string>;
  generateSoapSummary(context: SoapContext): Promise<SoapResult>;
}
