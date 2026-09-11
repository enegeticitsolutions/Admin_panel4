# MaiHoonNa — Master Notification Catalog & Event Specification

> **Status**: Canonical Source of Truth  
> **Architecture Pattern**: Event-driven via `@maihoonna/notifications` (Redis Streams broker)  
> **Scope**: All notification templates, audience rules, variables, priority policies, and channel assignments across the MaiHoonNa platform.

---

## 1. Master Notification Registry Table

| Template ID | Module | Trigger Event | Audience (Recipient) | Channel(s) | WA Category | Priority | Subject / Header | Sample Body Copy | Key Variables | Status / Notes |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **NT-001** | Onboarding & Account | OTP for login/signup | Subscriber, Beneficiary, CC, FM, OM, CSA, ERC | WhatsApp, SMS | Authentication | Critical | MaiHoonNa OTP | Your MaiHoonNa OTP is {{1}}. Valid for 10 minutes. Do not share this code with anyone. | `{{1}}` = OTP code | PASS |
| **NT-002** | Onboarding & Account | Subscriber account created | Subscriber | WhatsApp, Email | Utility | Medium | Welcome to MaiHoonNa | Hi {{1}}, welcome to MaiHoonNa — मंई हूँ ना! Your account is ready. Add your first beneficiary to get started. | `{{1}}` = Subscriber name | FAIL |
| **NT-003** | Onboarding & Account | Subscription request submitted | Subscriber | WhatsApp, Email | Utility | Medium | Subscription Request Received | Hi {{1}}, we've received your subscription request for {{2}} ({{3}} plan). Our team will confirm within 24 hours. | `{{1}}` = Subscriber name, `{{2}}` = Beneficiary name, `{{3}}` = Package name | VERIFIED LIVE |
| **NT-004** | Onboarding & Account | Subscription approved & activated | Subscriber | WhatsApp, Email | Utility | High | Your MaiHoonNa Subscription is Active | Great news {{1}}! Your {{2}} subscription for {{3}} is now active. Your care journey begins on {{4}}. | `{{1}}` = Subscriber name, `{{2}}` = Package name, `{{3}}` = Beneficiary name, `{{4}}` = Start date | Pending |
| **NT-005** | Onboarding & Account | Beneficiary profile created | Beneficiary | WhatsApp, Email | Utility | Medium | Welcome to MaiHoonNa Care | Hello {{1}}, you've been enrolled in MaiHoonNa care by {{2}}. Your Care Mitra will be assigned shortly. | `{{1}}` = Beneficiary name, `{{2}}` = Subscriber name | VERIFIED LIVE |
| **NT-006** | Onboarding & Account | Care Mitra onboarding — BGV approved, deployment cleared | Care Mitra | WhatsApp, Email | Utility | Medium | Welcome to the MaiHoonNa Team | Congratulations {{1}}! Your onboarding is complete and you're cleared for deployment. Your Field Manager is {{2}}. | `{{1}}` = CC name, `{{2}}` = FM name | FAIL |
| **NT-007** | Onboarding & Account | Care Mitra training reminder | Care Mitra | WhatsApp | Utility | Medium | Training Session Reminder | Hi {{1}}, reminder: your {{2}} training session is scheduled for {{3}} at {{4}}. | `{{1}}` = CC name, `{{2}}` = Module name, `{{3}}` = Date, `{{4}}` = Time/location | VERIFIED LIVE |
| **NT-008** | Onboarding & Account | Password / PIN reset request | All users | WhatsApp, Email, SMS | Authentication | Critical | MaiHoonNa Password Reset | Your password reset code is {{1}}. If you didn't request this, please contact support immediately. | `{{1}}` = Reset code | NOT APPLICABLE |
| **NT-010** | Visit & Encounter | Visit scheduled / roster published | Beneficiary | WhatsApp | Utility | Medium | New Visit Scheduled | Hi {{1}}, you have a visit with {{2}} on {{3}} at {{4}}. Address: {{5}}. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Date, `{{4}}` = Time, `{{5}}` = Address | PASS |
| **NT-010** | Visit & Encounter | Visit scheduled / roster published | Care Mitra | WhatsApp | Utility | Medium | New Visit Scheduled | Hi {{1}}, you have a visit with {{2}} on {{3}} at {{4}}. Address: {{5}}. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Date, `{{4}}` = Time, `{{5}}` = Address | FAIL |
| **NT-011** | Visit & Encounter | Visit reminder (1 hour before) | Care Mitra | WhatsApp | Utility | Medium | Upcoming Visit Reminder | Reminder: your visit with {{1}} starts at {{2}}. Tap to view directions. | `{{1}}` = Beneficiary name, `{{2}}` = Time | FAIL |
| **NT-012** | Visit & Encounter | Visit started — check-in confirmed | Subscriber | WhatsApp, Email | Utility | Low | Visit Started | {{1}} has started their visit with {{2}} at {{3}}. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Check-in time | FAIL |
| **NT-013** | Visit & Encounter | Manual check-in override flagged | Field Manager | WhatsApp | Utility | Medium | Manual Check-in Alert | {{1}} performed a manual check-in for {{2}} (outside geo-fence). Reason: {{3}}. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Remarks | VERIFIED LIVE |
| **NT-014** | Visit & Encounter | Visit completed — check-out confirmed | Subscriber | WhatsApp, Email | Utility | Medium | Visit Completed | {{1}}'s visit with {{2}} is complete. Duration: {{3}}. View the visit summary in your app. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Duration | FAIL |
| **NT-015** | Visit & Encounter | Daily visit summary digest | Subscriber | WhatsApp, Email | Utility | Low | Today's Visit Summary for {{1}} | Hi {{1}}, here's today's update for {{2}}: Mood — {{3}}. Vitals recorded. Notes: {{4}}. | `{{1}}` = Subscriber name, `{{2}}` = Beneficiary name, `{{3}}` = Mood, `{{4}}` = Visit notes (short) | Pending |
| **NT-016** | Visit & Encounter | Missed / no-show visit | Subscriber, Field Manager | WhatsApp, Email | Utility | High | Visit Not Completed | We're sorry — today's scheduled visit for {{1}} could not be completed. Our team is following up. | `{{1}}` = Beneficiary name | Pending |
| **NT-017** | Visit & Encounter | Clinic / hospital escort visit started | Subscriber | WhatsApp | Utility | Medium | Clinic Visit Started | {{1}} is accompanying {{2}} to {{3}}. We'll update you when the visit concludes. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Clinic/hospital name | Pending |
| **NT-018** | Visit & Encounter | Rating/feedback prompt | Subscriber, Beneficiary | WhatsApp | Utility | Low | Rate Today's Visit | How was today's visit with {{1}}? Tap to rate and share feedback. | `{{1}}` = CC name | VERIFIED LIVE |
| **NT-020** | Mood & Happiness Score | Mood logged as Sad / Anxious / Depressed | Subscriber | WhatsApp, Email | Utility | High | Mood Alert for {{1}} | {{1}} appeared {{2}} during today's visit. {{3}} has added notes — tap to view and respond. | `{{1}}` = Beneficiary name, `{{2}}` = Mood, `{{3}}` = CC name | FAIL |
| **NT-021** | Mood & Happiness Score | Two consecutive negative mood readings | Subscriber, Field Manager | WhatsApp, Email | Utility | Critical | Wellbeing Check Recommended for {{1}} | {{1}} has shown a low mood across two consecutive visits. We recommend a check-in call — would you like us to arrange a tele-consult? | `{{1}}` = Beneficiary name | FAIL |
| **NT-022** | Mood & Happiness Score | Happiness Score dropped below alert threshold | Subscriber | WhatsApp, Email | Utility | High | Happiness Score Update for {{1}} | {{1}}'s Happiness Score has changed to {{2}}. Our care team has been notified and will follow up. | `{{1}}` = Beneficiary name, `{{2}}` = New score | FAIL |
| **NT-023** | Mood & Happiness Score | Weekly happiness/wellbeing digest | Subscriber | Email | Marketing | Low | {{1}}'s Weekly Wellbeing Summary | Here's how {{1}} has been doing this week — mood trend, visit highlights, and hours used. | `{{1}}` = Beneficiary name | FAIL |
| **NT-030** | Vitals & Medication | Vitals out of configured normal range | Subscriber, Field Manager | WhatsApp, Email | Utility | Critical | Vitals Alert for {{1}} | {{1}}'s {{2}} reading today was {{3}}, outside the normal range. {{4}} has logged notes — please review. | `{{1}}` = Beneficiary name, `{{2}}` = Vital type, `{{3}}` = Reading, `{{4}}` = CC name | FAIL |
| **NT-031** | Vitals & Medication | Medication reminder (to beneficiary) | Beneficiary | WhatsApp | Utility | High | Medication Reminder | Hi {{1}}, it's time for your {{2}} ({{3}}). Tap to confirm once taken. | `{{1}}` = Beneficiary name, `{{2}}` = Medication name, `{{3}}` = Dosage | VERIFIED LIVE |
| **NT-032** | Vitals & Medication | Medication missed / non-adherence | Subscriber | WhatsApp, Email | Utility | High | Medication Missed for {{1}} | {{1}} did not confirm taking {{2}} scheduled for {{3}}. Please follow up. | `{{1}}` = Beneficiary name, `{{2}}` = Medication name, `{{3}}` = Scheduled time | FAIL |
| **NT-033** | Vitals & Medication | EMR vitals trend report (monthly) | Subscriber | Email | Utility | Low | {{1}}'s Monthly Health Summary | Attached is {{1}}'s vitals and medication adherence trend for {{2}}. | `{{1}}` = Beneficiary name, `{{2}}` = Month | NOT APPLICABLE |
| **NT-040** | Scheduling & Subscription | Schedule change request submitted | Operations Manager | WhatsApp, Email | Utility | Medium | Schedule Change Request | {{1}} has requested a schedule change for {{2}}, effective {{3}}. Please review and respond. | `{{1}}` = Subscriber/Beneficiary name, `{{2}}` = Beneficiary name, `{{3}}` = Requested date | FAIL |
| **NT-041** | Scheduling & Subscription | Schedule change approved/rejected | Subscriber, Beneficiary | WhatsApp, Email | Utility | Medium | Schedule Change {{1}} | Your request to reschedule {{2}}'s visit has been {{1}}. New schedule: {{3}}. | `{{1}}` = Approved/Rejected, `{{2}}` = Beneficiary name, `{{3}}` = New date/time | VERIFIED LIVE |
| **NT-042** | Scheduling & Subscription | Subscription renewal reminder (XX days before expiry) | Subscriber | WhatsApp, Email | Marketing | High | Your MaiHoonNa Plan Expires Soon | Hi {{1}}, your {{2}} subscription for {{3}} expires on {{4}}. Renew now to avoid a gap in care. | `{{1}}` = Subscriber name, `{{2}}` = Package name, `{{3}}` = Beneficiary name, `{{4}}` = Expiry date | FAIL |
| **NT-043** | Scheduling & Subscription | Renewal payment link | Subscriber | WhatsApp, Email | Utility | High | Complete Your Renewal | Renew {{1}}'s {{2}} plan in one tap: {{3}} | `{{1}}` = Beneficiary name, `{{2}}` = Package name, `{{3}}` = Payment link | Pending |
| **NT-044** | Scheduling & Subscription | Payment successful | Subscriber | WhatsApp, Email | Utility | Medium | Payment Received — Thank You | We've received your payment of {{1}} for {{2}}'s {{3}} plan. Receipt attached. | `{{1}}` = Amount, `{{2}}` = Beneficiary name, `{{3}}` = Package name | VERIFIED LIVE |
| **NT-045** | Scheduling & Subscription | Payment failed | Subscriber | WhatsApp, Email | Utility | High | Payment Unsuccessful | Your payment of {{1}} for {{2}}'s renewal could not be processed. Please retry: {{3}} | `{{1}}` = Amount, `{{2}}` = Beneficiary name, `{{3}}` = Payment link | Pending |
| **NT-046** | Scheduling & Subscription | Subscription hours running low | Subscriber | WhatsApp, Email | Utility | Medium | Hours Running Low for {{1}} | {{1}} has used {{2}}% of this period's hours. Consider upgrading or topping up. | `{{1}}` = Beneficiary name, `{{2}}` = % consumed | Pending |
| **NT-047** | Scheduling & Subscription | Subscription hours exhausted | Subscriber, CSA | WhatsApp, Email | Utility | High | Hours Exhausted for {{1}} | {{1}}'s subscription hours for this period are fully used. Renew or upgrade to continue uninterrupted care. | `{{1}}` = Beneficiary name | Pending |
| **NT-048** | Scheduling & Subscription | Subscription terminated | Subscriber | WhatsApp, Email | Utility | Medium | Subscription Ended | Your subscription for {{1}} has been terminated as requested, effective {{2}}. We hope to serve you again. | `{{1}}` = Beneficiary name, `{{2}}` = Effective date | VERIFIED LIVE |
| **NT-049** | Scheduling & Subscription | Free trial ending soon | Subscriber | WhatsApp, Email | Marketing | Medium | Your Free Trial Ends in {{1}} Days | Hi {{1}}, your free trial for {{2}} ends on {{3}}. Subscribe now to continue care without interruption. | `{{1}}` = Subscriber name, `{{2}}` = Beneficiary name, `{{3}}` = End date | Pending |
| **NT-050** | Emergency | Emergency triggered by beneficiary | ERC, OM, FM, PCC, SCC | WhatsApp, SMS, Voice Call | Utility | Critical | 🚨 EMERGENCY ALERT | EMERGENCY: {{1}} has triggered an emergency request at {{2}} ({{3}}). Respond immediately. | `{{1}}` = Beneficiary name, `{{2}}` = Timestamp, `{{3}}` = Location/address | Pending |
| **NT-051** | Emergency | Emergency acknowledged by ERC | Subscriber | WhatsApp, SMS | Utility | Critical | Emergency Being Handled | We've received the emergency alert for {{1}} and our team is responding. We'll update you shortly. | `{{1}}` = Beneficiary name | Pending |
| **NT-052** | Emergency | Ambulance dispatched | Subscriber | WhatsApp, SMS | Utility | Critical | Ambulance Dispatched for {{1}} | An ambulance has been dispatched to {{1}}'s location. ETA: {{2}}. | `{{1}}` = Beneficiary name, `{{2}}` = ETA | VERIFIED LIVE |
| **NT-053** | Emergency | Emergency resolved | Subscriber, OM | WhatsApp, Email | Utility | Critical | Emergency Resolved | The emergency for {{1}} has been resolved. Summary: {{2}}. Full report available in your app. | `{{1}}` = Beneficiary name, `{{2}}` = Brief outcome | VERIFIED LIVE |
| **NT-060** | Care Team & Allocation | Primary/Secondary CC assigned | Subscriber, Beneficiary | WhatsApp, Email | Utility | Medium | Meet Your Care Mitra | {{1}} has been assigned as {{2}}'s {{3}} Care Mitra. View their profile in your app. | `{{1}}` = CC name, `{{2}}` = Beneficiary name, `{{3}}` = Primary/Secondary | VERIFIED LIVE |
| **NT-061** | Care Team & Allocation | CC reallocated (temp replacement) | Subscriber, Beneficiary | WhatsApp | Utility | High | Care Mitra Update | {{1}} will be covering {{2}}'s visits temporarily while {{3}} is unavailable. | `{{1}}` = Temp CC name, `{{2}}` = Beneficiary name, `{{3}}` = Original CC name | VERIFIED LIVE |
| **NT-062** | Care Team & Allocation | New CC assigned to FM's team | Field Manager | WhatsApp | Utility | Medium | New Team Member | {{1}} has been added to your team, effective {{2}}. | `{{1}}` = CC name, `{{2}}` = Date | Pending |
| **NT-063** | Care Team & Allocation | CC deactivated/terminated | Field Manager, Operations Manager | WhatsApp, Email | Utility | Medium | Care Mitra Deactivated | {{1}} has been deactivated effective {{2}}. Reason: {{3}}. Please reassign their beneficiaries. | `{{1}}` = CC name, `{{2}}` = Last working date, `{{3}}` = Reason | Pending |
| **NT-064** | Care Team & Allocation | Birthday / special occasion reminder | Care Mitra, Field Manager | WhatsApp | Marketing | Low | Celebration Reminder | Reminder: it's {{1}}'s birthday on {{2}}! Plan a small celebration during your visit. | `{{1}}` = Beneficiary name, `{{2}}` = Date | Pending |
| **NT-065** | Care Team & Allocation | CC performance rating received | Care Mitra | WhatsApp | Utility | Low | New Feedback Received | You received a {{1}}-star rating from {{2}}'s family. Comment: "{{3}}" | `{{1}}` = Rating, `{{2}}` = Beneficiary name, `{{3}}` = Comment (short) | VERIFIED LIVE |
| **NT-070** | Community & Saathi Network | Saathi interaction request received | Volunteer | WhatsApp | Utility | Medium | New Saathi Request | {{1}} has requested an interaction with you via Saathi Network. Tap to accept or view details. | `{{1}}` = Beneficiary name | VERIFIED LIVE |
| **NT-071** | Community & Saathi Network | Saathi visit completed — credits earned | Volunteer | WhatsApp | Utility | Low | Saathi Credits Earned | Thank you for spending time with {{1}}! You've earned {{2}} Saathi credits. | `{{1}}` = Beneficiary name, `{{2}}` = Credits | Pending |
| **NT-072** | Community & Saathi Network | Hobby Circle connection message received | Beneficiary | WhatsApp | Utility | Low | New Message in Hobby Circle | {{1}} sent you a message about a shared interest in {{2}}. Tap to view. | `{{1}}` = Sender name, `{{2}}` = Hobby | Pending |
| **NT-073** | Community & Saathi Network | Community event upcoming / RSVP reminder | Beneficiary | WhatsApp, Email | Marketing | Low | Upcoming Community Event | {{1}} is happening on {{2}} at {{3}}. Tap to RSVP. | `{{1}}` = Event name, `{{2}}` = Date, `{{3}}` = Venue | Pending |
| **NT-074** | Community & Saathi Network | Legacy Circle bio published | Subscriber | Email | Utility | Low | Legacy Circle Bio Published | {{1}}'s Legacy Circle bio is now live and visible to the community. | `{{1}}` = Beneficiary name | Pending |
| **NT-080** | Service Requests | Tele-consultation requested | Subscriber, Beneficiary | WhatsApp | Utility | Medium | Tele-consultation Scheduled | Your tele-consultation for {{1}} is scheduled for {{2}} with Dr. {{3}}. | `{{1}}` = Beneficiary name, `{{2}}` = Date/time, `{{3}}` = Doctor name | VERIFIED LIVE |
| **NT-081** | Service Requests | Lab test appointment scheduled | Subscriber, Beneficiary | WhatsApp, Email | Utility | Medium | Lab Appointment Confirmed | {{1}}'s lab test ({{2}}) is scheduled for {{3}} at {{4}}. | `{{1}}` = Beneficiary name, `{{2}}` = Test name, `{{3}}` = Date/time, `{{4}}` = Lab location | VERIFIED LIVE |
| **NT-082** | Service Requests | Physiotherapy appointment scheduled | Subscriber, Beneficiary | WhatsApp, Email | Utility | Medium | Physiotherapy Appointment Confirmed | {{1}}'s physiotherapy session is booked for {{2}} at {{3}}. | `{{1}}` = Beneficiary name, `{{2}}` = Date/time, `{{3}}` = Center | VERIFIED LIVE |
| **NT-083** | Service Requests | Medicine order placed with pharmacy partner | Subscriber, Beneficiary | WhatsApp | Utility | Low | Medicine Order Placed | Your medicine order for {{1}} has been placed with {{2}}. Expected delivery: {{3}}. | `{{1}}` = Beneficiary name, `{{2}}` = Pharmacy partner, `{{3}}` = Delivery date | VERIFIED LIVE |
| **NT-084** | Service Requests | Appointment rescheduled / cancelled | Subscriber, Beneficiary | WhatsApp, Email | Utility | Medium | Appointment Update | Your {{1}} appointment has been {{2}}. New details: {{3}}. | `{{1}}` = Appointment type, `{{2}}` = Rescheduled/Cancelled, `{{3}}` = New date/time or N/A | VERIFIED LIVE |
| **NT-090** | Admin & Operations | New subscription pending CSA review | CSA | Email | Utility | Medium | New Subscription Pending Review | A new subscription request from {{1}} for {{2}} is pending your review. | `{{1}}` = Subscriber name, `{{2}}` = Beneficiary name | Pending |
| **NT-091** | Admin & Operations | Subscription pending OM approval | Operations Manager | Email | Utility | Medium | Subscription Awaiting Approval | Subscription #{{1}} for {{2}} is ready for your final approval. | `{{1}}` = Subscription ID, `{{2}}` = Beneficiary name | Pending |
| **NT-092** | Admin & Operations | Partner/supplier enrolment request received | Operations Manager | Email | Utility | Low | New Partner Enrolment Request | {{1}} ({{2}}) has submitted an enrolment request. Please review. | `{{1}}` = Partner name, `{{2}}` = Partner type | Pending |
| **NT-093** | Admin & Operations | Partner enrolment approved | Partner | Email | Utility | Medium | Partner Enrolment Approved | Congratulations, {{1}} is now an approved MaiHoonNa partner effective {{2}}. | `{{1}}` = Partner name, `{{2}}` = Date | Pending |
| **NT-094** | Admin & Operations | CC absence / unavailability reported | Field Manager | WhatsApp | Utility | High | CC Unavailable Today | {{1}} has reported unavailability for {{2}}. {{3}} beneficiary visit(s) need reassignment. | `{{1}}` = CC name, `{{2}}` = Date, `{{3}}` = Count | Pending |
| **NT-095** | Admin & Operations | Background verification (BGV) status update | Operations Manager | Email | Utility | Medium | BGV Status Update — {{1}} | Background verification for candidate {{1}} is now: {{2}}. | `{{1}}` = Candidate name, `{{2}}` = Status | Pending |
| **NT-096** | Admin & Operations | Weekly zone utilisation report | Operations Manager | Email | Utility | Low | Weekly Zone Performance Report | Attached: utilisation, CC performance, and SLA summary for {{1}} zone, week of {{2}}. | `{{1}}` = Zone name, `{{2}}` = Week start date | Pending |
| **NT-097** | Admin & Operations | Inbasket message — generic notification of new message | Subscriber, Beneficiary, FM, OM | WhatsApp | Utility | Low | New Message | You have a new message from {{1}}: "{{2}}" | `{{1}}` = Sender name, `{{2}}` = Message preview (short) | VERIFIED LIVE |

