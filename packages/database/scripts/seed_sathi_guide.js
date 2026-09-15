#!/usr/bin/env node

/**
 * seed_sathi_guide.js
 *
 * Standalone, idempotent script to populate all production Saathi Guide data:
 *   - 4 Saathi Best Practices (saathi_best_practices)
 *   - 8 Saathi Suggested Activities (saathi_suggested_activities)
 *   - 5 Saathi FAQs (saathi_faqs)
 *
 * Usage:
 *   node packages/database/scripts/seed_sathi_guide.js
 *   DATABASE_URL="postgresql://..." node packages/database/scripts/seed_sathi_guide.js
 *   npm run seed:sathi-guide
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Auto-discover DATABASE_URL if not directly supplied in process.env
if (!process.env.DATABASE_URL) {
  const candidateEnvPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../apps/api/.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL=')) {
          let val = trimmed.substring('DATABASE_URL='.length).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          process.env.DATABASE_URL = val;
          console.log(`[Sathi Guide Seed] Using DATABASE_URL discovered in ${envPath}`);
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[Sathi Guide Seed] ERROR: DATABASE_URL is not provided.');
  console.error('Please export DATABASE_URL or provide an .env file.');
  process.exit(1);
}

// 1. BEST PRACTICES DATA
const BEST_PRACTICES = [
  {
    title: 'Be Present & Empathetic',
    description: 'Active listening and genuine care are your most important tools',
    icon: 'heart-outline',
    points: [
      'Give your full attention during visits',
      'Listen more than you speak',
      'Show genuine interest in their stories and experiences',
      'Be patient and allow them to share at their own pace'
    ],
    sortOrder: 1,
    isActive: true
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
      'Ask for their advice or wisdom on topics'
    ],
    sortOrder: 2,
    isActive: true
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
      'Typical visits last 1-2 hours'
    ],
    sortOrder: 3,
    isActive: true
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
      'Don\'t provide medical advice or assistance'
    ],
    sortOrder: 4,
    isActive: true
  }
];

// 2. SUGGESTED ACTIVITIES DATA
const SUGGESTED_ACTIVITIES = [
  { title: 'Tea & Conversation', duration: '1-2 hours', difficulty: 'Easy', sortOrder: 1, isActive: true },
  { title: 'Board Games or Cards', duration: '1-2 hours', difficulty: 'Easy', sortOrder: 2, isActive: true },
  { title: 'Short Walks', duration: '30-60 mins', difficulty: 'Moderate', sortOrder: 3, isActive: true },
  { title: 'Reading Together', duration: '30-60 mins', difficulty: 'Easy', sortOrder: 4, isActive: true },
  { title: 'Photo Album Viewing', duration: '1 hour', difficulty: 'Easy', sortOrder: 5, isActive: true },
  { title: 'Light Gardening', duration: '1-2 hours', difficulty: 'Moderate', sortOrder: 6, isActive: true },
  { title: 'Technology Help', duration: '30-60 mins', difficulty: 'Moderate', sortOrder: 7, isActive: true },
  { title: 'Grocery Shopping', duration: '1-2 hours', difficulty: 'Moderate', sortOrder: 8, isActive: true }
];

// 3. FAQS DATA
const FAQS = [
  {
    question: 'What if the beneficiary seems unwell during my visit?',
    answer: 'If it is an emergency, contact Emergency Services immediately. Otherwise, inform the saathi coordinator through the emergency support channel.',
    sortOrder: 1,
    isActive: true
  },
  {
    question: 'How do I handle difficult conversations or emotions?',
    answer: 'Listen empathetically without judgment. Do not try to "fix" their feelings. If you feel overwhelmed, contact your saathi coordinator for guidance.',
    sortOrder: 2,
    isActive: true
  },
  {
    question: 'What if I need to cancel a scheduled visit?',
    answer: 'Please use the app to reschedule or cancel at least 24 hours in advance so the beneficiary can be notified promptly.',
    sortOrder: 3,
    isActive: true
  },
  {
    question: 'Can I bring someone else along to visits?',
    answer: 'No, for safety and privacy reasons, only verified Saathi volunteers are permitted to conduct visits.',
    sortOrder: 4,
    isActive: true
  },
  {
    question: 'How do I build rapport with someone I just met?',
    answer: 'Start with simple conversation starters, be patient, and show genuine interest in their stories. Consistency in your visits is key.',
    sortOrder: 5,
    isActive: true
  }
];

async function seed() {
  const sanitizedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`[Sathi Guide Seed] Connecting to target database: ${sanitizedUrl}`);

  const isLocal =
    process.env.DATABASE_URL.includes('localhost') ||
    process.env.DATABASE_URL.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('\n--- 1. Seeding Saathi Best Practices ---');
  for (const bp of BEST_PRACTICES) {
    const existing = await prisma.saathiBestPractice.findFirst({
      where: { title: bp.title }
    });

    if (!existing) {
      await prisma.saathiBestPractice.create({ data: bp });
      console.log(`  + [CREATED] ${bp.title}`);
    } else {
      await prisma.saathiBestPractice.update({
        where: { id: existing.id },
        data: {
          description: bp.description,
          icon: bp.icon,
          points: bp.points,
          sortOrder: bp.sortOrder,
          isActive: bp.isActive,
        }
      });
      console.log(`  ~ [UPDATED/VERIFIED] ${bp.title}`);
    }
  }

  console.log('\n--- 2. Seeding Saathi Suggested Activities ---');
  for (const act of SUGGESTED_ACTIVITIES) {
    const existing = await prisma.saathiSuggestedActivity.findFirst({
      where: { title: act.title }
    });

    if (!existing) {
      await prisma.saathiSuggestedActivity.create({ data: act });
      console.log(`  + [CREATED] ${act.title} (${act.duration}, ${act.difficulty})`);
    } else {
      await prisma.saathiSuggestedActivity.update({
        where: { id: existing.id },
        data: {
          duration: act.duration,
          difficulty: act.difficulty,
          sortOrder: act.sortOrder,
          isActive: act.isActive,
        }
      });
      console.log(`  ~ [UPDATED/VERIFIED] ${act.title}`);
    }
  }

  console.log('\n--- 3. Seeding Saathi FAQs ---');
  for (const faq of FAQS) {
    const existing = await prisma.saathiFaq.findFirst({
      where: { question: faq.question }
    });

    if (!existing) {
      await prisma.saathiFaq.create({ data: faq });
      console.log(`  + [CREATED] ${faq.question.slice(0, 50)}...`);
    } else {
      await prisma.saathiFaq.update({
        where: { id: existing.id },
        data: {
          answer: faq.answer,
          sortOrder: faq.sortOrder,
          isActive: faq.isActive,
        }
      });
      console.log(`  ~ [UPDATED/VERIFIED] ${faq.question.slice(0, 50)}...`);
    }
  }

  const [countBP, countAct, countFaq] = await Promise.all([
    prisma.saathiBestPractice.count(),
    prisma.saathiSuggestedActivity.count(),
    prisma.saathiFaq.count(),
  ]);

  console.log(`\n[Sathi Guide Seed] Completed successfully!`);
  console.log(`  - Total Best Practices in DB: ${countBP}`);
  console.log(`  - Total Activities in DB:     ${countAct}`);
  console.log(`  - Total FAQs in DB:           ${countFaq}`);

  await prisma.$disconnect();
  await pool.end();
}

seed().catch((err) => {
  console.error('[Sathi Guide Seed] Fatal error during seeding:', err);
  process.exit(1);
});
