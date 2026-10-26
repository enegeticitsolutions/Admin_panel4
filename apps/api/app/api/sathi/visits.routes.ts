import { Router, Response } from 'express';
import { validate, authenticate, AuthRequest } from '../shared/deps';
import { ApiResponse } from '../../utils/ApiResponse';
import * as sathiService from '../../services/sathi/sathi_service';
import {
  volunteerCheckinSchema,
  volunteerCheckoutSchema,
  volunteerRedeemSchema,
  volunteerLocationUpdateSchema,
} from '../../schemas/sathi';

const router = Router();

router.post('/location', authenticate, validate(volunteerLocationUpdateSchema), async (req: AuthRequest, res: Response) => {
  const updated = await sathiService.updateVolunteerLocation(req.userId!, req.body.latitude, req.body.longitude);
  res.json(new ApiResponse(200, updated, 'Live location updated successfully'));
});

router.post('/visits/checkin', authenticate, validate(volunteerCheckinSchema), async (req: AuthRequest, res: Response) => {
  const visitLog = await sathiService.checkinVolunteerVisit(req.userId!, req.body);
  res.status(201).json(new ApiResponse(201, visitLog, 'Checked in successfully'));
});

router.patch('/visits/:id/checkout', authenticate, validate(volunteerCheckoutSchema), async (req: AuthRequest, res: Response) => {
  const { result, message } = await sathiService.checkoutVolunteerVisit(req.userId!, req.params.id as string, req.body.notes);
  res.json(new ApiResponse(200, result, message));
});

router.patch('/visits/:id/feedback', authenticate, async (req: AuthRequest, res: Response) => {
  const updated = await sathiService.updateVolunteerVisitFeedback(req.userId!, req.params.id as string, req.body.feedback);
  res.json(new ApiResponse(200, updated, 'Feedback submitted successfully'));
});

router.get('/hours', authenticate, async (req: AuthRequest, res: Response) => {
  const logs = await sathiService.getVolunteerVisitLogs(req.userId!);
  res.json(new ApiResponse(200, logs));
});

router.get('/credits', authenticate, async (req: AuthRequest, res: Response) => {
  const txs = await sathiService.getVolunteerCreditTransactions(req.userId!);
  res.json(new ApiResponse(200, txs));
});

router.get('/credits/summary', authenticate, async (req: AuthRequest, res: Response) => {
  const summary = await sathiService.getVolunteerCreditSummary(req.userId!);
  res.json(new ApiResponse(200, summary));
});

router.post('/credits/redeem', authenticate, validate(volunteerRedeemSchema), async (req: AuthRequest, res: Response) => {
  const result = await sathiService.redeemVolunteerCredits(req.userId!, req.body);
  res.json(new ApiResponse(200, result, result.message));
});

router.post('/credits/coupons/validate', authenticate, async (req: AuthRequest, res: Response) => {
  const result = await sathiService.validateVolunteerCoupon(req.body.code);
  res.json(new ApiResponse(200, result, result.message));
});

router.post('/credits/coupons/claim', authenticate, async (req: AuthRequest, res: Response) => {
  const result = await sathiService.claimVolunteerCoupon(req.body.code, req.userId);
  res.json(new ApiResponse(200, result, result.message));
});

export default router;
