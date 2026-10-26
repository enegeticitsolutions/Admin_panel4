# MaiHooNa Senior Care: Google Gemini Multimodal AI Clinical Documentation & Voice Dictation Specification

**Document Reference:** `MHN-TPL-SOAP-001` (Care Companion Visit Note — SOAP Standard)  
**Feature Code:** `FEAT-VOICE-SOAP-AI`  
**Target Modules:** `apps/api`, `apps/mobile-app`, `apps/admin-backend`, `apps/admin-frontend`, `packages/database`  
**Status:** Production Ready (Committed Mon Oct 19 & Wed Oct 21, 2026)  

---

## 1. Executive Summary & Clinical Objectives
MaiHooNa Care Companions (Mitras) conduct routine and specialized home visits to senior citizens across India. During these encounters, companions perform physiological vital checks (Blood Pressure, SpO2, Pulse, Blood Glucose, Temperature), verify medication adherence, and observe cognitive, emotional, and mobility cues.

Typing lengthy observation notes on mobile devices while caring for an elder is distracting and creates significant cognitive overhead. To solve this, we designed and built an end-to-end Voice AI & Clinical SOAP Intelligence pipeline powered by Google Gemini Multimodal APIs.

### Key Capabilities Developed:
1. **Hands-Free Voice Dictation:** Companions speak naturally in English, Hindi, or Hinglish with Indian accents.
2. **Gemini Multimodal Audio Transcription:** Direct audio-stream-to-text processing using Gemini Flash without requiring intermediate third-party STT engines.
3. **Single-Tap SOAP Structuring (`MHN-TPL-SOAP-001`):** Converts raw notes, session vitals, medication statuses, and mood indicators into a standardized Subjective, Objective, Assessment, Plan (SOAP) clinical record.
4. **Dual-Presentation Split:** Generates two synchronized views: a rigorous clinical SOAP report for Field Managers and Operations Managers, and a warm, reassuring 'Family Connect' plain-language summary for the elder's family.
5. **Deterministic Hybrid Red-Flag Escalation Engine:** Independent pure-code validation layer that detects clinical emergencies (BP crisis, hypoxia, hypoglycemia, fever, emergency keywords) and forces immediate emergency escalation.
6. **Strict 'No-Diagnosis' Clinical Guardrail:** Enforces non-clinical boundaries: the AI and Mitra compare observations against baseline (e.g. 'BP above her usual 125/80') but are strictly forbidden from asserting unconfirmed medical diagnoses.

---

## 2. System Architecture & End-to-End Workflows
The architecture adheres strictly to Senior Backend Engineering Principles: high cohesion, low coupling, decoupled AI provider interfaces (Rule 20), multi-model resilience cascade, deterministic safety rules, and transactional audit trails.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             Care Companion Mobile App (React Native / Expo)            │
│                                                                                        │
│  [🎙️ VoiceNotesRecorder] (expo-av) ──(Audio: m4a/aac/wav, max 15MB)──────────────────┐  │
│  [📝 Notes Input Box]    <──(Transcribed Raw Text Editable by Mitra)──────────────────┼──┤
│  [✨ AI Summarise Button] ──(Payload: rawNotes + vitalsList + medsList + mood)────────┼──┤
│  [📋 SoapReviewModal]    <──(SOAP Structure + Red-Flag Flags + Follow-Up Prompts)─────┼──┤
│  [✅ Confirm & Save]     ──(Verified Encounter Payload to Checkout/Save API)──────────┼──┤
└───────────────────────────────────────────────────────────────────────────────────────┼──┘
                                                                                        │
                                       REST (JWT Auth)                                  │
                                                                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Backend API (apps/api - Node/Express/TS)             │
│                                                                                        │
│  Endpoints:                                                                            │
│  • POST /care-companion/visits/:visitId/ai/transcribe-voice (Multer memory upload)    │
│  • POST /care-companion/visits/:visitId/ai/summarize-soap   (Context assembly + LLM)  │
│                                                                                        │
│  Architecture Layers:                                                                 │
│  1. Routes & Controller (visit-ai.routes.ts) ──> Access Verification (Care Companion)  │
│  2. Decoupled Interface (IAiService.ts)      ──> Provider Inversion (Rule 20)          │
│  3. Adapter (GeminiAiAdapter.ts)             ──> Model Fallback Cascade & Timeout      │
│  4. Rules Engine (soap_rules_engine.ts)      ──> Independent Deterministic Safeguard   │
│  5. Context Assembler                        ──> Beneficiary profile, conditions, meds │
└───────────────────────────────────────────────────────────────────────────────────────┼──┘
                                                                                        │
                                       HTTPS POST (Google Gemini API)                   │
                                                                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Google Gemini 1.5 / 2.0 Flash AI Services                 │
│                                                                                        │
│  Task 1: Multimodal Audio Transcription                                                │
│  • Direct Base64 Audio processing (inlineData: audio/m4a)                              │
│  • Indian accent adaptation, medical terminology retention, Hinglish translation      │
│                                                                                        │
│  Task 2: Clinical SOAP Structuring according to MHN-TPL-SOAP-001                       │
│  • S (Subjective) - Verbatim quotes in '...', complaints, sleep, appetite, adherence   │
│  • O (Objective)  - Actual measurements, vitals, observed vs self-reported meds       │
│  • A (Assessment) - Baseline status vs targets, zero unconfirmed diagnoses             │
│  • P (Plan)       - Follow-up with owners & due dates, warm Family Connect update      │
│  • Follow-Up Prompts - Up to 3 concise missing clinical data questions                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Multi-Model Fallback Cascade & Circuit-Breaker
To eliminate HTTP 503 Service Unavailable errors and handle quota exhaustion seamlessly, `GeminiAiAdapter` utilizes a priority-based multi-model cascade:

| Priority | Gemini Model | Operational Role |
| :--- | :--- | :--- |
| **1. Primary** | `gemini-flash-lite-latest` | Default high-speed model with sub-second latency for real-time mobile UX. |
| **2. Backup A** | `gemini-3.5-flash-lite` | Secondary lightweight flash model triggered on 503 high load or 429 quota exhaustion. |
| **3. Backup B** | `gemini-3.5-flash` | High-reasoning flash tier capable of complex multimorbid patient structuring. |
| **4. Backup C** | `gemini-flash-latest` | Standard production fallback ensuring zero breaking deprecation gaps. |
| **5. Guardrail** | `AbortSignal.timeout(25000)` | 25-30 second strict request cancellation preventing battery drain or locked UI on spotty networks. |

