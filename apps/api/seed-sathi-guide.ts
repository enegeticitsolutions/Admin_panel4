import * as dotenv from 'dotenv';
dotenv.config();
import prisma from './app/core/database';

async function main() {
  console.log('Seeding Saathi Guide Data...');

  // 1. SaathiBestPractices
  console.log('Seeding Best Practices...');
  await prisma.saathiBestPractice.deleteMany(); // Clear existing
  await prisma.saathiBestPractice.createMany({
    data: [
      {
        title: 'Be Present & Empathetic',
        description: 'Active listening and genuine care are your most important tools',
        icon: 'heart-outline',
        points: [
          'Give your full attention during visits',
          'Listen more than you speak',
          'Show genuine interest in their stories and experiences',
          'Be patient and allow them to share at their own pace',
        ],
        sortOrder: 1,
      },
      {
        title: 'Conversation Starters',
        description: 'Topics that often lead to meaningful connections',
        icon: 'chatbubble-outline',
        points: [
          'Ask about their family and childhood memories',
          'Discuss hobbies, interests, or past careers',
          'Talk about current events or local community news',
          'Share appropriate stories from your own life',
          'Ask for their advice or wisdom on topics',
        ],
        sortOrder: 2,
      },
      {
        title: 'Visit Structure',
        description: 'Make the most of your time together',
        icon: 'time-outline',
        points: [
          'Arrive on time and stay for the planned duration',
          'Start with a warm greeting and casual conversation',
          'Engage in agreed-upon activities (tea, games, walks)',
          'End visits positively and confirm next meeting',
          'Typical visits last 1-2 hours',
        ],
        sortOrder: 3,
      },
      {
        title: 'Boundaries & Safety',
        description: 'Important guidelines to follow',
        icon: 'shield-checkmark-outline',
        points: [
          'Never share personal financial information',
          'Don\'t accept or give expensive gifts',
          'Respect their privacy and confidentiality',
          'Report any concerns to the saathi coordinator',
          'Don\'t provide medical advice or assistance',
        ],
        sortOrder: 4,
      },
    ],
  });

  // 2. SaathiSuggestedActivities
  console.log('Seeding Suggested Activities...');
  await prisma.saathiSuggestedActivity.deleteMany();
  await prisma.saathiSuggestedActivity.createMany({
    data: [
      {
        title: 'Tea & Conversation',
        duration: '1-2 hours',
        difficulty: 'Easy',
        sortOrder: 1,
      },
      {
        title: 'Board Games or Cards',
        duration: '1-2 hours',
        difficulty: 'Easy',
        sortOrder: 2,
      },
      {
        title: 'Short Walks',
        duration: '30-60 mins',
        difficulty: 'Moderate',
        sortOrder: 3,
      },
      {
        title: 'Reading Together',
        duration: '30-60 mins',
        difficulty: 'Easy',
        sortOrder: 4,
      },
      {
        title: 'Photo Album Viewing',
        duration: '1 hour',
        difficulty: 'Easy',
        sortOrder: 5,
      },
      {
        title: 'Light Gardening',
        duration: '1-2 hours',
        difficulty: 'Moderate',
        sortOrder: 6,
      },
      {
        title: 'Technology Help',
        duration: '30-60 mins',
        difficulty: 'Moderate',
        sortOrder: 7,
      },
      {
        title: 'Grocery Shopping',
        duration: '1-2 hours',
        difficulty: 'Moderate',
        sortOrder: 8,
      },
    ],
  });

  // 3. SaathiFaqs
  console.log('Seeding FAQs...');
  await prisma.saathiFaq.deleteMany();
  await prisma.saathiFaq.createMany({
    data: [
      {
        question: 'What if the beneficiary seems unwell during my visit?',
        answer: 'If it is an emergency, contact Emergency Services immediately. Otherwise, inform the saathi coordinator through the emergency support channel.',
        sortOrder: 1,
      },
      {
        question: 'How do I handle difficult conversations or emotions?',
        answer: 'Listen empathetically without judgment. Do not try to "fix" their feelings. If you feel overwhelmed, contact your saathi coordinator for guidance.',
        sortOrder: 2,
      },
      {
        question: 'What if I need to cancel a scheduled visit?',
        answer: 'Please use the app to reschedule or cancel at least 24 hours in advance so the beneficiary can be notified promptly.',
        sortOrder: 3,
      },
      {
        question: 'Can I bring someone else along to visits?',
        answer: 'No, for safety and privacy reasons, only verified Saathi volunteers are permitted to conduct visits.',
        sortOrder: 4,
      },
      {
        question: 'How do I build rapport with someone I just met?',
        answer: 'Start with simple conversation starters, be patient, and show genuine interest in their stories. Consistency in your visits is key.',
        sortOrder: 5,
      },
    ],
  });

  console.log('Successfully seeded all Saathi Guide data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
