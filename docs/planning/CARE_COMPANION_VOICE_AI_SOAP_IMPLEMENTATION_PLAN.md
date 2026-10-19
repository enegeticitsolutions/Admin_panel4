# Implementation Plan: Care Companion Voice AI & Clinical SOAP Notes

**Document Reference:** `MHN-TPL-SOAP-001` (Care Companion Visit Note — SOAP Template)  
**Target Modules:** `apps/api`, `apps/mobile-app`, `@maihoonna/database`  
**Status:** Ready for Review / Execution  

---

## 1. Executive Summary & Goals

The objective of this feature is to empower Care Companions (Mitras) during elder care visits to:
1. **Dictate observations hands-free** via voice in Hindi, English, or Hinglish.
2. **Transcribe speech to text in real-time** via Google Gemini Multimodal Audio API directly into the Visit Notes field.
3. **Generate structured clinical SOAP notes with a single tap** ("**AI Summarise**") compliant with MaiHooNa's official clinical template **`MHN-TPL-SOAP-001`**.
4. **Enforce clinical safety & automatic red-flag escalations** (Emergency Response Center `ERC now`, `Care Manager same day`, `Field Manager 24h review`).
5. **Auto-generate a warm, family-safe "Family Connect" update** for the elder's family without raw medical jargon.

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Care Companion Mobile App                               │
│                                                                                        │
│   Visit Notes Card (visit-details.tsx):                                                │
│   1. [🎙️ Dictate Note] ──> Records audio (expo-av) in m4a/aac                           │
│   2. Text Input Area    <── Receives raw transcribed text (editable by Mitra)          │
│   3. [✨ AI Summarise]   ──> Sends raw notes + session vitals + meds + mood + context    │
│   4. SOAP Review Modal  <── Receives S-O-A-P + Escalation Flags + Missing Data Prompts │
│   5. [Confirm & Save]   ──> Inserts into visit record & syncs with DB                  │
└───────────────────────────┬──────────────────────────────────┬─────────────────────────┘
                            │ (1) Audio Stream                 │ (2) Visit Context Payload
                            ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  Backend API (apps/api)                                │
│                                                                                        │
│   Endpoints:                                                                           │
│   • POST /care-companion/visits/:visitId/ai/transcribe-voice (Multer memory)           │
│   • POST /care-companion/visits/:visitId/ai/summarize-soap   (Context + LLM)          │
│                                                                                        │
│   Decoupled Provider Architecture (Rule 20):                                           │
│   Controller ──> IAiService (Interface) ──> GeminiAiAdapter                            │
│                                                   │                                    │
│   Clinical Guardrails & Rule Engine:              │                                    │
│   • Red-Flag Auto-Escalation Validator            │                                    │
│   • No-Diagnosis Enforcer                         │                                    │
│   • Segment Monitoring Matrix (S1–S6)             ▼                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Google Gemini 1.5 / 2.0 Flash                             │
│                                                                                        │
│   Task 1: Multimodal Speech-to-Text Transcription                                      │
│           • Direct audio ingest (m4a, wav, mp3, aac)                                   │
│           • Indian accent, Hindi, English, and Hinglish recognition                    │
│                                                                                        │
│   Task 2: Clinical SOAP Structuring according to MHN-TPL-SOAP-001                      │
│           • S (Subjective) - Elder's verbatim quotes, complaints, mood, sleep          │
│           • O (Objective)  - Vitals, observed vs self-reported meds, mobility, hygiene │
│           • A (Assessment) - Baseline comparison, risk flags, NO unconfirmed diagnosis │
│           • P (Plan)       - Follow-up with owners/due dates, Family Connect summary   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Specification Breakdown (`MHN-TPL-SOAP-001`)

