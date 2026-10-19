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
