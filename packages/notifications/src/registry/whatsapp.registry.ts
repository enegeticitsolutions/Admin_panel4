export interface WhatsAppTemplateConfig {
  template: string;
  body: string[];
}

export const WhatsAppRegistry: Record<string, WhatsAppTemplateConfig> = {
  // Onboarding & Account
  OTP_LOGIN_SIGNUP: { template: 'otp', body: ['otpCode'] },
  SUBSCRIBER_ACCOUNT_CREATED: { template: 'subscriber_account_created', body: ['subscriberName'] },
  WELCOME_SUBSCRIBER: { template: 'welcome_subscriber', body: ['subscriberName'] },
  SUBSCRIPTION_REQUEST_SUBMITTED: { template: 'subscription_request_submitted', body: ['subscriberName', 'beneficiaryName', 'packageName'] },
  SUBSCRIPTION_ACTIVATED: { template: 'subscription_approved_and_activated', body: ['subscriberName', 'packageName', 'beneficiaryName', 'startDate'] },
  SUBSCRIPTION_ACTIVATED_ALT: { template: 'subscription_activated', body: ['subscriberName', 'packageName', 'beneficiaryName', 'startDate'] },
  BENEF_PROFILE_CREATED: { template: 'benef_profile_created', body: ['beneficiaryName', 'subscriberName'] },
  CM_ONBOARDING_CLEARED: { template: 'care_mitra_onboarding__bgv_approved_deployment_cleared', body: ['ccName', 'fmName'] },
  CM_TRAINING_REMINDER: { template: 'care_mitra_training_reminder', body: ['ccName', 'moduleName', 'date', 'timeLocation'] },
  PASSWORD_RESET_REQUEST: { template: 'password_reset_request', body: ['resetCode'] },

  // Visit & Encounter
  VISIT_SCHEDULED: { template: 'visit_scheduled__roster_published', body: ['ccName', 'beneficiaryName', 'date', 'time', 'address'] },
  VISIT_REMINDER: { template: 'visit_reminder_1_hour_before', body: ['beneficiaryName', 'time'] },
  VISIT_STARTED: { template: 'visit_started_checkin_confirmed', body: ['ccName', 'beneficiaryName', 'checkInTime'] },
  MANUAL_CHECKIN_FLAGGED: { template: 'manual_checkin_override_flagged', body: ['ccName', 'beneficiaryName', 'remarks'] },
  VISIT_COMPLETED: { template: 'visit_completed__checkout_confirmed', body: ['ccName', 'beneficiaryName', 'duration'] },
  DAILY_VISIT_SUMMARY: { template: 'daily_visit_summary_digest', body: ['subscriberName', 'beneficiaryName', 'mood', 'notes'] },
  MISSED_VISIT: { template: 'missed__noshow_visit', body: ['beneficiaryName'] },
  CLINIC_VISIT_STARTED: { template: 'clinic__hospital_escort_visit_started', body: ['ccName', 'beneficiaryName', 'clinicName'] },
  RATING_FEEDBACK_PROMPT: { template: 'ratingfeedback_prompt', body: ['ccName'] },

  // Mood & Happiness Score
  MOOD_ALERT: { template: 'mood_logged_as_sad__anxious__depressed', body: ['beneficiaryName', 'mood', 'ccName'] },
  WELLBEING_CHECK_RECOMMENDED: { template: 'two_consecutive_negative_mood_readings', body: ['beneficiaryName'] },
  HAPPINESS_SCORE_UPDATE: { template: 'happiness_score_update', body: ['beneficiaryName', 'newScore'] },
  WEEKLY_WELLBEING_DIGEST: { template: 'weekly_wellbeing_digest', body: ['beneficiaryName'] },

  // Vitals & Medication
  VITALS_ALERT: { template: 'vitals_alert', body: ['beneficiaryName', 'vitalType', 'reading', 'ccName'] },
  MEDICATION_REMINDER: { template: 'medication_reminder_to_benef', body: ['beneficiaryName', 'medicationName', 'dosage'] },
  MEDICATION_MISSED: { template: 'medication_missed__nonadherence', body: ['beneficiaryName', 'medicationName', 'scheduledTime'] },
  EMR_VITALS_REPORT: { template: 'emr_vitals_report', body: ['beneficiaryName', 'month'] },

  // Scheduling & Subscription
  SCHEDULE_CHANGE_REQUEST: { template: 'schedule_change_request', body: ['subscriberName', 'beneficiaryName', 'requestedDate'] },
  SCHEDULE_CHANGE_DECISION: { template: 'schedule_change_approvedrejected', body: ['decision', 'beneficiaryName', 'newDateTime'] },
  SUBSCRIPTION_RENEWAL_REMINDER: { template: 'subscription_renewal_reminder', body: ['subscriberName', 'packageName', 'beneficiaryName', 'expiryDate'] },
  RENEWAL_PAYMENT: { template: 'renewal_payment', body: ['beneficiaryName', 'packageName', 'paymentLink'] },
  RENEWAL_PAYMENT_LINK: { template: 'renewal_payment', body: ['beneficiaryName', 'packageName', 'paymentLink'] },
  PAYMENT_SUCCESS: { template: 'payment_success', body: ['subscriberName', 'amount', 'transactionId'] },
  PAYMENT_SUCCESSFUL: { template: 'payment_successful', body: ['amount', 'beneficiaryName', 'packageName'] },
  PLAN_PURCHASED: { template: 'plan_purchased', body: ['amount', 'beneficiaryName', 'packageName'] },
  PACKAGE_PAYMENT: { template: 'package_payment', body: ['subscriberName', 'packageName', 'amount', 'paymentLink'] },
  ADDON_PAYMENT: { template: 'addon_payment', body: ['subscriberName', 'addonName', 'amount', 'paymentLink'] },
  PAYMENT_FAILED: { template: 'payment_failed', body: ['subscriberName', 'amount', 'beneficiaryName', 'paymentLink'] },
  SUBSCRIPTION_HOURS_LOW: { template: 'subscription_hours_running_down', body: ['beneficiaryName', 'percentConsumed'] },
  SUBSCRIPTION_HOURS_EXHAUSTED: { template: 'subscription_hours_exhaust', body: ['beneficiaryName'] },
  SUBSCRIPTION_TERMINATED: { template: 'subscription_terminated', body: ['beneficiaryName', 'effectiveDate'] },
  FREE_TRIAL_ENDING: { template: 'free_trial_ending', body: ['subscriberName', 'beneficiaryName', 'endDate'] },

  // Emergency
  EMERGENCY_TRIGGERED: { template: 'emergency_triggered', body: ['beneficiaryName', 'timestamp', 'location'] },
  EMERGENCY_ACKNOWLEDGED: { template: 'emergency_acknowledged_by_erc', body: ['beneficiaryName'] },
  EMERGENCY_SUPPORT_ALERT: { template: 'emergency_support_alert', body: ['beneficiaryName', 'coordinatorName'] },
  AMBULANCE_DISPATCHED: { template: 'ambulance_dispatched', body: ['beneficiaryName', 'eta'] },
  EMERGENCY_RESOLVED: { template: 'emergency_resolved', body: ['beneficiaryName', 'outcome'] },

  // Care Team & Allocation
  CC_ASSIGNED: { template: 'primarysecondary_cc_assigned', body: ['ccName', 'beneficiaryName', 'primaryOrSecondary'] },
  CC_REALLOCATED: { template: 'cc_reallocated_temporarily_replacement', body: ['tempCcName', 'beneficiaryName', 'originalCcName'] },
  NEW_CC_ASSIGNED_TO_FM: { template: 'new_cc_assigned_to_fm', body: ['ccName', 'date'] },
  CC_DEACTIVATED: { template: 'cc_deactivated', body: ['ccName', 'lastWorkingDate', 'reason'] },
  BIRTHDAY_REMINDER: { template: 'birthday_reminder', body: ['beneficiaryName', 'date'] },
  CC_PERFORMANCE_RATING: { template: 'cc_performance_rating_received', body: ['rating', 'beneficiaryName', 'comment'] },

  // Community & Saathi Network
  SAATHI_REGISTRATION_SUBMITTED: { template: 'saathi_registration_submit', body: ['volunteerName'] },
  SAATHI_INTERACTION_REQUEST: { template: 'saathi_interaction_request_received', body: ['beneficiaryName'] },
  SAATHI_VISIT_COMPLETED: { template: 'saathi_visit_completed__credits_earned', body: ['beneficiaryName', 'credits'] },
  SAATHI_VISIT_FEEDBACK_CONCERN: { template: 'visit_feedback_flags_concern', body: ['volunteerName', 'beneficiaryName', 'feedbackExcerpt'] },
  SAATHI_VISIT_CHECKED_IN_NOT_OUT: { template: 'visit_checked_in_but_never_checked_out', body: ['volunteerName', 'beneficiaryName', 'visitDate'] },
  SAATHI_NO_VISITS_LOGGED: { template: 'no_visits_logged', body: ['volunteerName', 'beneficiaryName'] },
  SAATHI_AVAILABILITY_SCHEDULE_UPDATED: { template: 'availability_schedule_updated', body: ['volunteerName', 'availabilitySummary'] },
  SAATHI_EMERGENCY_SUPPORT_ALERT: { template: 'emergency_support_alert', body: ['beneficiaryName', 'coordinatorName'] },
  SAATHI_PROFILE_SAVED: { template: 'profile_edited_saved', body: ['volunteerName'] },
  SAATHI_NEW_BENEFICIARY_MATCH: { template: 'new_beneficiary_match_assigned', body: ['volunteerName', 'beneficiaryName', 'distance'] },
  SAATHI_BENEFICIARY_MATCH_REMOVED: { template: 'beneficiary_reassigned_match_removed', body: ['volunteerName', 'beneficiaryName'] },
  SAATHI_MONTHLY_GOAL_ACHIEVED: { template: 'monthly_goal_achieved', body: ['volunteerName', 'hoursLogged', 'goalHours'] },
  SAATHI_MONTHLY_GOAL_AT_RISK: { template: 'monthly_goal_at_risk_mid_month_reminder', body: ['volunteerName', 'hoursLogged', 'goalHours'] },
  SAATHI_GIFT_CARD_ISSUED: { template: 'gift_card_issued', body: ['giftCardValue', 'giftCardBrand', 'recipientContact'] },
  SAATHI_LOW_BALANCE_NUDGE: { template: 'low_balance_nudge', body: ['volunteerName', 'availableCredits', 'estimatedValue'] },
  SAATHI_ADDRESS_UPDATED: { template: 'address_updated', body: ['volunteerName', 'newAddress'] },
  SAATHI_NEW_GUIDE_TIP: { template: 'new_guide_tip', body: ['volunteerName', 'tipTitle'] },
  SAATHI_PROFILE_COMPLETED: { template: 'profile_completed', body: ['volunteerName'] },
  SAATHI_INCOMPLETE_PROFILE_NUDGE: { template: 'profile_completed', body: ['volunteerName'] },
  SAATHI_PROFILE_APPROVED: { template: 'saathi_volunteer', body: ['volunteerName'] },
  SAATHI_VOLUNTEER: { template: 'saathi_volunteer', body: ['volunteerName'] },
  HOBBY_CIRCLE_MESSAGE: { template: 'hobby_circle_connection_message_received', body: ['senderName', 'hobby'] },
  COMMUNITY_EVENT_UPCOMING: { template: 'community_event_upcoming', body: ['eventName', 'date', 'venue'] },
  LEGACY_CIRCLE_BIO_PUBLISHED: { template: 'legacy_circle_bio_published', body: ['beneficiaryName'] },

  // Service Requests
  TELECONSULTATION_REQUESTED: { template: 'teleconsultation_requested', body: ['beneficiaryName', 'dateTime', 'doctorName'] },
  LAB_TEST_SCHEDULED: { template: 'lab_test_appointment_scheduled', body: ['beneficiaryName', 'testName', 'dateTime', 'labLocation'] },
  PHYSIOTHERAPY_SCHEDULED: { template: 'physiotherapy_appointment_scheduled', body: ['beneficiaryName', 'dateTime', 'center'] },
  MEDICINE_ORDER_PLACED: { template: 'medicine_order_placed_with_pharmacy_partner', body: ['beneficiaryName', 'pharmacyPartner', 'deliveryDate'] },
  APPOINTMENT_RESCHEDULED_CANCELLED: { template: 'appointment_rescheduled__cancelled', body: ['appointmentType', 'status', 'newDetails'] },

  // Admin & Operations
  SUBSCRIPTION_PENDING_CSA: { template: 'subscription_pending_csa', body: ['subscriberName', 'beneficiaryName'] },
  SUBSCRIPTION_PENDING_OM: { template: 'subscription_pending_om', body: ['subscriptionId', 'beneficiaryName'] },
  PARTNER_ENROLMENT_REQUEST: { template: 'partner_enrolment_request', body: ['partnerName', 'partnerType'] },
  PARTNER_ENROLMENT_APPROVED: { template: 'partner_enrolment_approved', body: ['partnerName', 'date'] },
  CC_ABSENCE_REPORTED: { template: 'cc_absence_reported', body: ['ccName', 'date', 'count'] },
  BGV_STATUS_UPDATE: { template: 'bgv_status_update', body: ['candidateName', 'status'] },
  WEEKLY_ZONE_UTILISATION: { template: 'weekly_zone_utilisation', body: ['zoneName', 'weekStartDate'] },
  INBASKET_MESSAGE: { template: 'inbasket_message_generic_notification_of_new_message', body: ['senderName', 'messagePreview'] },
};
