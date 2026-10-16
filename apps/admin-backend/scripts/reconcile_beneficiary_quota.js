/**
 * Beneficiary Quota Diagnostic & Reconciliation Script
 * Location: apps/admin-backend/scripts/reconcile_beneficiary_quota.js
 *
 * Usage on Server:
 *   cd ~/Admin_panel4/apps/admin-backend
 *   node scripts/reconcile_beneficiary_quota.js
 *
 * To automatically fix stuck reservations and resync quota:
 *   node scripts/reconcile_beneficiary_quota.js --fix
 *
 * Optional parameter to check specific beneficiary by ID or phone:
 *   node scripts/reconcile_beneficiary_quota.js --phone=9911051264
 *   node scripts/reconcile_beneficiary_quota.js --id=2ef946a1-94ca-4efb-9a7a-52d33ea22c7d --fix
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const { prisma } = require('../lib/prisma');

async function main() {
  const isFixMode = process.argv.includes('--fix');
  const phoneArg = process.argv.find(a => a.startsWith('--phone='))?.split('=')[1] || '9911051264';
  const idArg = process.argv.find(a => a.startsWith('--id='))?.split('=')[1] || '2ef946a1-94ca-4efb-9a7a-52d33ea22c7d';

  console.log('================================================================');
  console.log('🔍 BENEFICIARY QUOTA DIAGNOSTIC & RECONCILIATION TOOL');
  console.log(`Mode: ${isFixMode ? '🛠️ FIX / RECONCILE (Applying Changes)' : '👀 INSPECT ONLY (Add --fix to reconcile)'}`);
  console.log('================================================================\n');

  // 1. Locate Beneficiary
  let ben = await prisma.beneficiary.findUnique({
    where: { id: idArg },
    include: { user: true, subscriber: true }
  });

  if (!ben) {
    ben = await prisma.beneficiary.findFirst({
      where: {
        OR: [
          { phone: phoneArg },
          { name: { contains: 'Pushpa', mode: 'insensitive' } }
        ]
      },
      include: { user: true, subscriber: true }
    });
  }

  if (!ben) {
    console.error(`❌ Could not find beneficiary with ID: "${idArg}" or Phone: "${phoneArg}".`);
    process.exit(1);
  }

  console.log(`👤 Beneficiary Details:`);
  console.log(`   ID:         ${ben.id}`);
  console.log(`   Name:       ${ben.name}`);
  console.log(`   Phone:      ${ben.phone || 'N/A'}`);
  console.log(`   Subscriber: ${ben.subscriber?.name || 'N/A'} (${ben.subscriber?.phone || ben.subscriberId})\n`);

  // 2. Fetch All Visits
  const visits = await prisma.visit.findMany({
    where: { beneficiaryId: ben.id },
    include: {
      benefit: true,
      careCompanion: true,
    },
    orderBy: { scheduledTime: 'asc' }
  });
  const visitMap = new Map(visits.map(v => [v.id, v]));

  // 3. Fetch Subscriptions & Balances
  const subscriptions = await prisma.subscription.findMany({
    where: { beneficiaryId: ben.id },
    include: {
      package: true,
      packageVersion: true,
      benefitBalances: {
        include: {
          benefit: true,
          reservations: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`📦 Subscriptions on Record (${subscriptions.length}):`);
  subscriptions.forEach((sub, idx) => {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[Subscription #${idx + 1}] ID: ${sub.id}`);
    console.log(`  Package:   ${sub.packageVersion?.name || sub.package?.name || sub.packageType}`);
    console.log(`  Active:    ${sub.isActive ? '✅ TRUE' : '❌ FALSE'} | Queued: ${sub.isQueued ? 'YES' : 'NO'}`);
    console.log(`  Duration:  ${sub.startDate ? sub.startDate.toISOString().substring(0, 10) : 'N/A'} to ${sub.endDate ? sub.endDate.toISOString().substring(0, 10) : 'N/A'}`);
    console.log(`  Visits:    ${sub.visitsCompleted} completed / ${sub.visitsTotal} total`);
    console.log(`  Created:   ${sub.createdAt.toISOString()}`);
    console.log(`\n  Benefit Balances (${sub.benefitBalances.length}):`);

    sub.benefitBalances.forEach((b) => {
      const bName = b.snapshotBenefitName || b.benefit?.name || 'Unknown';
      const heldRes = b.reservations.filter(r => r.status === 'HELD');
      console.log(`   • [${b.benefitId}] ${bName}:`);
      console.log(`     Total: ${b.totalUnits} | Used: ${b.usedUnits} | Reserved (Locked): ${b.reservedUnits} | Available: ${b.availableUnits}`);
      if (heldRes.length > 0) {
        console.log(`     🔒 HELD Reservations (${heldRes.length}):`);
        heldRes.forEach(r => {
          const v = r.visitId ? visitMap.get(r.visitId) : null;
          console.log(`        - Res ID: ${r.id} | Units: ${r.units} | Visit ID: ${r.visitId || 'NONE'}`);
          if (v) {
            console.log(`          Visit Code: #${v.visitCode || 'N/A'} | Status: ${v.status} | Scheduled: ${v.scheduledTime?.toISOString()} | 3rdParty: ${v.is3rdParty}`);
          } else {
            console.log(`          ⚠️ ORPHANED: Visit record does not exist in DB!`);
          }
        });
      }
    });
  });

  console.log(`\n================================================================`);
  console.log(`🗓️ All Visits for ${ben.name} (${visits.length}):`);
  visits.forEach((v) => {
    console.log(`   • [${v.visitCode || v.id.substring(0, 8)}] ${v.scheduledTime?.toISOString()} | Status: ${v.status.toUpperCase()} | Benefit: ${v.benefit?.name || v.benefitId || 'None'} | CC: ${v.is3rdParty ? '3rd Party' : v.careCompanion?.name || 'None'}`);
  });

  // 4. Identify Anomalies / Stuck Reservations
  console.log(`\n================================================================`);
  console.log(`🔎 ANOMALY DETECTION:`);
  const stuckReservations = [];
  const balanceDrifts = [];

  for (const sub of subscriptions) {
    for (const b of sub.benefitBalances) {
      let trueHeldUnits = 0;
      for (const r of b.reservations) {
        if (r.status === 'HELD') {
          const v = r.visitId ? visitMap.get(r.visitId) : null;
          const isStuck = !v || ['completed', 'cancelled', 'missed'].includes(v.status);
          if (isStuck) {
            stuckReservations.push({
              reservationId: r.id,
              balanceId: b.id,
              benefitName: b.snapshotBenefitName || b.benefit?.name,
              units: r.units,
              visitId: r.visitId,
              visitCode: v?.visitCode,
              visitStatus: v?.status || 'DELETED_OR_MISSING',
              subPackage: sub.packageVersion?.name || sub.packageType
            });
          } else {
            trueHeldUnits += r.units;
          }
        }
      }

      if (b.reservedUnits !== trueHeldUnits) {
        balanceDrifts.push({
          balanceId: b.id,
          benefitName: b.snapshotBenefitName || b.benefit?.name,
          currentReserved: b.reservedUnits,
          trueHeldUnits,
          currentAvailable: b.availableUnits,
          correctedAvailable: b.totalUnits === -1 ? 999999 : Math.max(0, b.totalUnits - b.usedUnits - trueHeldUnits),
          subPackage: sub.packageVersion?.name || sub.packageType
        });
      }
    }
  }

  if (stuckReservations.length === 0 && balanceDrifts.length === 0) {
    console.log(`✅ No stuck reservations or balance counter drifts detected!`);
  } else {
    if (stuckReservations.length > 0) {
      console.log(`⚠️ Found ${stuckReservations.length} STUCK RESERVATION(S) (HELD on missed/cancelled/completed visit):`);
      stuckReservations.forEach(sr => {
        console.log(`   - Res ${sr.reservationId} (${sr.units} unit) for Benefit "${sr.benefitName}" on plan "${sr.subPackage}"`);
        console.log(`     Attached to Visit #${sr.visitCode || sr.visitId} with Status = ${sr.visitStatus.toUpperCase()}`);
      });
    }

    if (balanceDrifts.length > 0) {
      console.log(`\n⚠️ Found ${balanceDrifts.length} BALANCE COUNTER DRIFT(S):`);
      balanceDrifts.forEach(bd => {
        console.log(`   - Balance ${bd.balanceId} (${bd.benefitName}) on plan "${bd.subPackage}":`);
        console.log(`     reservedUnits: DB=${bd.currentReserved} vs True=${bd.trueHeldUnits}`);
        console.log(`     availableUnits: DB=${bd.currentAvailable} vs Corrected=${bd.correctedAvailable}`);
      });
    }

    if (isFixMode) {
      console.log(`\n🛠️ EXECUTING RECONCILIATION IN TRANSACTION...`);
      await prisma.$transaction(async (tx) => {
        // Release stuck reservations
        for (const sr of stuckReservations) {
          await tx.benefitReservation.update({
            where: { id: sr.reservationId },
            data: { status: 'RELEASED' }
          });
          console.log(`   ✓ Released reservation ${sr.reservationId}`);
        }

        // Correct balances
        for (const bd of balanceDrifts) {
          await tx.subscriptionBenefitBalance.update({
            where: { id: bd.balanceId },
            data: {
              reservedUnits: bd.trueHeldUnits,
              availableUnits: bd.correctedAvailable
            }
          });
          console.log(`   ✓ Corrected balance ${bd.balanceId} (reservedUnits: ${bd.trueHeldUnits}, availableUnits: ${bd.correctedAvailable})`);
        }
      });
      console.log(`\n🎉 Reconciliation completed successfully! Beneficiary quota has been restored.`);
    } else {
      console.log(`\n👉 To automatically fix these anomalies, run: node scripts/reconcile_beneficiary_quota.js --fix`);
    }
  }

  console.log('\n================================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
