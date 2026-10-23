const { prisma } = require('../../lib/prisma');
const { render: renderInvoiceHtml } = require('./invoice.html.renderer');
const { InvoicePdfService } = require('./invoice.pdf.service');
const storage = require('../../services/storage');
const { currentIndianFinancialYear, generateInvoiceNumber: billingGenerateInvoiceNumber } = require('@maihoonna/billing');

/**
 * GET /api/invoices
 * Lists invoices with pagination and search.
 */
async function listInvoices(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { status, search, invoiceType, subscriberId, beneficiaryId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (invoiceType) where.invoiceType = invoiceType;
    if (subscriberId) where.subscriberId = subscriberId;     // Admin: filter by subscriber
    if (beneficiaryId) where.beneficiaryId = beneficiaryId; // Admin: filter by beneficiary

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { subscriber: { name: { contains: q, mode: 'insensitive' } } },
        { subscriber: { phone: { contains: q, mode: 'insensitive' } } },
        { beneficiary: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          subscriber: { select: { id: true, name: true, phone: true, email: true } },
          beneficiary: { select: { id: true, name: true } },
          subscription: {
            select: {
              id: true,
              package: { select: { name: true, type: true } },
              packageVersion: { select: { name: true, version: true } },
            },
          },
          items: true,
          payments: {
            select: { id: true, paymentMethod: true, paymentStatus: true, transactionId: true, paidAt: true },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[InvoiceController] listInvoices error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/invoices/:id
 * Fetches full details for a single invoice.
 */
async function getInvoiceById(req, res) {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id },
          { invoiceNumber: id },
        ],
      },
      include: {
        subscriber: true,
        beneficiary: true,
        subscription: {
          include: {
            package: true,
            packageVersion: true,
          },
        },
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error('[InvoiceController] getInvoiceById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/invoices/:id/html
 * Renders a statutory printable Tax Invoice document.
 */
async function getInvoiceHtml(req, res) {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id },
          { invoiceNumber: id },
        ],
      },
      include: {
        subscriber: true,
        beneficiary: true,
        subscription: {
          include: {
            package: true,
            packageVersion: true,
          },
        },
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    // Fetch live company statutory details from SystemConfig table
    const configRows = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'COMPANY_NAME', 'COMPANY_ADDRESS', 'COMPANY_GSTIN',
            'COMPANY_PAN', 'COMPANY_CIN', 'COMPANY_EMAIL', 'COMPANY_PHONE',
            'COMPANY_BANK_NAME', 'COMPANY_BANK_ACCOUNT', 'COMPANY_BANK_IFSC', 'COMPANY_UPI_ID',
          ],
        },
      },
    });

    const configMap = {};
    for (const row of configRows) { configMap[row.key] = row.value; }

    const company = {
      name:    configMap.COMPANY_NAME    || process.env.COMPANY_NAME    || 'MaiHoonNa Eldercare Private Limited',
      address: configMap.COMPANY_ADDRESS || process.env.COMPANY_ADDRESS || 'DLF Phase V, Gurugram, Haryana',
      gstin:   configMap.COMPANY_GSTIN   || process.env.COMPANY_GSTIN   || '06AAUCM9447N1ZE',
      pan:     configMap.COMPANY_PAN     || process.env.COMPANY_PAN     || 'AAUCM9447N',
      cin:     configMap.COMPANY_CIN     || process.env.COMPANY_CIN     || 'U86900HR2026PTC145612',
      email:   configMap.COMPANY_EMAIL   || process.env.COMPANY_EMAIL   || 'info@maihoonna.com',
      phone:   configMap.COMPANY_PHONE   || process.env.COMPANY_PHONE   || '8507070049',
    };

    const html = renderInvoiceHtml(invoice, company);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[InvoiceController] getInvoiceHtml error:', err);
    res.status(500).send('Error generating invoice preview: ' + err.message);
  }
}

/**
 * GET /api/invoices/:id/pdf-url
 * Returns presigned S3 download/view URL for the invoice PDF.
 */
async function getInvoicePdfUrl(req, res) {
  try {
    const { id } = req.params;
    const result = await InvoicePdfService.getInvoicePdfUrl(id);

    res.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
      },
    });
  } catch (err) {
    console.error('[InvoiceController] getInvoicePdfUrl error:', err);
    const status = err.message && err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message || 'Failed to get invoice PDF URL' });
  }
}

