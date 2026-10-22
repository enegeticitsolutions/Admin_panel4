const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');

// GET /api/invoices
router.get('/', invoiceController.listInvoices);

// GET /api/invoices/:id
router.get('/:id', invoiceController.getInvoiceById);

// GET /api/invoices/:id/html
router.get('/:id/html', invoiceController.getInvoiceHtml);

// GET /api/invoices/:id/pdf-url
router.get('/:id/pdf-url', invoiceController.getInvoicePdfUrl);

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', invoiceController.downloadInvoicePdf);

module.exports = router;
