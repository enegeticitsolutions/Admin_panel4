export const DEFAULT_BASE_VISIT_MINUTES = 60;
export const DEFAULT_OVERTIME_BUFFER_MINUTES = 10;

export interface VisitBillingInput {
  elapsedMinutes: number;
  baseMinutes?: number;
  bufferMinutes?: number;
}

export interface VisitBillingResult {
  elapsedMinutes: number;
  baseMinutes: number;
  bufferMinutes: number;
  graceLimitMinutes: number;
  billableMinutes: number;
  hoursConsumed: number;
  isWithinBuffer: boolean;
  isOvertime: boolean;
}

/**
 * Calculates billable visit minutes with a post-visit grace buffer.
 *
 * Rules (for default 60m base + 10m buffer):
 * - 0..60m elapsed: billed at minimum 60m (1.0h)
 * - 61..70m elapsed (within 10m buffer): billed at 60m (1.0h), buffer is free
 * - >70m elapsed (e.g. 60m + 10m buffer + 10m extra = 80m): buffer is excluded,
 *   so billableMinutes = 80 - 10 = 70m (70 / 60 hours)
 */
export function calculateVisitBillableMinutes({
  elapsedMinutes,
  baseMinutes = DEFAULT_BASE_VISIT_MINUTES,
  bufferMinutes = DEFAULT_OVERTIME_BUFFER_MINUTES,
}: VisitBillingInput): VisitBillingResult {
  const safeBase = Math.max(1, Math.round(baseMinutes));
  const safeBuffer = Math.max(0, Math.round(bufferMinutes));
  const safeElapsed = Math.max(1, Math.round(elapsedMinutes));
  const graceLimitMinutes = safeBase + safeBuffer;

  const isWithinBuffer = safeElapsed > safeBase && safeElapsed <= graceLimitMinutes;
  const isOvertime = safeElapsed > graceLimitMinutes;

  let billableMinutes: number;
  if (safeElapsed <= graceLimitMinutes) {
    billableMinutes = safeBase;
  } else {
    billableMinutes = safeElapsed - safeBuffer;
  }

  const hoursConsumed = Number((billableMinutes / 60).toFixed(4));

  return {
    elapsedMinutes: safeElapsed,
    baseMinutes: safeBase,
    bufferMinutes: safeBuffer,
    graceLimitMinutes,
    billableMinutes,
    hoursConsumed,
    isWithinBuffer,
    isOvertime,
  };
}
