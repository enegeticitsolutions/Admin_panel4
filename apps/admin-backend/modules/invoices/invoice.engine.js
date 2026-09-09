const { v4: uuidv4 } = require('uuid');

// ─── Financial Year Utility ────────────────────────────────────────────────────

/**
 * Computes the current Indian Financial Year string dynamically.
 * Indian FY runs April 1 → March 31 of the next calendar year.
 *
 * Examples:
 *   April 2026   → "2026-27"
 *   January 2027 → "2026-27"
 *   April 2027   → "2027-28"
 *
 * @param {Date} [date=new Date()] - Reference date (defaults to today)
 * @returns {string}  e.g. "2026-27"
 */
function currentIndianFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  // Jan/Feb/Mar belong to the FY that started in the PREVIOUS calendar year
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1).toString().slice(-2); // last 2 digits only

  return `${fyStart}-${fyEnd}`;
}

// ─── TaxResolver ──────────────────────────────────────────────────────────────

/**
 * TaxResolver — Resolves dynamic GST percentages, HSN/SAC codes,
 * and exemption statuses directly from `benefits` and `tax_categories` tables.
 *
 * Resolution chain (no static/hardcoded values):
 *  1. benefit.isGstExempt  → 0%, exempt
 *  2. benefit.gstRate (explicit DB value) → use as-is
 *  3. benefit.taxCategory code → look up TaxCategory record in DB
 *  4. system_configs key "DEFAULT_GST_RATE" → dynamic system-level default
 *  5. Absolute last resort → 18% with a console.warn (seeding system_configs fixes this)
 */
class TaxResolver {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Resolves tax metadata for a given Benefit object or benefit UUID.
   *
   * @param {Object|string} benefitOrId - Benefit DB record or UUID string
   * @param {Object} [tx] - Prisma transaction client (falls back to this.prisma)
   * @returns {Promise<{ gstRate: number, hsnSacCode: string, isExempt: boolean }>}
   */
  async resolveBenefitTax(benefitOrId, tx) {
    const db = tx || this.prisma;
    let benefit = benefitOrId;

    if (typeof benefitOrId === 'string') {
      benefit = await db.benefit.findUnique({ where: { id: benefitOrId } });
    }

    if (!benefit) {
      console.warn('[TaxResolver] Benefit not found — using system default GST rate.');
      return this._systemDefault(db, null);
    }

    // 1. Explicitly exempt
    if (benefit.isGstExempt) {
      return { gstRate: 0, hsnSacCode: benefit.hsnSacCode || '999312', isExempt: true };
    }

    // 2. Explicit gstRate stored on benefit record
    if (benefit.gstRate !== null && benefit.gstRate !== undefined) {
      const rate = parseFloat(benefit.gstRate);
      return { gstRate: rate, hsnSacCode: benefit.hsnSacCode || '998399', isExempt: rate === 0 };
    }

    // 3. TaxCategory lookup via benefit.taxCategory code (DB table)
    if (benefit.taxCategory) {
      const category = await db.taxCategory.findUnique({ where: { code: benefit.taxCategory } });
      if (category && category.isActive) {
        return {
          gstRate: parseFloat(category.gstRate),
          hsnSacCode: benefit.hsnSacCode || category.hsnSacCode || '998399',
          isExempt: Boolean(category.isExempt),
        };
      }
    }

    // 4. System / DB default
    return this._systemDefault(db, benefit.hsnSacCode);
  }

  /**
   * Resolves tax metadata for a SubscriptionPackage record (package-level fallback).
   * Used when a payment is for a package directly with no itemized benefits.
   *
   * @param {Object} pkg - SubscriptionPackage DB record
   * @param {Object} [tx]
   * @returns {Promise<{ gstRate: number, hsnSacCode: string, isExempt: boolean }>}
   */
  async resolvePackageTax(pkg, tx) {
    const db = tx || this.prisma;
    if (!pkg) return this._systemDefault(db, null);

    if (pkg.isGstExempt) {
      return { gstRate: 0, hsnSacCode: pkg.hsnSacCode || '999312', isExempt: true };
    }

    if (pkg.gstRate !== null && pkg.gstRate !== undefined) {
      const rate = parseFloat(pkg.gstRate);
      return { gstRate: rate, hsnSacCode: pkg.hsnSacCode || '998399', isExempt: rate === 0 };
    }

    return this._systemDefault(db, pkg.hsnSacCode);
  }

