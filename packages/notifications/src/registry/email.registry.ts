export interface EmailTemplateConfig {
  template: string; // AWS SES Template Name
  variables: string[]; // Expected variable keys in dictionary
}

export const EmailRegistry: Record<string, EmailTemplateConfig> = {
  // ─── 1. Partner Ecosystem ──────────────────────────────────────────────────
  PARTNER_ENROLMENT_REQUEST: {
    template: 'MaiHoonNa_PartnerEnrolmentRequest',
    variables: ['partner_name', 'partner_type'],
  },
  PARTNER_ENROLMENT_APPROVED: {
    template: 'MaiHoonNa_PartnerEnrolmentApproved',
    variables: ['partner_name'],
  },

  // ─── 2. Onboarding & Account Management ────────────────────────────────────
  SUBSCRIBER_ACCOUNT_CREATED: {
    template: 'MaiHoonNa_SubscriberAccountCreated',
    variables: ['subscriber_name'],
  },
  WAITLIST_CONFIRMATION: {
    template: 'MaiHoonnaWaitlistTemplate',
    variables: ['name', 'mobile', 'email', 'pincode'],
  },
  BENEFICIARY_PROFILE_CREATED: {
    template: 'MaiHoonNa_BeneficiaryProfileCreated',
    variables: ['beneficiary_name', 'subscriber_name'],
  },

  // ─── 3. Subscriptions & Billing ────────────────────────────────────────────
  SUBSCRIPTION_REQUEST_SUBMITTED: {
    template: 'MaiHoonNa_SubscriptionRequestSubmitted',
    variables: ['subscriber_name', 'beneficiary_name', 'package_name'],
  },
  SUBSCRIPTION_APPROVED_ACTIVATED: {
    template: 'MaiHoonNa_SubscriptionApprovedActivated',
    variables: ['subscriber_name', 'package_name', 'beneficiary_name', 'start_date'],
  },
  SUBSCRIPTION_ACTIVATED: {
    template: 'MaiHoonNa_SubscriptionApprovedActivated',
    variables: ['subscriber_name', 'package_name', 'beneficiary_name', 'start_date'],
  },
  NEW_SUBSCRIPTION_PENDING_REVIEW: {
    template: 'MaiHoonNa_NewSubscriptionPendingReview',
    variables: ['subscriber_name', 'beneficiary_name', 'package_name'],
  },
  SUBSCRIPTION_PENDING_APPROVAL: {
    template: 'MaiHoonNa_SubscriptionPendingApproval',
    variables: ['subscriber_name', 'beneficiary_name', 'package_name'],
  },
  SUBSCRIPTION_HOURS_RUNNING_LOW: {
    template: 'MaiHoonNa_SubscriptionHoursRunningLow',
    variables: ['beneficiary_name', 'consumed_percentage'],
  },
  SUBSCRIPTION_HOURS_EXHAUSTED: {
    template: 'MaiHoonNa_SubscriptionHoursExhausted',
    variables: ['beneficiary_name'],
  },
  SUBSCRIPTION_RENEWAL_REMINDER: {
    template: 'MaiHoonNa_SubscriptionRenewalReminder',
    variables: ['subscriber_name', 'package_name', 'beneficiary_name', 'expiry_date'],
  },
  RENEWAL_PAYMENT_LINK: {
    template: 'MaiHoonNa_RenewalPaymentLink',
    variables: ['beneficiary_name', 'package_name', 'payment_link'],
  },
  PAYMENT_SUCCESSFUL: {
    template: 'MaiHoonNa_PaymentSuccessful',
    variables: ['amount', 'beneficiary_name', 'package_name'],
  },
  PAYMENT_FAILED: {
    template: 'MaiHoonNa_PaymentFailed',
    variables: ['amount', 'beneficiary_name', 'payment_link'],
  },
  FREE_TRIAL_ENDING_SOON: {
    template: 'MaiHoonNa_FreeTrialEndingSoon',
    variables: ['days_left'],
  },
  SUBSCRIPTION_TERMINATED: {
    template: 'MaiHoonNa_SubscriptionTerminated',
    variables: ['beneficiary_name', 'effective_date'],
  },

  // ─── 4. Care Mitra & Visit Operations ──────────────────────────────────────
  CARE_MITRA_ASSIGNED: {
    template: 'MaiHoonNa_CareMitraAssigned',
    variables: ['cc_name', 'beneficiary_name', 'contact_number'],
  },
  VISIT_STARTED: {
    template: 'MaiHoonNa_VisitStarted',
    variables: ['cc_name', 'beneficiary_name', 'checkin_time'],
  },
  VISIT_COMPLETED: {
    template: 'MaiHoonNa_VisitCompleted',
    variables: ['cc_name', 'beneficiary_name', 'duration'],
  },
  MISSED_VISIT: {
    template: 'MaiHoonNa_MissedVisit',
    variables: ['beneficiary_name'],
  },
  DAILY_VISIT_SUMMARY: {
    template: 'MaiHoonNa_DailyVisitSummaryDigest',
    variables: ['subscriber_name', 'beneficiary_name', 'mood', 'visit_notes'],
  },
  DAILY_VISIT_SUMMARY_DIGEST: {
    template: 'MaiHoonNa_DailyVisitSummaryDigest',
    variables: ['subscriber_name', 'beneficiary_name', 'mood', 'visit_notes'],
  },
  WEEKLY_WELLBEING_DIGEST: {
    template: 'MaiHoonNa_WeeklyWellbeingDigest',
    variables: ['beneficiary_name'],
  },
  MONTHLY_HEALTH_SUMMARY: {
    template: 'MaiHoonNa_MonthlyHealthSummary',
    variables: ['beneficiary_name', 'month'],
  },

  // ─── 5. Health, Vitals & Alerts ────────────────────────────────────────────
  VITALS_ALERT: {
    template: 'MaiHoonNa_VitalsAlert',
    variables: ['beneficiary_name', 'vital_type', 'reading', 'cc_name'],
  },
  MEDICATION_MISSED: {
    template: 'MaiHoonNa_MedicationMissed',
    variables: ['beneficiary_name', 'medication_name', 'scheduled_time'],
  },
  MOOD_ALERT: {
    template: 'MaiHoonNa_MoodAlert',
    variables: ['beneficiary_name', 'mood', 'cc_name'],
  },
  HAPPINESS_SCORE_DROPPED: {
    template: 'MaiHoonNa_HappinessScoreDropped',
    variables: ['beneficiary_name', 'new_score'],
  },
  CONSECUTIVE_NEGATIVE_MOOD: {
    template: 'MaiHoonNa_ConsecutiveNegativeMood',
    variables: ['beneficiary_name'],
  },
  EMERGENCY_RESOLVED: {
    template: 'MaiHoonNa_EmergencyResolved',
    variables: ['beneficiary_name', 'resolution_notes'],
  },

  // ─── 6. Scheduling & Appointments ──────────────────────────────────────────
  SCHEDULE_CHANGE_REQUEST_SUBMITTED: {
    template: 'MaiHoonNa_ScheduleChangeRequestSubmitted',
    variables: ['subscriber_name', 'beneficiary_name', 'requested_date'],
  },
  SCHEDULE_CHANGE_STATUS: {
    template: 'MaiHoonNa_ScheduleChangeStatus',
    variables: ['status', 'beneficiary_name', 'new_datetime'],
  },
  APPOINTMENT_UPDATE: {
    template: 'MaiHoonNa_AppointmentUpdate',
    variables: ['beneficiary_name', 'service_type', 'appointment_time'],
  },
  PHYSIOTHERAPY_SCHEDULED: {
    template: 'MaiHoonNa_PhysiotherapyScheduled',
    variables: ['beneficiary_name', 'therapist_name', 'scheduled_time'],
  },
  LAB_APPOINTMENT_SCHEDULED: {
    template: 'MaiHoonNa_LabAppointmentScheduled',
    variables: ['beneficiary_name', 'lab_name', 'scheduled_time'],
  },

  // ─── 7. Saathi Network ─────────────────────────────────────────────────────
  SAATHI_REGISTRATION_SUBMITTED: {
    template: 'MaiHoonNa_SaathiRegistrationSubmitted',
    variables: ['volunteer_name'],
  },
  SAATHI_PROFILE_APPROVED: {
    template: 'MaiHoonNa_SaathiProfileApproved',
    variables: ['volunteer_name'],
  },
  NEW_BENEFICIARY_MATCH: {
    template: 'MaiHoonNa_NewBeneficiaryMatch',
    variables: ['volunteer_name', 'beneficiary_name', 'distance_km'],
  },

  // ─── 8. Staff Onboarding & Operations ──────────────────────────────────────
  CARE_MITRA_ONBOARDING_APPROVED: {
    template: 'MaiHoonNa_CareMitraOnboardingApproved',
    variables: ['cc_name'],
  },
  CARE_MITRA_DEACTIVATED: {
    template: 'MaiHoonNa_CareMitraDeactivated',
    variables: ['cc_name', 'reason'],
  },
  BGV_STATUS_UPDATE: {
    template: 'MaiHoonNa_BGVStatusUpdate',
    variables: ['candidate_name', 'bgv_status'],
  },
  WEEKLY_ZONE_REPORT: {
    template: 'MaiHoonNa_WeeklyZoneReport',
    variables: ['zone_name', 'week_start', 'week_end'],
  },
  COMMUNITY_EVENT_UPCOMING: {
    template: 'MaiHoonNa_CommunityEventUpcoming',
    variables: ['event_name', 'event_date', 'event_location'],
  },
};