---

## 3. Information Sent (Context Assembly & Prompts)
### 3.1 Pre-Flight Clinical Context Aggregation
Before invoking the LLM, the backend queries the database and compiles a comprehensive physiological and pharmacological context:
- **Beneficiary Profile:** Name, Age, Gender, and Segment (`S1` to `S6`, e.g., Saathi Plus).
- **Known Conditions & Allergies:** Active profile entries (e.g. Type 2 Diabetes, Hypertension, Penicillin allergy).
- **Scheduled Medicines for Current Slot:** Prescribed medicines from active Care Plan (e.g. Metformin 500mg, Amlodipine 5mg OD).
- **Historical Carry-Forward Flags:** Critical observations from the last visit (e.g. *'Mild knee pain reported 16 Oct'*).
- **Current Session Recorded Vitals Matrix:** BP, Pulse, SpO2, Blood Glucose, Temperature, Weight.
- **Medication Administration Status:** Observed taking vs Self-reported vs Missed vs Refused.
- **Subjective Mood Selection:** Cheerful, Calm, Anxious, Withdrawn, Distressed.
- **Raw Spoken Observation:** Verbatim text transcribed from voice dictation.

### 3.2 System Prompt Specification (`MHN-TPL-SOAP-001`)
The model is invoked with `temperature: 0.2` and `responseMimeType: 'application/json'` to enforce deterministic structure.

---

## 4. Data Receiving, Schema & Dual-Channel Distribution
### 4.1 Output JSON Schema
```json
{
  "subjective": "string",          // Verbatim quotes in \"...\", mood, sleep, appetite, complaints\n  "objective": "string",           // Measured vitals with units, observed vs self-reported meds\n  "assessment": "string",          // Status vs baseline, zero medical diagnoses allowed\n  "plan": "string",                // Follow-up actions with owner + due date, next visit items\n  "overallStatus": "Stable" | "Improved" | "Needs attention" | "Urgent",\n  "escalationLevel": "None" | "Inform Field Manager (24 h)" | "Care Manager review (same day)" | "ERC now",\n  "escalationReasons": ["string"], // Array of triggering symptoms or clinical reasons\n  "familyConnectSummary": "string",// Warm, plain-language summary for family app without jargon\n  "followUpPrompts": ["string"]    // Up to 3 missing data clarification questions\n}
```

### 4.2 Dual-Channel Presentation Split
| Dimension | Channel A: Clinical SOAP (Staff & Admin) | Channel B: Family Connect (Subscribers) |
| :--- | :--- | :--- |
| **Audience** | Care Companions, Field Managers, Operations Managers, Clinical Teams. | Elder's children, family members, subscribers. |
| **Tone** | Formal clinical standard (`MHN-TPL-SOAP-001`), metrics, abbreviations. | Warm, reassuring, empathetic, zero clinical jargon. |
| **Storage Field** | `Visit.notes` and `Visit.soapNotes` | `Visit.visitSummary` |
| **Access Point** | Admin Panel Visit Details Modal, Ops Worklist | Subscriber Mobile App (Interactions Timeline) |

---

## 5. Clinical Safety Constraints & Deterministic Rules Engine
### 5.1 Strict Zero-Diagnosis Policy
> ⚠️ **CRITICAL CLINICAL SAFETY RULE:** Care Companions are non-clinical welfare partners. The model is strictly prohibited from inferring or producing new medical diagnoses (e.g. 'Osteoarthritis flare-up', 'Uncontrolled hypertension'). It must only compare observations to baseline (e.g. 'BP 136/84 is higher than her usual baseline of 125/80').

### 5.2 Anti-Hallucination & 'Not Recorded' Standard
Any parameter defined in the clinical template that was neither mentioned in the spoken audio nor entered in the vitals matrix must be explicitly set to `'Not recorded'`. Extrapolating or assuming values is strictly prohibited.

### 5.3 Deterministic Red-Flag Rules Engine (`soap_rules_engine.ts`)
| Clinical Parameter | Threshold / Condition | Automated Escalation Level |
| :--- | :--- | :--- |
| **Hypertensive Crisis** | Systolic $\ge 180$ or $\le 90$; Diastolic $\ge 110$ or $\le 60$ mmHg | 🚨 **ERC now** (Emergency Response Center) |
| **Sustained High BP** | $140–179$ mmHg systolic on consecutive visits | ⚠️ **Care Manager review (same day)** |
| **Critical Hypoxia** | $\text{SpO}_2 < 92\%$ | 🚨 **ERC now** |
| **Borderline Low Oxygen** | $\text{SpO}_2 \le 94\%$ | ⚠️ **Care Manager review (same day)** |
| **Blood Glucose Crisis** | $<70$ mg/dL (hypoglycemia) or $>300$ mg/dL (hyperglycemia) | 🚨 **ERC now** |
| **Abnormal Pulse** | Resting pulse $<50$ bpm or $>110$ bpm | ⚠️ **Care Manager review (same day)** |
| **High Fever** | Body temperature $\ge 100.4^\circ\text{F}$ | ⚠️ **Care Manager review (same day)** |
| **Emergency Keywords** | *'chest pain'*, *'breathless'*, *'fell'*, *'unconscious'*, *'confused'*, *'slurred speech'*, *'bleeding'* | 🚨 **ERC now** |
| **Recurring Complaint** | Same complaint (e.g. knee pain) reported in previous visit flags | 📋 **Inform Field Manager (24 h)** |

> **Safety Gate:** The highest severity level between the deterministic rule engine and the LLM always prevails. Any note triggering an `ERC now` alert cannot be saved without visual acknowledgement from the Mitra.

---

## 6. End-to-End Worked Real-World Example
**Input Spoken by Mitra:**  
> *"Mrs. Sharma was in good spirits today, BP was 136 over 84, took her metformin and amlodipine, complained of mild knee pain, and we walked 10 minutes in the garden together."*

