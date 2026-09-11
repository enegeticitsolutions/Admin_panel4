import { Router, Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { validate, authenticate, AuthRequest } from '../shared/deps';
import { ApiResponse } from '../../utils/ApiResponse';
import * as sathiService from '../../services/sathi/sathi_service';
import {
  volunteerRegisterSchema,
  volunteerLoginSchema,
  volunteerRegisterOtpSchema
} from '../../schemas/sathi';
import { sendOtpSchema, verifyOtpSchema } from '../../schemas/auth';

import { isBypassPhone } from '../../core/otp/otp_bypass';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const raw = (req.body?.phone || '').toString();
    return isBypassPhone(raw);
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const raw = (req.body?.phone || '').toString();
    return isBypassPhone(raw);
  },
});

// ─── Password Onboarding ─────────────────────────────────────────────────────

router.post('/auth/register', loginLimiter as unknown as RequestHandler, validate(volunteerRegisterSchema), async (req: Request, res: Response) => {
  const result = await sathiService.registerVolunteer(req.body);
  res.status(201).json(new ApiResponse(201, result, 'Volunteer registered successfully.'));
});

router.post('/auth/register-otp', loginLimiter as unknown as RequestHandler, validate(volunteerRegisterOtpSchema), async (req: Request, res: Response) => {
  const result = await sathiService.registerVolunteerWithOtp(req.body);
  res.status(201).json(new ApiResponse(201, result, 'Volunteer registered successfully.'));
});

router.post('/auth/login', loginLimiter as unknown as RequestHandler, validate(volunteerLoginSchema), async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const result = await sathiService.loginVolunteer(phone, password);
  res.json(new ApiResponse(200, result, 'Login successful'));
});

// ─── OTP Login ───────────────────────────────────────────────────────────────

router.post('/auth/send-otp', otpLimiter as unknown as RequestHandler, validate(sendOtpSchema), async (req: Request, res: Response) => {
  const result = await sathiService.sendVolunteerOtp(req.body.phone);
  res.json(new ApiResponse(200, result, 'OTP sent successfully'));
});

router.post('/auth/verify-otp', otpLimiter as unknown as RequestHandler, validate(verifyOtpSchema), async (req: Request, res: Response) => {
  const result = await sathiService.verifyVolunteerOtp(req.body.phone, req.body.otp);
  res.json(new ApiResponse(200, result, 'OTP verified successfully'));
});

// ─── Reapply Onboarding ──────────────────────────────────────────────────────

router.post('/auth/reapply', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const volunteer = await sathiService.getVolunteerProfile(userId);

  const cooldownDays = parseInt(await sathiService.getSystemConfig('sathi_reapply_cooldown_days', '30'), 10);
  if (volunteer.applicationStatus === 'REJECTED' && volunteer.rejectedAt) {
    const allowedDate = new Date(volunteer.rejectedAt);
    allowedDate.setDate(allowedDate.getDate() + cooldownDays);
    if (new Date() < allowedDate) {
      return res.status(400).json(
        new ApiResponse(
          400,
          null,
          `Re-application cooldown is active. You can re-apply after ${allowedDate.toLocaleDateString()}.`
        )
      );
    }
  }

  const updated = await sathiService.updateVolunteerProfile(userId, {
    applicationStatus: 'UNDER_REVIEW',
    rejectedAt: null,
  });

  res.json(new ApiResponse(200, updated, 'Reapplied successfully. Profile is under review.'));
});

export default router;
