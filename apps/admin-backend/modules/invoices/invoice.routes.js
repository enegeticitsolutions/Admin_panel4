const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');
const creditNoteController = require('../credit-notes/credit-note.controller');
const upload = require('../../middleware/upload');

// Refund & Credit Note routes for specific invoice (must precede /:id actions)
router.get('/:id/refund-details', creditNoteController.getRefundDetails);
router.post('/:id/credit-notes', creditNoteController.issueCreditNote);

// Counter routes (must precede /:id)
router.get('/counter', invoiceController.getInvoiceCounter);
router.post('/counter', invoiceController.updateInvoiceCounter);

// GET /api/invoices
router.get('/', invoiceController.listInvoices);

// Summary & Export reporting routes (must precede /:id)
router.get('/summary', invoiceController.getInvoiceSummary);
router.get('/export', invoiceController.exportInvoicesCsv);
router.get('/download-zip', invoiceController.downloadInvoicesZip);

// POST /api/invoices (Create manual invoice / attach invoice with optional PDF)
router.post('/', upload.single('pdf'), invoiceController.createInvoice);

// POST /api/invoices/direct-attach-pdf (Direct 1-click PDF upload & link)
router.post('/direct-attach-pdf', upload.single('pdf'), invoiceController.directAttachPdf);

// GET /api/invoices/:id
router.get('/:id', invoiceController.getInvoiceById);

// GET /api/invoices/:id/html
router.get('/:id/html', invoiceController.getInvoiceHtml);

// GET /api/invoices/:id/pdf-url
router.get('/:id/pdf-url', invoiceController.getInvoicePdfUrl);

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', invoiceController.downloadInvoicePdf);

// POST /api/invoices/:id/pdf (Attach / replace PDF file)
router.post('/:id/pdf', upload.single('pdf'), invoiceController.uploadInvoicePdf);

// DELETE /api/invoices/:id/pdf (Delete PDF attachment only)
router.delete('/:id/pdf', invoiceController.deleteInvoicePdf);

// DELETE /api/invoices/:id (Delete entire invoice record)
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;