### 3.1 Header Context (Auto-assembled by API)
Before prompting Gemini, the backend automatically gathers:
- **Beneficiary Profile**: Name, Age, Gender, Segment (`S1`–`S6`, e.g., Saathi Plus).
- **Known Conditions & Allergies**: Read-only from profile (e.g. Type 2 Diabetes, Hypertension).
- **Scheduled Medicines**: From Care Plan for the current slot (e.g. Metformin 500mg, Amlodipine 5mg).
- **Visit Metadata**: Type (Routine / Follow-up / Ad-hoc / Post-discharge), GPS-verified location, Check-in time.
- **Previous Visit Flags**: Carried forward from the last visit note (e.g. *"Mild knee pain reported 16 Oct"*).

---

### 3.2 S — Subjective (What the Beneficiary or Family Says)
- **Mandatory Rule:** Capture Beneficiary’s own words in quotation marks (`"..."`) and note who stated it.
- **Components:**
  - **Mood & Spirits:** Good / Okay / Low + verbatim quote.
  - **Complaints or Discomfort:** Symptom, location, duration, severity scale (0–10).
  - **Sleep Quality:** Good / Disturbed / Poor + hours if known.
  - **Appetite & Fluid Intake:** Normal / Reduced / Increased.
  - **Toilet Habits:** Normal / Change noted.
  - **Medicine Adherence (Self-Report):** Taken / Missed / Unsure per medicine.
  - **Loneliness & Social Contact:** Phone calls, visitors, Hobby Circles or Saathi interactions.
  - **Family Concerns:** Concerns voiced by daughter-in-law, domestic help, or caregiver.
  - **Beneficiary Requests:** Specific requests for goods, services, or assistance.

---

### 3.3 O — Objective (What the Mitra Measured or Saw)
- **Mandatory Rule:** Only values actually measured or physically observed during this visit. Unstated items must read `"Not recorded"`, never hallucinated or assumed.
- **Components:**
  - **Vitals Matrix:**
    - Blood Pressure (mmHg) — systolic/diastolic, arm/posture.
    - Pulse (bpm) & SpO₂ (%).
    - Temperature (°F) & Blood Glucose (mg/dL fasting/random/post-meal).
    - Weight (kg) & Respiratory Rate (breaths/min for S4–S6).
  - **Medicines Observed:**
    - Status for each pill: `Observed taking` vs `Self-reported` vs `Missed` vs `Refused`.
  - **Physical & Environmental Observations:**
    - Activity & Mobility (e.g., walked 10 min in garden, stick vs independent).
    - Gait & Balance (steady / unsteady / fall or near-fall).
    - Appearance & Hygiene (grooming, clothing, skin redness/bruises/swelling).
    - Alertness & Orientation (alert & oriented / drowsy / confused vs baseline).
    - Home Safety (loose rugs, lighting, grab rails, medication storage).
    - Engagement (conversation, music, games, reminiscence).

---

### 3.4 A — Assessment (Status vs Baseline — Zero Diagnosis)
- **CRITICAL CLINICAL SAFETY RULE:**
  - The Mitra compares today with baseline and previous visit.
  - **NO MEDICAL DIAGNOSIS ALLOWED.**
  - *Allowed:* `"BP higher than her usual 125–130 systolic."`
  - *Strictly Prohibited:* `"Uncontrolled hypertension"` or `"Likely osteoarthritis."`
- **Components:**
  - **Overall Status Today:** `Stable` / `Improved` / `Needs attention` / `Urgent`.
  - **Change Since Last Visit:** `Better` / `Same` / `Worse` + details.
  - **Vitals vs Target Range:** In range vs Out of range.
  - **Medicine Adherence:** `Full` / `Partial` / `Missed`.
  - **Wellbeing & Loneliness:** `Engaged` / `Withdrawn` / `Low mood noted`.
  - **Concerns Identified:** Observational notes (e.g. *"Knee pain, 2nd report this week, did not stop walk"*).
  - **Risk Flags:** `Fall risk` | `Nutrition` | `Hydration` | `Skin` | `Memory` | `Mood` | `Caregiver strain` | `None`.

---