**AI Generated Clinical SOAP Output:**
- **S — Subjective:** Beneficiary in good spirits (`"feeling good today"`). Reports mild knee pain; side, onset, and severity score (0-10) *not recorded*. Self-reports taking morning medicines. Sleep, appetite, toilet habits, and social contact: *not recorded*.
- **O — Objective:** BP 136/84 mmHg (seated, left arm). Metformin and Amlodipine taken — observed vs self-reported *not recorded*. Walked 10 minutes in the garden; aid and gait *not recorded*. SpO2, pulse, and temperature: *not recorded*.
- **A — Assessment:** Overall Status: `Stable`. BP is above her usual baseline (target <130/80, out of range). Medicine adherence: full for morning slot. Knee pain: 2nd report since 16 Oct, did not prevent walking. Risk flags: possible fall risk if knee pain worsens. *(Zero clinical diagnoses)*.
- **P — Plan:**  
  1. Recheck BP at next visit, seated after 5 min rest (Owner: Mitra · Next Visit).  
  2. Ask knee pain score (0-10) and side at next visit (Owner: Mitra · Next Visit).  
  3. Inform Field Manager within 24h of repeat knee pain; suggest physio assessment (Owner: Mitra · Due: 24h).  
- **Escalation Level:** `Inform Field Manager (24 h)` (Triggered by recurring knee pain flag).
- **Family Connect Update:** *"Mrs. Sharma was cheerful today, took her morning medicines, and enjoyed a short walk in the garden. She mentioned mild knee pain, and our team will keep a close eye on it during future visits."*
- **Clarification Prompts:**  
  1. *"Which knee has pain, and what is the severity on a scale of 0 to 10?"*  
  2. *"Did you personally observe her taking the medicines, or did she self-report?"*  
  3. *"How was her sleep quality over the previous night?"*

---

## 7. Complete Source Code Repository (Review Annex)
Below is the complete, unmodified source code for all components created for this feature.

### 1. AI Service Interface & TypeScript Contracts
**File Location:** `apps/api/app/services/ai/IAiService.ts`  
**Module Responsibility:** Defines strict TypeScript contracts for SoapContext (pre-flight payload), SoapResult (structured clinical output), EscalationLevel union, and the IAiService decoupled provider interface (Rule 20).

```typescript
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

```

---

### 2. Gemini Multimodal AI Adapter & Fallback Cascade
**File Location:** `apps/api/app/services/ai/GeminiAiAdapter.ts`  
**Module Responsibility:** Implements Gemini Multimodal audio ingestion, 4-tier model fallback cascade (gemini-flash-lite-latest -> 3.5-flash-lite -> 3.5-flash -> flash-latest), timeout circuit-breaker, temperature 0.2 prompt configuration, and JSON parsing.

```typescript
import { config } from '../../core/config';
import { IAiService, SoapContext, SoapResult, EscalationLevel } from './IAiService';
import { evaluateRedFlags } from '../care_companion/soap_rules_engine';

export class GeminiAiAdapter implements IAiService {
  private apiKey: string;
  private configuredModel: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.gemini.apiKey;
    this.configuredModel = config.gemini.model || 'gemini-flash-lite-latest';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Returns a prioritized list of Gemini models to attempt.
   * If the primary model encounters high demand (HTTP 503), quota limits (429),
   * deprecation (404), or timeout, the adapter cascades to backup models.
   */
  private getCandidateModels(): string[] {
    const list = [
      this.configuredModel,
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];
    return list.filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);
  }

  /**
   * Helper method to call Gemini generateContent with automatic fallback across models.
   */
  private async callGemini(
    requestBody: any,
    timeoutMs = 25000
  ): Promise<{ data: any; usedModel: string }> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const candidateModels = this.getCandidateModels();
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      const endpoint = `${this.baseUrl}/models/${model}:generateContent`;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(
            `⚠️ [GeminiAiAdapter] Model "${model}" responded with HTTP ${response.status}: ${errText.slice(0, 200)}`
          );

          if (response.status === 400 && errText.includes('API_KEY_INVALID')) {
            throw new Error('Gemini API key is invalid. Please check GEMINI_API_KEY.');
          }

          lastError = new Error(
            `Gemini model "${model}" failed (HTTP ${response.status}): ${response.statusText || 'Unavailable'}`
          );
          continue;
        }

        const data = (await response.json()) as any;
        return { data, usedModel: model };
      } catch (err: any) {
        console.warn(
          `⚠️ [GeminiAiAdapter] Model "${model}" call failed: ${err.message || err}`
        );

        if (err.message?.includes('API key is invalid')) {
          throw err;
        }

        lastError = err;
      }
    }

    throw (
      lastError ||
      new Error(
        'Gemini AI service is temporarily experiencing high traffic across all models. Please try again shortly.'
      )
    );
  }

  /**
   * Transcribe recorded audio buffer to text using Gemini Multimodal Audio understanding.
   * Supports Indian English, Hindi, and Hinglish.
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const base64Audio = audioBuffer.toString('base64');

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/m4a',
                data: base64Audio,
              },
            },
            {
              text: `You are an expert medical and eldercare transcription assistant for MaiHooNa Care Companions (Mitras) in India.
Your task is to transcribe this spoken voice note verbatim into clear, accurate text.

Rules:
1. The speaker may speak English, Hindi, or a mix of both (Hinglish), with Indian accents.
2. Transcribe exactly what is spoken. Keep numbers, medical terms, medication names (e.g., Metformin, Amlodipine, Telmisartan), vital readings (e.g., BP 136/84, pulse 76, sugar 140), and names accurate.
3. If spoken in Hindi/Hinglish, transcribe it clearly in readable Roman script or standard English translation while preserving the verbatim meaning.
4. Do not summarize or add commentary. Return ONLY the transcribed text. If the audio is silent or unintelligible, respond with "NO_SPEECH_DETECTED".`,
            },
          ],
        },
      ],
    };

    const { data } = await this.callGemini(requestBody, 30000);

    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (candidateText === 'NO_SPEECH_DETECTED' || candidateText.length === 0) {
      return '';
    }

    return candidateText;
  }

  /**
   * Generate structured SOAP notes compliant with MHN-TPL-SOAP-001 template.
   */
  async generateSoapSummary(context: SoapContext): Promise<SoapResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    // 1. Run deterministic Red-Flag Rules Engine first (Clinical Safety Gate)
    const ruleEvaluation = evaluateRedFlags(context);

    // 2. Prepare comprehensive prompt for Gemini
    const systemPrompt = `You are an expert clinical documentation assistant for MaiHooNa Elder Care.
