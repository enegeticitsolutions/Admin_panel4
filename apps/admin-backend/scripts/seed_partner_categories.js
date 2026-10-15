#!/usr/bin/env node

/**
 * Seed Script: Partner Categories & Partners
 * Location: apps/admin-backend/scripts/seed_partner_categories.js
 *
 * Usage:
 *   node scripts/seed_partner_categories.js
 *   node scripts/seed_partner_categories.js --with-partners
 */

const path = require('path');
const fs = require('fs');

// Auto-discover DATABASE_URL and environment variables
const candidateEnvPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../packages/database/.env'),
  path.resolve(__dirname, '../../../apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    if (process.env.DATABASE_URL) break;
  }
}

const { prisma, pool } = require('../lib/prisma');

// 8 Exact Partner Categories from Ecosystem UI
const PARTNER_CATEGORIES = [
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

// Initial representative Partner entries for each category
const INITIAL_PARTNERS = [
  {
    categoryCode: 'AMBULANCE_EMERGENCY',
    organizationName: 'MaiHoonNa 24/7 Emergency Fleet',
    primaryContactName: 'Emergency Operations Desk',
    phone: '9810000001',
    email: 'emergency@maihoonna.com',
    city: 'Gurugram',
    state: 'Haryana',
    description: 'Rapid-response partner network for medical emergencies, equipped with advanced cardiac and ICU life support.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: true,
    displayOrder: 1,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['24/7 Dispatch', 'ICU on Wheels', 'Trained Paramedics', 'GPS Live Tracking'],
  },
  {
    categoryCode: 'PHARMACY_PARTNERS',
    organizationName: 'Apollo & MedPlus Pharmacy Hub',
    primaryContactName: 'Prescription Desk',
    phone: '9810000002',
    email: 'pharmacy@maihoonna.com',
    city: 'Gurugram',
    state: 'Haryana',
    description: 'Genuine medicine ordering, doorstep express delivery, and monthly prescription refill management.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: true,
    displayOrder: 2,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['Same-day Home Delivery', '100% Genuine Medicines', 'Automated Refills', 'Discounts for Seniors'],
  },
  {
    categoryCode: 'DIAGNOSTIC_LABS',
    organizationName: 'NABL Certified Diagnostic Partner',
    primaryContactName: 'Sample Collection Team',
    phone: '9810000003',
    email: 'diagnostics@maihoonna.com',
    city: 'Delhi NCR',
    state: 'Delhi',
    description: 'Home sample collection and fast digital reporting for blood, urine, ECG, and routine health checks.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: true,
    displayOrder: 3,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['Home Sample Collection', 'NABL Accredited', 'Online Reports in 12h', 'Fasting & Non-Fasting Tests'],
  },
  {
    categoryCode: 'CARE_PROVIDERS',
    organizationName: 'Elite Senior Care & Physio Network',
    primaryContactName: 'Care Coordinator',
    phone: '9810000004',
    email: 'care@maihoonna.com',
    city: 'Gurugram',
    state: 'Haryana',
    description: 'Qualified physiotherapists, geriatric care assistants, and visiting clinicians for comprehensive home recovery.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: true,
    displayOrder: 4,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['Home Physiotherapy', 'Fall Risk Recovery', 'Post-Op Rehabilitation', 'Certified Clinicians'],
  },
  {
    categoryCode: 'HOSPITALS_CLINICS',
    organizationName: 'Max & Fortis Geriatric Tie-up Hub',
    primaryContactName: 'Hospital Relationship Desk',
    phone: '9810000005',
    email: 'hospitals@maihoonna.com',
    city: 'Gurugram',
    state: 'Haryana',
    description: 'Preferred hospital tie-ups offering expedited admissions, geriatric OPD desk, and cashless assistance.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: true,
    displayOrder: 5,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['Priority OPD Booking', 'Expedited Admission', 'Dedicated Desk', 'Emergency Coordination'],
  },
  {
    categoryCode: 'TELE_MEDICINE',
    organizationName: 'MaiHoonNa Tele-Consultation Clinic',
    primaryContactName: 'Virtual Care Desk',
    phone: '9810000006',
    email: 'telemed@maihoonna.com',
    city: 'National',
    state: 'Delhi',
    description: 'Virtual consultation scheduling managed seamlessly by Care Mitras with top consulting physicians.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: true,
    displayOrder: 6,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['Care Mitra Assisted', 'Video Consultations', 'Digital Prescription', 'Specialist Second Opinions'],
  },
  {
    categoryCode: 'CORPORATE_B2B',
    organizationName: 'Enterprise Eldercare Solutions',
    primaryContactName: 'Corporate Wellness Team',
    phone: '9810000007',
    email: 'b2b@maihoonna.com',
    city: 'National',
    state: 'Delhi',
    description: 'Comprehensive employee benefit programmes tailored for organisations supporting elderly parents of workforce.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: false,
    displayOrder: 7,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['Employee Parent Care', 'Annual Wellness Passes', 'Corporate Dashboard', 'Subsidized Plans'],
  },
  {
    categoryCode: 'RWA_HOUSING_SOCIETIES',
    organizationName: 'Gated Condominium Care Chapters',
    primaryContactName: 'Society Community Liaison',
    phone: '9810000008',
    email: 'rwa@maihoonna.com',
    city: 'Gurugram',
    state: 'Haryana',
    description: 'Nodal senior care centers and on-campus emergency response embedded within residential condominium societies.',
    status: 'APPROVED',
    isPublished: true,
    isFeatured: false,
    displayOrder: 8,
    source: 'ADMIN_DIRECT',
    serviceHighlights: ['On-campus Helpdesks', 'Emergency Response Buttons', 'Weekly Camps', 'Community Engagement'],
  },
];

async function seed() {
  console.log('================================================================');
  console.log('🌱 SEEDING PARTNER CATEGORIES & PARTNERS (MaiHoonNa Ecosystem)');
  console.log('================================================================\n');

  const withPartners = process.argv.includes('--with-partners') || process.argv.includes('--all') || true;

  const categoryMap = {};

  // 1. Seed or Upsert the 8 Categories
  console.log('📦 1. Upserting 8 Partner Categories...');
  for (const cat of PARTNER_CATEGORIES) {
    // Check if category already exists by slug, code, or name (to handle previous variants)
    const existing = await prisma.partnerCategory.findFirst({
      where: {
        OR: [
          { slug: cat.slug },
          { code: cat.code },
          { name: { equals: cat.name, mode: 'insensitive' } },
        ],
      },
    });

    let savedCat;
    if (existing) {
      savedCat = await prisma.partnerCategory.update({
        where: { id: existing.id },
        data: {
          name: cat.name,
          slug: cat.slug,
          code: cat.code,
          description: cat.description,
          displayOrder: cat.displayOrder,
          isActive: cat.isActive,
        },
      });
      console.log(`   ✓ Updated Category: [${savedCat.code}] "${savedCat.name}"`);
    } else {
      savedCat = await prisma.partnerCategory.create({
        data: cat,
      });
      console.log(`   + Created Category: [${savedCat.code}] "${savedCat.name}"`);
    }
    categoryMap[cat.code] = savedCat;
  }

  // 2. Optionally Seed Partner Records into the Partner Table
  if (withPartners) {
    console.log('\n🤝 2. Upserting Representative Partners in Partner Table...');
    for (const p of INITIAL_PARTNERS) {
      const cat = categoryMap[p.categoryCode];
      if (!cat) {
        console.warn(`   ⚠️ Category code "${p.categoryCode}" not found for partner "${p.organizationName}". Skipping.`);
        continue;
      }

      const existingPartner = await prisma.partner.findFirst({
        where: {
          organizationName: p.organizationName,
          categoryId: cat.id,
        },
      });

      if (existingPartner) {
        await prisma.partner.update({
          where: { id: existingPartner.id },
          data: {
            primaryContactName: p.primaryContactName,
            phone: p.phone,
            email: p.email,
            city: p.city,
            state: p.state,
            description: p.description,
            status: p.status,
            isPublished: p.isPublished,
            isFeatured: p.isFeatured,
            displayOrder: p.displayOrder,
            source: p.source,
            serviceHighlights: p.serviceHighlights,
          },
        });
        console.log(`   ✓ Updated Partner: "${p.organizationName}" (${cat.name})`);
      } else {
        await prisma.partner.create({
          data: {
            organizationName: p.organizationName,
            primaryContactName: p.primaryContactName,
            phone: p.phone,
            email: p.email,
            city: p.city,
            state: p.state,
            description: p.description,
            categoryId: cat.id,
            status: p.status,
            isPublished: p.isPublished,
            isFeatured: p.isFeatured,
            displayOrder: p.displayOrder,
            source: p.source,
            serviceHighlights: p.serviceHighlights,
          },
        });
        console.log(`   + Created Partner: "${p.organizationName}" (${cat.name})`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('✅ ALL 8 PARTNER CATEGORIES & PARTNERS SEEDED SUCCESSFULLY!');
  console.log('================================================================\n');
}

seed()
  .catch((e) => {
    console.error('❌ Error seeding partner categories & partners:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
    if (pool) await pool.end();
  });
