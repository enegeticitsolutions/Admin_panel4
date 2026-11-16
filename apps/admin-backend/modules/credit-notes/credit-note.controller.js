const creditNoteService = require('./credit-note.service');
const { prisma } = require('../../lib/prisma');
const { renderCreditNoteHtml } = require('@maihoonna/billing');

/**
 * GET /api/invoices/:id/refund-details
 * Returns current payment, previous credit notes, and remaining refundable amount for an invoice.
 */
async function getRefundDetails(req, res) {
  try {
    const { id } = req.params;
    const details = await creditNoteService.getInvoiceRefundDetails(id);
    res.json({
      success: true,
      data: details,
    });
  } catch (err) {
    console.error('[CreditNoteController] getRefundDetails error:', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * POST /api/invoices/:id/credit-notes
 * Issues a statutory Credit Note and initiates refund (Razorpay online or manual UTR).
 */
async function issueCreditNote(req, res) {
  try {
    const { id: invoiceId } = req.params;
    const { amount, refundMode, manualReference, reason, notes, cancelSubscription } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive refund amount is required',
      });
    }

    const creditNote = await creditNoteService.issueCreditNote({
      invoiceId,
      amount: parseFloat(amount),
      refundMode: refundMode || 'GATEWAY_ONLINE',
      manualReference,
      reason: reason || 'Customer requested refund',
      notes,
      cancelSubscription: Boolean(cancelSubscription),
    });

    res.status(201).json({
      success: true,
      message: `Credit Note ${creditNote.creditNoteNumber} issued successfully`,
      data: creditNote,
    });
  } catch (err) {
    console.error('[CreditNoteController] issueCreditNote error:', err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET /api/credit-notes
 * Lists all credit notes with search and pagination.
 */
async function listCreditNotes(req, res) {
  try {
    const { page, limit, search, invoiceId, subscriberId } = req.query;
    const result = await creditNoteService.listCreditNotes({
      page,
      limit,
      search,
      invoiceId,
      subscriberId,
    });

    res.json({
      success: true,
      data: result.creditNotes,
      pagination: result.pagination,
    });
  } catch (err) {
    console.error('[CreditNoteController] listCreditNotes error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * GET /api/credit-notes/:id
 * Fetches single credit note details.
 */
async function getCreditNoteById(req, res) {
  try {
    const { id } = req.params;
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        invoice: true,
        subscriber: true,
        beneficiary: true,
        subscription: true,
        payment: true,
      },
    });

    if (!creditNote) {
      return res.status(404).json({ success: false, message: 'Credit Note not found' });
    }

    res.json({ success: true, data: creditNote });
  } catch (err) {
    console.error('[CreditNoteController] getCreditNoteById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/credit-notes/:id/pdf-url
 * Returns signed download URL for Credit Note PDF.
 */
async function getCreditNotePdfUrl(req, res) {
  try {
    const { id } = req.params;
    const { downloadUrl, fileName } = await creditNoteService.getCreditNotePdfUrl(id);

    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName,
      },
    });
  } catch (err) {
    console.error('[CreditNoteController] getCreditNotePdfUrl error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/credit-notes/:id/html
 * Returns statutory HTML string preview for a credit note.
 */
async function getCreditNoteHtml(req, res) {
  try {
    const { id } = req.params;
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        invoice: true,
        subscriber: true,
        beneficiary: true,
      },
    });

    if (!creditNote) {
      return res.status(404).send('Credit Note not found');
    }

    const company = await creditNoteService.getCompanyDetails();
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

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[CreditNoteController] getCreditNoteHtml error:', err);
    res.status(500).send(`Error rendering Credit Note: ${err.message}`);
  }
}

module.exports = {
  getRefundDetails,
  issueCreditNote,
  listCreditNotes,
  getCreditNoteById,
  getCreditNotePdfUrl,
  getCreditNoteHtml,
};
