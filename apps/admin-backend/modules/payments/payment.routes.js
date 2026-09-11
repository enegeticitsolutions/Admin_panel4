const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const { verifyToken, authorizeRoles } = require('../../middleware/auth');

const staffOnly = [verifyToken, authorizeRoles('master_admin', 'admin', 'operations_manager', 'customer_service', 'sales')];
const financeAdmins = [verifyToken, authorizeRoles('master_admin', 'admin', 'operations_manager')];

// ── Payment Routes ────────────────────────────────────────────────────────────

// Public webhook receiver (verifies HMAC SHA-256 signature in service)
router.post('/webhook', paymentController.handleWebhook);

// Public status poll for checkout screen
router.get('/status/:orderId', paymentController.getStatus);

// Protected administrative payment operations
router.post('/generate-link', staffOnly, paymentController.generateLink);
router.post('/:id/mark-offline', financeAdmins, paymentController.markOffline);

// Payment simulation strictly restricted to development/staging testing
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_PAYMENTS === 'true') {
  router.post('/simulate-pay/:orderId', financeAdmins, paymentController.simulatePay);
}

module.exports = router;