### 3.5 P — Plan (Actions, Owners, Escalations & Family Connect)
- **Mandatory Rule:** Every action must have an assigned owner and due date. Escalation level is mandatory.
- **Components:**
  - **Actions Done During Visit:** (e.g., medicine reminder given, assisted walk, family updated).
  - **Follow-up Actions:** `[Action · Owner · Due Date]` (Owners: Mitra / Field Manager / Care Manager / Family / Partner).
  - **Mandatory Escalation Level:**
    - `None`
    - `Inform Field Manager (24 h)`
    - `Care Manager review (same day)`
    - `ERC now (Emergency Response Center)`
  - **Partner Referral Suggestion:** Physio / Diagnostics / Doctor (KRA Healthcare) / Pharmacy / None (requires family consent).
  - **Next Visit Monitoring Items:** Specific parameters to inspect next time (e.g. *"Recheck BP seated, ask knee pain score 0-10"*).
  - **Family Connect Update:** Auto-generated, warm, plain-language summary for family members without raw medical jargon (unless family opted in).

---

### 3.6 Automated Red-Flag Escalation Engine

The backend AI prompt and validation service will enforce deterministic triggers:

| Clinical Trigger | Threshold / Condition | Automated Escalation Route |
| :--- | :--- | :--- |
| **Blood Pressure Crisis** | Systolic $\ge 180$ or $\le 90$; Diastolic $\ge 110$ or $\le 60$ mmHg | 🚨 **ERC now** (Emergency Response Center) |
| **Sustained High BP** | $140–179$ mmHg systolic on 2 visits in a row | ⚠️ **Care Manager (same day)** |
| **Low Oxygen (Hypoxia)** | $\text{SpO}_2 < 92\%$ | 🚨 **ERC now** |
| **Abnormal Pulse** | $<50$ or $>110$ bpm at rest | ⚠️ **Care Manager same day** (ERC if symptomatic) |
| **Blood Glucose Crisis** | $<70$ mg/dL (hypoglycemia) or $>300$ mg/dL | 🚨 **ERC now** |
| **High Fever** | Temperature $\ge 100.4^\circ\text{F}$ | ⚠️ **Care Manager (same day)** |
| **Emergency Red-Flag Keywords** | Any mention of *"chest pain"*, *"breathless"*, *"fell"*, *"unconscious"*, *"confused"*, *"slurred speech"*, *"bleeding"* | 🚨 **ERC now** |
| **Missed Critical Medicine** | 2+ consecutive scheduled doses | ⚠️ **Care Manager (same day)** |
| **Chronic Recurring Complaint** | 3rd report in 14 days (e.g. worsening knee pain) | 📋 **Field Manager review** |
| **Severe Withdrawal / Depression** | Refusing food, acute withdrawal, severe low mood | ⚠️ **Care Manager (same day)** |

> **Safety Gate:** A note triggering an `ERC now` or `Care Manager` red flag cannot be saved without visual acknowledgement from the Mitra in the mobile app.

---

### 3.7 Interactive Clarification Prompts (Max 3)
When drafting the SOAP note, if critical information is missing from the voice input, Gemini will return up to **3 concise clarification prompts** (prioritizing red-flag gaps):
- *Example 1:* *"Which knee has pain, and what is the severity from 0 to 10?"*
- *Example 2:* *"Did you observe Mrs. Sharma taking the medicines, or did she self-report?"*
- *Example 3:* *"How were her sleep and appetite over the last 24 hours?"*

The Mitra can quickly speak the answer or tap **"Skip"** to proceed immediately.

---

## 4. Technical Implementation Steps

### Phase 1: Backend Foundation (`apps/api`)

