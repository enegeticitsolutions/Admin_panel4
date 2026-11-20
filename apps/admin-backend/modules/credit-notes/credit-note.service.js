const { prisma } = require('../../lib/prisma');
const {
  generateCreditNoteNumber,
  calculateCreditNoteTaxBreakdown,
  renderCreditNoteHtml,
} = require('@maihoonna/billing');
const razorpayService = require('../payments/razorpay.service');
const storage = require('../../services/storage');
const puppeteer = require('puppeteer');

class CreditNoteService {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Helper: Resolves statutory company details from system_configs / env.
   */
  async getCompanyDetails() {
    const configRows = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'COMPANY_NAME',
            'COMPANY_ADDRESS',
            'COMPANY_GSTIN',
            'COMPANY_PAN',
            'COMPANY_CIN',
            'COMPANY_EMAIL',
            'COMPANY_PHONE',
          ],
        },
      },
    });
    const configMap = {};
    for (const r of configRows) configMap[r.key] = r.value;

    return {
      name: configMap.COMPANY_NAME || process.env.COMPANY_NAME || '',
      address: configMap.COMPANY_ADDRESS || process.env.COMPANY_ADDRESS || '',
      gstin: configMap.COMPANY_GSTIN || process.env.COMPANY_GSTIN || '',
      pan: configMap.COMPANY_PAN || process.env.COMPANY_PAN || '',
      cin: configMap.COMPANY_CIN || process.env.COMPANY_CIN || '',
      email: configMap.COMPANY_EMAIL || process.env.COMPANY_EMAIL || '',
      phone: configMap.COMPANY_PHONE || process.env.COMPANY_PHONE || '',
    };
  }

  /**
   * Fetches refund context and remaining refundable balance for an invoice.
   */
  async getInvoiceRefundDetails(invoiceId) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true, email: true } },
        beneficiary: { select: { id: true, name: true } },
        subscription: {
          select: {
            id: true,
            isActive: true,
            isQueued: true,
            packageType: true,
            packageVersion: {
              select: {
                name: true,
                packageCode: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            paymentStatus: true,
            amountPaid: true,
            gatewayName: true,
            gatewayPaymentId: true,
            transactionId: true,
            refundAmount: true,
            paidAt: true,
          },
        },
        creditNotes: {
          where: { status: { not: 'VOID' } },
          orderBy: { issuedAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new Error(`Invoice not found for ID: ${invoiceId}`);
    }

    const totalPaid = invoice.totalAmount || 0;
    const alreadyCredited = invoice.creditNotes.reduce((sum, cn) => sum + (cn.totalAmount || 0), 0);
    const remainingRefundable = Math.max(0, Math.round((totalPaid - alreadyCredited) * 100) / 100);

    // Find linked payment
    const linkedPayment = invoice.payments.find(
      (p) => p.paymentStatus === 'success' || p.paymentStatus === 'partially_refunded'
    ) || invoice.payments[0] || null;

    const isOnlineGateway = Boolean(
      linkedPayment?.gatewayPaymentId ||
      (linkedPayment?.transactionId && linkedPayment.transactionId.startsWith('pay_'))
    );

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      subscriber: invoice.subscriber,
      beneficiary: invoice.beneficiary,
      subscription: invoice.subscription,
      totalAmount: totalPaid,
      alreadyCredited,
      remainingRefundable,
      creditNotesCount: invoice.creditNotes.length,
      creditNotes: invoice.creditNotes,
      linkedPayment,
      isOnlineGateway,
      suggestedMode: isOnlineGateway ? 'GATEWAY_ONLINE' : 'MANUAL_BANK',
    };
  }

  /**
   * Issues a Credit Note and executes refund.
   */
  async issueCreditNote({
    invoiceId,
    amount,
    refundMode = 'GATEWAY_ONLINE',
    manualReference = null,
    reason = 'Customer requested refund',
    notes = null,
    cancelSubscription = false,
  }) {
    const refundVal = Math.round(Number(amount) * 100) / 100;
    if (isNaN(refundVal) || refundVal <= 0) {
      throw new Error('Refund amount must be a positive number greater than 0');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscriber: true,
        beneficiary: true,
        subscription: true,
        payments: true,
        creditNotes: { where: { status: { not: 'VOID' } } },
      },
    });

    if (!invoice) {
      throw new Error(`Invoice not found for ID: ${invoiceId}`);
    }

    const alreadyCredited = invoice.creditNotes.reduce((sum, cn) => sum + (cn.totalAmount || 0), 0);
    const maxRefundable = Math.max(0, Math.round((invoice.totalAmount - alreadyCredited) * 100) / 100);

    if (refundVal > maxRefundable + 0.01) {
      throw new Error(
        `Refund amount of ₹${refundVal} exceeds the remaining refundable balance of ₹${maxRefundable}`
      );
    }

    // 1. Generate sequential Credit Note number
    const creditNoteNumber = await generateCreditNoteNumber(this.prisma, new Date(), 'MHN/CN');

    // 2. Compute proportional GST tax reversal
    const taxBreakdown = calculateCreditNoteTaxBreakdown(refundVal, invoice);

    // 3. Find linked payment
    const linkedPayment = invoice.payments.find(
      (p) => p.paymentStatus === 'success' || p.paymentStatus === 'partially_refunded'
    ) || invoice.payments[0] || null;

    let gatewayRefundId = null;

    // 4. Handle Razorpay Gateway Refund if online mode selected
    if (refundMode === 'GATEWAY_ONLINE') {
      const razorpayPayId = linkedPayment?.gatewayPaymentId ||
        (linkedPayment?.transactionId?.startsWith('pay_') ? linkedPayment.transactionId : null);

      if (!razorpayPayId) {
        throw new Error(
          'No online gateway payment ID found for this invoice. Please select Manual Bank Transfer.'
        );
      }

      const rzpRes = await razorpayService.issueRefund({
        paymentId: razorpayPayId,
        amount: refundVal,
        receipt: creditNoteNumber,
        notes: {
          invoiceNumber: invoice.invoiceNumber,
          creditNoteNumber,
          reason,
        },
      });

      gatewayRefundId = rzpRes.id;
    }

    // 5. Persist Credit Note in DB atomically
    const creditNote = await this.prisma.$transaction(async (tx) => {
      // Create Credit Note
      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          status: 'ISSUED',
          invoiceId: invoice.id,
          originalInvoiceNumber: invoice.invoiceNumber,
          subscriberId: invoice.subscriberId,
          beneficiaryId: invoice.beneficiaryId,
          subscriptionId: invoice.subscriptionId,
          paymentId: linkedPayment?.id || null,
          baseAmount: taxBreakdown.baseAmount,
          taxAmount: taxBreakdown.taxAmount,
          cgstAmount: taxBreakdown.cgstAmount,
          sgstAmount: taxBreakdown.sgstAmount,
          igstAmount: taxBreakdown.igstAmount,
          totalAmount: taxBreakdown.totalAmount,
          refundMode,
          gatewayRefundId,
          manualReference: manualReference ? String(manualReference).trim() : null,
          reason: reason || 'Customer requested refund',
          notes: notes ? String(notes).trim() : null,
        },
        include: {
          invoice: true,
          subscriber: true,
          beneficiary: true,
          subscription: true,
          payment: true,
        },
      });

      // Update linked payment if found
      if (linkedPayment) {
        const newRefundTotal = Math.round(((linkedPayment.refundAmount || 0) + refundVal) * 100) / 100;
        const isFullPaymentRefunded = newRefundTotal >= (linkedPayment.amountPaid - 0.05);

        await tx.payment.update({
          where: { id: linkedPayment.id },
          data: {
            refundId: gatewayRefundId || linkedPayment.refundId,
            refundAmount: newRefundTotal,
            refundedAt: new Date(),
            refundReason: reason,
            paymentStatus: isFullPaymentRefunded ? 'refunded' : 'partially_refunded',
          },
        });
      }

      // Check whether subscription should be cancelled
      const isFullInvoiceRefunded = (alreadyCredited + refundVal) >= (invoice.totalAmount - 0.05);
      if (invoice.subscriptionId && (cancelSubscription || isFullInvoiceRefunded)) {
        await tx.subscription.update({
          where: { id: invoice.subscriptionId },
          data: {
            isActive: false,
            cancelledAt: new Date(),
            cancellationNote: 'Cancelled via Credit Note refund',
          },
        });

        // Clear available units from benefit balances
        await tx.subscriptionBenefitBalance.updateMany({
          where: { subscriptionId: invoice.subscriptionId },
          data: {
            availableUnits: 0,
          },
        });
      }

      return cn;
    });

    // 6. Generate and upload statutory Credit Note PDF asynchronously
    this.generateAndUploadCreditNotePdf(creditNote.id).catch((err) => {
      console.error(`[CreditNoteService] Background PDF generation failed for ${creditNoteNumber}:`, err.message);
    });

    return creditNote;
  }

  /**
   * Generates statutory Credit Note PDF using Puppeteer and uploads to storage.
   */
  async generateAndUploadCreditNotePdf(creditNoteId) {
    const creditNote = await this.prisma.creditNote.findUnique({
      where: { id: creditNoteId },
      include: {
        invoice: true,
        subscriber: true,
        beneficiary: true,
        subscription: true,
      },
    });

    if (!creditNote) return null;

    const company = await this.getCompanyDetails();
    const recipient = {
      name: creditNote.subscriber?.name || '',
      phone: creditNote.subscriber?.phone || '',
      email: creditNote.subscriber?.email || '',
      address: creditNote.subscriber?.address || '',
      state: creditNote.invoice?.placeOfSupply || '',
    };

    const html = renderCreditNoteHtml({
      creditNoteNumber: creditNote.creditNoteNumber,
      issuedAt: creditNote.issuedAt,
      originalInvoiceNumber: creditNote.originalInvoiceNumber,
      originalInvoiceDate: creditNote.invoice?.issuedAt,
      reason: creditNote.reason,
      company,
      recipient,
      breakdown: {
        baseAmount: creditNote.baseAmount,
        taxAmount: creditNote.taxAmount,
        cgstAmount: creditNote.cgstAmount,
        sgstAmount: creditNote.sgstAmount,
        igstAmount: creditNote.igstAmount,
        totalAmount: creditNote.totalAmount,
      },
      refundDetails: {
        refundMode: creditNote.refundMode,
        gatewayRefundId: creditNote.gatewayRefundId,
        manualReference: creditNote.manualReference,
      },
    });

    let pdfBuffer;
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
      pdfBuffer = Buffer.from(pdfUint8Array);
    } finally {
      await browser.close();
    }

    const sanitized = creditNote.creditNoteNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
    const s3Path = `credit-notes/${sanitized}.pdf`;

    await storage.upload(pdfBuffer, s3Path, 'application/pdf');

    await this.prisma.creditNote.update({
      where: { id: creditNote.id },
      data: {
        pdfUrl: s3Path,
        pdfGeneratedAt: new Date(),
      },
    });

    return s3Path;
  }

  /**
   * Retrieves signed download URL for Credit Note PDF.
   */
  async getCreditNotePdfUrl(creditNoteId) {
    const creditNote = await this.prisma.creditNote.findUnique({
      where: { id: creditNoteId },
      select: { id: true, pdfUrl: true, creditNoteNumber: true },
    });

    if (!creditNote) {
      throw new Error(`Credit Note not found for ID: ${creditNoteId}`);
    }

    let s3Path = creditNote.pdfUrl;
    if (!s3Path) {
      // Generate on-demand if not already generated
      s3Path = await this.generateAndUploadCreditNotePdf(creditNoteId);
    }

    if (!s3Path) {
      throw new Error('Failed to generate Credit Note PDF');
    }

    const downloadUrl = await storage.getDownloadUrl(s3Path, 3600);
    return {
      downloadUrl,
      fileName: `${creditNote.creditNoteNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
    };
  }

  /**
   * Lists Credit Notes with search and pagination.
   */
  async listCreditNotes({ page = 1, limit = 20, search = '', invoiceId = null, subscriberId = null, startDate = null, endDate = null }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (invoiceId) where.invoiceId = invoiceId;
    if (subscriberId) where.subscriberId = subscriberId;

    if (startDate || endDate) {
      where.issuedAt = {};
      if (startDate) where.issuedAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setUTCHours(23, 59, 59, 999);
        where.issuedAt.lte = end;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { creditNoteNumber: { contains: q, mode: 'insensitive' } },
        { originalInvoiceNumber: { contains: q, mode: 'insensitive' } },
        { subscriber: { name: { contains: q, mode: 'insensitive' } } },
        { subscriber: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [creditNotes, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
          subscriber: { select: { id: true, name: true, phone: true, email: true } },
          beneficiary: { select: { id: true, name: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.creditNote.count({ where }),
    ]);

    return {
      creditNotes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

module.exports = new CreditNoteService();
