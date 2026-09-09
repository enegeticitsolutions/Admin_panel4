import { Router } from 'express';
import { authenticate } from '../shared/deps';
import * as invoicesController from '../../controllers/subscriber/invoices.controller';

const router = Router();

router.use(authenticate);

// Get all invoices for the subscriber
router.get('/', invoicesController.getSubscriberInvoices);

// Get a specific invoice by ID
router.get('/:id', invoicesController.getInvoiceById);

// Get printable HTML for invoice
router.get('/:id/html', invoicesController.getInvoiceHtml);

// Get invoice by order ID (Razorpay Order ID or Payment transaction ID)
router.get('/order/:orderId', invoicesController.getInvoiceByOrderId);

export default router;
