#!/usr/bin/env node

/**
 * seed_system_configs.js
 *
 * Standalone, idempotent script to populate all 33 canonical system configuration
 * records into any database (Supabase, local PostgreSQL, or AWS RDS).
 *
 * Usage:
 *   node packages/database/scripts/seed_system_configs.js
 *   DATABASE_URL="postgresql://..." node packages/database/scripts/seed_system_configs.js
 *   npm run seed:config
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
          console.log(`[Config Seed] Using DATABASE_URL discovered in ${envPath}`);
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[Config Seed] ERROR: DATABASE_URL is not provided.');
  console.error('Please export DATABASE_URL or provide an .env file.');
  process.exit(1);
}

// Canonical dataset of all system configurations
const SYSTEM_CONFIG_DATA = [
  {
    key: "benefit_rollover_default_cap_months",
    value: "1.0",
    group: "BENEFITS",
    description: "Maximum multiplier of monthly base quota that can roll forward into the next month (Default: 1.0 = 1 Month quota cap)"
  },
  {
    key: "benefit_rollover_enabled",
    value: "true",
    group: "BENEFITS",
    description: "Enable automatic monthly period refresh and 1-month rollover for multi-month care plans"
  },
  {
    key: "COMPANY_ADDRESS",
    value: "DLF Phase V, Gurugram, Haryana",
    group: "COMPANY",
    description: "Registered company office address"
  },
  {
    key: "COMPANY_BANK_ACCOUNT",
    value: "000000000000",
    group: "COMPANY",
    description: "Company settlement bank account number"
  },
  {
    key: "COMPANY_BANK_IFSC",
    value: "HDFC0000000",
    group: "COMPANY",
    description: "Company bank branch IFSC code"
  },
  {
    key: "COMPANY_BANK_NAME",
    value: "HDFC Bank",
    group: "COMPANY",
    description: "Company bank name"
  },
  {
    key: "COMPANY_CIN",
    value: "U86900HR2026PTC145612",
    group: "COMPANY",
    description: "Corporate Identification Number (CIN)"
  },
  {
    key: "COMPANY_EMAIL",
    value: "info@maihoonna.com",
    group: "COMPANY",
    description: "Official support and contact email address"
  },
  {
    key: "COMPANY_GSTIN",
    value: "06AAUCM9447N1ZE",
    group: "COMPANY",
    description: "Company GSTIN registration number"
  },
  {
    key: "COMPANY_NAME",
    value: "MaiHoonNa Eldercare Private Limited",
    group: "COMPANY",
    description: "Full registered corporate company name"
  },
  {
    key: "COMPANY_PAN",
    value: "AAUCM9447N",
    group: "COMPANY",
    description: "Company Permanent Account Number (PAN)"
  },
  {
    key: "COMPANY_PHONE",
    value: "8507070049",
    group: "COMPANY",
    description: "Company primary office contact phone number"
  },
  {
    key: "COMPANY_UPI_ID",
    value: "maihoonna@upi",
    group: "COMPANY",
    description: "Company Virtual Payment Address (UPI ID)"
  },
  {
    key: "DEFAULT_GST_RATE",
    value: "18",
    group: "TAX",
    description: "Default GST tax rate percentage applied to subscriptions and invoices"
  },
  {
    key: "EMERGENCY_HELPLINE_NUMBER",
    value: "01142258823",
    group: "EMERGENCY",
    description: "24/7 Emergency Helpline dialed by Beneficiary SOS and emergency support modals"
  },
  {
    key: "EMERGENCY_SERVICES_NUMBER",
    value: "112",
    group: "EMERGENCY",
    description: "National Emergency Services helpline (112)"
  },
  {
    key: "globalLunchEnd",
    value: "14",
    group: "scheduling",
    description: "Global lunch end time for all CCs (24h format)"
  },
  {
    key: "globalLunchStart",
    value: "13:00",
    group: "scheduling",
    description: "Global lunch start time for all CCs"
  },
  {
    key: "max_beneficiaries_per_volunteer",
    value: "10",
    group: "Volunteer",
    description: "Maximum number of beneficiaries a single Saathi volunteer can be assigned to at one time."
  },
  {
    key: "max_beneficiary_per_team",
    value: "10",
    group: "general",
    description: "Maximum Beneficiaries allowed per field team"
  },
  {
    key: "max_cc_per_team",
    value: "15",
    group: "general",
    description: "Maximum Care Companions allowed per field team"
  },
  {
    key: "max_primary_cc",
    value: "6",
    group: "general",
    description: "Maximum active beneficiaries a CC can be primary for"
  },
  {
    key: "max_secondary_cc",
    value: "5",
    group: "general",
    description: "Maximum active beneficiaries a CC can be secondary for"
  },
  {
    key: "max_teams_per_zone",
    value: "5",
    group: "general",
    description: "Maximum teams allowed to operate out of a single Zone office"
  },
  {
    key: "max_volunteer_search_radius_km",
    value: "15",
    group: "Volunteer",
    description: "Spatial search radius in kilometers for matching volunteers near a beneficiary."
  },
  {
    key: "max_volunteers_per_beneficiary",
    value: "15",
    group: "Volunteer",
    description: "Maximum number of Saathi volunteers that can be assigned to a single beneficiary."
  },
  {
    key: "region_radius_km",
    value: "31",
    group: "general",
    description: "Default radius of a Region sector in Km"
  },
  {
    key: "SATHI_COORDINATOR_NUMBER",
    value: "+91 1244495435",
    group: "SUPPORT",
    description: "Saathi Coordinator phone number shown in Saathi App Guide and Support"
  },
  {
    key: "SATHI_CREDIT_RATE",
    value: "10",
    group: "sathi",
    description: "Credit points earned per hour of volunteering"
  },
  {
    key: "SATHI_MIN_BILLING_MINUTES",
    value: "10",
    group: "sathi",
    description: "Minimum duration for a volunteer visit check-out in minutes"
  },
  {
    key: "sathi_reapply_cooldown_days",
    value: "30",
    group: "Sathi Network Settings",
    description: "Cooldown period in days after rejection before Sathi volunteer can re-apply"
  },
  {
    key: "VOLUNTEER_CREDIT_CONVERSION_RATE",
    value: "10",
    group: "sathi",
    description: "Conversion rate from volunteer credits to Rupees (1 credit = X Rs)"
  },
  {
    key: "zone_radius_km",
    value: "15.0",
    group: "general",
    description: "Default radius of a Zone office coverage in Km"
  }
];

async function seed() {
  const sanitizedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  console.log(`[Config Seed] Connecting to target database: ${sanitizedUrl}`);

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

  console.log(`[Config Seed] Starting upsert of ${SYSTEM_CONFIG_DATA.length} system configurations...\n`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of SYSTEM_CONFIG_DATA) {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: item.key }
    });

    if (!existing) {
      await prisma.systemConfig.create({
        data: {
          key: item.key,
          value: item.value.trim(),
          group: item.group || null,
          description: item.description || null,
        }
      });
      createdCount++;
      console.log(`  + [CREATED] ${item.key.padEnd(35)} = ${item.value.trim()}`);
    } else {
      await prisma.systemConfig.update({
        where: { key: item.key },
        data: {
          group: item.group || existing.group,
          description: item.description || existing.description,
        }
      });
      updatedCount++;
      console.log(`  ~ [EXISTS]  ${item.key.padEnd(35)} = ${existing.value}`);
    }
  }

  console.log(`\n[Config Seed] Completed successfully!`);
  console.log(`  - Newly Created: ${createdCount}`);
  console.log(`  - Verified/Kept: ${updatedCount}`);
  console.log(`  - Total Configs: ${SYSTEM_CONFIG_DATA.length}`);

  await prisma.$disconnect();
  await pool.end();
}

seed().catch((err) => {
  console.error('[Config Seed] Fatal error during seeding:', err);
  process.exit(1);
});
