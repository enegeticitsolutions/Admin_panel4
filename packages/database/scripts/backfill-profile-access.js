/**
 * Idempotent Backfill Script: Unified Profile Access Graph
 *
 * Safely populates `care_circle_members` (SELF + MANAGER rows) and normalizes
 * existing memberships without touching or deleting any legacy columns.
 *
 * Usage:
 *   node packages/database/scripts/backfill-profile-access.js           # Dry run (read-only)
 *   node packages/database/scripts/backfill-profile-access.js --apply   # Execute live backfill
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Resolve env (prefer apps/api/.env for DIRECT_URL, fallback to apps/admin-backend/.env)
const apiEnv = path.resolve(__dirname, '../../../apps/api/.env');
const adminEnv = path.resolve(__dirname, '../../../apps/admin-backend/.env');
if (fs.existsSync(apiEnv)) dotenv.config({ path: apiEnv });
if (fs.existsSync(adminEnv)) dotenv.config({ path: adminEnv });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DIRECT_URL or DATABASE_URL is required in environment.');
  process.exit(1);
}

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  console.log('==============================================================');
  console.log(` Unified Profile Access Backfill (${APPLY ? 'LIVE APPLY MODE' : 'DRY-RUN MODE'})`);
  console.log('==============================================================\n');

  const beneficiaries = await prisma.beneficiary.findMany({
    where: { status: { not: 'deleted' } },
    select: {
      id: true,
      userId: true,
      subscriberId: true,
      relationship: true,
    },
  });

  const existingMembers = await prisma.careCircleMember.findMany({
    select: {
      id: true,
      beneficiaryId: true,
      userId: true,
      role: true,
      accessRole: true,
      canEditDetails: true,
      canManageAccess: true,
      status: true,
      inviteCode: true,
      invitedBy: true,
      relationship: true,
      user: { select: { phone: true } },
    },
  });

  const memberMap = new Map();
  for (const m of existingMembers) {
    memberMap.set(`${m.beneficiaryId}:${m.userId}`, m);
  }

  let selfCreated = 0;
  let selfUpdated = 0;
  let managerCreated = 0;
  let managerUpdated = 0;
  let legacyNormalized = 0;
  let invitesMigrated = 0;

  // 1. Ensure SELF and MANAGER rows for every active beneficiary
  for (const b of beneficiaries) {
    // 1a. SELF row (profile owner)
    const selfKey = `${b.id}:${b.userId}`;
    const existingSelf = memberMap.get(selfKey);
    if (!existingSelf) {
      selfCreated++;
      if (APPLY) {
        await prisma.careCircleMember.upsert({
          where: { beneficiaryId_userId: { beneficiaryId: b.id, userId: b.userId } },
          create: {
            beneficiaryId: b.id,
            userId: b.userId,
            accessRole: 'SELF',
            role: 'self',
            relationship: 'Self',
            canRenew: true,
            canViewVitals: true,
            canBookVisits: true,
            canEditDetails: true,
            canManageAccess: true,
            status: 'active',
          },
          update: {
            accessRole: 'SELF',
            canRenew: true,
            canViewVitals: true,
            canBookVisits: true,
            canEditDetails: true,
            canManageAccess: true,
            status: 'active',
          },
        });
      }
    } else if (existingSelf.accessRole !== 'SELF' || !existingSelf.canManageAccess) {
      selfUpdated++;
      if (APPLY) {
        await prisma.careCircleMember.update({
          where: { id: existingSelf.id },
          data: {
            accessRole: 'SELF',
            role: 'self',
            canRenew: true,
            canViewVitals: true,
            canBookVisits: true,
            canEditDetails: true,
            canManageAccess: true,
            status: 'active',
          },
        });
      }
    }

    // 1b. MANAGER row for distinct subscriber/sponsor
    if (b.subscriberId && b.subscriberId !== b.userId) {
      const mgrKey = `${b.id}:${b.subscriberId}`;
      const existingMgr = memberMap.get(mgrKey);
      if (!existingMgr) {
        managerCreated++;
        if (APPLY) {
          await prisma.careCircleMember.upsert({
            where: { beneficiaryId_userId: { beneficiaryId: b.id, userId: b.subscriberId } },
            create: {
              beneficiaryId: b.id,
              userId: b.subscriberId,
              accessRole: 'MANAGER',
              role: 'primary_sponsor',
              relationship: b.relationship || 'Sponsor',
              canRenew: true,
              canViewVitals: true,
              canBookVisits: true,
              canEditDetails: true,
              canManageAccess: true,
              status: 'active',
            },
            update: {
              accessRole: 'MANAGER',
              canRenew: true,
              canViewVitals: true,
              canBookVisits: true,
              canEditDetails: true,
              canManageAccess: true,
              status: 'active',
            },
          });
        }
      } else if (existingMgr.accessRole !== 'MANAGER' || !existingMgr.canManageAccess) {
        managerUpdated++;
        if (APPLY) {
          await prisma.careCircleMember.update({
            where: { id: existingMgr.id },
            data: {
              accessRole: 'MANAGER',
              role: 'primary_sponsor',
              canRenew: true,
              canViewVitals: true,
              canBookVisits: true,
              canEditDetails: true,
              canManageAccess: true,
              status: 'active',
            },
          });
        }
      }
    }
  }

  // 2. Normalize existing invited/shared CareCircleMember rows
  const benById = new Map(beneficiaries.map((b) => [b.id, b]));
  for (const m of existingMembers) {
    const b = benById.get(m.beneficiaryId);
    if (!b) continue;
    if (m.userId === b.userId || (b.subscriberId && m.userId === b.subscriberId)) continue;

    let desiredAccessRole = 'VIEWER';
    let desiredCanEdit = false;
    let desiredCanManage = false;

    if (m.role === 'primary_sponsor' || m.role === 'manager') {
      desiredAccessRole = 'MANAGER';
      desiredCanEdit = true;
      desiredCanManage = true;
    } else if (m.role === 'editor' || m.canEditDetails) {
      desiredAccessRole = 'EDITOR';
      desiredCanEdit = true;
    }

    if (m.accessRole !== desiredAccessRole || m.canManageAccess !== desiredCanManage) {
      legacyNormalized++;
      if (APPLY) {
        await prisma.careCircleMember.update({
          where: { id: m.id },
          data: {
            accessRole: desiredAccessRole,
            canEditDetails: desiredCanEdit,
            canManageAccess: desiredCanManage,
          },
        });
      }
    }

    // 3. Migrate pending/invited legacy inviteCode rows into CareAccessRequest
    if (m.status === 'invited' && m.inviteCode) {
      invitesMigrated++;
      if (APPLY) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.careAccessRequest.upsert({
          where: { inviteCode: m.inviteCode },
          create: {
            beneficiaryId: m.beneficiaryId,
            direction: 'INVITE',
            requestedRole: desiredAccessRole,
            relationship: m.relationship || 'Family Member',
            invitedByUserId: m.invitedBy || b.subscriberId || b.userId,
            targetPhone: m.user?.phone ? m.user.phone.replace(/\D/g, '').slice(-10) : null,
            inviteCode: m.inviteCode,
            status: 'PENDING',
            expiresAt,
          },
          update: {},
        });
      }
    }
  }

  console.log(`Total active beneficiaries scanned : ${beneficiaries.length}`);
  console.log(`SELF rows to create / update       : ${selfCreated} / ${selfUpdated}`);
  console.log(`MANAGER rows to create / update    : ${managerCreated} / ${managerUpdated}`);
  console.log(`Legacy shared rows to normalize    : ${legacyNormalized}`);
  console.log(`Pending invites to migrate         : ${invitesMigrated}`);

  // Verification pass in APPLY mode
  if (APPLY) {
    const updatedMembers = await prisma.careCircleMember.findMany({
      where: { status: 'active' },
      select: { beneficiaryId: true, userId: true, accessRole: true },
    });
    const activeSet = new Set(updatedMembers.map((m) => `${m.beneficiaryId}:${m.userId}:${m.accessRole}`));

    let missingSelf = 0;
    let missingManager = 0;
    for (const b of beneficiaries) {
      if (!activeSet.has(`${b.id}:${b.userId}:SELF`)) missingSelf++;
      if (b.subscriberId && b.subscriberId !== b.userId && !activeSet.has(`${b.id}:${b.subscriberId}:MANAGER`)) {
        missingManager++;
      }
    }
    console.log('\n--- Post-Backfill Verification ---');
    console.log(`Beneficiaries missing SELF row     : ${missingSelf}`);
    console.log(`Beneficiaries missing MANAGER row  : ${missingManager}`);
    if (missingSelf > 0 || missingManager > 0) {
      throw new Error('Verification failed: missing SELF or MANAGER rows!');
    }
    console.log('VERIFICATION PASSED: 100% of beneficiaries have unified access rows.');
  } else {
    console.log('\n(Dry-run complete. Re-run with --apply to commit changes.)');
  }
}

run()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