You must generate a structured Care Companion Visit Note following the official template "MHN-TPL-SOAP-001".

PATIENT CONTEXT:
- Beneficiary Name: ${context.beneficiaryName}
- Age: ${context.beneficiaryAge || 'Not specified'}, Gender: ${context.beneficiaryGender || 'Not specified'}
- Segment: ${context.segment || 'S2, Saathi Plus'}
- Known Conditions: ${context.knownConditions?.join(', ') || 'None listed'}
- Allergies: ${context.allergies?.join(', ') || 'None known'}
- Scheduled Medicines for Slot: ${context.scheduledMedicines?.join(', ') || 'None'}
- Previous Visit Flags: ${context.previousVisitFlags || 'None'}
- Current Mood Assessment: ${context.mood || 'Not specified'}
- Recorded Vitals This Visit: ${JSON.stringify(context.vitalsList || [])}
- Medications Status: ${JSON.stringify(context.medicationsList || [])}

RAW MITRA OBSERVATION / VOICE NOTES:
"${context.rawNotes}"

TEMPLATE SPECIFICATION (MHN-TPL-SOAP-001):
1. S — Subjective (what the Beneficiary or family says):
   - Record the Beneficiary's own words in quotation marks ("...") and indicate who said it.
   - Include: Mood/spirits, complaints/discomfort (symptom, location, duration, severity 0-10), sleep, appetite/fluids, toilet habits, self-reported medicine adherence, social contact/loneliness, family concerns, requests.
   - UNSTATED FIELDS MUST READ "Not recorded", NEVER inferred.

2. O — Objective (what the Mitra measured or saw):
   - ONLY values actually measured or observed during this visit.
   - Include vitals with units, method/device if mentioned.
   - Medicines: explicitly state "Observed taking" vs "Self-reported" vs "Missed".
   - Physical observations: mobility, gait/balance, appearance/hygiene, alertness/orientation, home safety, activities done together.
   - UNSTATED VALUES MUST READ "Not recorded".

3. A — Assessment (status vs baseline):
   - CRITICAL SAFETY RULE: NO NEW MEDICAL DIAGNOSES ALLOWED. The Mitra compares today with baseline and last visit.
   - Allowed: "BP higher than her usual 125-130 systolic."
   - PROHIBITED: "Uncontrolled hypertension" or "Likely osteoarthritis".
   - Overall status: Choose one of [Stable, Improved, Needs attention, Urgent].
   - Compare with baseline, note risk flags (Fall risk, Nutrition, Hydration, Skin, Memory, Mood, Caregiver strain, or None).

4. P — Plan (what happens next, who owns it):
   - Every follow-up action must have an owner (Mitra, Field Manager, Care Manager, Family, Partner) and due date.
   - Escalation level must be chosen from: [None, Inform Field Manager (24 h), Care Manager review (same day), ERC now].
   - If red flags were detected, align escalation accordingly.
   - Items to monitor at next visit.
   - Family Connect update: A warm, reassuring, plain-language summary suitable to send to the elder's family (no clinical jargon, no raw numbers unless vital).

5. Follow-Up Prompts (Max 3):
   - Identify up to 3 critical gaps in the observation (e.g., "Which knee, and pain score 0-10?", "Did you personally observe her take morning meds?", "How did she sleep last night?").

OUTPUT FORMAT:
Return pure valid JSON matching this schema:
{
  "subjective": "string",
  "objective": "string",
  "assessment": "string",
  "plan": "string",
  "overallStatus": "Stable" | "Improved" | "Needs attention" | "Urgent",
  "escalationLevel": "None" | "Inform Field Manager (24 h)" | "Care Manager review (same day)" | "ERC now",
  "escalationReasons": ["string"],
  "familyConnectSummary": "string",
  "followUpPrompts": ["string"]
}`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: systemPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature for high clinical precision
      },
    };

    const { data, usedModel } = await this.callGemini(requestBody, 25000);

    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      throw new Error('No content returned from Gemini SOAP generator');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      console.error('Failed to parse Gemini JSON output:', rawContent);
      throw new Error('AI returned an invalid response structure.');
    }

    // Merge deterministic rule engine findings with LLM escalation (highest priority wins)
    let finalEscalation: EscalationLevel = parsed.escalationLevel || 'None';
    const combinedReasons = [
      ...(parsed.escalationReasons || []),
      ...ruleEvaluation.reasons,
    ];

    if (ruleEvaluation.escalationLevel === 'ERC now') {
      finalEscalation = 'ERC now';
    } else if (
      ruleEvaluation.escalationLevel === 'Care Manager review (same day)' &&
      finalEscalation !== 'ERC now'
    ) {
      finalEscalation = 'Care Manager review (same day)';
    } else if (
      ruleEvaluation.escalationLevel === 'Inform Field Manager (24 h)' &&
      finalEscalation === 'None'
    ) {
      finalEscalation = 'Inform Field Manager (24 h)';
    }

    const uniqueReasons = Array.from(new Set(combinedReasons));

    // Construct human-readable formatted note for insertion into visit notes
    const formattedNotes = `S — Subjective:
${parsed.subjective || 'Not recorded'}

O — Objective:
${parsed.objective || 'Not recorded'}

A — Assessment:
${parsed.assessment || 'Stable'}

P — Plan:
${parsed.plan || 'Routine monitoring'}`;

    return {
      subjective: parsed.subjective || '',
      objective: parsed.objective || '',
      assessment: parsed.assessment || '',
      plan: parsed.plan || '',
      overallStatus: parsed.overallStatus || 'Stable',
      escalationLevel: finalEscalation,
      escalationReasons: uniqueReasons,
      familyConnectSummary: parsed.familyConnectSummary || '',
      followUpPrompts: (parsed.followUpPrompts || []).slice(0, 3),
      formattedNotes,
      aiModelId: usedModel,
      generatedAt: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const geminiAiService = new GeminiAiAdapter();

```

---

