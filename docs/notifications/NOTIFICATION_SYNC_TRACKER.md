# MaiHoonNa — Master WhatsApp Template Sync & Ingestion Tracker

> **Source of Truth**: `MHN-CFG-NOTIF-001_WhatsApp_Email_Notification_Templates_v1.0.xlsx`  
> **Registry File**: `packages/notifications/src/registry/whatsapp.registry.ts`  
> **Test Harness**: `packages/notifications/test-batch-2.ts`  
> **Last Updated**: 2026-09-10  

---

## 1. Templates Shared by You in this Session (42 Unique Templates)

| # | Excel ID | Module | Event Trigger / Description | Approved MSG91 Slug | Variables in Order | Registry Event Key |
|:---|:---|:---|:---|:---|:---|:---|
| 1 | **NT-032** | Vitals & Medication | Medication missed / non-adherence | `medication_missed__nonadherence` | `['beneficiaryName', 'medicationName', 'scheduledTime']` | `MEDICATION_MISSED` |
| 2 | **NT-011** | Visit & Encounter | Visit reminder (1 hour before) | `visit_reminder_1_hour_before` | `['beneficiaryName', 'time']` | `VISIT_REMINDER` |
| 3 | **ST-052** | Saathi Guide & Support | Visit feedback flags a concern | `visit_feedback_flags_concern` | `['volunteerName', 'beneficiaryName', 'feedbackExcerpt']` | `SAATHI_VISIT_FEEDBACK_CONCERN` |
| 4 | **ST-026** | Saathi Visit Logging | Visit checked in but never checked out | `visit_checked_in_but_never_checked_out` | `['volunteerName', 'beneficiaryName', 'visitDate']` | `SAATHI_VISIT_CHECKED_IN_NOT_OUT` |
| 5 | **ST-013** | Saathi Matching | No visits logged in 14 days — nudge | `no_visits_logged` | `['volunteerName', 'beneficiaryName']` | `SAATHI_NO_VISITS_LOGGED` |
| 6 | **NT-071 / ST-030** | Saathi Rewards | Saathi visit completed — credits earned | `saathi_visit_completed__credits_earned` | `['beneficiaryName', 'credits']` | `SAATHI_VISIT_COMPLETED` |
| 7 | **NT-010** | Visit & Encounter | Visit scheduled / roster published | `visit_scheduled__roster_published` | `['ccName', 'beneficiaryName', 'date', 'time', 'address']` | `VISIT_SCHEDULED` |
| 8 | **NT-017** | Visit & Encounter | Clinic / hospital escort visit started | `clinic__hospital_escort_visit_started` | `['ccName', 'beneficiaryName', 'clinicName']` | `CLINIC_VISIT_STARTED` |
| 9 | **NT-016** | Visit & Encounter | Missed / no-show visit | `missed__noshow_visit` | `['beneficiaryName']` | `MISSED_VISIT` |
| 10 | **NT-015** | Visit & Encounter | Daily visit summary digest | `daily_visit_summary_digest` | `['subscriberName', 'beneficiaryName', 'mood', 'notes']` | `DAILY_VISIT_SUMMARY` |
| 11 | **NT-014** | Visit & Encounter | Visit completed — check-out confirmed | `visit_completed__checkout_confirmed` | `['ccName', 'beneficiaryName', 'duration']` | `VISIT_COMPLETED` |
| 12 | **NT-012** | Visit & Encounter | Visit started — check-in confirmed | `visit_started_checkin_confirmed` | `['ccName', 'beneficiaryName', 'checkInTime']` | `VISIT_STARTED` |
| 13 | **ST-041** | Saathi Profile | Availability schedule updated | `availability_schedule_updated` | `['volunteerName', 'availabilitySummary']` | `SAATHI_AVAILABILITY_SCHEDULE_UPDATED` |
| 14 | **NT-084** | Service Requests | Appointment rescheduled / cancelled | `appointment_rescheduled__cancelled` | `['appointmentType', 'status', 'newDetails']` | `APPOINTMENT_RESCHEDULED_CANCELLED` |
| 15 | **NT-082** | Service Requests | Physiotherapy appointment scheduled | `physiotherapy_appointment_scheduled` | `['beneficiaryName', 'dateTime', 'center']` | `PHYSIOTHERAPY_SCHEDULED` |
| 16 | **NT-081** | Service Requests | Lab test appointment scheduled | `lab_test_appointment_scheduled` | `['beneficiaryName', 'testName', 'dateTime', 'labLocation']` | `LAB_TEST_SCHEDULED` |
| 17 | **NT-041** | Scheduling & Sub | Schedule change approved/rejected | `schedule_change_approvedrejected` | `['decision', 'beneficiaryName', 'newDateTime']` | `SCHEDULE_CHANGE_DECISION` |
| 18 | **ST-002** | Saathi Onboarding | Saathi registration submitted | `saathi_registration_submit` | `['volunteerName']` | `SAATHI_REGISTRATION_SUBMITTED` |
| 19 | **NT-004** | Subscriptions | Subscription approved & activated | `subscription_approved_and_activated` | `['subscriberName', 'packageName', 'beneficiaryName', 'startDate']` | `SUBSCRIPTION_ACTIVATED` |
| 20 | **NT-002** | Onboarding & Account | Welcome subscriber / account created | `welcome_subscriber` | `['subscriberName']` | `SUBSCRIBER_ACCOUNT_CREATED` / `WELCOME_SUBSCRIBER` |
| 21 | **NT-020** | Mood & Wellbeing | Mood logged as Sad / Anxious / Depressed | `mood_logged_as_sad__anxious__depressed` | `['beneficiaryName', 'mood', 'ccName']` | `MOOD_ALERT` |
| 22 | **NT-021** | Mood & Wellbeing | Two consecutive negative mood readings | `two_consecutive_negative_mood_readings` | `['beneficiaryName']` | `WELLBEING_CHECK_RECOMMENDED` |
| 23 | **NT-044** | Scheduling & Sub | Payment received — plan purchased | `plan_purchased` | `['amount', 'beneficiaryName', 'packageName']` | `PLAN_PURCHASED` |
| 24 | **ST-051** | Saathi Guide & Support | Emergency support alert acknowledged | `emergency_support_alert` | `['beneficiaryName', 'coordinatorName']` | `SAATHI_EMERGENCY_SUPPORT_ALERT` |
| 25 | **NT-043** | Scheduling & Sub | Renewal payment link | `renewal_payment` | `['beneficiaryName', 'packageName', 'paymentLink']` | `RENEWAL_PAYMENT` |
| 26 | **ST-005** | Saathi Profile | Profile edited & saved | `profile_edited_saved` | `['volunteerName']` | `SAATHI_PROFILE_SAVED` |
| 27 | **ST-010** | Saathi Matching | New beneficiary match assigned | `new_beneficiary_match_assigned` | `['volunteerName', 'beneficiaryName', 'distance']` | `SAATHI_NEW_BENEFICIARY_MATCH` |
| 28 | **ST-011** | Saathi Matching | Beneficiary reassigned / match removed | `beneficiary_reassigned_match_removed` | `['volunteerName', 'beneficiaryName']` | `SAATHI_BENEFICIARY_MATCH_REMOVED` |
| 29 | **ST-024** | Saathi Visit Logging | Monthly goal achieved (100%) | `monthly_goal_achieved` | `['volunteerName', 'hoursLogged', 'goalHours']` | `SAATHI_MONTHLY_GOAL_ACHIEVED` |
| 30 | **ST-032** | Saathi Rewards | Gift card issued & delivered | `gift_card_issued` | `['giftCardValue', 'giftCardBrand', 'recipientContact']` | `SAATHI_GIFT_CARD_ISSUED` |
| 31 | **ST-033** | Saathi Rewards | Credit balance milestone / low balance | `low_balance_nudge` | `['volunteerName', 'availableCredits', 'estimatedValue']` | `SAATHI_LOW_BALANCE_NUDGE` |
| 32 | **ST-040** | Saathi Profile | Address updated | `address_updated` | `['volunteerName', 'newAddress']` | `SAATHI_ADDRESS_UPDATED` |
| 33 | **ST-050** | Saathi Guide & Support | New guide tip / best practice published | `new_guide_tip` | `['volunteerName', 'tipTitle']` | `SAATHI_NEW_GUIDE_TIP` |
| 34 | **ST-042** | Saathi Profile | Incomplete profile nudge / Complete profile | `profile_completed` | `['volunteerName']` | `SAATHI_PROFILE_COMPLETED` |
| 35 | **NT-018** | Visit & Encounter | Rating/feedback prompt | `ratingfeedback_prompt` | `['ccName']` | `RATING_FEEDBACK_PROMPT` |
| 36 | **ST-025** | Saathi Visit Logging | Monthly goal at-risk — mid-month reminder | `monthly_goal_at_risk_mid_month_reminder` | `['volunteerName', 'hoursLogged', 'goalHours']` | `SAATHI_MONTHLY_GOAL_AT_RISK` |
| 37 | **NT-065** | Care Team | CC performance rating received | `cc_performance_rating_received` | `['rating', 'beneficiaryName', 'comment']` | `CC_PERFORMANCE_RATING` |
| 38 | **NT-061** | Care Team | CC reallocated (temp replacement) | `cc_reallocated_temporarily_replacement` | `['tempCcName', 'beneficiaryName', 'originalCcName']` | `CC_REALLOCATED` |
| 39 | **NT-045** | Scheduling & Sub | Payment failed | `payment_failed` | `['subscriberName', 'amount', 'beneficiaryName', 'paymentLink']` | `PAYMENT_FAILED` |
| 40 | **Custom** | Scheduling & Sub | Package payment request link | `package_payment` | `['subscriberName', 'packageName', 'amount', 'paymentLink']` | `PACKAGE_PAYMENT` |
| 41 | **Custom** | Scheduling & Sub | Addon service payment link | `addon_payment` | `['subscriberName', 'addonName', 'amount', 'paymentLink']` | `ADDON_PAYMENT` |
| 42 | **ST-003** | Saathi Onboarding | Saathi profile approved & activated | `saathi_volunteer` | `['volunteerName']` | `SAATHI_PROFILE_APPROVED` |

