import {
  NotificationChannelType,
  NotificationPriority,
  WhatsAppCategory,
} from './care-mitra-templates.registry';

export interface SathiTemplateDefinition {
  id: string; // e.g. "ST-001"
  key: string; // e.g. "SAATHI_LOGIN_OTP"
  module: string;
  category?: string;
  triggerEvent: string;
  audience: 'Saathi Volunteer' | 'Program Coordinator';
  channels: NotificationChannelType[];
  whatsappCategory: WhatsAppCategory;
  priority: NotificationPriority;
  subject: string;
  title?: string;
  bodyTemplate: string;
  variables: string[];
  targetScreen?: string; // deep link target in sathi-app
  notes?: string;
}

export const SathiTemplates: Record<string, SathiTemplateDefinition> = {
  // ST-001: Onboarding & Account — OTP for login / signup
  SAATHI_LOGIN_OTP: {
    id: 'ST-001',
    key: 'SAATHI_LOGIN_OTP',
    module: 'Onboarding & Account',
    triggerEvent: 'OTP for login / signup',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'sms'],
    whatsappCategory: 'Authentication',
    priority: 'critical',
    subject: 'Saathi Login OTP',
    bodyTemplate: 'Your Saathi Network OTP is {{otpCode}}. Valid for 10 minutes. Do not share this code with anyone.',
    variables: ['otpCode'],
    targetScreen: '/(auth)/otp',
  },

  // ST-002: Onboarding & Account — Saathi registration submitted
  SAATHI_REGISTRATION_SUBMITTED: {
    id: 'ST-002',
    key: 'SAATHI_REGISTRATION_SUBMITTED',
    module: 'Onboarding & Account',
    triggerEvent: 'Saathi registration submitted',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'email'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Registration Received',
    bodyTemplate: "Hi {{volunteerName}}, thanks for registering as a Saathi! We're reviewing your application and will notify you within 2-3 days.",
    variables: ['volunteerName'],
    targetScreen: '/(sathi)/profile',
  },

  // ST-003: Onboarding & Account — Saathi profile approved & activated
  SAATHI_PROFILE_APPROVED: {
    id: 'ST-003',
    key: 'SAATHI_PROFILE_APPROVED',
    module: 'Onboarding & Account',
    triggerEvent: 'Saathi profile approved & activated',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'email'],
    whatsappCategory: 'Utility',
    priority: 'high',
    subject: 'Welcome to the Saathi Network!',
    bodyTemplate: 'Congratulations {{volunteerName}}! Your Saathi profile is approved. Head to the Match tab to view beneficiaries near you.',
    variables: ['volunteerName'],
    targetScreen: '/(sathi)/match',
  },

  // ST-005: Onboarding & Account — Profile edited & saved
  SAATHI_PROFILE_UPDATED: {
    id: 'ST-005',
    key: 'SAATHI_PROFILE_UPDATED',
    module: 'Onboarding & Account',
    triggerEvent: 'Profile edited & saved',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Profile Updated',
    bodyTemplate: 'Hi {{volunteerName}}, your profile changes have been saved successfully.',
    variables: ['volunteerName'],
    targetScreen: '/(sathi)/profile',
  },

  // ST-010: Matching & Beneficiaries — New beneficiary match assigned
  SAATHI_BENEFICIARY_MATCHED: {
    id: 'ST-010',
    key: 'SAATHI_BENEFICIARY_MATCHED',
    module: 'Matching & Beneficiaries',
    triggerEvent: 'New beneficiary match assigned',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'email'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'New Beneficiary Match',
    bodyTemplate: "Hi {{volunteerName}}, you've been matched with {{beneficiaryName}}, a senior beneficiary {{distanceKm}} km away. Review their profile and schedule your first visit.",
    variables: ['volunteerName', 'beneficiaryName', 'distanceKm'],
    targetScreen: '/(sathi)/match',
  },

  // ST-011: Matching & Beneficiaries — Beneficiary reassigned / match removed
  SAATHI_BENEFICIARY_UNMATCHED: {
    id: 'ST-011',
    key: 'SAATHI_BENEFICIARY_UNMATCHED',
    module: 'Matching & Beneficiaries',
    triggerEvent: 'Beneficiary reassigned / match removed',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Match Update',
    bodyTemplate: 'Hi {{volunteerName}}, {{beneficiaryName}} is no longer in your assigned beneficiary list.',
    variables: ['volunteerName', 'beneficiaryName'],
    targetScreen: '/(sathi)/match',
  },

  // ST-012: Matching & Beneficiaries — Visit request received
  SAATHI_VISIT_REQUEST_RECEIVED: {
    id: 'ST-012',
    key: 'SAATHI_VISIT_REQUEST_RECEIVED',
    module: 'Matching & Beneficiaries',
    triggerEvent: 'Visit request received',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'New Visit Request',
    bodyTemplate: "{{beneficiaryName}} has requested a visit. Tap 'View All' under Visit Requests to accept or view details.",
    variables: ['beneficiaryName'],
    targetScreen: '/(sathi)',
  },

  // ST-013: Matching & Beneficiaries — No visits logged in 14 days — nudge
  SAATHI_VISIT_INACTIVE_NUDGE: {
    id: 'ST-013',
    key: 'SAATHI_VISIT_INACTIVE_NUDGE',
    module: 'Matching & Beneficiaries',
    triggerEvent: 'No visits logged in 14 days — nudge',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Marketing',
    priority: 'low',
    subject: 'We Miss You at Saathi!',
    bodyTemplate: "Hi {{volunteerName}}, it's been a while since your last visit. {{beneficiaryName}} and others would love to see you — tap to check in.",
    variables: ['volunteerName', 'beneficiaryName'],
    targetScreen: '/(sathi)/match',
  },

  // ST-020: Visit & Hours Logging — Check-in confirmed
  SAATHI_CHECKIN_CONFIRMED: {
    id: 'ST-020',
    key: 'SAATHI_CHECKIN_CONFIRMED',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Check-in confirmed',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Check-In Confirmed',
    bodyTemplate: "You've checked in with {{beneficiaryName}} at {{checkInTime}}. Your companion hours are now being logged.",
    variables: ['beneficiaryName', 'checkInTime'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-021: Visit & Hours Logging — Visit completed / checked out
  SAATHI_VISIT_CHECKED_OUT: {
    id: 'ST-021',
    key: 'SAATHI_VISIT_CHECKED_OUT',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Visit completed / checked out',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Visit Completed',
    bodyTemplate: "Great job, {{volunteerName}}! Your visit with {{beneficiaryName}} lasted {{duration}}. You've earned +{{points}} pts.",
    variables: ['volunteerName', 'beneficiaryName', 'duration', 'points'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-022: Visit & Hours Logging — Feedback not yet submitted — reminder
  SAATHI_FEEDBACK_REMINDER: {
    id: 'ST-022',
    key: 'SAATHI_FEEDBACK_REMINDER',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Feedback not yet submitted — reminder',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Add Your Visit Feedback',
    bodyTemplate: "Hi {{volunteerName}}, don't forget to add feedback for your visit with {{beneficiaryName}} on {{visitDate}}. It only takes a minute.",
    variables: ['volunteerName', 'beneficiaryName', 'visitDate'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-023: Visit & Hours Logging — Beneficiary confirmed visit completion
  SAATHI_VISIT_CONFIRMED_BY_BENEFICIARY: {
    id: 'ST-023',
    key: 'SAATHI_VISIT_CONFIRMED_BY_BENEFICIARY',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Beneficiary confirmed visit completion',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Visit Confirmed by Beneficiary',
    bodyTemplate: '{{beneficiaryName}} confirmed your visit is complete. +{{points}} pts credited to your account.',
    variables: ['beneficiaryName', 'points'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-024: Visit & Hours Logging — Monthly goal achieved (100%)
  SAATHI_MONTHLY_GOAL_ACHIEVED: {
    id: 'ST-024',
    key: 'SAATHI_MONTHLY_GOAL_ACHIEVED',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Monthly goal achieved (100%)',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'email'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Monthly Goal Achieved! 🎉',
    bodyTemplate: "Congratulations {{volunteerName}}! You've hit 100% of your Monthly Goal — {{hoursLogged}}/{{goalHours}} hours this month.",
    variables: ['volunteerName', 'hoursLogged', 'goalHours'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-025: Visit & Hours Logging — Monthly goal at-risk — mid-month reminder
  SAATHI_MONTHLY_GOAL_AT_RISK: {
    id: 'ST-025',
    key: 'SAATHI_MONTHLY_GOAL_AT_RISK',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Monthly goal at-risk — mid-month reminder',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Marketing',
    priority: 'low',
    subject: 'Keep Going!',
    bodyTemplate: "Hi {{volunteerName}}, you're at {{hoursLogged}}/{{goalHours}} hours toward this month's goal. A short visit this week keeps you on track.",
    variables: ['volunteerName', 'hoursLogged', 'goalHours'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-026: Visit & Hours Logging — Visit checked in but never checked out
  SAATHI_VISIT_NOT_CHECKED_OUT: {
    id: 'ST-026',
    key: 'SAATHI_VISIT_NOT_CHECKED_OUT',
    module: 'Visit & Hours Logging',
    triggerEvent: 'Visit checked in but never checked out',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Check-Out Needed',
    bodyTemplate: 'Hi {{volunteerName}}, we noticed your visit with {{beneficiaryName}} on {{visitDate}} was never checked out. Please complete it to log your hours.',
    variables: ['volunteerName', 'beneficiaryName', 'visitDate'],
    targetScreen: '/(sathi)/hours',
  },

  // ST-030: Rewards & Credits — Credits earned after a visit
  SAATHI_CREDITS_EARNED: {
    id: 'ST-030',
    key: 'SAATHI_CREDITS_EARNED',
    module: 'Rewards & Credits',
    triggerEvent: 'Credits earned after a visit',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Saathi Credits Earned',
    bodyTemplate: "You've earned +{{points}} pts for your visit with {{beneficiaryName}}. Total balance: {{totalBalance}}.",
    variables: ['points', 'beneficiaryName', 'totalBalance'],
    targetScreen: '/(sathi)/credits',
  },

  // ST-031: Rewards & Credits — Redemption request submitted
  SAATHI_REDEMPTION_REQUESTED: {
    id: 'ST-031',
    key: 'SAATHI_REDEMPTION_REQUESTED',
    module: 'Rewards & Credits',
    triggerEvent: 'Redemption request submitted',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Redemption Received',
    bodyTemplate: 'Hi {{volunteerName}}, your request to redeem {{credits}} credits for a {{giftCardBrand}} Gift Card has been received and is processing.',
    variables: ['volunteerName', 'credits', 'giftCardBrand'],
    targetScreen: '/(sathi)/credits',
  },

  // ST-032: Rewards & Credits — Gift card issued & delivered
  SAATHI_GIFT_CARD_DELIVERED: {
    id: 'ST-032',
    key: 'SAATHI_GIFT_CARD_DELIVERED',
    module: 'Rewards & Credits',
    triggerEvent: 'Gift card issued & delivered',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'email'],
    whatsappCategory: 'Utility',
    priority: 'high',
    subject: 'Your Gift Card is Ready',
    bodyTemplate: 'Your ₹{{amount}} {{giftCardBrand}} Gift Card has been sent to {{recipientContact}}. Check your email/SMS for the code.',
    variables: ['amount', 'giftCardBrand', 'recipientContact'],
    targetScreen: '/(sathi)/credits',
  },

  // ST-033: Rewards & Credits — Credit balance milestone / low-balance nudge
  SAATHI_CREDIT_BALANCE_MILESTONE: {
    id: 'ST-033',
    key: 'SAATHI_CREDIT_BALANCE_MILESTONE',
    module: 'Rewards & Credits',
    triggerEvent: 'Credit balance milestone / low-balance nudge',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Marketing',
    priority: 'low',
    subject: 'You Have Credits Waiting',
    bodyTemplate: 'Hi {{volunteerName}}, you have {{credits}} pts (~₹{{estimatedValue}}) sitting unredeemed. Redeem them anytime from Credits & Rewards.',
    variables: ['volunteerName', 'credits', 'estimatedValue'],
    targetScreen: '/(sathi)/credits',
  },

  // ST-040: Profile & Availability — Address updated
  SAATHI_ADDRESS_UPDATED: {
    id: 'ST-040',
    key: 'SAATHI_ADDRESS_UPDATED',
    module: 'Profile & Availability',
    triggerEvent: 'Address updated',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Address Updated',
    bodyTemplate: "Hi {{volunteerName}}, your address has been updated to {{newAddress}}. We'll re-match nearby beneficiaries accordingly.",
    variables: ['volunteerName', 'newAddress'],
    targetScreen: '/(sathi)/edit-profile',
  },

  // ST-041: Profile & Availability — Availability schedule updated
  SAATHI_AVAILABILITY_UPDATED: {
    id: 'ST-041',
    key: 'SAATHI_AVAILABILITY_UPDATED',
    module: 'Profile & Availability',
    triggerEvent: 'Availability schedule updated',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Utility',
    priority: 'low',
    subject: 'Availability Updated',
    bodyTemplate: 'Hi {{volunteerName}}, your availability has been updated: {{availabilitySummary}}.',
    variables: ['volunteerName', 'availabilitySummary'],
    targetScreen: '/(sathi)/edit-profile',
  },

  // ST-042: Profile & Availability — Incomplete profile nudge
  SAATHI_INCOMPLETE_PROFILE_NUDGE: {
    id: 'ST-042',
    key: 'SAATHI_INCOMPLETE_PROFILE_NUDGE',
    module: 'Profile & Availability',
    triggerEvent: 'Incomplete profile nudge',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Marketing',
    priority: 'low',
    subject: 'Complete Your Saathi Profile',
    bodyTemplate: "Hi {{volunteerName}}, add your interests and 'Why I Joined' so we can match you with beneficiaries who share your hobbies.",
    variables: ['volunteerName'],
    targetScreen: '/(sathi)/edit-profile',
  },

  // ST-050: Guide & Support — New guide tip / best practice published
  SAATHI_GUIDE_TIP_PUBLISHED: {
    id: 'ST-050',
    key: 'SAATHI_GUIDE_TIP_PUBLISHED',
    module: 'Guide & Support',
    triggerEvent: 'New guide tip / best practice published',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp'],
    whatsappCategory: 'Marketing',
    priority: 'low',
    subject: 'New Saathi Guide Tip',
    bodyTemplate: "Hi {{volunteerName}}, we've added a new tip to the Saathi Guide: '{{tipTitle}}'. Tap to read.",
    variables: ['volunteerName', 'tipTitle'],
    targetScreen: '/(sathi)/guide',
  },

  // ST-051: Guide & Support — Emergency support alert acknowledged
  SAATHI_EMERGENCY_ACKNOWLEDGED: {
    id: 'ST-051',
    key: 'SAATHI_EMERGENCY_ACKNOWLEDGED',
    module: 'Guide & Support',
    triggerEvent: 'Emergency support alert acknowledged',
    audience: 'Saathi Volunteer',
    channels: ['push', 'in_app', 'whatsapp', 'sms'],
    whatsappCategory: 'Utility',
    priority: 'high',
    subject: 'Emergency Alert Received',
    bodyTemplate: 'Your emergency alert regarding {{beneficiaryName}} has been received. Program Coordinator {{coordinatorName}} has been notified and will call you shortly.',
    variables: ['beneficiaryName', 'coordinatorName'],
    targetScreen: '/(sathi)/guide',
  },

  // ST-052: Guide & Support — Visit feedback flags a concern
  SAATHI_FEEDBACK_CONCERN_FLAGGED: {
    id: 'ST-052',
    key: 'SAATHI_FEEDBACK_CONCERN_FLAGGED',
    module: 'Guide & Support',
    triggerEvent: 'Visit feedback flags a concern',
    audience: 'Program Coordinator',
    channels: ['push', 'in_app', 'whatsapp', 'email'],
    whatsappCategory: 'Utility',
    priority: 'high',
    subject: 'Feedback Flagged for Review',
    bodyTemplate: '{{volunteerName}} left a concern in visit feedback for {{beneficiaryName}}: "{{feedbackExcerpt}}". Please review and follow up.',
    variables: ['volunteerName', 'beneficiaryName', 'feedbackExcerpt'],
    targetScreen: '/(sathi)/notifications',
  },

  // ST-060: Coordinator Alerts — New Saathi volunteer registered
  COORDINATOR_NEW_VOLUNTEER_REGISTERED: {
    id: 'ST-060',
    key: 'COORDINATOR_NEW_VOLUNTEER_REGISTERED',
    module: 'Coordinator Alerts',
    triggerEvent: 'New Saathi volunteer registered',
    audience: 'Program Coordinator',
    channels: ['push', 'in_app', 'email'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'New Volunteer Registration',
    bodyTemplate: '{{volunteerName}} has registered as a Saathi volunteer in {{zoneCity}}. Review and approve their profile.',
    variables: ['volunteerName', 'zoneCity'],
    targetScreen: '/(sathi)/notifications',
  },

  // ST-061: Coordinator Alerts — Gift card redemption needs approval
  COORDINATOR_REDEMPTION_AWAITING_APPROVAL: {
    id: 'ST-061',
    key: 'COORDINATOR_REDEMPTION_AWAITING_APPROVAL',
    module: 'Coordinator Alerts',
    triggerEvent: 'Gift card redemption needs approval',
    audience: 'Program Coordinator',
    channels: ['push', 'in_app', 'email'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Redemption Awaiting Approval',
    bodyTemplate: '{{volunteerName}} has requested {{credits}} credits (~₹{{estimatedValue}}) as a {{giftCardBrand}} Gift Card. Approve or reject in the admin console.',
    variables: ['volunteerName', 'credits', 'estimatedValue', 'giftCardBrand'],
    targetScreen: '/(sathi)/notifications',
  },

  // ST-062: Coordinator Alerts — Volunteer inactive 30+ days
  COORDINATOR_VOLUNTEER_INACTIVE_30D: {
    id: 'ST-062',
    key: 'COORDINATOR_VOLUNTEER_INACTIVE_30D',
    module: 'Coordinator Alerts',
    triggerEvent: 'Volunteer inactive 30+ days',
    audience: 'Program Coordinator',
    channels: ['push', 'in_app', 'email'],
    whatsappCategory: 'Utility',
    priority: 'normal',
    subject: 'Inactive Volunteer Alert',
    bodyTemplate: '{{volunteerName}} has logged no companion hours in 30 days. Consider a check-in call or reassigning their beneficiaries.',
    variables: ['volunteerName'],
    targetScreen: '/(sathi)/notifications',
  },
};

/**
 * Format string replacing {{variableName}} with actual value
 */
export function formatSathiTemplateText(templateText: string, variables: Record<string, any>): string {
  if (!templateText) return '';
  let result = templateText;
  if (!variables) return result;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, String(value ?? ''));
  }
  return result;
}
