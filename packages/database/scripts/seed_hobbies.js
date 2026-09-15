#!/usr/bin/env node

/**
 * seed_hobbies.js
 *
 * Standalone, idempotent script to populate Hobby data:
 *
 * Usage:
 *   node packages/database/scripts/seed_hobbies.js
 *   DATABASE_URL="postgresql://..." node packages/database/scripts/seed_hobbies.js
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
          console.log(`[Hobbies Seed] Using DATABASE_URL discovered in ${envPath}`);
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[Hobbies Seed] ERROR: DATABASE_URL is not provided.');
  console.error('Please export DATABASE_URL or provide an .env file.');
  process.exit(1);
}

// 1. HOBBIES DATA
const HOBBIES = [
  "Reading",
  "Writing",
  "Cooking",
  "Baking",
  "Gardening",
  "Photography",
  "Yoga",
  "Meditation",
  "Walking",
  "Running",
  "Cycling",
  "Swimming",
  "Painting",
  "Drawing",
  "Knitting",
  "Sewing",
  "Playing Instruments",
  "Listening to Music",
  "Watching Movies",
  "Board Games",
  "Chess",
  "Puzzles",
  "Traveling",
  "Bird Watching",
  "Fishing",
  "Dancing",
  "Singing",
  "Volunteering",
  "Learning Languages",
  "Calligraphy"
];

async function seed() {
  const sanitizedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`[Hobbies Seed] Connecting to target database: ${sanitizedUrl}`);

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

  console.log('\n--- 1. Seeding Hobbies ---');
  let createdCount = 0;
  let verifiedCount = 0;

  for (const hobbyName of HOBBIES) {
    const existing = await prisma.hobby.findFirst({
      where: { name: hobbyName }
    });

    if (!existing) {
      await prisma.hobby.create({ data: { name: hobbyName } });
      console.log(`  + [CREATED] ${hobbyName}`);
      createdCount++;
    } else {
      console.log(`  ~ [VERIFIED/KEPT] ${hobbyName}`);
      verifiedCount++;
    }
  }

  const totalHobbies = await prisma.hobby.count();

  console.log(`\n[Hobbies Seed] Completed successfully!`);
  console.log(`  - Newly Created: ${createdCount}`);
  console.log(`  - Verified/Kept: ${verifiedCount}`);
  console.log(`  - Total Hobbies in DB: ${totalHobbies}`);

  await prisma.$disconnect();
  await pool.end();
}

seed().catch((err) => {
  console.error('[Hobbies Seed] Fatal error during seeding:', err);
  process.exit(1);
});
