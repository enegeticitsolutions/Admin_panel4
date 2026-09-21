#!/usr/bin/env node

/**
 * seed_master_admin.js
 *
 * Standalone, idempotent script to seed the Master Admin profile.
 *
 * Usage:
 *   node packages/database/scripts/seed_master_admin.js
 *   DATABASE_URL="postgresql://..." node packages/database/scripts/seed_master_admin.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Auto-discover DATABASE_URL if not directly supplied in process.env
if (!process.env.DATABASE_URL) {
  const candidateEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../apps/api/.env'),
    path.resolve(__dirname, '../../../apps/admin-backend/.env'),
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
          console.log(`[Master Admin Seed] Using DATABASE_URL discovered in ${envPath}`);
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[Master Admin Seed] ERROR: DATABASE_URL is not provided.');
  console.error('Please export DATABASE_URL or provide an .env file.');
  process.exit(1);
}

// Master Admin Details
const PHONES = [
  '9305951785',
  '8826280049',
  '8081152565',
  '9971661223'
];

const PASSWORD_PLAIN = process.env.MASTER_ADMIN_PASSWORD;

const ROLE = 'master_admin'; 

async function seed() {
  const sanitizedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`[Master Admin Seed] Connecting to target database: ${sanitizedUrl}`);

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

  console.log('\n--- 1. Seeding Master Admin Profiles ---');

  let bcrypt;
  const candidateBcryptPaths = [
    'bcryptjs',
    path.resolve(process.cwd(), 'node_modules/bcryptjs'),
    path.resolve(__dirname, '../../../node_modules/bcryptjs'),
    path.resolve(__dirname, '../../../apps/api/node_modules/bcryptjs'),
    path.resolve(__dirname, '../../../apps/admin-backend/node_modules/bcryptjs'),
  ];

  for (const bPath of candidateBcryptPaths) {
    try {
      bcrypt = require(bPath);
      if (bcrypt) break;
    } catch (err) {}
  }

  if (!bcrypt) {
    console.error('[Master Admin Seed] ERROR: Could not find bcryptjs module to hash the password.');
    console.error('Please run this script from the root directory where node_modules are installed, or run "npm install bcryptjs" temporarily.');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(PASSWORD_PLAIN, salt);

  for (const phone of PHONES) {
    const adminData = {
      phone: phone,
      password: hashedPassword,
      role: ROLE,
      name: 'Master Admin',
      isActive: true,
      isVerified: true,
      status: 'active'
    };

    const user = await prisma.user.upsert({
      where: { phone: phone },
      update: adminData,
      create: adminData,
    });
    
    console.log(`  - Upserted Master Admin: ${user.phone} (ID: ${user.id})`);
  }

  console.log(`\n[Master Admin Seed] Completed successfully! seeded ${PHONES.length} profiles.`);

  await prisma.$disconnect();
  await pool.end();
}

seed().catch((err) => {
  console.error('[Master Admin Seed] Fatal error during seeding:', err);
  process.exit(1);
});
