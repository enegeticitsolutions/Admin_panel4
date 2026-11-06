import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import prisma from '../../../core/database';

/**
 * Layer 2: Dedicated Rate Limiter for Public Website Forms
 * Restricts an IP to maximum 5 form submissions per 15-minute window.
 */
export const websiteFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 form submissions per window
  message: {
    success: false,
    message: 'You have submitted too many requests recently. Please wait a few minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return ipKeyGenerator(req.ip || '');
  },
}) as unknown as RequestHandler;

/**
 * Layer 3: Invisible Honeypot Trap
 * Bots blindly populate all input fields. If an invisible bot-trap field contains
 * any value, silently return HTTP 200 without writing to DB or syncing to Zoho.
 */
export const honeypotCheck = (req: Request, res: Response, next: NextFunction): void => {
  const honeypotField =
    req.body?.b_address_check ||
    req.body?.fax_number ||
    req.body?.hp_code ||
    req.body?.bot_field;

  if (honeypotField && typeof honeypotField === 'string' && honeypotField.trim().length > 0) {
    console.warn(`🤖 [Bot Trap Triggered] Spam submission blocked from IP: ${req.ip}`);
    // Silently return success to fool the bot without doing any work
    res.status(200).json({
      success: true,
      message: 'Thank you! Your inquiry has been received.',
    });
    return;
  }
  next();
};

/**
 * Layer 4: Business Logic Deduplication
 * Checks if a lead with the given phone number or email was already received
 * in the last `windowHours` (default 2 hours).
 *
 * @param phone Normalized phone number (or raw phone)
 * @param email Email address (optional)
 * @param windowHours Cooldown duration in hours (default 2)
 * @returns true if recent duplicate exists, false otherwise
 */
export async function isRecentDuplicateLead(
  phone: string,
  email?: string,
  windowHours = 2
): Promise<boolean> {
  try {
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const normalized = phone.replace(/\D/g, '').slice(-10);

    const conditions: any[] = [];
    if (normalized.length >= 10) {
      conditions.push({ phone: { contains: normalized } });
    }
    if (email && email.trim()) {
      conditions.push({ email: { equals: email.trim(), mode: 'insensitive' } });
    }

    if (conditions.length === 0) return false;

    const existing = await (prisma as any).marketingLead.findFirst({
      where: {
        AND: [
          { createdAt: { gte: cutoffTime } },
          { OR: conditions },
        ],
      },
      select: { id: true, createdAt: true },
    });

    return !!existing;
  } catch (err: any) {
    console.warn('⚠️ [Deduplication Check] DB query note:', err.message);
    return false; // Fail open to avoid blocking legitimate users on DB read hiccup
  }
}