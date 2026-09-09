import { Prisma } from '@prisma/client';
import prisma from '../core/database';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceFilters {
  status?: string;
  invoiceType?: string;
  page?: number;
  limit?: number;
}

// Reusable include shape for all invoice queries
const INVOICE_FULL_INCLUDE = {
  subscriber: {
    select: { id: true, name: true, phone: true, email: true, state: true },
  },
  beneficiary: {
    select: { id: true, name: true, state: true },
  },
  subscription: {
    select: {
      id: true,
      packageType: true,
      package: { select: { name: true, type: true } },
      packageVersion: { select: { name: true, version: true } },
    },
  },
  items: true,
  payments: {
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      transactionId: true,
      gatewayOrderId: true,
      gatewayPaymentId: true,
      paidAt: true,
    },
  },
} as const;

// ─── InvoiceRepository ─────────────────────────────────────────────────────────

/**
 * InvoiceRepository — Single source-of-truth for all invoice DB queries.
 *
 * OOP design principles:
 * - All Prisma queries live here — controllers stay thin
 * - Accepts optional db client (supports transaction contexts)
 * - Fully reusable: subscriber portal, beneficiary portal, admin panel
 */
export class InvoiceRepository {
  private db: typeof prisma;

  constructor(db: typeof prisma = prisma) {
    this.db = db;
  }

  /**
   * Subscriber view: ALL invoices where subscriberId = userId.
   * Covers invoices for all beneficiaries under this subscriber.
   */
  async findForSubscriber(subscriberId: string, filters: InvoiceFilters = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = { subscriberId };
    if (filters.status) where.status = filters.status as any;
    if (filters.invoiceType) where.invoiceType = filters.invoiceType as any;

    const [invoices, total] = await this.db.$transaction([
      this.db.invoice.findMany({
        where,
        include: INVOICE_FULL_INCLUDE,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Beneficiary view: ONLY invoices where beneficiaryId = id.
   * Also enforces subscriberId check so a beneficiary can't see other subscribers' data.
   */
  async findForBeneficiary(
    beneficiaryId: string,
    subscriberId: string,
    filters: InvoiceFilters = {}
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      beneficiaryId,
      subscriberId, // Security guard: beneficiary must belong to this subscriber
    };
    if (filters.status) where.status = filters.status as any;

    const [invoices, total] = await this.db.$transaction([
      this.db.invoice.findMany({
        where,
        include: INVOICE_FULL_INCLUDE,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Fetches a single invoice, with access policy applied.
   * subscriberId is always required — either from subscriber or parent subscriber of beneficiary.
   */
  async findOne(invoiceId: string, subscriberId: string) {
    return this.db.invoice.findFirst({
      where: {
        subscriberId,
        OR: [{ id: invoiceId }, { invoiceNumber: invoiceId }],
      },
      include: INVOICE_FULL_INCLUDE,
    });
  }

  /**
   * Finds invoice by Razorpay orderId or transactionId (for post-payment redirect).
   */
  async findByOrderId(orderId: string, subscriberId: string) {
    // Try direct subscription linkage first
    let invoice = await this.db.invoice.findFirst({
      where: { subscriberId, subscriptionId: orderId },
      include: INVOICE_FULL_INCLUDE,
    });

    if (!invoice) {
      // Try payment record lookup
      const payment = await this.db.payment.findFirst({
        where: {
          subscriberId,
          OR: [{ transactionId: orderId }, { gatewayOrderId: orderId }, { gatewayPaymentId: orderId }],
        },
        include: {
          invoice: { include: INVOICE_FULL_INCLUDE },
        },
      });
      if (payment?.invoice) {
        invoice = payment.invoice as any;
      }
    }

    return invoice;
  }

  /**
   * Admin-only: find any invoice without subscriber scoping.
   */
  async findByIdAdmin(invoiceId: string) {
    return this.db.invoice.findFirst({
      where: { OR: [{ id: invoiceId }, { invoiceNumber: invoiceId }] },
      include: INVOICE_FULL_INCLUDE,
    });
  }
}

// Singleton export for controllers
export const invoiceRepository = new InvoiceRepository();
