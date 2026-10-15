#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Auto-discover DATABASE_URL
if (!process.env.DATABASE_URL) {
  const candidateEnvPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../apps/api/.env'),
    path.resolve(__dirname, '../../../apps/admin-backend/.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      if (process.env.DATABASE_URL) break;
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const INITIAL_CATEGORIES = [
  {
    name: 'Ambulance & Emergency',
    slug: 'ambulance-emergency',
    code: 'AMBULANCE_EMERGENCY',
    description: 'Rapid-response partner network for medical emergencies.',
    displayOrder: 1,
    isActive: true,
  },
  {
    name: 'Pharmacy Partners',
    slug: 'pharmacy-partners',
    code: 'PHARMACY_PARTNERS',
    description: 'Medicine ordering, home delivery, and prescription management.',
    displayOrder: 2,
    isActive: true,
  },
  {
    name: 'Diagnostic Labs',
    slug: 'diagnostic-labs',
    code: 'DIAGNOSTIC_LABS',
    description: 'Home-sample collection and lab appointment scheduling.',
    displayOrder: 3,
    isActive: true,
  },
  {
    name: 'Care Providers',
    slug: 'care-providers',
    code: 'CARE_PROVIDERS',
    description: 'Physiotherapists, ENT specialists, general physicians, and more.',
    displayOrder: 4,
    isActive: true,
  },
  {
    name: 'Hospitals & Clinics',
    slug: 'hospitals-clinics',
    code: 'HOSPITALS_CLINICS',
    description: 'Preferred hospital tie-ups for planned visits and referrals.',
    displayOrder: 5,
    isActive: true,
  },
  {
    name: 'Tele-medicine',
    slug: 'tele-medicine',
    code: 'TELE_MEDICINE',
    description: 'Virtual consultation scheduling managed by Care Mitras.',
    displayOrder: 6,
    isActive: true,
  },
  {
    name: 'Corporate & B2B',
    slug: 'corporate-b2b',
    code: 'CORPORATE_B2B',
    description: 'Employee benefit programmes for organisations with elder care needs.',
    displayOrder: 7,
    isActive: true,
  },
  {
    name: 'RWA & Housing Societies',
    slug: 'rwa-housing-societies',
    code: 'RWA_HOUSING_SOCIETIES',
    description: 'Nodal care centres embedded within condominium societies.',
    displayOrder: 8,
    isActive: true,
  },
];

async function seedPartnerCategories() {
  console.log('🌱 Seeding initial Zoho CRM partner categories...');
  for (const cat of INITIAL_CATEGORIES) {
    await prisma.partnerCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        code: cat.code,
        description: cat.description,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
      },
      create: cat,
    });
  }
  console.log('✅ 8 Partner categories seeded successfully into database!');
}

seedPartnerCategories()
  .catch((e) => {
    console.error('❌ Error seeding partner categories:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