---

## 2. Declarative Notification Catalog Schema (YAML)

```yaml
notification_catalog:
  purpose: >
    Master notification catalog for the MaiHoonNa application.
    Each notification is triggered by a specific domain business event and
    delivered via Redis Streams to WhatsApp, Email, SMS, or Voice Call.

  field_definitions:
    module: Business module responsible for the notification
    trigger_event: Exact event that triggers the notification
    audience: User role(s) who should receive the notification
    channels: Delivery channels
    whatsapp_category: WhatsApp template category
    priority: Notification urgency
    subject_header: Email subject / WhatsApp template header
    sample_body: Example notification content
    variables: Dynamic values required to render the notification

  notifications:

    # =========================================================
    # ONBOARDING & ACCOUNT
    # =========================================================

    - code: "NT-001"
      module: "Onboarding & Account"
      trigger_event: "OTP for login/signup"
      audience: ["Subscriber", "Beneficiary", "CC", "FM", "OM", "CSA", "ERC"]
      channels: ["WhatsApp", "SMS"]
      whatsapp_category: "Authentication"
      priority: "Critical"
      subject_header: "MaiHoonNa OTP"
      sample_body: >
        Your MaiHoonNa OTP is {{1}}. Valid for 10 minutes.
        Do not share this code with anyone.
      variables:
        "{{1}}": "OTP code"

    - code: "NT-002"
      module: "Onboarding & Account"
      trigger_event: "Subscriber account created"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Welcome to MaiHoonNa"
      sample_body: >
        Hi {{1}}, welcome to MaiHoonNa — मैं हूँ ना!
        Your account is ready. Add your first beneficiary to get started.
      variables:
        "{{1}}": "Subscriber name"

    - code: "NT-003"
      module: "Onboarding & Account"
      trigger_event: "Subscription request submitted"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Subscription Request Received"
      sample_body: >
        Hi {{1}}, we've received your subscription request for {{2}}
        ({{3}} plan). Our team will confirm within 24 hours.
      variables:
        "{{1}}": "Subscriber name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Package name"

    - code: "NT-004"
      module: "Onboarding & Account"
      trigger_event: "Subscription approved & activated"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Your MaiHoonNa Subscription is Active"
      sample_body: >
        Great news {{1}}! Your {{2}} subscription for {{3}} is now active.
        Your care journey begins on {{4}}.
      variables:
        "{{1}}": "Subscriber name"
        "{{2}}": "Package name"
        "{{3}}": "Beneficiary name"
        "{{4}}": "Start date"

    - code: "NT-005"
      module: "Onboarding & Account"
      trigger_event: "Beneficiary profile created"
      audience: ["Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Welcome to MaiHoonNa Care"
      sample_body: >
        Hello {{1}}, you've been enrolled in MaiHoonNa care by {{2}}.
        Your Care Mitra will be assigned shortly.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Subscriber name"

    - code: "NT-006"
      module: "Onboarding & Account"
      trigger_event: "Care Mitra onboarding — BGV approved, deployment cleared"
      audience: ["Care Mitra"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Welcome to the MaiHoonNa Team"
      sample_body: >
        Congratulations {{1}}! Your onboarding is complete and you're
        cleared for deployment. Your Field Manager is {{2}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "FM name"

    - code: "NT-007"
      module: "Onboarding & Account"
      trigger_event: "Care Mitra training reminder"
      audience: ["Care Mitra"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Training Session Reminder"
      sample_body: >
        Hi {{1}}, reminder: your {{2}} training session is scheduled
        for {{3}} at {{4}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Module name"
        "{{3}}": "Date"
        "{{4}}": "Time/location"

    - code: "NT-008"
      module: "Onboarding & Account"
      trigger_event: "Password / PIN reset request"
      audience: ["All users"]
      channels: ["WhatsApp", "Email", "SMS"]
      whatsapp_category: "Authentication"
      priority: "Critical"
      subject_header: "MaiHoonNa Password Reset"
      sample_body: >
        Your password reset code is {{1}}. If you didn't request this,
        please contact support.
      variables:
        "{{1}}": "Reset code"

    # =========================================================
    # VISIT & ENCOUNTER
    # =========================================================

    - code: "NT-010-BENEF"
      module: "Visit & Encounter"
      trigger_event: "Visit scheduled / roster published"
      audience: ["Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "New Visit Scheduled"
      sample_body: >
        Hi {{1}}, you have a visit with {{2}} on {{3}} at {{4}}.
        Address: {{5}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Date"
        "{{4}}": "Time"
        "{{5}}": "Address"

    - code: "NT-010-CC"
      module: "Visit & Encounter"
      trigger_event: "Visit scheduled / roster published"
      audience: ["Care Mitra"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "New Visit Scheduled"
      sample_body: >
        Hi {{1}}, you have a visit with {{2}} on {{3}} at {{4}}.
        Address: {{5}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Date"
        "{{4}}": "Time"
        "{{5}}": "Address"

    - code: "NT-011"
      module: "Visit & Encounter"
      trigger_event: "Visit reminder (1 hour before)"
      audience: ["Care Mitra"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Upcoming Visit Reminder"
      sample_body: >
        Reminder: your visit with {{1}} starts at {{2}}.
        Tap to view details.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Time"

    - code: "NT-012"
      module: "Visit & Encounter"
      trigger_event: "Visit started — check-in confirmed"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Visit Started"
      sample_body: >
        {{1}} has started their visit with {{2}} at {{3}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Check-in time"

    - code: "NT-013"
      module: "Visit & Encounter"
      trigger_event: "Manual check-in override flagged"
      audience: ["Field Manager"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Manual Check-in Alert"
      sample_body: >
        {{1}} performed a manual check-in for {{2}} (outside geo-fence).
        Reason: {{3}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Remarks"

    - code: "NT-014"
      module: "Visit & Encounter"
      trigger_event: "Visit completed — check-out confirmed"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Visit Completed"
      sample_body: >
        {{1}}'s visit with {{2}} is complete. Duration: {{3}}.
        View the visit summary in your app.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Duration"

    - code: "NT-015"
      module: "Visit & Encounter"
      trigger_event: "Daily visit summary digest"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Today's Visit Summary for {{1}}"
      sample_body: >
        Hi {{1}}, here's today's update for {{2}}:
        Mood — {{3}}. Vitals recorded. Notes: {{4}}.
      variables:
        "{{1}}": "Subscriber name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Mood"
        "{{4}}": "Visit notes (short)"

    - code: "NT-016"
      module: "Visit & Encounter"
      trigger_event: "Missed / no-show visit"
      audience: ["Subscriber", "Field Manager"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Visit Not Completed"
      sample_body: >
        We're sorry — today's scheduled visit for {{1}} could not
        be completed. Our team is following up.
      variables:
        "{{1}}": "Beneficiary name"

    - code: "NT-017"
      module: "Visit & Encounter"
      trigger_event: "Clinic / hospital escort visit started"
      audience: ["Subscriber"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Clinic Visit Started"
      sample_body: >
        {{1}} is accompanying {{2}} to {{3}}.
        We'll update you when the visit concludes.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Clinic/hospital name"

    - code: "NT-018"
      module: "Visit & Encounter"
      trigger_event: "Rating/feedback prompt"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Rate Today's Visit"
      sample_body: >
        How was today's visit with {{1}}?
        Tap to rate and share feedback.
      variables:
        "{{1}}": "CC name"

    # =========================================================
    # MOOD & HAPPINESS SCORE
    # =========================================================

    - code: "NT-020"
      module: "Mood & Happiness Score"
      trigger_event: "Mood logged as Sad / Anxious / Depressed"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Mood Alert for {{1}}"
      sample_body: >
        {{1}} appeared {{2}} during today's visit.
        {{3}} has added notes — tap to view and respond.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Mood"
        "{{3}}": "CC name"

    - code: "NT-021"
      module: "Mood & Happiness Score"
      trigger_event: "Two consecutive negative mood readings"
      audience: ["Subscriber", "Field Manager"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Critical"
      subject_header: "Wellbeing Check Recommended for {{1}}"
      sample_body: >
        {{1}} has shown a low mood across two consecutive visits.
        We recommend a check-in call — would you like us to arrange
        a tele-consult?
      variables:
        "{{1}}": "Beneficiary name"

    - code: "NT-022"
      module: "Mood & Happiness Score"
      trigger_event: "Happiness Score dropped below alert threshold"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Happiness Score Update for {{1}}"
      sample_body: >
        {{1}}'s Happiness Score has changed to {{2}}.
        Our care team has been notified and will follow up.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "New score"

    - code: "NT-023"
      module: "Mood & Happiness Score"
      trigger_event: "Weekly happiness/wellbeing digest"
      audience: ["Subscriber"]
      channels: ["Email"]
      whatsapp_category: "Marketing"
      priority: "Low"
      subject_header: "{{1}}'s Weekly Wellbeing Summary"
      sample_body: >
        Here's how {{1}} has been doing this week —
        mood trend, visit highlights, and hours used.
      variables:
        "{{1}}": "Beneficiary name"

    # =========================================================
    # VITALS & MEDICATION
    # =========================================================

    - code: "NT-030"
      module: "Vitals & Medication"
      trigger_event: "Vitals out of configured normal range"
      audience: ["Subscriber", "Field Manager"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Critical"
      subject_header: "Vitals Alert for {{1}}"
      sample_body: >
        {{1}}'s {{2}} reading today was {{3}}, outside the normal range.
        {{4}} has logged notes — please review.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Vital type"
        "{{3}}": "Reading"
        "{{4}}": "CC name"

    - code: "NT-031"
      module: "Vitals & Medication"
      trigger_event: "Medication reminder (to beneficiary)"
      audience: ["Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Medication Reminder"
      sample_body: >
        Hi {{1}}, it's time for your {{2}} ({{3}}).
        Tap to confirm once taken.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Medication name"
        "{{3}}": "Dosage"

    - code: "NT-032"
      module: "Vitals & Medication"
      trigger_event: "Medication missed / non-adherence"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Medication Missed for {{1}}"
      sample_body: >
        {{1}} did not confirm taking {{2}} scheduled for {{3}}.
        Please follow up.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Medication name"
        "{{3}}": "Scheduled time"

    - code: "NT-033"
      module: "Vitals & Medication"
      trigger_event: "EMR vitals trend report (monthly)"
      audience: ["Subscriber"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "{{1}}'s Monthly Health Summary"
      sample_body: >
        Attached is {{1}}'s vitals and medication adherence trend
        for {{2}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Month"

    # =========================================================
    # SCHEDULING & SUBSCRIPTION
    # =========================================================

    - code: "NT-040"
      module: "Scheduling & Subscription"
      trigger_event: "Schedule change request submitted"
      audience: ["Operations Manager"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Schedule Change Request"
      sample_body: >
        {{1}} has requested a schedule change for {{2}},
        effective {{3}}. Please review and respond.
      variables:
        "{{1}}": "Subscriber/Beneficiary name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Effective date"

    - code: "NT-041"
      module: "Scheduling & Subscription"
      trigger_event: "Schedule change approved/rejected"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Schedule Change {{1}}"
      sample_body: >
        Your request to reschedule {{2}}'s visit has been {{1}}.
        New schedule: {{3}}.
      variables:
        "{{1}}": "Approved/Rejected"
        "{{2}}": "Beneficiary name"
        "{{3}}": "New schedule"

    - code: "NT-042"
      module: "Scheduling & Subscription"
      trigger_event: "Subscription renewal reminder (XX days before expiry)"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Marketing"
      priority: "High"
      subject_header: "Your MaiHoonNa Plan Expires Soon"
      sample_body: >
        Hi {{1}}, your {{2}} subscription for {{3}} expires on {{4}}.
        Renew now to avoid a gap in care.
      variables:
        "{{1}}": "Subscriber name"
        "{{2}}": "Package name"
        "{{3}}": "Beneficiary name"
        "{{4}}": "Expiry date"

    - code: "NT-043"
      module: "Scheduling & Subscription"
      trigger_event: "Renewal payment link"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Complete Your Renewal"
      sample_body: >
        Renew {{1}}'s {{2}} plan in one tap: {{3}}
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Package name"
        "{{3}}": "Payment link"

    - code: "NT-044"
      module: "Scheduling & Subscription"
      trigger_event: "Payment successful"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Payment Received — Thank You"
      sample_body: >
        We've received your payment of {{1}} for {{2}}'s {{3}} plan.
        Receipt attached.
      variables:
        "{{1}}": "Amount"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Package name"

    - code: "NT-045"
      module: "Scheduling & Subscription"
      trigger_event: "Payment failed"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Payment Unsuccessful"
      sample_body: >
        Your payment of {{1}} for {{2}}'s renewal could not be processed.
        Please retry: {{3}}
      variables:
        "{{1}}": "Amount"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Payment link"

    - code: "NT-046"
      module: "Scheduling & Subscription"
      trigger_event: "Subscription hours running low"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Hours Running Low for {{1}}"
      sample_body: >
        {{1}} has used {{2}} of this period's hours.
        Consider upgrading or topping up.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "% consumed"

    - code: "NT-047"
      module: "Scheduling & Subscription"
      trigger_event: "Subscription hours exhausted"
      audience: ["Subscriber", "CSA"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Hours Exhausted for {{1}}"
      sample_body: >
        {{1}}'s subscription hours for this period are fully used.
        Renew or upgrade to continue uninterrupted care.
      variables:
        "{{1}}": "Beneficiary name"

    - code: "NT-048"
      module: "Scheduling & Subscription"
      trigger_event: "Subscription terminated"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Subscription Ended"
      sample_body: >
        Your subscription for {{1}} has been terminated as requested,
        effective {{2}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Effective date"

    - code: "NT-049"
      module: "Scheduling & Subscription"
      trigger_event: "Free trial ending soon"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Marketing"
      priority: "Medium"
      subject_header: "Your Free Trial Ends in {{1}} Days"
      sample_body: >
        Hi {{1}}, your free trial for {{2}} ends on {{3}}.
        Subscribe now to continue care without interruption.
      variables:
        "{{1}}": "Number of days"
        "{{2}}": "Subscriber name"
        "{{3}}": "End date"

    # =========================================================
    # EMERGENCY
    # =========================================================

    - code: "NT-050"
      module: "Emergency"
      trigger_event: "Emergency triggered by beneficiary"
      audience: ["ERC", "OM", "FM", "PCC", "SCC"]
      channels: ["WhatsApp", "SMS", "Voice Call"]
      whatsapp_category: "Utility"
      priority: "Critical"
      subject_header: "🚨 EMERGENCY ALERT"
      sample_body: >
        EMERGENCY: {{1}} has triggered an emergency request at {{2}}.
        Respond immediately.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Timestamp"
        "{{3}}": "Location/address"

    - code: "NT-051"
      module: "Emergency"
      trigger_event: "Emergency acknowledged by ERC"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "SMS"]
      whatsapp_category: "Utility"
      priority: "Critical"
      subject_header: "Emergency Being Handled"
      sample_body: >
        We've received the emergency alert for {{1}} and our team
        is responding. We'll update you shortly.
      variables:
        "{{1}}": "Beneficiary name"

    - code: "NT-052"
      module: "Emergency"
      trigger_event: "Ambulance dispatched"
      audience: ["Subscriber"]
      channels: ["WhatsApp", "SMS"]
      whatsapp_category: "Utility"
      priority: "Critical"
      subject_header: "Ambulance Dispatched for {{1}}"
      sample_body: >
        An ambulance has been dispatched to {{1}}'s location.
        ETA: {{2}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "ETA"

    - code: "NT-053"
      module: "Emergency"
      trigger_event: "Emergency resolved"
      audience: ["Subscriber", "OM"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Critical"
      subject_header: "Emergency Resolved"
      sample_body: >
        The emergency for {{1}} has been resolved.
        Summary: {{2}}. Full report available in your app.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Brief outcome"

    # =========================================================
    # CARE TEAM & ALLOCATION
    # =========================================================

    - code: "NT-060"
      module: "Care Team & Allocation"
      trigger_event: "Primary/Secondary CC assigned"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Meet Your Care Mitra"
      sample_body: >
        {{1}} has been assigned as {{2}}'s Care Mitra.
        View their profile in your app.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Primary/Secondary"

    - code: "NT-061"
      module: "Care Team & Allocation"
      trigger_event: "CC reallocated (temp replacement)"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "Care Mitra Update"
      sample_body: >
        {{1}} will be covering {{2}}'s visits temporarily while {{3}}
        is unavailable.
      variables:
        "{{1}}": "Temp CC name"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Original CC name"

    - code: "NT-062"
      module: "Care Team & Allocation"
      trigger_event: "New CC assigned to FM's team"
      audience: ["Field Manager"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "New Team Member"
      sample_body: >
        {{1}} has been added to your team, effective {{2}}.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Date"

    - code: "NT-063"
      module: "Care Team & Allocation"
      trigger_event: "CC deactivated/terminated"
      audience: ["Field Manager", "Operations Manager"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Care Mitra Deactivated"
      sample_body: >
        {{1}} has been deactivated effective {{2}}.
        Reason: {{3}}. Please reassign their beneficiaries.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Last working date"
        "{{3}}": "Reason"

    - code: "NT-064"
      module: "Care Team & Allocation"
      trigger_event: "Birthday / special occasion reminder"
      audience: ["Care Mitra", "Field Manager"]
      channels: ["WhatsApp"]
      whatsapp_category: "Marketing"
      priority: "Low"
      subject_header: "Celebration Reminder"
      sample_body: >
        Reminder: it's {{1}}'s birthday on {{2}}!
        Plan a small celebration during your visit.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Date"

    - code: "NT-065"
      module: "Care Team & Allocation"
      trigger_event: "CC performance rating received"
      audience: ["Care Mitra"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "New Feedback Received"
      sample_body: >
        You received a {{1}}-star rating from {{2}}'s family.
        Comment: "{{3}}"
      variables:
        "{{1}}": "Rating"
        "{{2}}": "Beneficiary name"
        "{{3}}": "Comment (short)"

    # =========================================================
    # COMMUNITY & SAATHI NETWORK
    # =========================================================

    - code: "NT-070"
      module: "Community & Saathi Network"
      trigger_event: "Saathi interaction request received"
      audience: ["Volunteer"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "New Saathi Request"
      sample_body: >
        {{1}} has requested an interaction with you via Saathi Network.
        Tap to accept or view details.
      variables:
        "{{1}}": "Beneficiary name"

    - code: "NT-071"
      module: "Community & Saathi Network"
      trigger_event: "Saathi visit completed — credits earned"
      audience: ["Volunteer"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Saathi Credits Earned"
      sample_body: >
        Thank you for spending time with {{1}}!
        You've earned {{2}} Saathi credits.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Credits"

    - code: "NT-072"
      module: "Community & Saathi Network"
      trigger_event: "Hobby Circle connection message received"
      audience: ["Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "New Message in Hobby Circle"
      sample_body: >
        {{1}} sent you a message about a shared interest in {{2}}.
        Tap to view.
      variables:
        "{{1}}": "Sender name"
        "{{2}}": "Hobby"

    - code: "NT-073"
      module: "Community & Saathi Network"
      trigger_event: "Community event upcoming / RSVP reminder"
      audience: ["Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Marketing"
      priority: "Low"
      subject_header: "Upcoming Community Event"
      sample_body: >
        {{1}} is happening on {{2}} at {{3}}.
        Tap to RSVP.
      variables:
        "{{1}}": "Event name"
        "{{2}}": "Date"
        "{{3}}": "Venue"

    - code: "NT-074"
      module: "Community & Saathi Network"
      trigger_event: "Legacy Circle bio published"
      audience: ["Subscriber"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Legacy Circle Bio Published"
      sample_body: >
        {{1}}'s Legacy Circle bio is now live and visible to the community.
      variables:
        "{{1}}": "Beneficiary name"

    # =========================================================
    # SERVICE REQUESTS
    # =========================================================

    - code: "NT-080"
      module: "Service Requests"
      trigger_event: "Tele-consultation requested"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Tele-consultation Scheduled"
      sample_body: >
        Your tele-consultation for {{1}} is scheduled for {{2}}
        with Dr. {{3}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Date/time"
        "{{3}}": "Doctor name"

    - code: "NT-081"
      module: "Service Requests"
      trigger_event: "Lab test appointment scheduled"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Lab Appointment Confirmed"
      sample_body: >
        {{1}}'s lab test ({{2}}) is scheduled for {{3}} at {{4}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Test name"
        "{{3}}": "Date/time"
        "{{4}}": "Lab location"

    - code: "NT-082"
      module: "Service Requests"
      trigger_event: "Physiotherapy appointment scheduled"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Physiotherapy Appointment Confirmed"
      sample_body: >
        {{1}}'s physiotherapy session is booked for {{2}} at {{3}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Date/time"
        "{{3}}": "Center"

    - code: "NT-083"
      module: "Service Requests"
      trigger_event: "Medicine order placed with pharmacy partner"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Medicine Order Placed"
      sample_body: >
        Your medicine order for {{1}} has been placed with {{2}}.
        Expected delivery: {{3}}.
      variables:
        "{{1}}": "Beneficiary name"
        "{{2}}": "Pharmacy partner"
        "{{3}}": "Delivery date/time"

    - code: "NT-084"
      module: "Service Requests"
      trigger_event: "Appointment rescheduled / cancelled"
      audience: ["Subscriber", "Beneficiary"]
      channels: ["WhatsApp", "Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Appointment Update"
      sample_body: >
        Your {{1}} appointment has been {{2}}.
        New details: {{3}}.
      variables:
        "{{1}}": "Appointment type"
        "{{2}}": "Rescheduled/Cancelled"
        "{{3}}": "New date/time or N/A"

    # =========================================================
    # ADMIN & OPERATIONS
    # =========================================================

    - code: "NT-090"
      module: "Admin & Operations"
      trigger_event: "New subscription pending CSA review"
      audience: ["CSA"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "New Subscription Pending Review"
      sample_body: >
        A new subscription request from {{1}} for {{2}} is pending
        your review.
      variables:
        "{{1}}": "Subscriber name"
        "{{2}}": "Beneficiary name"

    - code: "NT-091"
      module: "Admin & Operations"
      trigger_event: "Subscription pending OM approval"
      audience: ["Operations Manager"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Subscription Awaiting Approval"
      sample_body: >
        Subscription #{{1}} for {{2}} is ready for your final approval.
      variables:
        "{{1}}": "Subscription ID"
        "{{2}}": "Beneficiary name"

    - code: "NT-092"
      module: "Admin & Operations"
      trigger_event: "Partner/supplier enrolment request received"
      audience: ["Operations Manager"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "New Partner Enrolment Request"
      sample_body: >
        {{1}} ({{2}}) has submitted an enrolment request.
        Please review.
      variables:
        "{{1}}": "Partner name"
        "{{2}}": "Partner type"

    - code: "NT-093"
      module: "Admin & Operations"
      trigger_event: "Partner enrolment approved"
      audience: ["Partner"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "Partner Enrolment Approved"
      sample_body: >
        Congratulations, {{1}} is now an approved MaiHoonNa partner
        effective {{2}}.
      variables:
        "{{1}}": "Partner name"
        "{{2}}": "Date"

    - code: "NT-094"
      module: "Admin & Operations"
      trigger_event: "CC absence / unavailability reported"
      audience: ["Field Manager"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "High"
      subject_header: "CC Unavailable Today"
      sample_body: >
        {{1}} has reported unavailability for {{2}}.
        {{3}} beneficiary visit(s) need reassignment.
      variables:
        "{{1}}": "CC name"
        "{{2}}": "Date"
        "{{3}}": "Beneficiary visit count"

    - code: "NT-095"
      module: "Admin & Operations"
      trigger_event: "Background verification (BGV) status update"
      audience: ["Operations Manager"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Medium"
      subject_header: "BGV Status Update — {{1}}"
      sample_body: >
        Background verification for candidate {{1}} is now: {{2}}.
      variables:
        "{{1}}": "Candidate name"
        "{{2}}": "Status"

    - code: "NT-096"
      module: "Admin & Operations"
      trigger_event: "Weekly zone utilisation report"
      audience: ["Operations Manager"]
      channels: ["Email"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "Weekly Zone Performance Report"
      sample_body: >
        Attached: utilisation, CC performance, and SLA summary for
        {{1}} zone, week of {{2}}.
      variables:
        "{{1}}": "Zone name"
        "{{2}}": "Week start date"

    - code: "NT-097"
      module: "Admin & Operations"
      trigger_event: "Inbasket message — generic notification of new message"
      audience: ["Subscriber", "Beneficiary", "Field Manager", "Operations Manager"]
      channels: ["WhatsApp"]
      whatsapp_category: "Utility"
      priority: "Low"
      subject_header: "New Message"
      sample_body: >
        You have a new message from {{1}}: "{{2}}"
      variables:
        "{{1}}": "Sender name"
        "{{2}}": "Message preview (short)"
```

