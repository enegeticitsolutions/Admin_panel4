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
    name: 'Ambulance and Emergency',
    slug: 'ambulance-and-emergency',
    code: 'AMBULANCE_AND_EMERGENCY',
    description: '24/7 ICU ambulances, cardiac support, and emergency response teams.',
    displayOrder: 1,
    isActive: true,
  },
  {
    name: 'Pharmacy',
    slug: 'pharmacy',
    code: 'PHARMACY',
    description: 'Home delivery of prescription medications and medical supplies.',
    displayOrder: 2,
    isActive: true,
  },
  {
    name: 'Diagnostic Labs',
    slug: 'diagnostic-labs',
    code: 'DIAGNOSTIC_LABS',
    description: 'NABL accredited pathology labs with doorstep sample collection.',
    displayOrder: 3,
    isActive: true,
  },
  {
    name: 'Care Providers',
    slug: 'care-providers',
    code: 'CARE_PROVIDERS',
    description: 'Trained nurses, attendants, and home physiotherapists.',
    displayOrder: 4,
    isActive: true,
  },
  {
    name: 'Hospitals and Clinics',
    slug: 'hospitals-and-clinics',
    code: 'HOSPITALS_AND_CLINICS',
    description: 'Priority OPD consultations, IPD admissions, and geriatric care units.',
    displayOrder: 5,
    isActive: true,
  },
  {
    name: 'Corporate & B2B',
    slug: 'corporate-and-b2b',
    code: 'CORPORATE_B2B',
    description: 'Employee eldercare wellness and enterprise care benefit programs.',
    displayOrder: 6,
    isActive: true,
  },
  {
    name: 'Tele-medicine',
    slug: 'tele-medicine',
    code: 'TELE_MEDICINE',
    description: 'Instant video and phone consultations with verified specialist doctors.',
    displayOrder: 7,
    isActive: true,
  },
  {
    name: 'RWA & Housing Socities',
    slug: 'rwa-and-housing-socities',
    code: 'RWA_HOUSING_SOCIETIES',
    description: 'Gated community emergency assistance and on-campus eldercare camps.',
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