/**
 * GET /api/invoices/:id/pdf
 * Directly redirects to the presigned S3 PDF URL for seamless browser download.
 */
async function downloadInvoicePdf(req, res) {
  try {
    const { id } = req.params;
    const result = await InvoicePdfService.getInvoicePdfUrl(id);
    res.redirect(result.downloadUrl);
  } catch (err) {
    console.error('[InvoiceController] downloadInvoicePdf error:', err);
    const status = err.message && err.message.includes('not found') ? 404 : 500;
    res.status(status).send('Error downloading invoice: ' + err.message);
  }
}

/**
 * POST /api/invoices
 * Create manual invoice / attach invoice with optional PDF file upload.
 */
async function createInvoice(req, res) {
  try {
    const {
      subscriberId,
      beneficiaryId,
      invoiceNumber: customInvoiceNumber,
      invoiceType = 'SUBSCRIPTION',
      status = 'PAID',
      totalAmount,
      baseAmount: customBaseAmount,
      taxAmount: customTaxAmount,
      placeOfSupply,
      issuedAt,
      paidAt,
      description = 'MaiHoonNa Eldercare Subscription Plan',
    } = req.body;

    if (!subscriberId) {
      return res.status(400).json({ success: false, message: 'subscriberId is required' });
    }

    const subscriber = await prisma.user.findUnique({
      where: { id: subscriberId },
    });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    const tot = parseFloat(totalAmount) || 0;
    let base = parseFloat(customBaseAmount);
    let tax = parseFloat(customTaxAmount);

    if (isNaN(base) || isNaN(tax)) {
      base = +(tot / 1.18).toFixed(2);
      tax = +(tot - base).toFixed(2);
    }

    const state = placeOfSupply || subscriber.state || 'Haryana';
    const isInterState = state.trim().toLowerCase() !== 'haryana';
    const cgst = isInterState ? 0 : +(tax / 2).toFixed(2);
    const sgst = isInterState ? 0 : +(tax / 2).toFixed(2);
    const igst = isInterState ? tax : 0;

    let finalInvoiceNumber = customInvoiceNumber?.trim();
    if (!finalInvoiceNumber) {
      finalInvoiceNumber = await billingGenerateInvoiceNumber(prisma, issuedAt ? new Date(issuedAt) : new Date());
    }

    // Check if invoice number is already taken
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: finalInvoiceNumber },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: `Invoice number ${finalInvoiceNumber} already exists` });
    }

    let pdfUrl = null;
    let pdfGeneratedAt = null;

    if (req.file) {
      const sanitizedNumber = finalInvoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
      const s3Path = `invoices/${sanitizedNumber}.pdf`;
      await storage.upload(req.file.buffer, s3Path, 'application/pdf');
      pdfUrl = s3Path;
      pdfGeneratedAt = new Date();
    }

    const invoiceDate = issuedAt ? new Date(issuedAt) : new Date();
    const invoicePaidDate = status === 'PAID' ? (paidAt ? new Date(paidAt) : invoiceDate) : null;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: finalInvoiceNumber,
        invoiceType,
        status,
        subscriberId,
        beneficiaryId: beneficiaryId && beneficiaryId !== 'none' ? beneficiaryId : null,
        baseAmount: base,
        discountAmount: 0,
        saathiDiscountAmount: 0,
        taxAmount: tax,
        totalAmount: tot,
        placeOfSupply: state,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        issuedAt: invoiceDate,
        paidAt: invoicePaidDate,
        pdfUrl,
        pdfGeneratedAt,
        items: {
          create: [
            {
              description: description || 'MaiHoonNa Eldercare Subscription Plan',
              hsnSacCode: '998399',
              taxRate: 18,
              isGstExempt: false,
              quantity: 1,
              unitPrice: base,
              amount: base,
            },
          ],
        },
      },
      include: {
        subscriber: true,
        beneficiary: true,
        items: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  } catch (err) {
    console.error('[InvoiceController] createInvoice error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/invoices/:id/pdf
 * Attach or replace PDF file for an existing invoice.
 */
async function uploadInvoicePdf(req, res) {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'PDF file is required' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const sanitizedNumber = (invoice.invoiceNumber || invoice.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const s3Path = `invoices/${sanitizedNumber}.pdf`;

    await storage.upload(req.file.buffer, s3Path, 'application/pdf');

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl: s3Path,
        pdfGeneratedAt: new Date(),
      },
    });

    const downloadUrl = await storage.getPresignedUrl(s3Path, 3600);

    res.json({
      success: true,
      message: 'Invoice PDF attached successfully',
      data: {
        invoice: updated,
        downloadUrl,
      },
    });
  } catch (err) {
    console.error('[InvoiceController] uploadInvoicePdf error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/invoices/:id/pdf
 * Delete PDF file attachment from S3 and remove link on invoice.
 */
async function deleteInvoicePdf(req, res) {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.pdfUrl) {
      try {
        await storage.delete(invoice.pdfUrl);
      } catch (s3Err) {
        console.warn(`[InvoiceController] S3 delete warning for ${invoice.pdfUrl}:`, s3Err.message);
      }
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl: null,
        pdfGeneratedAt: null,
      },
    });

    res.json({
      success: true,
      message: 'Invoice PDF deleted successfully',
    });
  } catch (err) {
    console.error('[InvoiceController] deleteInvoicePdf error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/invoices/:id
 * Delete entire invoice record, cascade-delete items, unlink payments, delete S3 PDF.
 */
async function deleteInvoice(req, res) {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { invoiceNumber: id }],
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Attempt to delete S3 PDF file if it exists
    if (invoice.pdfUrl) {
      try {
        await storage.delete(invoice.pdfUrl);
      } catch (s3Err) {
        console.warn(`[InvoiceController] S3 delete warning for ${invoice.pdfUrl}:`, s3Err.message);
      }
    }

    // Unlink any payments referencing this invoice
    await prisma.payment.updateMany({
      where: { invoiceId: invoice.id },
      data: { invoiceId: null },
    });

    // Delete invoice items
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: invoice.id },
    });

    // Delete invoice record
    await prisma.invoice.delete({
      where: { id: invoice.id },
    });

    res.json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} deleted successfully`,
    });
  } catch (err) {
    console.error('[InvoiceController] deleteInvoice error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/invoices/counter
 * Get current sequence counter state for the given or current financial year.
 */
async function getInvoiceCounter(req, res) {
  try {
    const financialYear = req.query.financialYear || currentIndianFinancialYear();
    const counter = await prisma.invoiceCounter.findUnique({
      where: { financialYear },
    });

    const lastCount = counter ? counter.lastCount : 0;
    const nextCount = lastCount + 1;
    const nextInvoiceNumber = `MHN/INV/${financialYear}/${String(nextCount).padStart(5, '0')}`;

    res.json({
      success: true,
      data: {
        financialYear,
        lastCount,
        nextCount,
        nextInvoiceNumber,
      },
    });
  } catch (err) {
    console.error('[InvoiceController] getInvoiceCounter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/invoices/counter
 * Set or reset lastCount for the given financial year.
 */
async function updateInvoiceCounter(req, res) {
  try {
    const { lastCount, financialYear: customFY } = req.body;
    if (lastCount === undefined || isNaN(parseInt(lastCount, 10))) {
      return res.status(400).json({ success: false, message: 'lastCount is required and must be an integer' });
    }

    const financialYear = customFY || currentIndianFinancialYear();
    const countVal = Math.max(0, parseInt(lastCount, 10));

    const updated = await prisma.invoiceCounter.upsert({
      where: { financialYear },
      update: { lastCount: countVal },
      create: { financialYear, lastCount: countVal },
    });

    const nextCount = countVal + 1;
    const nextInvoiceNumber = `MHN/INV/${financialYear}/${String(nextCount).padStart(5, '0')}`;

    res.json({
      success: true,
      message: `Invoice counter for ${financialYear} updated to ${countVal}. Next invoice: ${nextInvoiceNumber}`,
      data: {
        financialYear,
        lastCount: updated.lastCount,
        nextCount,
        nextInvoiceNumber,
      },
    });
  } catch (err) {
    console.error('[InvoiceController] updateInvoiceCounter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  getInvoiceHtml,
  getInvoicePdfUrl,
  downloadInvoicePdf,
  createInvoice,
  uploadInvoicePdf,
  deleteInvoicePdf,
  deleteInvoice,
  getInvoiceCounter,
  updateInvoiceCounter,
};