  /**
   * Reads DEFAULT_GST_RATE from system_configs table.
   * Falls back to statutory 18% if the key is missing (with a warning).
   *
   * @param {Object} db
   * @param {string|null} hsnSacCode
   * @returns {Promise<{ gstRate: number, hsnSacCode: string, isExempt: boolean }>}
   */
  async _systemDefault(db, hsnSacCode) {
    try {
      const config = await db.systemConfig.findUnique({ where: { key: 'DEFAULT_GST_RATE' } });
      if (config && config.value) {
        const rate = parseFloat(config.value);
        return { gstRate: isNaN(rate) ? 18 : rate, hsnSacCode: hsnSacCode || '998399', isExempt: false };
      }
    } catch (_) {
      // Non-fatal: system_configs table might not be seeded yet
    }

    console.warn(
      '[TaxResolver] No DEFAULT_GST_RATE in system_configs — applying statutory 18% fallback. ' +
      'Seed system_configs table with key="DEFAULT_GST_RATE" to remove this warning.',
    );
    return { gstRate: 18, hsnSacCode: hsnSacCode || '998399', isExempt: false };
  }
}

// ─── InvoiceCalculator ────────────────────────────────────────────────────────

/**
 * InvoiceCalculator — Pure domain calculator for GST mathematics,
 * discount proportioning, and state-of-supply tax splits (CGST+SGST vs IGST).
 *
 * No DB dependency — purely mathematical. All tax rates must already be resolved.
 */
class InvoiceCalculator {
  /**
   * Calculates itemized line totals, taxable value, and tax splits.
   *
   * @param {Object} params
   * @param {Array<{
   *   benefitId?: string,
   *   name: string,
   *   quantity: number,
   *   unitPrice: number,
   *   gstRate: number,
   *   hsnSacCode?: string,
   *   isExempt?: boolean
   * }>} params.items
   * @param {number} [params.totalDiscount=0]     - Total monetary discount to spread proportionally
   * @param {string} [params.customerState]        - Customer place-of-supply state
   * @param {string} [params.companyState]         - Provider registered state (default 'Haryana')
   * @returns {Object} Full calculation result
   */
  static calculate({ items = [], totalDiscount = 0, customerState = 'Haryana', companyState = 'Haryana' }) {
    const isInterState =
      (customerState || '').trim().toLowerCase() !== (companyState || '').trim().toLowerCase();

    // 1. Raw base amount (before discount)
    const rawBaseAmount = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

    // 2. Proportional discount ratio across all line items
    const discountRatio = rawBaseAmount > 0 ? Math.min(1, totalDiscount / rawBaseAmount) : 0;

    let totalTaxAmount = 0;
    let totalTaxableAmount = 0;

    const processedItems = items.map((item) => {
      const rawLineTotal = item.unitPrice * item.quantity;
      const lineDiscount = Math.round(rawLineTotal * discountRatio * 100) / 100;
      const taxableAmount = Math.max(0, rawLineTotal - lineDiscount);

      const rate = item.isExempt ? 0 : (item.gstRate ?? 18);
      const lineTax = item.isExempt
        ? 0
        : Math.round((taxableAmount * rate / 100) * 100) / 100;

      totalTaxableAmount += taxableAmount;
      totalTaxAmount += lineTax;

      return {
        benefitId: item.benefitId || null,
        description: item.name,
        hsnSacCode: item.hsnSacCode || (item.isExempt ? '999312' : '998399'),
        taxRate: rate,
        isGstExempt: Boolean(item.isExempt),
        quantity: item.quantity,
        unitPrice: Math.round(item.unitPrice * 100) / 100,
        amount: Math.round(taxableAmount * 100) / 100,
        tax: Math.round(lineTax * 100) / 100,
      };
    });

    totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
    totalTaxableAmount = Math.round(totalTaxableAmount * 100) / 100;

    // Intra-state: split into 50% CGST + 50% SGST
    // Inter-state: full IGST
    const cgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
    const sgstAmount = isInterState ? 0 : Math.round((totalTaxAmount / 2) * 100) / 100;
    const igstAmount = isInterState ? totalTaxAmount : 0;

    const totalAmount = Math.round((totalTaxableAmount + totalTaxAmount) * 100) / 100;

    return {
      baseAmount: Math.round(rawBaseAmount * 100) / 100,
      discountAmount: Math.round(totalDiscount * 100) / 100,
      taxableAmount: totalTaxableAmount,
      taxAmount: totalTaxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      placeOfSupply: customerState || companyState,
      items: processedItems,
    };
  }

  /** Instance alias — allows `new InvoiceCalculator().calculate(...)` pattern */
  calculate(args) {
    return InvoiceCalculator.calculate(args);
  }
}

// ─── InvoiceNumberGenerator ───────────────────────────────────────────────────

/**
 * InvoiceNumberGenerator — Generates statutory sequential invoice numbers
 * using atomic DB counter operations (upsert for safety).
 *
 * The financial year is ALWAYS computed dynamically from the system date.
 * It is NEVER hardcoded. Format: MHN/INV/2026-27/00001
 */