---

## 3. Implementation Requirements & System Invariants

### 3.1 Architecture Pattern
* **Pattern**: Event-driven via Redis Streams.
* **Producer Layer**: Application / business service creates a domain event and publishes it asynchronously via `notificationProducer.publish({ ... })` (latency < 2ms, zero DB transaction blocking).
* **Consumer Layer**: The `@maihoonna/notifications` daemon processes messages using consumer groups (`notification-workers`), handles idempotency via `idemp:notif:<key>`, auto-claims idle messages via `XAUTOCLAIM`, and routes unrecoverable messages to `stream:notifications:dlq`.

### 3.2 Channel Adapters
1. **WhatsApp**: Uses approved Meta WABA templates matching the catalog variables via MSG91 API gateway.
2. **Email**: AWS SES (primary) with Zoho SMTP (fallback).
3. **SMS**: Transactional SMS only when explicitly specified in channels.
4. **Voice Call**: Emergency notification triggers only (`NT-050`).

### 3.3 Priority Handling
* **Critical**: Immediate processing (`NT-001`, `NT-008`, `NT-021`, `NT-030`, `NT-050`, `NT-051`, `NT-052`, `NT-053`).
* **High**: Immediate processing after critical (`NT-004`, `NT-016`, `NT-020`, `NT-022`, `NT-031`, `NT-032`, `NT-042`, `NT-043`, `NT-045`, `NT-047`, `NT-061`, `NT-094`).
* **Medium**: Normal transactional processing.
* **Low**: Processed asynchronously; may be batched / digested.

### 3.4 Data Integrity Rules
* Never hardcode recipient personal details in templates.
* Every `{{N}}` placeholder must map to its exact catalog-defined variable.
* Variable ordering must strictly match the approved Meta template definition.
* If a required variable is missing, do not send a malformed notification; log a data-contract mismatch.
