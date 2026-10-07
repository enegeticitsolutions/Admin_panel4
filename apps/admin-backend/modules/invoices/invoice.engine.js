const { v4: uuidv4 } = require('uuid');
const {
  BillingCalculator,
  TaxResolver: BillingTaxResolver,
  currentIndianFinancialYear,
  generateInvoiceNumber: billingGenerateInvoiceNumber,
} = require('@maihoonna/billing');

class TaxResolver {
  constructor(prisma) {
    this.prisma = prisma;
    this._resolver = new BillingTaxResolver(prisma);
  }

  async resolveBenefitTax(benefitOrId, tx) {
    return this._resolver.resolveBenefitTax(benefitOrId, tx);
  }

  async resolvePackageTax(pkg, tx) {
    const db = tx || this.prisma;
    if (!pkg) return this._resolver.systemDefault(db, null);

    if (pkg.isGstExempt) {
      return { gstRate: 0, hsnSacCode: pkg.hsnSacCode || '999312', isExempt: true };
    }

    if (pkg.gstRate !== null && pkg.gstRate !== undefined) {
      const rate = parseFloat(pkg.gstRate);
      return { gstRate: rate, hsnSacCode: pkg.hsnSacCode || '998399', isExempt: rate === 0 };
    }

    return this._resolver.systemDefault(db, pkg.hsnSacCode);
  }

  async _systemDefault(db, hsnSacCode) {
    return this._resolver.systemDefault(db, hsnSacCode);
  }
}

// ─── InvoiceCalculator ────────────────────────────────────────────────────────

/**
 * InvoiceCalculator — Powered by canonical @maihoonna/billing engine.
 * Pure domain calculator for GST mathematics, discount proportioning,
 * and state-of-supply tax splits (CGST+SGST vs IGST).
 */
class InvoiceCalculator {
  static calculate({ items = [], totalDiscount = 0, customerState = '', companyState = process.env.COMPANY_STATE || 'Haryana', packageTotalBasePrice }) {
    const billingItems = items.map((item) => ({
      benefitId: item.benefitId || null,
      name: item.name || item.description || 'Benefit',
      description: item.description || item.name || 'Benefit',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice,
      nominalCost: item.nominalCost !== undefined ? item.nominalCost : item.unitPrice,
      gstRate: item.gstRate,
      hsnSacCode: item.hsnSacCode,
      isGstExempt: Boolean(item.isExempt ?? item.isGstExempt),
    }));

    const result = BillingCalculator.calculate({
      items: billingItems,
      couponDiscountAmount: totalDiscount,
      customerState,
      companyState,
      packageTotalBasePrice,
    });

    return {
      baseAmount: result.baseAmount,
      discountAmount: result.discountAmount,
      taxableAmount: result.taxableAmount,
      taxAmount: result.taxAmount,
      cgstAmount: result.cgstAmount,
      sgstAmount: result.sgstAmount,
      igstAmount: result.igstAmount,
      totalAmount: result.totalAmount,
      placeOfSupply: result.placeOfSupply,
      items: result.items,
      taxSummary: result.taxSummary,
      isInterState: result.isInterState,
    };
  }

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
   * Generates the next sequential invoice number using canonical @maihoonna/billing engine.
   *
   * @param {Object} tx      - Prisma transaction client (MUST be inside a transaction)
   * @param {Date} [forDate] - Date to derive FY from. Defaults to today (new Date()).
   * @returns {Promise<string>}  e.g. "MHN/INV/2026-27/00001"
   */
  static async next(tx, forDate = new Date()) {
    return billingGenerateInvoiceNumber(tx, forDate instanceof Date ? forDate : new Date());
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
