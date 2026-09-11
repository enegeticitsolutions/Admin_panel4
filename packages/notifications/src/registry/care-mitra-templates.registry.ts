export type NotificationChannelType = 'push' | 'whatsapp' | 'email' | 'sms' | 'in_app';
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';
export type WhatsAppCategory = 'Utility' | 'Marketing' | 'Authentication';

export interface CareMitraTemplateDefinition {
  id: string; // e.g. "NT-006"
  key: string; // e.g. "CARE_MITRA_ONBOARDING_CLEARED"
  module: string;
  triggerEvent: string;
  channels: NotificationChannelType[];
  whatsappCategory: WhatsAppCategory;
  whatsappTemplate: string;
  priority: NotificationPriority;
  subject: string;
  bodyTemplate: string;
  variables: string[]; // ['ccName', 'fmName'] etc.
}

export const CareMitraTemplates: Record<string, CareMitraTemplateDefinition> = {
  // NT-006: Onboarding & Account — BGV approved, deployment cleared
  CARE_MITRA_ONBOARDING_CLEARED: {
    id: 'NT-006',
    key: 'CARE_MITRA_ONBOARDING_CLEARED',
    module: 'Onboarding & Account',
    triggerEvent: 'Care Mitra onboarding — BGV approved, deployment cleared',
    channels: ['push', 'whatsapp', 'email', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'care_mitra_onboarding_cleared',
    priority: 'high',
    subject: 'Welcome to the MaiHoonNa Team',
    bodyTemplate: "Congratulations {{ccName}}! Your onboarding is complete and you're cleared for deployment. Your Field Manager is {{fmName}}.",
    variables: ['ccName', 'fmName'],
  },

  // NT-007: Onboarding & Account — Care Mitra training reminder
  CARE_MITRA_TRAINING_REMINDER: {
    id: 'NT-007',
    key: 'CARE_MITRA_TRAINING_REMINDER',
    module: 'Onboarding & Account',
    triggerEvent: 'Care Mitra training reminder',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'care_mitra_training_reminder',
    priority: 'normal',
    subject: 'Training Session Reminder',
    bodyTemplate: 'Hi {{ccName}}, reminder: your {{moduleName}} training session is scheduled for {{date}} at {{timeLocation}}.',
    variables: ['ccName', 'moduleName', 'date', 'timeLocation'],
  },

  // NT-010: Visit & Encounter — Visit scheduled / roster published
  CARE_MITRA_VISIT_SCHEDULED: {
    id: 'NT-010',
    key: 'CARE_MITRA_VISIT_SCHEDULED',
    module: 'Visit & Encounter',
    triggerEvent: 'Visit scheduled / roster published',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'visit_scheduled',
    priority: 'normal',
    subject: 'New Visit Scheduled',
    bodyTemplate: 'Hi {{ccName}}, you have a visit with {{beneficiaryName}} on {{date}} at {{time}}. Address: {{address}}.',
    variables: ['ccName', 'beneficiaryName', 'date', 'time', 'address'],
  },

  // NT-011: Visit & Encounter — Visit reminder (1 hour before)
  CARE_MITRA_VISIT_REMINDER: {
    id: 'NT-011',
    key: 'CARE_MITRA_VISIT_REMINDER',
    module: 'Visit & Encounter',
    triggerEvent: 'Visit reminder (1 hour before)',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'visit_reminder',
    priority: 'high',
    subject: 'Upcoming Visit Reminder',
    bodyTemplate: 'Reminder: your visit with {{beneficiaryName}} starts at {{time}}. Tap to view directions.',
    variables: ['beneficiaryName', 'time'],
  },

  // NT-064: Care Team & Allocation — Birthday / special occasion reminder
  CARE_MITRA_BIRTHDAY_REMINDER: {
    id: 'NT-064',
    key: 'CARE_MITRA_BIRTHDAY_REMINDER',
    module: 'Care Team & Allocation',
    triggerEvent: 'Birthday / special occasion reminder',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Marketing',
    whatsappTemplate: 'birthday_reminder',
    priority: 'low',
    subject: 'Celebration Reminder',
    bodyTemplate: "Reminder: it's {{beneficiaryName}}'s birthday on {{date}}! Plan a small celebration during your visit.",
    variables: ['beneficiaryName', 'date'],
  },

  // NT-065: Care Team & Allocation — CC performance rating received
  CARE_MITRA_PERFORMANCE_RATING: {
    id: 'NT-065',
    key: 'CARE_MITRA_PERFORMANCE_RATING',
    module: 'Care Team & Allocation',
    triggerEvent: 'CC performance rating received',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'cc_performance_rating',
    priority: 'low',
    subject: 'New Feedback Received',
    bodyTemplate: 'You received a {{rating}}-star rating from {{beneficiaryName}}\'s family. Comment: "{{comment}}"',
    variables: ['rating', 'beneficiaryName', 'comment'],
  },

  // NT-070: Community & Saathi Network — Saathi interaction request received
  SAATHI_INTERACTION_REQUEST: {
    id: 'NT-070',
    key: 'SAATHI_INTERACTION_REQUEST',
    module: 'Community & Saathi Network',
    triggerEvent: 'Saathi interaction request received',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'saathi_interaction_request',
    priority: 'normal',
    subject: 'New Saathi Request',
    bodyTemplate: '{{beneficiaryName}} has requested an interaction with you via Saathi Network. Tap to accept or view details.',
    variables: ['beneficiaryName'],
  },

  // NT-071: Community & Saathi Network — Saathi visit completed — credits earned
  SAATHI_VISIT_CREDITS_EARNED: {
    id: 'NT-071',
    key: 'SAATHI_VISIT_CREDITS_EARNED',
    module: 'Community & Saathi Network',
    triggerEvent: 'Saathi visit completed — credits earned',
    channels: ['push', 'whatsapp', 'in_app'],
    whatsappCategory: 'Utility',
    whatsappTemplate: 'saathi_visit_completed',
    priority: 'low',
    subject: 'Saathi Credits Earned',
    bodyTemplate: "Thank you for spending time with {{beneficiaryName}}! You've earned {{credits}} Saathi credits.",
    variables: ['beneficiaryName', 'credits'],
  },
};

/**
 * Formats body and subject text replacing {{variableName}} with actual values
 */
export function formatTemplateText(templateText: string, variables: Record<string, any>): string {
  let result = templateText;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, String(value ?? ''));
  }
  return result;
}
