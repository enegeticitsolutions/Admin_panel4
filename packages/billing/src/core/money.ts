/**
 * High-precision monetary math utilities using integer paise.
 * In India, ₹1 = 100 paise. Performing calculations in integer paise
 * avoids IEEE-754 floating point drift (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */

export class Money {
  /**
   * Converts Rupee decimal amount to integer paise.
   */
  static toPaise(rupees: number | string): number {
    const parsed = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
    if (isNaN(parsed) || !isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
  }

  /**
   * Converts integer paise back to 2-decimal Rupees.
   */
  static toRupees(paise: number): number {
    return Math.round(paise) / 100;
  }

  /**
   * Formats paise as Indian currency string (e.g., 10050 -> "100.50").
   */
  static format(paise: number): string {
    return (Math.round(paise) / 100).toFixed(2);
  }

  /**
   * Distributes an integer amount of paise across an array of weights using
   * the Hare-Niemeyer / Largest Remainder method.
   *
   * Invariant guaranteed:
   * sum(allocatedPaise) === totalPaise exactly. No 1-paise discrepancy.
   */
  static distribute(totalPaise: number, weights: number[]): number[] {
    if (!weights.length) return [];
    if (totalPaise === 0) return weights.map(() => 0);

    const sumWeights = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
    if (sumWeights === 0) {
      // If all weights are 0, distribute evenly
      const baseShare = Math.floor(totalPaise / weights.length);
      let remainder = totalPaise - baseShare * weights.length;
      return weights.map(() => {
        const share = baseShare + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        return share;
      });
    }

    // 1. Calculate integer floor shares and track fractional remainders
    const shares: number[] = [];
    const remainders: { index: number; remainder: number }[] = [];
    let allocatedSum = 0;

    for (let i = 0; i < weights.length; i++) {
      const weight = Math.max(0, weights[i]);
      const exactShare = (totalPaise * weight) / sumWeights;
      const floorShare = Math.floor(exactShare);

      shares.push(floorShare);
      allocatedSum += floorShare;
      remainders.push({ index: i, remainder: exactShare - floorShare });
    }

    // 2. Sort by descending fractional remainder
    remainders.sort((a, b) => b.remainder - a.remainder);

    // 3. Distribute remaining paise one by one to items with highest remainder
    let unallocated = totalPaise - allocatedSum;
    let ptr = 0;
    while (unallocated > 0 && ptr < remainders.length) {
      shares[remainders[ptr].index]++;
      unallocated--;
      ptr++;
    }

    return shares;
  }
}
