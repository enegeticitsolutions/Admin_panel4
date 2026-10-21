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
