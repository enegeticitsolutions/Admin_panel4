import { Response } from 'express';
import { AuthRequest } from '../../api/shared/deps';
import prisma from '../../core/database';
import { InvoiceRepository } from '../../repositories/invoice.repository';
import { InvoiceHtmlRenderer } from '../../services/invoice.html.renderer';

// ─── OOP: Each controller method is thin — delegates to repository & renderer ──
// The controller's only job: extract request params, call repo, shape response.

const repo = new InvoiceRepository();

// ─── Helper: parse pagination from query ─────────────────────────────────────

function parsePagination(query: any) {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20)),
  };
}

// ─── GET /subscriber/invoices ─────────────────────────────────────────────────
// Subscriber sees ALL invoices tied to their account (all beneficiaries included).

export const getSubscriberInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const subscriberId = req.userId!;
    const { status, invoiceType } = req.query as Record<string, string>;
    const { page, limit } = parsePagination(req.query);

    const result = await repo.findForSubscriber(subscriberId, { status, invoiceType, page, limit });

    res.json({
      success: true,
      data: result.invoices,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err: any) {
    console.error('[InvoicesController.getSubscriberInvoices]', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
};

// ─── GET /subscriber/invoices/:id ─────────────────────────────────────────────
// Subscriber fetches a single invoice (must belong to them).

export const getInvoiceById = async (req: AuthRequest, res: Response) => {
  try {
    const subscriberId = req.userId!;
    const { id } = req.params;

    const invoice = await repo.findOne(id, subscriberId);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (err: any) {
    console.error('[InvoicesController.getInvoiceById]', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
};

// ─── GET /subscriber/invoices/order/:orderId ─────────────────────────────────
// Looks up invoice by Razorpay orderId / paymentId / transactionId.

export const getInvoiceByOrderId = async (req: AuthRequest, res: Response) => {
  try {
    const subscriberId = req.userId!;
    const { orderId } = req.params;

    const invoice = await repo.findByOrderId(orderId, subscriberId);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found for this order' });
    }

    res.json({ success: true, data: invoice });
  } catch (err: any) {
    console.error('[InvoicesController.getInvoiceByOrderId]', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
};

// ─── GET /subscriber/invoices/:id/html ───────────────────────────────────────
// Returns printable HTML for a tax invoice (subscriber-scoped).

export const getInvoiceHtml = async (req: AuthRequest, res: Response) => {
  try {
    const subscriberId = req.userId!;
    const { id } = req.params;

    const invoice = await repo.findOne(id, subscriberId);

    if (!invoice) {
      return res.status(404).send('<h3>Invoice not found</h3>');
    }

    const configRows = await prisma.systemConfig.findMany({
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

    const configMap: Record<string, string> = {};
    for (const r of configRows) {
      configMap[r.key] = r.value;
    }

    const html = InvoiceHtmlRenderer.render(invoice, {
      name: configMap.COMPANY_NAME,
      address: configMap.COMPANY_ADDRESS,
      gstin: configMap.COMPANY_GSTIN,
      pan: configMap.COMPANY_PAN,
      cin: configMap.COMPANY_CIN,
      email: configMap.COMPANY_EMAIL,
      phone: configMap.COMPANY_PHONE,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    console.error('[InvoicesController.getInvoiceHtml]', err.message);
    res.status(500).send(`<h3>Error generating invoice: ${err.message}</h3>`);
  }
};

// ─── GET /subscriber/beneficiaries/:beneficiaryId/invoices ───────────────────
// Beneficiary view: ONLY invoices where beneficiaryId = param, AND subscriber owns that beneficiary.
// Called from beneficiaries.routes.ts

export const getBeneficiaryInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const subscriberId = req.userId!;
    const { beneficiaryId } = req.params;
    const { status } = req.query as Record<string, string>;
    const { page, limit } = parsePagination(req.query);

    const result = await repo.findForBeneficiary(beneficiaryId, subscriberId, { status, page, limit });

    res.json({
      success: true,
      data: result.invoices,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err: any) {
    console.error('[InvoicesController.getBeneficiaryInvoices]', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
};
