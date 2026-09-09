const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');

// GET /api/invoices
router.get('/', invoiceController.listInvoices);

// GET /api/invoices/:id
router.get('/:id', invoiceController.getInvoiceById);

// GET /api/invoices/:id/html
router.get('/:id/html', invoiceController.getInvoiceHtml);

module.exports = router;
