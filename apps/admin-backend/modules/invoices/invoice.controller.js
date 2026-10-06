const { prisma } = require('../../lib/prisma');
const { render: renderInvoiceHtml } = require('./invoice.html.renderer');

// numberToWords is provided by invoice.html.renderer.js — kept here only for
// backward compatibility if any other code in this file references it.
function numberToWords(num) {
  if (num === 0) return 'Zero';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let word = '';
  if (Math.floor(num / 10000000) > 0) {
    word += inWords(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (Math.floor(num / 100000) > 0) {
    word += inWords(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (Math.floor(num / 1000) > 0) {
    word += inWords(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  if (num > 0) {
    word += inWords(Math.floor(num));
  }

  return word.trim();
}

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
 *
 * Delegates to the shared invoice.html.renderer.js — single source of truth
 * for all invoice HTML output (admin, website, mobile app via apps/api).
 * Correctly renders: coupon discount + saathi volunteer discount.
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

    // Company details — resolved in priority order on every request:
    //   1. SystemConfig DB table  (updated in real-time via admin panel)
    //   2. env var                (deployment-level override)
    //   3. hardcoded string       (absolute last resort — should never be reached in production)
    const company = {
      name:    configMap.COMPANY_NAME    || process.env.COMPANY_NAME    || 'MaiHoonNa Eldercare Private Limited',
      address: configMap.COMPANY_ADDRESS || process.env.COMPANY_ADDRESS || 'DLF Phase V, Gurugram, Haryana',
      gstin:   configMap.COMPANY_GSTIN   || process.env.COMPANY_GSTIN   || '06AAUCM9447N1ZE',
      pan:     configMap.COMPANY_PAN     || process.env.COMPANY_PAN     || 'AAUCM9447N',
      cin:     configMap.COMPANY_CIN     || process.env.COMPANY_CIN     || 'U86900HR2026PTC145612',
      email:   configMap.COMPANY_EMAIL   || process.env.COMPANY_EMAIL   || 'info@maihoonna.com',
      phone:   configMap.COMPANY_PHONE   || process.env.COMPANY_PHONE   || '8507070049',
    };

    // Renderer handles all HTML, discount rows (coupon + saathi), escaping, and numberToWords.
    const html = renderInvoiceHtml(invoice, company);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[InvoiceController] getInvoiceHtml error:', err);
    res.status(500).send('Error generating invoice preview: ' + err.message);
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  getInvoiceHtml,
};