---

## 2. Previously Verified & Active Templates (20 Templates)

| # | Excel ID | Module | Event Description | Approved MSG91 Slug | Variables in Order | Registry Event Key |
|:---|:---|:---|:---|:---|:---|:---|
| 33 | **NT-001** | Auth & Login | OTP for login/signup | `otp` | `['otpCode']` | `OTP_LOGIN_SIGNUP` |
| 34 | **NT-003** | Onboarding | Subscription request submitted | `subscription_request_submitted` | `['subscriberName', 'beneficiaryName', 'packageName']` | `SUBSCRIPTION_REQUEST_SUBMITTED` |
| 35 | **NT-005** | Onboarding | Beneficiary profile created | `benef_profile_created` | `['beneficiaryName', 'subscriberName']` | `BENEF_PROFILE_CREATED` |
| 36 | **NT-006** | Care Mitra Onboarding | Care Mitra onboarding — cleared | `care_mitra_onboarding__bgv_approved_deployment_cleared` | `['ccName', 'fmName']` | `CM_ONBOARDING_CLEARED` |
| 37 | **NT-007** | Onboarding | Care Mitra training reminder | `care_mitra_training_reminder` | `['ccName', 'moduleName', 'date', 'timeLocation']` | `CM_TRAINING_REMINDER` |
| 38 | **NT-013** | Visit & Encounter | Manual check-in override flagged | `manual_checkin_override_flagged` | `['ccName', 'beneficiaryName', 'remarks']` | `MANUAL_CHECKIN_FLAGGED` |
| 39 | **NT-031** | Vitals & Medication | Medication reminder (to beneficiary) | `medication_reminder_to_benef` | `['beneficiaryName', 'medicationName', 'dosage']` | `MEDICATION_REMINDER` |
| 41 | **NT-044** | Subscriptions | Payment successful | `payment_success` | `['subscriberName', 'amount', 'transactionId']` | `PAYMENT_SUCCESS` |
| 42 | **NT-046** | Subscriptions | Subscription hours running low | `subscription_hours_running_down` | `['beneficiaryName', 'percentConsumed']` | `SUBSCRIPTION_HOURS_LOW` |
| 43 | **NT-047** | Subscriptions | Subscription hours exhausted | `subscription_hours_exhaust` | `['beneficiaryName']` | `SUBSCRIPTION_HOURS_EXHAUSTED` |
| 44 | **NT-048** | Subscriptions | Subscription terminated | `subscription_terminated` | `['beneficiaryName', 'effectiveDate']` | `SUBSCRIPTION_TERMINATED` |
| 45 | **NT-051** | Emergency | Emergency acknowledged by ERC | `emergency_acknowledged_by_erc` | `['beneficiaryName']` | `EMERGENCY_ACKNOWLEDGED` |
| 46 | **NT-052** | Emergency | Ambulance dispatched | `ambulance_dispatched` | `['beneficiaryName', 'eta']` | `AMBULANCE_DISPATCHED` |
| 47 | **NT-053** | Emergency | Emergency resolved | `emergency_resolved` | `['beneficiaryName', 'outcome']` | `EMERGENCY_RESOLVED` |
| 48 | **NT-060** | Care Team | Primary/Secondary CC assigned | `primarysecondary_cc_assigned` | `['ccName', 'beneficiaryName', 'primaryOrSecondary']` | `CC_ASSIGNED` |
| 51 | **NT-070** | Community | Saathi interaction request received | `saathi_interaction_request_received` | `['beneficiaryName']` | `SAATHI_INTERACTION_REQUEST` |
| 52 | **NT-072** | Community | Hobby Circle connection message received | `hobby_circle_connection_message_received` | `['senderName', 'hobby']` | `HOBBY_CIRCLE_MESSAGE` |
| 53 | **NT-080** | Service Requests | Tele-consultation requested | `teleconsultation_requested` | `['beneficiaryName', 'dateTime', 'doctorName']` | `TELECONSULTATION_REQUESTED` |
| 54 | **NT-083** | Service Requests | Medicine order placed with pharmacy partner | `medicine_order_placed_with_pharmacy_partner` | `['beneficiaryName', 'pharmacyPartner', 'deliveryDate']` | `MEDICINE_ORDER_PLACED` |
| 55 | **NT-097** | Admin & Ops | Inbasket message notification | `inbasket_message_generic_notification_of_new_message` | `['senderName', 'messagePreview']` | `INBASKET_MESSAGE` |

---

## 3. Total Sync Status: 62 Templates Fully Aligned with Meta / MSG91!
**Only 11 templates remaining** across the entire platform catalog.
