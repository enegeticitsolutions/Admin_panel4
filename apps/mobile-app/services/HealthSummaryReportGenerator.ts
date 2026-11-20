import { Alert, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface HealthSummaryVitalsItem {
  code: string;
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'normal' | 'low' | 'high' | 'abnormal' | 'recorded';
  capturedAt: string;
  source: string;
  recorder: string;
}

export interface HealthSummaryReadingItem {
  id: string;
  vitalName: string;
  vitalCode: string;
  value: string;
  unit: string;
  capturedAt: string;
  displayDate: string;
  displayTime: string;
  status: 'normal' | 'low' | 'high' | 'abnormal' | 'recorded';
  source: 'beneficiary' | 'care_companion';
  recorder: string;
}

export interface HealthSummaryMedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  timeSlots: string[];
  instructions: string | null;
  prescribedBy: string | null;
  startDate: string;
}

export interface HealthSummaryEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

export interface VitalTrendPoint {
  date: string;
  fullDate: string;
  value: number;
  source?: 'care_companion' | 'beneficiary';
  recorder?: string;
}

export interface VitalTrend {
  name: string;
  code: string;
  unit: string;
  dataType: string;
  gridMax: number;
  gridValues: number[];
  color: string;
  v1: VitalTrendPoint[];
  v2?: VitalTrendPoint[];
}

export interface MonthlyVitalStat {
  code: string;
  name: string;
  unit: string;
  min: string;
  max: string;
  avg: string;
  latest: string;
  readingCount: number;
  status: 'normal' | 'low' | 'high' | 'recorded';
}

export interface MonthlyReportData {
  periodLabel: string;
  totalVisits: number;
  adherencePercentage: number;
  takenCount: number;
  missedCount: number;
  vitalsStats: MonthlyVitalStat[];
  overallStatus: 'stable' | 'attention_needed' | 'improving';
}

export interface HealthSummaryData {
  reportId: string;
  generatedAt: string;
  beneficiary: {
    id: string;
    name: string;
    age: number;
    gender: string;
    bloodGroup: string;
    address: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
    primaryPhysicianName: string | null;
    primaryPhysicianPhone: string | null;
    primaryPhysicianSpec: string | null;
    emergencyContacts: HealthSummaryEmergencyContact[];
  };
  allergies: string[];
  medicalConditions: string[];
  vitals: HealthSummaryVitalsItem[];
  allReadingsHistory?: HealthSummaryReadingItem[];
  weeklyTrends?: VitalTrend[];
  monthlyTrends?: VitalTrend[];
  vitalsTrends?: VitalTrend[];
  monthlyReport?: MonthlyReportData;
  medications: HealthSummaryMedicationItem[];
  adherence: {
    percentage: number;
    takenCount: number;
    missedCount: number;
    totalScheduled: number;
    status: 'excellent' | 'good' | 'fair' | 'needs_attention';
  };
  careOverview: {
    assignedCompanionName: string | null;
    lastVisitDate: string | null;
    lastVisitMood: string | null;
    notes: string | null;
  };
}

/**
 * Generates clinical, print-optimized HTML for the Health Summary Report.
 */
