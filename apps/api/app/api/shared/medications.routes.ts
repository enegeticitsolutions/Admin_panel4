import { Router, Request, Response } from 'express';
import { authenticate, validate } from './deps';
import { createMedicationSchema, updateMedicationSchema, createAdherenceSchema } from '../../schemas/medication';
import * as medicationService from '../../services/shared/medication_service';

const router = Router();

/**
 * GET /api/shared/medications/presets
 * Returns curated common medication presets (BP, Diabetes, Acidity, etc.) for quick selection.
 */
router.get('/presets', (req: Request, res: Response) => {
  const presets = medicationService.getMedicationPresets();
  res.json({ success: true, data: presets });
});

router.get('/beneficiary/:beneficiaryId', authenticate, async (req: Request, res: Response) => {
  try {
    const meds = await medicationService.getBeneficiaryMedications(req.params.beneficiaryId as string);
    res.json({ success: true, data: meds });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authenticate, validate(createMedicationSchema), async (req: Request, res: Response) => {
  try {
    const med = await medicationService.createMedication(req.body);
    res.status(201).json({ success: true, data: med });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authenticate, validate(updateMedicationSchema), async (req: Request, res: Response) => {
  try {
    const med = await medicationService.updateMedication(req.params.id as string, req.body);
    res.json({ success: true, data: med });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await medicationService.deleteMedication(req.params.id as string);
    res.json({ success: true, message: 'Medication removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/adherence', authenticate, validate(createAdherenceSchema), async (req: Request, res: Response) => {
  const record = await medicationService.createAdherenceRecord(req.body);
  res.status(201).json({ success: true, data: record });
});

/**
 * GET /api/shared/medications/beneficiary/:beneficiaryId/today
 * Returns today's personalized medicine schedules.
 */
router.get('/beneficiary/:beneficiaryId/today', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await medicationService.getTodayMedications(req.params.beneficiaryId as string);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/shared/medications/adherence/log
 * Registers if a medication has been checked off or missed, updating all calculations.
 */
router.post('/adherence/log', authenticate, async (req: Request, res: Response) => {
  try {
    const { beneficiaryId, medicationId, scheduledTimeIso, taken, recordedBy } = req.body;
    if (!beneficiaryId || !medicationId || !scheduledTimeIso || taken === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required body elements' });
    }
    const result = await medicationService.logAdherence(
      beneficiaryId,
      medicationId,
      scheduledTimeIso,
      taken,
      recordedBy || 'system'
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/shared/medications/beneficiary/:beneficiaryId/metrics
 * Returns global summary statistics (average, taken, missed counts).
 */
router.get('/beneficiary/:beneficiaryId/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const metrics = await medicationService.getMedicationMetrics(req.params.beneficiaryId as string);
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