class InvoiceNumberGenerator {
  /**
   * Generates the next sequential invoice number.
   *
   * @param {Object} tx      - Prisma transaction client (MUST be inside a transaction)
   * @param {Date} [forDate] - Date to derive FY from. Defaults to today (new Date()).
   * @returns {Promise<string>}  e.g. "MHN/INV/2026-27/00001"
   */
  static async next(tx, forDate = new Date()) {
    // Always computed from date — never passed as a hardcoded string
    const financialYear = currentIndianFinancialYear(
      forDate instanceof Date ? forDate : new Date(),
    );

    const counter = await tx.invoiceCounter.upsert({
      where: { financialYear },
      update: { lastCount: { increment: 1 } },
      create: { financialYear, lastCount: 1 },
    });

    const countStr = counter.lastCount.toString().padStart(5, '0');
    return `MHN/INV/${financialYear}/${countStr}`;
  }
}

// ─── InvoiceEngine ────────────────────────────────────────────────────────────

/**
 * InvoiceEngine — Core OOP orchestrator for creating atomic, fully-itemized
 * legal invoices in PostgreSQL.
 *
 * Guarantees:
 * - Financial year is always derived from the current/provided date (never hardcoded)
 * - Tax rates are always resolved from DB records via TaxResolver
 * - All math is delegated to InvoiceCalculator (pure, no DB dependency)
 * - All DB writes happen inside the caller-provided transaction (atomicity)
 */
class InvoiceEngine {
  constructor(prisma) {
    this.prisma = prisma;
    this.taxResolver = new TaxResolver(prisma);
    this.calculator = new InvoiceCalculator(); // Instance for callers that prefer OOP style
  }

  /**
   * Persists an Invoice and all its line items atomically.
   *
   * @param {Object} tx - Prisma transaction client
   * @param {Object} params
   * @param {string} params.invoiceType          - 'SUBSCRIPTION' | 'SERVICE'
   * @param {string} params.subscriberId         - UUID of the subscriber (User)
   * @param {string} [params.beneficiaryId]      - UUID of the beneficiary
   * @param {string} [params.subscriptionId]     - UUID of the subscription
   * @param {string} [params.appointmentId]      - UUID of the appointment
   * @param {string} [params.status='PAID']      - 'PAID' | 'ISSUED' | 'DRAFT'
   * @param {Object} params.calculationResult    - Output from InvoiceCalculator.calculate()
   * @param {Date}   [params.invoiceDate]        - Date for FY computation & timestamps (default: now)
   * @returns {Promise<Object>} Created Invoice record with items included
   */
  async createInvoiceRecord(tx, {
    invoiceType = 'SUBSCRIPTION',
    subscriberId,
    beneficiaryId = null,
    subscriptionId = null,
    appointmentId = null,
    status = 'PAID',
    calculationResult,
    invoiceDate,
  }) {
    if (!subscriberId) throw new Error('[InvoiceEngine] subscriberId is required.');
    if (!calculationResult) throw new Error('[InvoiceEngine] calculationResult is required.');

    // Financial year is always derived from the actual date — never hardcoded
    const invoiceNumber = await InvoiceNumberGenerator.next(tx, invoiceDate || new Date());
    const invoiceId = uuidv4();
    const now = invoiceDate || new Date();

    const invoice = await tx.invoice.create({
      data: {
        id: invoiceId,
        invoiceNumber,
        invoiceType,
        status,
        subscriberId,
        beneficiaryId: beneficiaryId || null,
        subscriptionId: subscriptionId || null,
        appointmentId: appointmentId || null,
        baseAmount: calculationResult.baseAmount,
        discountAmount: calculationResult.discountAmount,
        taxAmount: calculationResult.taxAmount,
        totalAmount: calculationResult.totalAmount,
        placeOfSupply: calculationResult.placeOfSupply,
        cgstAmount: calculationResult.cgstAmount,
        sgstAmount: calculationResult.sgstAmount,
        igstAmount: calculationResult.igstAmount,
        issuedAt: now,
        paidAt: status === 'PAID' ? now : null,
        items: {
          create: calculationResult.items.map((item) => ({
            id: uuidv4(),
            benefitId: item.benefitId || null,
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            taxRate: item.taxRate,
            isGstExempt: item.isGstExempt,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),
        },
      },
      include: { items: true },
    });

    return invoice;
  }

  /**
   * Semantic alias — use when building calculationResult externally and persisting in one shot.
   */
  async generateAndPersist(tx, params) {
    return this.createInvoiceRecord(tx, params);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  currentIndianFinancialYear,
  TaxResolver,
  InvoiceCalculator,
  InvoiceNumberGenerator,
  InvoiceEngine,
};