### 3. Deterministic Clinical Red-Flag Rule Engine
**File Location:** `apps/api/app/services/care_companion/soap_rules_engine.ts`  
**Module Responsibility:** Independent, pure TypeScript clinical safety gate evaluating vitals against medical crisis thresholds (BP >=180/110, SpO2 <92%, glucose <70 or >300 mg/dL, fever >=100.4°F) and emergency keywords independently of LLM reasoning.

```typescript
import { EscalationLevel, SoapContext } from '../ai/IAiService';

export interface EvaluationResult {
  escalationLevel: EscalationLevel;
  reasons: string[];
}

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'breathless',
  'short of breath',
  'difficulty breathing',
  'fell',
  'fall down',
  'unconscious',
  'passed out',
  'fainted',
  'confused',
  'slurred speech',
  'bleeding',
  'choking',
  'seizure',
];

const CARE_MANAGER_KEYWORDS = [
  'refusing food',
  'not eating',
  'withdrawn',
  'severe low mood',
  'very depressed',
  'refusing medicine',
];

/**
 * Deterministic Clinical Red-Flag Rule Engine based on MHN-TPL-SOAP-001.
 * Evaluates vitals and raw notes independently of LLM to ensure absolute clinical safety.
 */
export function evaluateRedFlags(context: SoapContext): EvaluationResult {
  const reasons: string[] = [];
  let isErc = false;
  let isCareManager = false;
  let isFieldManager = false;

  const rawNotesLower = (context.rawNotes || '').toLowerCase();

  // 1. Keyword Scans for Emergency Words
  for (const kw of EMERGENCY_KEYWORDS) {
    if (rawNotesLower.includes(kw)) {
      isErc = true;
      reasons.push(`Emergency red-flag symptom mentioned: "${kw}"`);
    }
  }

  // 2. Keyword Scans for Care Manager Review
  for (const kw of CARE_MANAGER_KEYWORDS) {
    if (rawNotesLower.includes(kw)) {
      isCareManager = true;
      reasons.push(`Care manager review trigger: "${kw}"`);
    }
  }

  // 3. Vitals Threshold Evaluation
  if (context.vitalsList && Array.isArray(context.vitalsList)) {
    for (const v of context.vitalsList) {
      const name = (v.name || '').toLowerCase();
      const valStr = String(v.value || '').trim();

      // Blood Pressure (e.g., "180/110" or separate Systolic/Diastolic)
      if (name.includes('bp') || name.includes('blood pressure')) {
        const parts = valStr.split('/');
        if (parts.length === 2) {
          const sys = parseFloat(parts[0]);
          const dia = parseFloat(parts[1]);
          if (!isNaN(sys) && !isNaN(dia)) {
            if (sys >= 180 || sys <= 90 || dia >= 110 || dia <= 60) {
              isErc = true;
              reasons.push(`Critical Blood Pressure: ${sys}/${dia} mmHg (threshold: >=180/110 or <=90/60)`);
            } else if (sys >= 140) {
              isCareManager = true;
              reasons.push(`Elevated systolic BP: ${sys} mmHg`);
            }
          }
        }
      }

      // SpO2 (Oxygen Saturation)
      if (name.includes('spo2') || name.includes('oxygen')) {
        const spo2 = parseFloat(valStr);
        if (!isNaN(spo2)) {
          if (spo2 < 92) {
            isErc = true;
            reasons.push(`Critical Hypoxia: SpO2 is ${spo2}% (threshold: <92%)`);
          } else if (spo2 <= 94) {
            isCareManager = true;
            reasons.push(`Borderline low SpO2: ${spo2}%`);
          }
        }
      }

      // Blood Glucose
      if (name.includes('glucose') || name.includes('sugar')) {
        const glucose = parseFloat(valStr);
        if (!isNaN(glucose)) {
          if (glucose < 70) {
            isErc = true;
            reasons.push(`Critical Hypoglycemia: Blood Glucose is ${glucose} mg/dL (threshold: <70 mg/dL)`);
          } else if (glucose > 300) {
            isErc = true;
            reasons.push(`Critical Hyperglycemia: Blood Glucose is ${glucose} mg/dL (threshold: >300 mg/dL)`);
          }
        }
      }

      // Pulse / Heart Rate
      if (name.includes('pulse') || name.includes('heart rate')) {
        const pulse = parseFloat(valStr);
        if (!isNaN(pulse)) {
          if (pulse < 50 || pulse > 110) {
            isCareManager = true;
            reasons.push(`Abnormal resting pulse: ${pulse} bpm (threshold: <50 or >110 bpm)`);
          }
        }
      }

      // Temperature
      if (name.includes('temp') || name.includes('temperature')) {
        const temp = parseFloat(valStr);
        if (!isNaN(temp)) {
          if (temp >= 100.4) {
            isCareManager = true;
            reasons.push(`High fever: ${temp}°F (threshold: >=100.4°F)`);
          }
        }
      }
    }
  }

  // 4. Repeated Complaint check from previous flags
  if (context.previousVisitFlags && context.previousVisitFlags.trim().length > 0) {
    const prevFlags = context.previousVisitFlags.toLowerCase();
    if (prevFlags.includes('pain') && rawNotesLower.includes('pain')) {
      isFieldManager = true;
      reasons.push(`Recurring pain complaint (noted in previous visit: "${context.previousVisitFlags}")`);
    }
  }

  // Determine final escalation level
  let escalationLevel: EscalationLevel = 'None';
  if (isErc) {
    escalationLevel = 'ERC now';
  } else if (isCareManager) {
    escalationLevel = 'Care Manager review (same day)';
  } else if (isFieldManager) {
    escalationLevel = 'Inform Field Manager (24 h)';
  }

  return {
    escalationLevel,
    reasons,
  };
}

```

---

### 4. Visit AI Joi Request Validation Schema
**File Location:** `apps/api/app/schemas/visit_ai.ts`  
**Module Responsibility:** Joi input validation schema ensuring all required UUIDs, raw note strings, and vitals/medication arrays meet structural integrity contracts before touching the AI pipeline.

