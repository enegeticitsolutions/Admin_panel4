import { Router, Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { validate, authenticate } from '../shared/deps';
import { sendOtpSchema, verifyOtpSchema, checkLocationSchema, registerPasswordSchema, loginPasswordSchema } from '../../schemas/auth';
import * as authService from '../../services/auth/auth_service';
import { sendEmailVerificationOtp, verifyEmailOtp } from '../../services/auth/email_verification_service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';

import { isBypassPhone } from '../../core/otp/otp_bypass';

const router = Router();

// Rate Limiter for OTP Requests (max 10 requests per 15 mins per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OTP requests per window
  message: { success: false, message: 'Too many OTP requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const raw = (req.body?.phone || '').toString();
    return isBypassPhone(raw);
  },
});

// Rate Limiter for Password Logins (e.g., max 10 requests per 15 mins per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 password login attempts per window
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const raw = (req.body?.phone || '').toString();
    return isBypassPhone(raw);
  },
});


router.post('/send-otp', otpLimiter as unknown as RequestHandler, validate(sendOtpSchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.sendOtp(req.body.phone);
  res.json(new ApiResponse(200, result, 'OTP sent successfully'));
}));

router.post('/verify-otp', otpLimiter as unknown as RequestHandler, validate(verifyOtpSchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyOtp(req.body.phone, req.body.otp);
  res.json(new ApiResponse(200, result, 'OTP verified successfully'));
}));

router.post('/check-location', validate(checkLocationSchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.checkLocation(req.body.location);
  res.json(new ApiResponse(200, result, 'Location check completed'));
}));

router.post('/register-password', loginLimiter as unknown as RequestHandler, validate(registerPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { phone, name, age, password, email, location, latitude, longitude, pincode } = req.body;
  const result = await authService.registerWithPassword(phone, name, age, password, email, location, latitude, longitude, pincode);
  res.json(new ApiResponse(201, result, 'Registration successful'));
}));

// POST /auth/register-otp — Production / OTP-only registration completion
// Phone is already verified; we only need name + age (no password stored)
router.post('/register-otp', loginLimiter as unknown as RequestHandler, asyncHandler(async (req: Request, res: Response) => {
  const { phone, name, age, email, location, latitude, longitude, pincode } = req.body;
  if (!phone || !name || !age) {
    res.status(400).json(new ApiResponse(400, null, 'phone, name, and age are required'));
    return;
  }
  const result = await authService.registerWithOtp(phone, name, Number(age), email, location, latitude, longitude, pincode);
  res.json(new ApiResponse(201, result, 'Registration successful'));
}));

router.post('/login-password', loginLimiter as unknown as RequestHandler, validate(loginPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const result = await authService.loginWithPassword(phone, password);
  res.json(new ApiResponse(200, result, 'Login successful'));
}));

router.post('/change-password', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.changePassword((req as any).userId, req.body);
  res.json(new ApiResponse(200, result, 'Password changed successfully'));
}));

// POST /api/auth/send-email-otp
router.post('/send-email-otp', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await sendEmailVerificationOtp(email);
  res.json(new ApiResponse(200, result, result.message));
}));

import { decodeToken } from '../../core/security';

// POST /api/auth/verify-email-otp
router.post('/verify-email-otp', asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const authHeader = req.headers.authorization;
  let userId: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = decodeToken(token);
    if (decoded) {
      userId = decoded.sub; // token payload uses sub for ID
    }
  }
  const result = await verifyEmailOtp(email, otp, userId);
  res.json(new ApiResponse(200, result, result.message));
}));

/**
 * POST /api/auth/switch-role
 *
 * Allows a dual-role user (subscriber who is also their own beneficiary) to
 * switch active session role without logging out. Requires a valid JWT.
 * Body: { targetRole: 'subscriber' | 'beneficiary' }
 */
router.post('/switch-role', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { targetRole } = req.body;
  if (!targetRole || !['subscriber', 'beneficiary'].includes(targetRole)) {
    res.status(400).json(new ApiResponse(400, null, "targetRole must be 'subscriber' or 'beneficiary'"));
    return;
  }
  const result = await authService.switchRole((req as any).userId, targetRole as 'subscriber' | 'beneficiary');
  res.json(new ApiResponse(200, result, result.message));
}));

export default router;