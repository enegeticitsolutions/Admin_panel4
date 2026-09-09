import prisma from '../../core/database';
import { Prisma, PeriodStatus } from '@prisma/client';
import { generateUUID } from '../../utils/helpers';

export type TxClient = Prisma.TransactionClient;

/**
 * BenefitPeriodManager (OOP Class)
 * 
 * Manages discrete monthly entitlement windows (BenefitPeriods) for multi-month subscriptions.
 * Enforces non-compounding rollover rules (default: 1 month base quota cap or configured via SystemConfig).
 */
export class BenefitPeriodManager {
  private static instance: BenefitPeriodManager;

  private constructor() {}

  public static getInstance(): BenefitPeriodManager {
    if (!BenefitPeriodManager.instance) {
      BenefitPeriodManager.instance = new BenefitPeriodManager();
    }
    return BenefitPeriodManager.instance;
  }

  /**
   * Retrieves the system-wide default rollover cap multiplier from SystemConfig.
   * Default: 1.0 (1 month's base quota).
   */
  public async getSystemRolloverMultiplier(client: TxClient = prisma): Promise<number> {
    try {
      const config = await client.systemConfig.findFirst({
        where: {
          OR: [
            { key: 'benefit_rollover_default_cap_months' },
            { key: 'BENEFIT_ROLLOVER_DEFAULT_CAP_MONTHS' }
          ]
        }
      });
      if (config && config.value) {
        const val = parseFloat(config.value);
        if (!isNaN(val) && val >= 0) return val;
      }
    } catch (e) {
      console.warn('[BenefitPeriodManager] SystemConfig read failed, falling back to 1.0', e);
    }
    return 1.0;
  }