```typescript
import Joi from 'joi';

export const summarizeSoapSchema = Joi.object({
  visitId: Joi.string().uuid().required(),
  rawNotes: Joi.string().min(1).required(),
  mood: Joi.string().optional().allow('', null),
  vitalsList: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        unit: Joi.string().optional().allow('', null),
      })
    )
    .optional(),
  medicationsList: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        taken: Joi.boolean().required(),
        scheduledTime: Joi.string().optional().allow('', null),
      })
    )
    .optional(),
});

```

---

### 5. Care Companion Visit AI REST Endpoints
**File Location:** `apps/api/app/api/care_companion/visit-ai.routes.ts`  
**Module Responsibility:** Express REST routes for POST /transcribe-voice (Multer memory buffer audio upload, max 15MB) and POST /summarize-soap (pre-flight patient context aggregator, conditions, active medications, and carry-forward flags).

```typescript
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, validate } from '../shared/deps';
import prisma from '../../core/database';
import { geminiAiService } from '../../services/ai/GeminiAiAdapter';
import { summarizeSoapSchema } from '../../schemas/visit_ai';

const router = Router();

// Allowed audio MIME types for voice recording
const ALLOWED_AUDIO_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/webm',
  'audio/x-m4a',
  'audio/caf',
  'audio/3gpp',
];

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max limit (well above 2-3 min voice note)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Please record in a standard audio format.`));
    }
  },
});

/**
 * Helper to verify Care Companion / Admin access to the specified visit.
 */
async function verifyVisitAccess(visitId: string, userId: string, userRole?: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      beneficiary: {
        include: {
          user: true,
        },
      },
      careCompanion: true,
    },
  });

  if (!visit) {
    return { authorized: false, status: 404, message: 'Visit not found' };
  }

  const isAdmin = [
    'admin',
    'master_admin',
    'super_admin',
    'field_manager',
    'operations_manager',
    'customer_service',
  ].includes(userRole || '');

  const isAssignedCc = visit.careCompanion && visit.careCompanion.userId === userId;

  if (!isAdmin && !isAssignedCc) {
    return {
      authorized: false,
      status: 403,
      message: 'Access denied: You are not authorized to manage this visit.',
    };
  }

  return { authorized: true, visit };
}

/**
 * POST /care-companion/visits/:visitId/ai/transcribe-voice
 * Accepts recorded voice file and returns text transcribed by Gemini Multimodal Audio.
 */
router.post(
  '/:visitId/ai/transcribe-voice',
  authenticate,
  audioUpload.single('audio') as any,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as any;
      const visitId = req.params.visitId as string;
      const userId = authReq.userId;
      const userRole = authReq.userRole;

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'No audio file provided in request. Please record voice before submitting.',
        });
      }

      const access = await verifyVisitAccess(visitId, userId, userRole);
      if (!access.authorized) {
        return res.status(access.status || 403).json({ success: false, message: access.message });
      }

      const transcript = await geminiAiService.transcribeAudio(
        req.file.buffer,
        req.file.mimetype
      );

      return res.json({
        success: true,
        data: {
          transcript,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error: any) {
      console.error('❌ [Voice Transcription Error]:', error);
      const isFetchError =
        error.message?.includes('fetch failed') ||
        error.name === 'TypeError' ||
        error.name === 'TimeoutError';
      const userMessage = isFetchError
        ? 'AI transcription service is temporarily experiencing network delays. Please try again.'
        : (error.message || 'Failed to transcribe audio. Please try again or type manually.');

      return res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  }
);

/**
 * POST /care-companion/visits/:visitId/ai/summarize-soap
 * Analyzes raw visit notes + vitals + medications + mood and generates structured SOAP note
 * according to MHN-TPL-SOAP-001 with automated red-flag escalations.
 */
router.post(
  '/:visitId/ai/summarize-soap',
  authenticate,
  validate(summarizeSoapSchema),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as any;
      const visitId = req.params.visitId as string;
      const userId = authReq.userId;
      const userRole = authReq.userRole;

      const access = await verifyVisitAccess(visitId, userId, userRole);
      if (!access.authorized || !access.visit) {
        return res.status(access.status || 403).json({ success: false, message: access.message });
      }

      const visit = access.visit;
      const beneficiary = visit.beneficiary;

      // Fetch previous visit for flag carry-over (e.g. knee pain 16 Oct)
      const previousVisit = await prisma.visit.findFirst({
        where: {
          beneficiaryId: beneficiary.id,
          id: { not: visitId },
          status: 'completed',
        },
        orderBy: { scheduledTime: 'desc' },
        select: { notes: true, visitSummary: true, scheduledTime: true },
      });

      // Assemble known conditions / statuses from beneficiary profile
      const knownConditions: string[] = [
        beneficiary.mobilityStatus ? `Mobility: ${beneficiary.mobilityStatus}` : '',
        beneficiary.cognitiveStatus ? `Cognitive: ${beneficiary.cognitiveStatus}` : '',
      ].filter(Boolean);

      // Fetch active medications for scheduled medicines list
      const activeMeds = await prisma.medication.findMany({
        where: { beneficiaryId: beneficiary.id, isActive: true },
        select: { name: true, dosage: true, frequency: true },
      });

      const scheduledMedicines = activeMeds.map(
        (m) => `${m.name} ${m.dosage || ''} (${m.frequency || ''})`.trim()
      );

      const soapContext = {
        beneficiaryName: beneficiary.name || 'Beneficiary',
        beneficiaryAge: beneficiary.age || null,
        beneficiaryGender: beneficiary.gender || null,
        segment: 'S2, Saathi Plus',
        knownConditions,
        allergies: beneficiary.allergies || [],
        scheduledMedicines,
        previousVisitFlags: previousVisit?.notes || previousVisit?.visitSummary || undefined,
        rawNotes: req.body.rawNotes,
        mood: req.body.mood || visit.mood || undefined,
        vitalsList: req.body.vitalsList || [],
        medicationsList: req.body.medicationsList || [],
      };

      const result = await geminiAiService.generateSoapSummary(soapContext);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('❌ [SOAP Summarization Error]:', error);
      const isFetchError =
        error.message?.includes('fetch failed') ||
        error.name === 'TypeError' ||
        error.name === 'TimeoutError';
      const userMessage = isFetchError
        ? 'AI service is temporarily experiencing network delays. Please try again in a few moments.'
        : (error.message || 'Failed to generate AI SOAP notes. Please try again.');

      return res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  }
);

