#!/usr/bin/env node

/**
 * seed_benefit_types.js
 *
 * Standalone, idempotent script to seed BenefitType data directly into the database (Supabase).
 *
 * Usage:
 *   node packages/database/scripts/seed_benefit_types.js
 *   npm run seed:benefit-types
 *   DATABASE_URL="postgresql://..." node packages/database/scripts/seed_benefit_types.js
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
    path.resolve(process.cwd(), 'packages/database/.env'),
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
          console.log(`[Benefit Types Seed] Discovered DATABASE_URL in ${envPath}`);
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[Benefit Types Seed] ERROR: DATABASE_URL is not provided.');
  console.error('Please export DATABASE_URL or provide a valid .env file.');
  process.exit(1);
}

// Canonical Benefit Types Definition
const BENEFIT_TYPES = [
  {
    code: 'EMERGENCY',
    name: 'Emergency',
    description: '24/7 Emergency SOS & Response Services',
    iconCode: '🚨',
    displayOrder: 1,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'SATHI_COMPANION',
    name: 'Sathi Companion',
    description: 'Volunteer companionship & care companion home visits',
    iconCode: '👥',
    displayOrder: 2,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'NURSE_VISIT',
    name: 'Nurse',
    description: 'Trained nursing care and home procedures',
    iconCode: '🏥',
    displayOrder: 3,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'CARE_ASSISTANT',
    name: 'Care Assistant',
    description: 'Non-medical care assistance, daily support and companionship',
    iconCode: '🤝',
    displayOrder: 4,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'AMBULANCE',
    name: 'Ambulance',
    description: 'Emergency ambulance transit & medical evacuation',
    iconCode: '🚑',
    displayOrder: 5,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'TELE_CONSULT',
    name: 'Tele-consultation',
    description: 'Remote tele-doctor consultation and audio/video clinical advice',
    iconCode: '📞',
    displayOrder: 6,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'PHYSIO_SESSION',
    name: 'Physio Session',
    description: 'Physiotherapy, movement rehabilitation and guided recovery',
    iconCode: '🧘',
    displayOrder: 7,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'LAB_TEST',
    name: 'Lab Test',
    description: 'Diagnostic laboratory sample collection at doorstep',
    iconCode: '🔬',
    displayOrder: 8,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'PHARMACY',
    name: 'Pharmacy',
    description: 'Prescription medicine procurement, refill and doorstep delivery',
    iconCode: '💊',
    displayOrder: 9,
    isActive: true,
    isSystem: true,
  },
  {
    code: 'SPECIALIST_DOCTOR',
    name: 'Specialist Doctor',
    description: 'In-person consultation with medical specialists (Cardiologist, Neurologist, etc.)',
    iconCode: '🧑‍⚕️',
    displayOrder: 10,
    isActive: true,
    isSystem: false,
  },
  {
    code: 'NUTRITION_DIET',
    name: 'Nutrition & Diet',
    description: 'Personalized dietary assessment and geriatric nutritional plans',
    iconCode: '🥗',
    displayOrder: 11,
    isActive: true,
    isSystem: false,
  },
  {
    code: 'MENTAL_WELLNESS',
    name: 'Mental Wellness',
    description: 'Mental health counseling, cognitive engagement and emotional therapy',
    iconCode: '❤️',
    displayOrder: 12,
    isActive: true,
    isSystem: false,
  },
];

async function seed() {
  const sanitizedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`[Benefit Types Seed] Connecting to database: ${sanitizedUrl}`);

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

  console.log('\n=============================================');
  console.log('       SEEDING BENEFIT TYPES (SUPABASE)      ');
  console.log('=============================================\n');

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const item of BENEFIT_TYPES) {
    // 1. Check if record exists by unique code OR by unique name
    let existing = null;
    if (item.code) {
      existing = await prisma.benefitType.findFirst({
        where: { code: item.code },
      });
    }

    if (!existing) {
      existing = await prisma.benefitType.findFirst({
        where: { name: item.name },
      });
    }

    if (!existing) {
      // Create fresh record
      const created = await prisma.benefitType.create({
        data: {
          code: item.code,
          name: item.name,
          description: item.description,
          iconCode: item.iconCode,
          displayOrder: item.displayOrder,
          isActive: item.isActive,
          isSystem: item.isSystem,
        },
      });
      console.log(`  + [CREATED] ${item.iconCode} ${created.name} (code: ${created.code || 'null'}, ID: ${created.id})`);
      createdCount++;
    } else {
      // Determine if update is needed (e.g. adding code, icon, or description if missing/different)
      const needsUpdate =
        (item.code && existing.code !== item.code) ||
        (item.description && existing.description !== item.description) ||
        (item.iconCode && existing.iconCode !== item.iconCode) ||
        existing.displayOrder !== item.displayOrder ||
        existing.isSystem !== item.isSystem ||
        existing.isActive !== item.isActive;

      if (needsUpdate) {
        const updated = await prisma.benefitType.update({
          where: { id: existing.id },
          data: {
            code: item.code || existing.code,
            name: existing.name, // Keep existing name to prevent unique conflict
            description: item.description || existing.description,
            iconCode: item.iconCode || existing.iconCode,
            displayOrder: item.displayOrder ?? existing.displayOrder,
            isActive: item.isActive !== undefined ? item.isActive : existing.isActive,
            isSystem: item.isSystem !== undefined ? item.isSystem : existing.isSystem,
          },
        });
        console.log(`  ~ [UPDATED] ${updated.iconCode} ${updated.name} (code: ${updated.code}, ID: ${updated.id})`);
        updatedCount++;
      } else {
        console.log(`  = [UNCHANGED] ${existing.iconCode || '•'} ${existing.name} (code: ${existing.code || 'null'}, ID: ${existing.id})`);
        unchangedCount++;
      }
    }
  }

  // Fetch all benefit types to display current status
  const allBenefitTypes = await prisma.benefitType.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { benefits: true } } },
  });

  console.log('\n---------------------------------------------');
  console.log('SUMMARY:');
  console.log(`  - Newly Created : ${createdCount}`);
  console.log(`  - Updated       : ${updatedCount}`);
  console.log(`  - Unchanged     : ${unchangedCount}`);
  console.log(`  - Total in DB   : ${allBenefitTypes.length}`);
  console.log('---------------------------------------------\n');

  console.log('Current Benefit Types in Database:');
  console.table(
    allBenefitTypes.map((t) => ({
      Order: t.displayOrder,
      Icon: t.iconCode || ' ',
      Code: t.code || '(none)',
      Name: t.name,
      System: t.isSystem ? 'YES' : 'NO',
      Active: t.isActive ? 'YES' : 'NO',
      BenefitsCount: t._count?.benefits ?? 0,
      ID: t.id,
    }))
  );

  await prisma.$disconnect();
  await pool.end();
}

seed()
  .then(() => {
    console.log('[Benefit Types Seed] Successfully completed.\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Benefit Types Seed] Fatal error during seeding:', err);
    process.exit(1);
  });