  /**
   * Generates discrete monthly BenefitPeriod rows upon subscription activation.
   * Initializes Period 1 with base allocations and sets status to ACTIVE.
   */
  public async generatePeriodsForSubscription(
    subscriptionId: string,
    durationMonths: number,
    startDate: Date,
    benefits: Array<{
      benefitId: string;
      name: string;
      unitLabel?: string | null;
      monthlyUnits: number;
      allowRollover?: boolean;
      maxRolloverUnits?: number | null;
    }>,
    client: TxClient = prisma
  ): Promise<void> {
    const totalPeriods = Math.max(1, Math.floor(durationMonths || 1));
    const rolloverMultiplier = await this.getSystemRolloverMultiplier(client);

    // Clean up any existing un-activated periods if resetting
    await client.benefitPeriod.deleteMany({
      where: { subscriptionId }
    });

    let currentPeriodStart = new Date(startDate);

    for (let periodNum = 1; periodNum <= totalPeriods; periodNum++) {
      const periodEnd = new Date(currentPeriodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const isFirst = periodNum === 1;
      const periodStatus: PeriodStatus = isFirst ? PeriodStatus.ACTIVE : PeriodStatus.UPCOMING;

      const periodId = generateUUID();

      const period = await client.benefitPeriod.create({
        data: {
          id: periodId,
          subscriptionId,
          periodNumber: periodNum,
          startDate: currentPeriodStart,
          endDate: periodEnd,
          status: periodStatus,
        }
      });

      // If Period 1, initialize balances immediately with base allocation
      if (isFirst) {
        for (const b of benefits) {
          const base = Math.max(0, b.monthlyUnits || 0);
          const isRolloverAllowed = b.allowRollover !== false;
          const cap = !isRolloverAllowed
            ? 0
            : b.maxRolloverUnits !== undefined && b.maxRolloverUnits !== null
              ? b.maxRolloverUnits
              : Math.round(base * rolloverMultiplier);

          await client.benefitPeriodBalance.create({
            data: {
              id: generateUUID(),
              periodId: period.id,
              benefitId: b.benefitId,
              snapshotName: b.name,
              snapshotUnitLabel: b.unitLabel || null,
              baseAllocation: base,
              rolloverAllocation: 0,
              totalAllocation: base,
              usedQuantity: 0,
              reservedQuantity: 0,
              remainingQuantity: base,
              rolloverCap: cap,
            }
          });
        }
      }

      currentPeriodStart = new Date(periodEnd);
    }
  }

  /**
   * Evaluates active period on-demand (Just-In-Time) upon user API requests.
   * If current period has expired (endDate < now) and next period exists, transitions smoothly.
   */
  public async evaluateAndTransitionJIT(
    subscriptionId: string,
    client: TxClient = prisma
  ): Promise<any> {
    const now = new Date();
    const activePeriod = await client.benefitPeriod.findFirst({
      where: { subscriptionId, status: PeriodStatus.ACTIVE },
      include: { balances: true }
    });

    if (!activePeriod) return null;

    // Check if the current period has expired
    if (activePeriod.endDate < now) {
      return await this.transitionToNextPeriod(subscriptionId, client);
    }

    return activePeriod;
  }

  /**
   * Transitions a subscription from its current active period to the next upcoming period.
   * Computes non-compounding rollover: min(unusedRemaining, rolloverCap).
   */
  public async transitionToNextPeriod(
    subscriptionId: string,
    client: TxClient = prisma
  ): Promise<any> {
    const currentPeriod = await client.benefitPeriod.findFirst({
      where: { subscriptionId, status: PeriodStatus.ACTIVE },
      include: { balances: true }
    });

    if (!currentPeriod) return null;

    const nextPeriod = await client.benefitPeriod.findFirst({
      where: { 
        subscriptionId, 
        periodNumber: currentPeriod.periodNumber + 1,
        status: PeriodStatus.UPCOMING
      }
    });

    // 1. Close current period
    await client.benefitPeriod.update({
      where: { id: currentPeriod.id },
      data: { status: PeriodStatus.CLOSED }
    });

    // If no next period exists, the subscription duration has fully ended
    if (!nextPeriod) {
      await client.subscription.update({
        where: { id: subscriptionId },
        data: { isActive: false }
      });
      return null;
    }

    // 2. Activate next period
    const activatedPeriod = await client.benefitPeriod.update({
      where: { id: nextPeriod.id },
      data: { status: PeriodStatus.ACTIVE }
    });

    const rolloverMultiplier = await this.getSystemRolloverMultiplier(client);

    // 3. Roll over unused balances into next period
    for (const prevBal of currentPeriod.balances) {
      const unused = Math.max(0, prevBal.remainingQuantity);
      const cap = prevBal.rolloverCap !== null && prevBal.rolloverCap !== undefined
        ? prevBal.rolloverCap
        : Math.round(prevBal.baseAllocation * rolloverMultiplier);

      const rolloverUnits = cap > 0 ? Math.min(unused, cap) : 0;
      const base = prevBal.baseAllocation;
      const total = base + rolloverUnits;

      await client.benefitPeriodBalance.create({
        data: {
          id: generateUUID(),
          periodId: activatedPeriod.id,
          benefitId: prevBal.benefitId,
          snapshotName: prevBal.snapshotName,
          snapshotUnitLabel: prevBal.snapshotUnitLabel,
          baseAllocation: base,
          rolloverAllocation: rolloverUnits,
          totalAllocation: total,
          usedQuantity: 0,
          reservedQuantity: 0,
          remainingQuantity: total,
          rolloverCap: cap,
        }
      });
    }

    return await client.benefitPeriod.findUnique({
      where: { id: activatedPeriod.id },
      include: { balances: true }
    });
  }

  /**
   * Cross-Subscription Renewal Rollover (Level 2)
   * Transfers eligible unused rollover balances from an expiring subscription to a renewed subscription.
   * Injects the rollover units into Period 1 of the new subscription and updates SubscriptionBenefitBalance.
   */
  public async rolloverFromPreviousSubscription(
    previousSubscriptionId: string,
    newSubscriptionId: string,
    client: TxClient = prisma
  ): Promise<number> {
    const prevActivePeriod = await client.benefitPeriod.findFirst({
      where: {
        subscriptionId: previousSubscriptionId,
        status: { in: [PeriodStatus.ACTIVE, PeriodStatus.CLOSED] },
      },
      orderBy: { periodNumber: 'desc' },
      include: { balances: true },
    });

    if (!prevActivePeriod || !prevActivePeriod.balances.length) return 0;

    const newFirstPeriod = await client.benefitPeriod.findFirst({
      where: {
        subscriptionId: newSubscriptionId,
        periodNumber: 1,
      },
      include: { balances: true },
    });

    if (!newFirstPeriod) return 0;

    let totalRolledOver = 0;

    for (const prevBal of prevActivePeriod.balances) {
      const cap = prevBal.rolloverCap ?? 0;
      if (cap <= 0) continue; // Rollover not permitted for this benefit

      const unused = Math.max(0, prevBal.remainingQuantity);
      const unitsToRoll = Math.min(unused, cap);
      if (unitsToRoll <= 0) continue;

      const targetBal = newFirstPeriod.balances.find((b) => b.benefitId === prevBal.benefitId);
      if (targetBal) {
        await client.benefitPeriodBalance.update({
          where: { id: targetBal.id },
          data: {
            rolloverAllocation: targetBal.rolloverAllocation + unitsToRoll,
            totalAllocation: targetBal.totalAllocation + unitsToRoll,
            remainingQuantity: targetBal.remainingQuantity + unitsToRoll,
          },
        });
        totalRolledOver += unitsToRoll;
      }

      // Also update master ledger SubscriptionBenefitBalance if present
      const targetSubBal = await client.subscriptionBenefitBalance.findFirst({
        where: { subscriptionId: newSubscriptionId, benefitId: prevBal.benefitId },
      });
      if (targetSubBal) {
        await client.subscriptionBenefitBalance.update({
          where: { id: targetSubBal.id },
          data: {
            totalUnits: targetSubBal.totalUnits + unitsToRoll,
            availableUnits: targetSubBal.availableUnits + unitsToRoll,
          },
        });
      }
    }

    return totalRolledOver;
  }
}

export const benefitPeriodManager = BenefitPeriodManager.getInstance();