export default router;

```

---

### 6. Mobile Hands-Free Audio Recorder Component
**File Location:** `apps/mobile-app/components/care-companion/VoiceNotesRecorder.tsx`  
**Module Responsibility:** React Native / Expo component using expo-av for high-quality audio recording with live pulsing animation, 2-minute safety auto-cutoff, haptic feedback, and automated multipart upload to Gemini.

```typescript
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

interface VoiceNotesRecorderProps {
  visitId: string;
  token: string;
  onTranscribed: (transcript: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_SECONDS = 120; // 2 minutes auto-cutoff

export const VoiceNotesRecorder: React.FC<VoiceNotesRecorderProps> = ({
  visitId,
  token,
  onTranscribed,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSecs, setDurationSecs] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording badge
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Clean up recording and timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    if (disabled || isRecording || isTranscribing) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in device settings to dictate visit notes.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDurationSecs(0);

      // Start duration ticker
      timerRef.current = setInterval(() => {
        setDurationSecs((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopAndTranscribe();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      Alert.alert('Recording Error', 'Could not access device microphone. Please try again.');
      setIsRecording(false);
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (e) {
      // Ignored
    } finally {
      setIsRecording(false);
      setDurationSecs(0);
    }
  };

  const stopAndTranscribe = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) {
        throw new Error('No audio file was created');
      }

      // Upload audio to Gemini speech-to-text API
      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: 'visit-note.m4a',
        type: 'audio/m4a',
      } as any);

      const response = await fetch(`${API_URL}/care-companion/visits/${visitId}/ai/transcribe-voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Let fetch set multi-part boundary automatically
        },
        body: formData,
      });

      const json = await response.json();
      if (json.success && json.data?.transcript) {
        onTranscribed(json.data.transcript);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (json.data?.transcript === '') {
        Alert.alert(
          'No Speech Detected',
          'We could not hear any clear voice observations. Please try speaking closer to the mic.'
        );
      } else {
        Alert.alert('Transcription Failed', json.message || 'Could not transcribe voice notes.');
      }
    } catch (err: any) {
      console.error('Voice upload error:', err);
      Alert.alert(
        'Upload Error',
        'Could not complete voice transcription. You can still type notes manually.'
      );
    } finally {
      setIsTranscribing(false);
      setDurationSecs(0);
    }
  };

  if (isTranscribing) {
    return (
      <View style={styles.transcribingContainer}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text style={styles.transcribingText}>Transcribing with AI...</Text>
      </View>
    );
  }

  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        <Animated.View style={[styles.redDot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.recordingTimer}>{formatTimer(durationSecs)}</Text>

        <View style={styles.recordingControls}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancelRecording}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color="#EF4444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={stopAndTranscribe}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.dictateBtn, disabled && { opacity: 0.5 }]}
      onPress={startRecording}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Ionicons name="mic" size={16} color="#4F46E5" style={{ marginRight: 5 }} />
      <Text style={styles.dictateBtnText}>Dictate Voice</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  dictateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: 'Poppins-Medium',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  recordingTimer: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: 'Poppins-Bold',
    marginRight: 10,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 13,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Poppins-Medium',
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  transcribingText: {
    fontSize: 12,
    color: '#4F46E5',
    marginLeft: 6,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
});

```

---

### 7. Mobile Clinical SOAP Review & Acknowledgement Modal
**File Location:** `apps/mobile-app/components/care-companion/SoapReviewModal.tsx`  
**Module Responsibility:** Companion confirmation modal featuring tabbed views for Clinical SOAP vs. Family Connect, emergency red-flag acknowledgement gate, interactive missing data prompt chips, and Append vs. Replace workflows.

```typescript
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface SoapData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  overallStatus: 'Stable' | 'Improved' | 'Needs attention' | 'Urgent';
  escalationLevel: 'None' | 'Inform Field Manager (24 h)' | 'Care Manager review (same day)' | 'ERC now';
  escalationReasons: string[];
  familyConnectSummary: string;
  followUpPrompts: string[];
  formattedNotes: string;
}

interface SoapReviewModalProps {
  visible: boolean;
  soapData: SoapData | null;
  onApply: (
    formattedNotes: string,
    mode: 'replace' | 'append',
    familyConnectSummary?: string,
    escalation?: { escalate: boolean; reason?: string }
  ) => void;
  onDismiss: () => void;
}

export const SoapReviewModal: React.FC<SoapReviewModalProps> = ({
  visible,
  soapData,
  onApply,
  onDismiss,
}) => {
  const [acknowledgedErc, setAcknowledgedErc] = useState(false);
  const [activeTab, setActiveTab] = useState<'soap' | 'family'>('soap');

  if (!soapData) return null;

  const isEmergency = soapData.escalationLevel === 'ERC now';
  const isCareManager = soapData.escalationLevel === 'Care Manager review (same day)';
  const isFieldManager = soapData.escalationLevel === 'Inform Field Manager (24 h)';
  const hasEscalation = isEmergency || isCareManager || isFieldManager;

  const handleConfirmReplace = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const escalationInfo = hasEscalation ? {
      escalate: true,
      reason: `${soapData.escalationLevel}: ${soapData.escalationReasons?.join('; ') || 'Clinical flag'}`
    } : undefined;
    onApply(soapData.formattedNotes, 'replace', soapData.familyConnectSummary, escalationInfo);
  };

  const handleConfirmAppend = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const escalationInfo = hasEscalation ? {
      escalate: true,
      reason: `${soapData.escalationLevel}: ${soapData.escalationReasons?.join('; ') || 'Clinical flag'}`
    } : undefined;
    onApply(soapData.formattedNotes, 'append', soapData.familyConnectSummary, escalationInfo);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Urgent':
        return { bg: '#FEE2E2', text: '#DC2626', border: '#F87171' };
      case 'Needs attention':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' };
      case 'Improved':
        return { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' };
      default:
        return { bg: '#E0E7FF', text: '#4338CA', border: '#A5B4FC' };
    }
  };

  const statusColors = getStatusColor(soapData.overallStatus);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.modalContainer}>
        <StatusBar barStyle="dark-content" />

        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={20} color="#4F46E5" style={{ marginRight: 6 }} />
              <Text style={styles.modalTitle}>SOAP Visit Note</Text>
            </View>
            <Text style={styles.modalSubtitle}>MHN-TPL-SOAP-001 Clinical Standard</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {soapData.overallStatus}
            </Text>
          </View>
        </View>

        {/* Tab Toggle: SOAP vs Family Connect */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'soap' && styles.tabButtonActive]}
            onPress={() => setActiveTab('soap')}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={activeTab === 'soap' ? '#4F46E5' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'soap' && styles.tabButtonTextActive]}>
              Clinical SOAP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'family' && styles.tabButtonActive]}
            onPress={() => setActiveTab('family')}
          >
            <Ionicons
              name="heart-outline"
              size={16}
              color={activeTab === 'family' ? '#4F46E5' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'family' && styles.tabButtonTextActive]}>
              Family Connect
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Red Flag Auto-Escalation Banner */}
          {hasEscalation && (
            <View
              style={[
                styles.escalationBanner,
                isEmergency ? styles.emergencyBanner : styles.warningBanner,
              ]}
            >
              <View style={styles.escalationHeader}>
                <Ionicons
                  name={isEmergency ? 'alert-circle' : 'warning'}
                  size={22}
                  color={isEmergency ? '#DC2626' : '#D97706'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.escalationTitle,
                    { color: isEmergency ? '#DC2626' : '#B45309' },
                  ]}
                >
                  ESCALATION: {soapData.escalationLevel}
                </Text>
              </View>

              {soapData.escalationReasons.map((reason, index) => (
                <View key={index} style={styles.reasonBullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}

              {isEmergency && (
                <TouchableOpacity
                  style={[
                    styles.ackButton,
                    acknowledgedErc && styles.ackButtonActive,
                  ]}
                  onPress={() => setAcknowledgedErc(!acknowledgedErc)}
                >
                  <Ionicons
                    name={acknowledgedErc ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={acknowledgedErc ? '#059669' : '#DC2626'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.ackText}>
                    I acknowledge this emergency red flag and will notify ERC immediately.
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Follow-up Clarification Prompts (if any) */}
          {soapData.followUpPrompts && soapData.followUpPrompts.length > 0 && (
            <View style={styles.promptsCard}>
              <View style={styles.promptsHeader}>
                <Ionicons name="help-circle-outline" size={18} color="#0891B2" style={{ marginRight: 6 }} />
                <Text style={styles.promptsTitle}>Suggested Clarifications</Text>
              </View>
              <Text style={styles.promptsSub}>Gaps observed in dictation (optional):</Text>
              {soapData.followUpPrompts.map((prompt, idx) => (
                <View key={idx} style={styles.promptChip}>
                  <Text style={styles.promptNumber}>{idx + 1}.</Text>
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'soap' ? (
            /* 4 Pillars of SOAP */
            <View style={styles.soapSections}>
              {/* S: Subjective */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#EEF2FF' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#4F46E5' }]}>S</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Subjective</Text>
                  <Text style={styles.sectionCaption}>(Beneficiary words & feelings)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.subjective || 'Not recorded'}</Text>
              </View>

              {/* O: Objective */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#059669' }]}>O</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Objective</Text>
                  <Text style={styles.sectionCaption}>(Measured vitals & observations)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.objective || 'Not recorded'}</Text>
              </View>

              {/* A: Assessment */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#D97706' }]}>A</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  <Text style={styles.sectionCaption}>(Status vs baseline — No diagnosis)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.assessment || 'Stable'}</Text>
              </View>

              {/* P: Plan */}
              <View style={styles.soapSectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.letterBadge, { backgroundColor: '#F5F3FF' }]}>
                    <Text style={[styles.letterBadgeText, { color: '#7C3AED' }]}>P</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  <Text style={styles.sectionCaption}>(Action items, owner & due dates)</Text>
                </View>
                <Text style={styles.sectionBody}>{soapData.plan || 'Routine monitoring'}</Text>
              </View>
            </View>
          ) : (
            /* Family Connect Preview */
            <View style={styles.familyCard}>
              <View style={styles.familyHeader}>
                <Ionicons name="people-circle-outline" size={24} color="#EA580C" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.familyTitle}>Family Connect Update</Text>
                  <Text style={styles.familySub}>Reassuring update automatically sent to family</Text>
                </View>
              </View>
              <View style={styles.familySpeechBubble}>
                <Text style={styles.familyText}>{soapData.familyConnectSummary}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions Bar */}
        <View style={styles.modalBottomBar}>
          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.appendBtn}
            onPress={handleConfirmAppend}
            disabled={isEmergency && !acknowledgedErc}
          >
            <Ionicons name="add-circle-outline" size={18} color="#4F46E5" style={{ marginRight: 4 }} />
            <Text style={styles.appendBtnText}>Append</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.applyBtn,
              isEmergency && !acknowledgedErc && { opacity: 0.5 },
            ]}
            onPress={handleConfirmReplace}
            disabled={isEmergency && !acknowledgedErc}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.applyBtnText}>Apply SOAP Note</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Poppins-Bold',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  tabButtonTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  escalationBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  emergencyBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  warningBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  escalationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  escalationTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  reasonBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: '#DC2626',
    marginRight: 6,
  },
  reasonText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    fontFamily: 'Poppins-Regular',
  },
  ackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  ackButtonActive: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  ackText: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
    fontFamily: 'Poppins-Medium',
  },
  promptsCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  promptsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  promptsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    fontFamily: 'Poppins-Bold',
  },
  promptsSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promptNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
    marginRight: 6,
  },
  promptChipText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    fontFamily: 'Poppins-Medium',
  },
  soapSections: {
    gap: 12,
  },
  soapSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  letterBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  letterBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Poppins-Bold',
    marginRight: 6,
  },
  sectionCaption: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Poppins-Regular',
  },
  sectionBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  familyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  familyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
    fontFamily: 'Poppins-Bold',
  },
  familySub: {
    fontSize: 11,
    color: '#78716C',
    fontFamily: 'Poppins-Regular',
  },
  familySpeechBubble: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
  },
  familyText: {
    fontSize: 14,
    color: '#431407',
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
  },
  modalBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  dismissBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  appendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  appendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: 'Poppins-Medium',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
  },
});

```

---
