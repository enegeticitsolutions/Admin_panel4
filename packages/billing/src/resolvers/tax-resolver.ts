export interface TaxMetadata {
  gstRate: number;
  hsnSacCode: string;
  isExempt: boolean;
}

export class TaxResolver {
  private prisma: any;

  constructor(prismaClient: any) {
    this.prisma = prismaClient;
  }

  /**
   * Resolves GST metadata for a Benefit DB record or UUID string.
   */
  async resolveBenefitTax(benefitOrId: any, tx?: any): Promise<TaxMetadata> {
    const db = tx || this.prisma;
    let benefit = benefitOrId;

    if (typeof benefitOrId === 'string') {
      benefit = await db.benefit.findUnique({ where: { id: benefitOrId } });
    }

    if (!benefit) {
      return this.systemDefault(db, null);
    }

    // 1. Explicitly exempt
    if (benefit.isGstExempt) {
      return { gstRate: 0, hsnSacCode: benefit.hsnSacCode || '999312', isExempt: true };
    }

    // 2. Explicit gstRate on benefit record
    if (benefit.gstRate !== null && benefit.gstRate !== undefined) {
      const rate = parseFloat(benefit.gstRate);
      return {
        gstRate: rate,
        hsnSacCode: benefit.hsnSacCode || (rate === 0 ? '999312' : '998399'),
        isExempt: rate === 0,
      };
    }

    // 3. TaxCategory lookup via code
    if (benefit.taxCategory) {
      const category = await db.taxCategory.findUnique({ where: { code: benefit.taxCategory } });
      if (category && category.isActive) {
        const rate = parseFloat(category.gstRate);
        return {
          gstRate: rate,
          hsnSacCode: benefit.hsnSacCode || category.hsnSacCode || (rate === 0 ? '999312' : '998399'),
          isExempt: Boolean(category.isExempt || rate === 0),
        };
      }
    }

    // 4. System / DB default
    return this.systemDefault(db, benefit.hsnSacCode);
  }

  /**
   * Reads DEFAULT_GST_RATE from system_configs table.
   */
  async systemDefault(db: any, hsnSacCode: string | null): Promise<TaxMetadata> {
    try {
      const config = await db.systemConfig.findUnique({ where: { key: 'DEFAULT_GST_RATE' } });
      if (config && config.value) {
        const rate = parseFloat(config.value);
        return {
          gstRate: isNaN(rate) ? 18 : rate,
          hsnSacCode: hsnSacCode || '998399',
          isExempt: rate === 0,
        };
      }
    } catch (_) {
      // Non-fatal if table not yet seeded
    }

    return { gstRate: 18, hsnSacCode: hsnSacCode || '998399', isExempt: false };
  }
}