export function generateHealthSummaryHtml(data: HealthSummaryData, readingLimit: number = 10): string {
  const formattedDate = new Date(data.generatedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Vitals rows (latest)
  const vitalsRows = data.vitals.length > 0
    ? data.vitals.map(v => {
        let badgeColor = '#10B981';
        let badgeBg = '#ECFDF5';
        let badgeText = 'Normal';
        if (v.status === 'high') { badgeColor = '#EF4444'; badgeBg = '#FEF2F2'; badgeText = 'Elevated'; }
        else if (v.status === 'low') { badgeColor = '#F59E0B'; badgeBg = '#FFFBEB'; badgeText = 'Low'; }
        else if (v.status === 'abnormal') { badgeColor = '#DC2626'; badgeBg = '#FEF2F2'; badgeText = 'Abnormal'; }
        else if (v.status === 'recorded') { badgeColor = '#6B7280'; badgeBg = '#F3F4F6'; badgeText = 'Recorded'; }

        const dateStr = v.capturedAt ? new Date(v.capturedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '--';

        return `
          <tr>
            <td style="font-weight: 600; color: #111827;">${v.name}</td>
            <td style="font-weight: 700; color: #FE6700; font-size: 15px;">${v.value} <span style="font-size: 11px; font-weight: normal; color: #6B7280;">${v.unit}</span></td>
            <td style="color: #6B7280; font-size: 12px;">${v.normalRange || 'N/A'}</td>
            <td><span style="display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">${badgeText}</span></td>
            <td style="color: #4B5563; font-size: 12px;">${dateStr} <span style="color: #9CA3AF;">(${v.recorder})</span></td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="5" style="text-align: center; color: #9CA3AF; padding: 20px;">No vitals recorded yet.</td></tr>`;

  // Detailed Reading-based Log Table (Requested by user)
  const historyList = (data.allReadingsHistory || []).slice(0, readingLimit * 6);
  const readingLogRows = historyList.length > 0
    ? historyList.map(item => {
        let statusBadge = '<span style="color:#10B981; font-weight:600;">Normal</span>';
        if (item.status === 'high') statusBadge = '<span style="color:#EF4444; font-weight:600;">High</span>';
        else if (item.status === 'low') statusBadge = '<span style="color:#F59E0B; font-weight:600;">Low</span>';

        return `
          <tr>
            <td style="color:#4B5563; font-size:12px;">${item.displayDate} <span style="color:#9CA3AF;">${item.displayTime}</span></td>
            <td style="font-weight:600; color:#111827;">${item.vitalName}</td>
            <td style="font-weight:700; color:#FE6700;">${item.value} <span style="font-size:11px; color:#6B7280;">${item.unit}</span></td>
            <td>${statusBadge}</td>
            <td style="color:#6B7280; font-size:12px;">${item.recorder}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="5" style="text-align: center; color: #9CA3AF; padding: 14px;">No historical readings available.</td></tr>`;

  // Medications rows
  const medicationRows = data.medications.length > 0
    ? data.medications.map(m => {
        const slots = m.timeSlots && m.timeSlots.length > 0 ? m.timeSlots.join(', ') : m.frequency || 'Daily';
        return `
          <tr>
            <td style="font-weight: 600; color: #111827;">
              ${m.name}
              ${m.prescribedBy ? `<br><span style="font-size: 11px; font-weight: normal; color: #6B7280;">Prescribed by Dr. ${m.prescribedBy}</span>` : ''}
            </td>
            <td style="font-weight: 600; color: #374151;">${m.dosage}</td>
            <td style="color: #4B5563; font-size: 13px;">${slots}</td>
            <td style="color: #6B7280; font-size: 12px;">${m.instructions || 'As directed'}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="4" style="text-align: center; color: #9CA3AF; padding: 20px;">No active medications prescribed.</td></tr>`;

  // Allergies banner
  const allergiesHtml = data.allergies.length > 0
    ? `
      <div style="background-color: #FEF2F2; border: 1.5px solid #F87171; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <strong style="color: #DC2626; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Known Allergies (Patient Safety Alert)</strong>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${data.allergies.map(a => `<span style="background: #FEE2E2; color: #991B1B; font-weight: 600; font-size: 13px; padding: 4px 12px; border-radius: 6px; border: 1px solid #FCA5A5;">${a}</span>`).join('')}
        </div>
      </div>
    `
    : `
      <div style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 10px; padding: 10px 16px; margin-bottom: 20px; color: #166534; font-size: 13px;">
        <strong>✓ No Known Allergies Reported</strong> (NKDA)
      </div>
    `;

  // Medical conditions tags
  const conditionsHtml = data.medicalConditions.length > 0
    ? data.medicalConditions.map(c => `<span style="background: #FFF7ED; color: #C2410C; font-weight: 600; font-size: 13px; padding: 4px 12px; border-radius: 6px; border: 1px solid #FFEDD5;">${c}</span>`).join('')
    : '<span style="color: #9CA3AF; font-size: 13px;">No chronic conditions recorded</span>';

  // Emergency contact display
  const primaryContact = data.beneficiary.emergencyContacts.find(c => c.isPrimary) || data.beneficiary.emergencyContacts[0];
  const emergencyContactStr = primaryContact
    ? `${primaryContact.name} (${primaryContact.relationship}) - ${primaryContact.phone}`
    : 'Not configured';

  // Adherence badge color
  let adherenceBadgeBg = '#ECFDF5';
  let adherenceBadgeColor = '#059669';
  if (data.adherence.percentage < 65) {
    adherenceBadgeBg = '#FEF2F2';
    adherenceBadgeColor = '#DC2626';
  } else if (data.adherence.percentage < 85) {
    adherenceBadgeBg = '#FFFBEB';
    adherenceBadgeColor = '#D97706';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Health Summary - ${data.beneficiary.name}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      color: #1F2937;
      background: #FFFFFF;
      font-size: 13px;
      line-height: 1.5;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #FE6700;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #FE6700;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #6B7280;
      margin: 2px 0 0 0;
    }
    .report-meta {
      text-align: right;
      font-size: 11px;
      color: #6B7280;
    }
    .patient-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .patient-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 2fr;
      gap: 12px;
    }
    .patient-item label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #9CA3AF;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .patient-item span {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 22px 0 10px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 6px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 18px;
    }
    table.data-table th {
      background: #F9FAFB;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #4B5563;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 12px;
      border-top: 1px solid #E5E7EB;
      border-bottom: 1px solid #E5E7EB;
    }
    table.data-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 13px;
    }
    .adherence-container {
      display: flex;
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      align-items: center;
      justify-content: space-between;
    }
    .adherence-metric {
      text-align: center;
    }
    .adherence-metric strong {
      display: block;
      font-size: 20px;
      font-weight: 800;
    }
    .adherence-metric span {
      font-size: 11px;
      color: #6B7280;
      text-transform: uppercase;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px dashed #D1D5DB;
      padding-top: 14px;
      font-size: 11px;
      color: #9CA3AF;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <h1 class="brand-title">MaiHoonNa</h1>
        <p class="brand-subtitle">Senior Care & Clinical Health Summary</p>
      </td>
      <td class="report-meta" style="vertical-align: middle;">
        <div><strong>REPORT ID:</strong> ${data.reportId}</div>
        <div><strong>DATE:</strong> ${formattedDate}</div>
        <div><strong>CONFIDENTIAL MEDICAL DOCUMENT</strong></div>
      </td>
    </tr>
  </table>

  <!-- Patient Demographics Card -->
  <div class="patient-box">
    <div class="patient-grid">
      <div class="patient-item">
        <label>Beneficiary Senior</label>
        <span>${data.beneficiary.name}</span>
      </div>
      <div class="patient-item">
        <label>Age / Gender</label>
        <span>${data.beneficiary.age} yrs / ${data.beneficiary.gender}</span>
      </div>
      <div class="patient-item">
        <label>Blood Group</label>
        <span style="color: #DC2626; font-weight: 800;">${data.beneficiary.bloodGroup}</span>
      </div>
      <div class="patient-item">
        <label>Primary Physician</label>
        <span>${data.beneficiary.primaryPhysicianName ? 'Dr. ' + data.beneficiary.primaryPhysicianName : 'Not Assigned'}</span>
      </div>
    </div>
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #E5E7EB; display: flex; justify-content: space-between; font-size: 12px; color: #4B5563;">
      <div><strong>Address:</strong> ${data.beneficiary.address || 'Address on record'}</div>
      <div><strong>Emergency Contact:</strong> ${emergencyContactStr}</div>
    </div>
  </div>

  <!-- Known Allergies -->
  ${allergiesHtml}

  <!-- Medical Conditions -->
  <div class="section-title">Diagnosed Medical Conditions</div>
  <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
    ${conditionsHtml}
  </div>

  <!-- Current Vitals & Latest Readings -->
  <div class="section-title">Latest Recorded Vitals & Biometrics</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Vital Parameter</th>
        <th>Latest Reading</th>
        <th>Normal Reference Range</th>
        <th>Status</th>
        <th>Recorded On & Source</th>
      </tr>
    </thead>
    <tbody>
      ${vitalsRows}
    </tbody>
  </table>

  <!-- Detailed Readings History Table (User Requested Reading Filter) -->
  <div class="section-title">Detailed Readings Log (Last ${readingLimit} Records)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Date & Time</th>
        <th>Vital Parameter</th>
        <th>Recorded Value</th>
        <th>Status</th>
        <th>Recorded By</th>
      </tr>
    </thead>
    <tbody>
      ${readingLogRows}
    </tbody>
  </table>

  <!-- Prescribed Medications & Regimen -->
  <div class="section-title">Active Prescribed Medications</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Medicine & Prescriber</th>
        <th>Dosage</th>
        <th>Schedule / Timing</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${medicationRows}
    </tbody>
  </table>

  <!-- 30-Day Medication Adherence -->
  <div class="section-title">Medication Adherence (Past 30 Days)</div>
  <div class="adherence-container">
    <div class="adherence-metric">
      <strong style="color: ${adherenceBadgeColor};">${data.adherence.percentage}%</strong>
      <span>Overall Adherence</span>
    </div>
    <div class="adherence-metric">
      <strong style="color: #059669;">${data.adherence.takenCount}</strong>
      <span>Doses Taken</span>
    </div>
    <div class="adherence-metric">
      <strong style="color: #DC2626;">${data.adherence.missedCount}</strong>
      <span>Doses Missed</span>
    </div>
    <div class="adherence-metric">
      <strong style="color: #374151;">${data.adherence.totalScheduled}</strong>
      <span>Total Scheduled</span>
    </div>
    <div style="background: ${adherenceBadgeBg}; color: ${adherenceBadgeColor}; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; text-transform: uppercase;">
      ${data.adherence.status.replace('_', ' ')}
    </div>
  </div>

  ${data.careOverview.assignedCompanionName ? `
    <!-- Care Overview -->
    <div class="section-title">Care Companion & Recent Interaction</div>
    <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px;">
      <div><strong>Assigned Companion:</strong> ${data.careOverview.assignedCompanionName}</div>
      ${data.careOverview.lastVisitDate ? `<div><strong>Last Completed Visit:</strong> ${data.careOverview.lastVisitDate} (Mood: ${data.careOverview.lastVisitMood || 'Good'})</div>` : ''}
      ${data.careOverview.notes ? `<div style="margin-top: 6px; color: #4B5563;"><strong>Care Notes:</strong> ${data.careOverview.notes}</div>` : ''}
    </div>
  ` : ''}

  <!-- Footer & Clinical Disclaimer -->
  <div class="footer">
    <strong>DISCLAIMER:</strong> This Health Summary is compiled from MaiHoonNa senior care tracking, care companion visit logs, and self-reported vitals.<br>
    It is intended for family coordination, routine tracking, and clinical consultations. For emergency medical needs, contact emergency services immediately.<br>
    © ${new Date().getFullYear()} MaiHoonNa Senior Care. All rights reserved. Confidential.
  </div>

</body>
</html>
  `;
}

/**
 * Generates a PDF file on the device filesystem.
 */
export async function generateHealthSummaryPDF(data: HealthSummaryData, readingLimit: number = 10): Promise<{ uri: string }> {
  const html = generateHealthSummaryHtml(data, readingLimit);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  return { uri };
}

/**
 * Downloads and saves/shares the PDF.
 */
export async function downloadHealthSummaryPDF(data: HealthSummaryData, readingLimit: number = 10): Promise<void> {
  const { uri } = await generateHealthSummaryPDF(data, readingLimit);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Save Health Summary - ${data.beneficiary.name}`,
      UTI: 'com.adobe.pdf'
    });
  } else {
    Alert.alert('Notice', 'PDF sharing/download is not available on this device.');
  }
}

/**
 * Opens native sharing sheet to share the PDF directly (WhatsApp, Email, AirDrop).
 */
export async function shareHealthSummaryPDF(data: HealthSummaryData, readingLimit: number = 10): Promise<void> {
  const { uri } = await generateHealthSummaryPDF(data, readingLimit);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Health Summary - ${data.beneficiary.name}`,
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('Notice', 'Sharing is not available on this device.');
  }
}

/**
 * Formats a clean WhatsApp / SMS text summary for quick sharing.
 */
export async function shareHealthSummaryText(data: HealthSummaryData): Promise<void> {
  const allergiesList = data.allergies.length > 0 ? data.allergies.join(', ') : 'None reported (NKDA)';
  const conditionsList = data.medicalConditions.length > 0 ? data.medicalConditions.join(', ') : 'None recorded';

  const vitalsText = data.vitals.slice(0, 5).map(v => `• ${v.name}: ${v.value} ${v.unit}`).join('\n');
  const medsText = data.medications.slice(0, 5).map(m => `• ${m.name} (${m.dosage}) - ${m.frequency}`).join('\n');

  const textMessage = `📋 *HEALTH SUMMARY: ${data.beneficiary.name}*
Age: ${data.beneficiary.age} | Blood: ${data.beneficiary.bloodGroup}

⚠️ *Allergies:* ${allergiesList}
🩺 *Conditions:* ${conditionsList}

📊 *Latest Vitals:*
${vitalsText || 'No recent vitals'}

💊 *Active Medications:*
${medsText || 'No active medications'}
Adherence: ${data.adherence.percentage}% (Past 30 days)

Generated via MaiHoonNa Senior Care App`;

  try {
    await Share.share({
      message: textMessage,
      title: `Health Summary - ${data.beneficiary.name}`,
    });
  } catch (err) {
    console.error('Error sharing text summary:', err);
  }
}
