import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../apps/api/.env') });

import { WhatsAppChannel } from './src/channels/whatsapp.channel';
import { WhatsAppRegistry } from './src/registry/whatsapp.registry';

const whatsAppChannel = new WhatsAppChannel();
const TARGET_PHONE = '9305951785';

const templatesToTest = [
  {
    event: 'VISIT_SCHEDULED',
    variables: ['Priya Sharma', 'Mr. Ramesh Kumar', 'Sept 4', '11:00 AM', 'Sector 62, Noida'],
  },
  {
    event: 'VISIT_REMINDER',
    variables: ['Mr. Ramesh Kumar', '11:00 AM'],
  },
  {
    event: 'CM_ONBOARDING_CLEARED',
    variables: ['Priya Sharma', 'Amit Verma'],
  },
  {
    event: 'EMERGENCY_ACKNOWLEDGED',
    variables: ['Mr. Ramesh Kumar'],
  },
  {
    event: 'MEDICATION_MISSED',
    variables: ['Mr. Ramesh Kumar', 'Metformin 500mg', '1:00 PM'],
  },
  {
    event: 'VISIT_STARTED',
    variables: ['Priya Sharma', 'Mr. Ramesh Kumar', '11:02 AM'],
  },
  {
    event: 'VISIT_COMPLETED',
    variables: ['Priya Sharma', 'Mr. Ramesh Kumar', '1 hr 15 mins'],
  },
  {
    event: 'DAILY_VISIT_SUMMARY',
    variables: ['Rajeev Kumar', 'Mr. Ramesh Kumar', 'Cheerful', 'Walked 500m, vitals normal'],
  },
  {
    event: 'MISSED_VISIT',
    variables: ['Mr. Ramesh Kumar'],
  },
  {
    event: 'CLINIC_VISIT_STARTED',
    variables: ['Priya Sharma', 'Mr. Ramesh Kumar', 'Fortis Hospital Noida'],
  },
  {
    event: 'SAATHI_VISIT_FEEDBACK_CONCERN',
    variables: ['Rahul Verma', 'Mr. Ramesh Kumar', 'Beneficiary felt slightly dizzy during walk'],
  },
  {
    event: 'SAATHI_VISIT_CHECKED_IN_NOT_OUT',
    variables: ['Rahul Verma', 'Mr. Ramesh Kumar', 'Sept 10, 2026'],
  },
  {
    event: 'SAATHI_NO_VISITS_LOGGED',
    variables: ['Rahul Verma', 'Mr. Ramesh Kumar'],
  },
  {
    event: 'SAATHI_AVAILABILITY_SCHEDULE_UPDATED',
    variables: ['Rahul Verma', 'Mon, Wed, Fri (10 AM - 2 PM)'],
  },
  {
    event: 'SAATHI_VISIT_COMPLETED',
    variables: ['Mr. Ramesh Kumar', '25'],
  },
  {
    event: 'MOOD_ALERT',
    variables: ['Mr. Ramesh Kumar', 'Sad', 'Priya Sharma'],
  },
  {
    event: 'WELLBEING_CHECK_RECOMMENDED',
    variables: ['Mr. Ramesh Kumar'],
  },
  {
    event: 'PLAN_PURCHASED',
    variables: ['₹4,999', 'Mr. Ramesh Kumar', 'Silver Care'],
  },
  {
    event: 'SAATHI_EMERGENCY_SUPPORT_ALERT',
    variables: ['Mr. Ramesh Kumar', 'Dr. Meenakshi Sundaram'],
  },
  {
    event: 'RENEWAL_PAYMENT',
    variables: ['Mr. Ramesh Kumar', 'Silver Care', 'https://mhn.care/pay/r123'],
  },
  {
    event: 'SAATHI_PROFILE_SAVED',
    variables: ['Rahul Verma'],
  },
  {
    event: 'SAATHI_NEW_BENEFICIARY_MATCH',
    variables: ['Rahul Verma', 'Mrs. Sunita Verma', '2.5'],
  },
  {
    event: 'SAATHI_BENEFICIARY_MATCH_REMOVED',
    variables: ['Rahul Verma', 'Mrs. Sunita Verma'],
  },
  {
    event: 'SAATHI_MONTHLY_GOAL_ACHIEVED',
    variables: ['Rahul Verma', '20', '20'],
  },
  {
    event: 'SAATHI_GIFT_CARD_ISSUED',
    variables: ['500', 'Amazon', 'rahul@example.com'],
  },
  {
    event: 'SAATHI_LOW_BALANCE_NUDGE',
    variables: ['Rahul Verma', '120', '600'],
  },
  {
    event: 'SAATHI_ADDRESS_UPDATED',
    variables: ['Rahul Verma', 'Sector 62, Noida'],
  },
  {
    event: 'HOBBY_CIRCLE_MESSAGE',
    variables: ['Suresh Gupta', 'Gardening'],
  },
  {
    event: 'SAATHI_NEW_GUIDE_TIP',
    variables: ['Rahul Verma', 'Active Listening Techniques for Seniors'],
  },
  {
    event: 'SAATHI_PROFILE_COMPLETED',
    variables: ['Rahul Verma'],
  },
  {
    event: 'RATING_FEEDBACK_PROMPT',
    variables: ['Priya Sharma'],
  },
  {
    event: 'SAATHI_MONTHLY_GOAL_AT_RISK',
    variables: ['Rahul Verma', '8', '20'],
  },
  {
    event: 'CC_PERFORMANCE_RATING',
    variables: ['5', 'Mr. Ramesh Kumar', 'Very attentive and compassionate care.'],
  },
  {
    event: 'CC_REALLOCATED',
    variables: ['Neha Singh', 'Mr. Ramesh Kumar', 'Priya Sharma'],
  },
  {
    event: 'PAYMENT_FAILED',
    variables: ['Rajeev Kumar', '₹4,999', 'Mr. Ramesh Kumar', 'https://mhn.care/pay/retry123'],
  },
  {
    event: 'PACKAGE_PAYMENT',
    variables: ['Rajeev Kumar', 'Gold Eldercare', '₹9,999', 'https://mhn.care/pay/pkg123'],
  },
  {
    event: 'ADDON_PAYMENT',
    variables: ['Rajeev Kumar', 'Physiotherapy 5-pack', '₹2,500', 'https://mhn.care/pay/addon123'],
  },
  {
    event: 'SAATHI_PROFILE_APPROVED',
    variables: ['Rahul Verma'],
  },
];

async function runTest() {
  console.log('Testing Batch 2 corrected templates against MSG91...');
  for (const item of templatesToTest) {
    const reg = (WhatsAppRegistry as any)[item.event];
    console.log(`\nDispatching [${item.event}] with slug: "${reg.template}"...`);
    const res = await whatsAppChannel.send({
      to: TARGET_PHONE,
      templateName: reg.template,
      variables: item.variables,
    });
    console.log(`Result:`, res);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

runTest();
