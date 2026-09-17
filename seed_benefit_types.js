#!/usr/bin/env node

/**
 * seed_benefit_types.js
 *
 * Standalone direct database seeder for Benefit Types on Supabase.
 * Can be run from ANY directory (root, subfolder, EC2 terminal).
 *
 * Usage:
 *   node seed_benefit_types.js
 */

const fs = require('fs');
const path = require('path');

// 1. Auto-discover DATABASE_URL from .env files if not already in process.env
if (!process.env.DATABASE_URL) {
  const candidateEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'packages/database/.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(process.cwd(), 'apps/admin-backend/.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, 'packages/database/.env'),
    path.resolve(__dirname, 'apps/api/.env'),
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
          console.log(`[Seed] Discovered DATABASE_URL in: ${envPath}`);
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[Seed] ERROR: DATABASE_URL is not set.');
  console.error('Please export DATABASE_URL="postgresql://..." or provide a .env file.');
  process.exit(1);
}

// 2. Canonical Benefit Types Data
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

// Helper to resolve `pg` package from multiple possible locations
function getPgModule() {
  const tryPaths = [
    'pg',
    './node_modules/pg',
    './packages/database/node_modules/pg',
    './apps/api/node_modules/pg',
  ];
  for (const p of tryPaths) {
    try {
      return require(p);
    } catch (e) {}
  }
  return null;
}

async function run() {
  const pg = getPgModule();
  if (!pg) {
    console.error('[Seed] ERROR: "pg" module not found. Run "npm install pg" or run from project root.');
    process.exit(1);
  }

  const { Pool } = pg;
  const isLocal =
    process.env.DATABASE_URL.includes('localhost') ||
    process.env.DATABASE_URL.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  const sanitizedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`[Seed] Connected to database: ${sanitizedUrl}\n`);
  console.log('======================================================');
  console.log('            SEEDING BENEFIT TYPES DIRECTLY            ');
  console.log('======================================================\n');

  try {
    let created = 0;
    let updated = 0;

    for (const item of BENEFIT_TYPES) {
      // Check existing by code OR name
      const existingRes = await client.query(
        `SELECT id, code, name, description, "iconCode", "displayOrder", "isActive", "isSystem" 
         FROM benefit_types 
         WHERE code = $1 OR name = $2 
         LIMIT 1`,
        [item.code, item.name]
      );

      if (existingRes.rows.length === 0) {
        // Create new
        const insertRes = await client.query(
          `INSERT INTO benefit_types 
            (id, code, name, description, "iconCode", "displayOrder", "isActive", "isSystem", "createdAt", "updatedAt")
           VALUES 
            (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           RETURNING id, code, name, "iconCode", "displayOrder"`,
          [
            item.code,
            item.name,
            item.description,
            item.iconCode,
            item.displayOrder,
            item.isActive,
            item.isSystem,
          ]
        );
        const row = insertRes.rows[0];
        console.log(`  + [CREATED]   ${row.iconCode} ${row.name} (Code: ${row.code}, ID: ${row.id})`);
        created++;
      } else {
        // Update existing safely
        const existing = existingRes.rows[0];
        const updateRes = await client.query(
          `UPDATE benefit_types
           SET code = COALESCE($1, code),
               description = COALESCE($2, description),
               "iconCode" = COALESCE($3, "iconCode"),
               "displayOrder" = $4,
               "isActive" = $5,
               "isSystem" = $6,
               "updatedAt" = NOW()
           WHERE id = $7
           RETURNING id, code, name, "iconCode", "displayOrder"`,
          [
            item.code,
            item.description,
            item.iconCode,
            item.displayOrder,
            item.isActive,
            item.isSystem,
            existing.id,
          ]
        );
        const row = updateRes.rows[0];
        console.log(`  ~ [UPSERTED]  ${row.iconCode} ${row.name} (Code: ${row.code}, ID: ${row.id})`);
        updated++;
      }
    }

    // List all types currently in DB
    const listRes = await client.query(
      `SELECT bt.id, bt.code, bt.name, bt."iconCode", bt."displayOrder", bt."isActive", bt."isSystem", 
              COUNT(b.id)::int AS "benefitsCount"
       FROM benefit_types bt
       LEFT JOIN benefits b ON b."benefitTypeId" = bt.id
       GROUP BY bt.id
       ORDER BY bt."displayOrder" ASC`
    );

    console.log('\n------------------------------------------------------');
    console.log(`SUMMARY: Created: ${created} | Updated: ${updated} | Total in DB: ${listRes.rows.length}`);
    console.log('------------------------------------------------------\n');

    console.table(
      listRes.rows.map((r) => ({
        Order: r.displayOrder,
        Icon: r.iconCode || ' ',
        Code: r.code || '(none)',
        Name: r.name,
        System: r.isSystem ? 'YES' : 'NO',
        Active: r.isActive ? 'YES' : 'NO',
        Benefits: r.benefitsCount,
        ID: r.id,
      }))
    );

    console.log('[Seed] Completed successfully!\n');
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