#### Step 1.1: Environment & SDK Configuration
- Update [`apps/api/.env`](file:///Users/puneet/Desktop/MHN/apps/api/.env) and [`apps/api/.env.example`](file:///Users/puneet/Desktop/MHN/apps/api/.env.example):
  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  GEMINI_MODEL=gemini-1.5-flash
  ```
- Expose values in [`apps/api/app/core/config.ts`](file:///Users/puneet/Desktop/MHN/apps/api/app/core/config.ts).
- Install `@google/genai` or `@google/generative-ai` in `apps/api`.

#### Step 1.2: Decoupled AI Provider Pattern (Rule 20)
- Create interface: `apps/api/app/services/ai/IAiService.ts`:
  - `transcribeAudio(buffer: Buffer, mimeType: string): Promise<string>`
  - `generateSoapNote(payload: SoapGenerationContext): Promise<SoapNoteResponse>`
- Create adapter: `apps/api/app/services/ai/GeminiAiAdapter.ts`:
  - Ingests audio streams for transcription.
  - Implements the comprehensive system prompt encoding all rules of `MHN-TPL-SOAP-001`.
- Create factory: `apps/api/app/services/ai/ai_service.ts`.

#### Step 1.3: Red-Flag Rule Engine
- Create `apps/api/app/services/care_companion/soap_rules_engine.ts`:
  - Deterministically evaluates vitals and text flags against threshold tables.
  - Computes escalation level independently of LLM output to guarantee clinical safety.

#### Step 1.4: API Endpoints & Routes
- Create `apps/api/app/api/care_companion/visit-ai.routes.ts`:
  - `POST /care-companion/visits/:visitId/ai/transcribe-voice` (Multer audio upload, max 15MB).
  - `POST /care-companion/visits/:visitId/ai/summarize-soap` (Generates SOAP draft, red-flag triggers, and follow-up prompts).
- Register routes in [`apps/api/app/main.ts`](file:///Users/puneet/Desktop/MHN/apps/api/app/main.ts).

---

### Phase 2: Database Schema & Audit Trail (`packages/database`)

The template requires an audit trail:
- Retain original voice transcript and raw text.
- Retain AI draft timestamp and model ID.
- Retain Mitra confirmation timestamp.
- Store Family Connect update.

In [`packages/database/prisma/schema.prisma`](file:///Users/puneet/Desktop/MHN/packages/database/prisma/schema.prisma):
- Extend `Visit` model or store structured JSON:
  - `visitSummary`: stores the generated Family Connect update.
  - `escalateToManager`: boolean (matches `MHN-TPL-SOAP-001`).
  - `escalationReason`: string (e.g. `"ERC now: SpO2 90%"` or `"Care Manager: Repeated knee pain"`).
  - `soapNotes`: JSON or formatted text containing `{ S, O, A, P, rawTranscript, aiModelId, confirmedAt }`.

---

### Phase 3: Mobile App Audio Recording (`apps/mobile-app`)

#### Step 3.1: Permissions & Expo Config
- Update [`apps/mobile-app/app.json`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/app.json):
  - iOS: `NSMicrophoneUsageDescription`: *"MaiHoonNa requires microphone access to dictate visit notes and clinical observations."*
  - Android: `android.permission.RECORD_AUDIO`.
- Install `expo-av` via `npx expo install expo-av`.

#### Step 3.2: Voice Recorder Component
- Build `apps/mobile-app/components/care-companion/VoiceNotesRecorder.tsx`:
  - Pulsing live audio badge with timer (`00:15 / 02:00`).
  - Native haptic feedback upon start/stop.
  - Auto-stop limit at 2 minutes.
  - Direct upload to `/ai/transcribe-voice`.
  - Appends or writes transcription directly into the Visit Notes text box.

---

### Phase 4: SOAP AI Summarization & Confirmation UI (`apps/mobile-app`)

#### Step 4.1: Visit Notes Card Enhancement
In [`apps/mobile-app/app/(care-companion)/visit-details.tsx`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/app/(care-companion)/visit-details.tsx):
- Place `VoiceNotesRecorder` at the header of the **Visit Notes** card.
- Keep the `TextInput` for viewing/editing transcribed or manually entered notes.
- Add the **"✨ AI Summarise (SOAP Note)"** button below the text area.

#### Step 4.2: SOAP Review & Confirmation Modal
Build `apps/mobile-app/components/care-companion/SoapReviewModal.tsx`:
- **Card Preview**: Tabbed or accordion layout displaying:
  - **S — Subjective** (Quotes highlighted, mood, sleep).
  - **O — Objective** (Vitals summary, meds observed vs self-reported).
  - **A — Assessment** (Status badge: `Stable` / `Needs Attention`, baseline comparison).
  - **P — Plan** (Actions, owner, due date, Family Connect preview).
- **Red-Flag Banner**: If auto-escalation is triggered (`ERC now` or `Care Manager`), render high-visibility banner with mandatory confirmation acknowledgement.
- **Clarification Prompts**: Display up to 3 interactive chips for unrecorded fields (e.g., *"Which knee?"*), allowing the Mitra to tap or dictate quick answers or hit *"Skip"*.
- **Confirmation Action**: Mitra confirms: *"I confirm this note reflects my visit"* ➔ updates `visitNotes` and sets structured payload for encounter save.

---

## 5. Worked Example (From Template)

**Input Spoken by Mitra:**  
> *"Mrs. Sharma was in good spirits today, BP 136/84, took her metformin and amlodipine, complained of mild knee pain, walked 10 minutes in the garden."*

**AI Generated SOAP Output:**
- **S (Subjective):** Beneficiary in good spirits (`"feeling good today"`). Reports mild knee pain; side, onset, and severity score (0–10) *not recorded*. Self-reports taking morning medicines. Sleep, appetite, toilet habits, and social contact: *not recorded*.
- **O (Objective):** BP 136/84 mmHg (seated, left arm). Metformin and Amlodipine taken — observed vs self-reported *not recorded*. Walked 10 minutes in the garden; aid and gait *not recorded*. Other vitals: *not recorded*.
- **A (Assessment):** Overall: `Stable`. BP above her usual range (target <130/80, out of range). Medicine adherence: full for morning slot. Knee pain: 2nd report since 16 Oct, did not prevent walking. Risk flags: possible fall risk if knee pain increases. *(Zero new diagnoses).*
- **P (Plan):**
  - Recheck BP at next visit, seated after 5 min rest (Owner: Mitra · Next Visit).
  - Ask knee pain score (0–10) and side at next visit (Owner: Mitra · Next Visit).
  - Inform Field Manager within 24h of repeat knee pain; suggest physio assessment (Owner: Mitra · Due: 24h).
  - **Escalation Level:** `Inform Field Manager (24 h)`.
  - **Family Connect Update:** *"Mrs. Sharma was cheerful today, took her medicines, and enjoyed a short garden walk. She mentioned mild knee pain; our team will keep a close eye on it."*
- **Clarification Prompts Shown to Mitra:**
  1. *"Which knee has pain, and what is the severity from 0 to 10?"*
  2. *"Did you personally observe her take the medicines?"*
  3. *"How did she sleep last night?"*

---

## 6. Verification & Quality Checklist

- [ ] **Voice Ingestion:** Test audio recording in quiet and noisy environments; test English, Hindi, and mixed Hinglish.
- [ ] **Exact Value Retention:** Verify numbers (e.g. BP 136/84) are transcribed exactly and not modified.
- [ ] **No-Diagnosis Verification:** Confirm LLM never produces unconfirmed clinical labels (e.g. strictly rejects "Osteoarthritis" or "Hypertension").
- [ ] **Red-Flag Escalation:** Trigger test cases with BP 185/115 and SpO2 90% — ensure `ERC now` triggers instantly and locks confirmation until acknowledged.
- [ ] **Offline / Network Resilience:** Ensure manual text editing and saving remain 100% operational even if the AI endpoint fails or times out.
- [ ] **Audit Trail Integrity:** Confirm raw audio transcripts, AI generation logs, and Mitra edits are tracked accurately.
