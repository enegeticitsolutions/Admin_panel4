import { Router } from 'express';
import { authenticate, validate } from '../shared/deps';
import { createBeneficiarySchema, updateBeneficiarySchema } from '../../schemas/beneficiary';
import * as beneficiaryController from '../../controllers/subscriber/beneficiary.controller';
import * as invoicesController from '../../controllers/subscriber/invoices.controller';
import multer from 'multer';

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDFs, Word documents, and images are allowed.`));
    }
  },
});

const router = Router();

// Beneficiaries
router.post('/', authenticate, validate(createBeneficiarySchema), beneficiaryController.createBeneficiary);
router.get('/subscriber/:subscriberId', authenticate, beneficiaryController.getSubscriberBeneficiaries);
router.get('/sathi-eligible', authenticate, beneficiaryController.getSathiEligibleBeneficiaries);
router.get('/:beneficiaryId/profile', authenticate, beneficiaryController.getBeneficiaryProfile);
router.get('/:beneficiaryId/pending-details', authenticate, beneficiaryController.getBeneficiaryPendingDetails);
router.put('/:beneficiaryId', authenticate, validate(updateBeneficiarySchema), beneficiaryController.updateBeneficiary);
router.delete('/:beneficiaryId', authenticate, beneficiaryController.deleteBeneficiary);

// Medical Records Management
router.post('/:beneficiaryId/medical-records/upload', authenticate, (req: any, res: any, next: any) => {
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('📄 [Medical Record Upload] Multer error:', err.message);
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, beneficiaryController.uploadMedicalRecord);
router.put('/medical-records/:recordId', authenticate, beneficiaryController.updateMedicalRecord);
router.delete('/medical-records/:recordId', authenticate, beneficiaryController.deleteMedicalRecord);

// Medication Management
router.post('/:beneficiaryId/medications', authenticate, beneficiaryController.addMedication);
router.delete('/medications/:medicationId', authenticate, beneficiaryController.deleteMedication);

// ─── Beneficiary Billing / Invoices ─────────────────────────────────────────
// Beneficiary sees ONLY invoices where beneficiaryId = :beneficiaryId
// subscriber auth ensures the beneficiary belongs to the logged-in user
router.get('/:beneficiaryId/invoices', authenticate, invoicesController.getBeneficiaryInvoices);
router.get('/:beneficiaryId/invoices/:invoiceId/html', authenticate, async (req: any, res: any) => {
  req.params.id = req.params.invoiceId;
  return invoicesController.getInvoiceHtml(req, res);
});

export default router;