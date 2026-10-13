import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { validate, authenticate, AuthRequest } from '../shared/deps';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../core/database';
import { RazorpayPayoutService } from '../../services/razorpay_payout_service';
import { volunteerAmazonRedeemSchema } from '../../schemas/sathi';
import {
  dispatchSaathiRedemptionRequested,
  dispatchSaathiAmazonPayoutSuccess,
  dispatchSaathiAmazonPayoutFailed,
} from '../../services/sathi/sathi-notification.dispatcher';

const router = Router();

/**
 * POST /api/sathi/redemptions/amazon
 * Initiates an Amazon Pay Gift Card Wallet Payout via RazorpayX.
 */
router.post(
  '/redemptions/amazon',
  authenticate,
  validate(volunteerAmazonRedeemSchema),
  async (req: AuthRequest, res: Response) => {
    const volunteerId = req.userId!;
    const { amount } = req.body; // INR value, e.g. 500

    const volunteer = await prisma.volunteer.findUnique({
      where: { id: volunteerId },
    });

    if (!volunteer) {
      throw new ApiError(404, 'Volunteer profile not found');
    }

    if (!volunteer.phone) {
      throw new ApiError(400, 'Volunteer profile must have a valid phone number for Amazon Pay wallet payouts');
    }

    // Check if volunteer already has a pending or in-flight payout
    const existingActiveRedemption = await prisma.volunteerRedemption.findFirst({
      where: {
        volunteerId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (existingActiveRedemption) {
      throw new ApiError(
        400,
        'You already have an Amazon Pay redemption in progress. Please wait for it to complete.'
      );
    }

    // Resolve conversion rate from SystemConfig (default: 10 INR per point)
    const configRate = await prisma.systemConfig.findUnique({
      where: { key: 'VOLUNTEER_CREDIT_CONVERSION_RATE' },
    });
    const conversionRate = configRate ? parseFloat(configRate.value) || 10 : 10;
    const creditsNeeded = Math.ceil(amount / conversionRate);

    if (volunteer.totalCreditPoints < creditsNeeded) {
      throw new ApiError(
        400,
        `Insufficient credit points. You need ${creditsNeeded} points for ₹${amount}, but have ${volunteer.totalCreditPoints.toFixed(0)} points available.`
      );
    }

    const redemptionId = crypto.randomUUID();
    // Razorpay requires idempotency key to be <= 36 characters. UUID is exactly 36 characters.
    const idempotencyKey = redemptionId;

    // Step 1: Atomically deduct credits and record PENDING redemption
    const dbResult = await prisma.$transaction(async (tx) => {
      const vol = await tx.volunteer.findUnique({
        where: { id: volunteerId },
      });

      if (!vol || vol.totalCreditPoints < creditsNeeded) {
        throw new ApiError(400, 'Insufficient credit balance');
      }

      const newBalance = vol.totalCreditPoints - creditsNeeded;

      await tx.volunteer.update({
        where: { id: volunteerId },
        data: { totalCreditPoints: newBalance },
      });

      const creditTx = await tx.volunteerCreditTransaction.create({
        data: {
          volunteerId,
          type: 'redeemed',
          minutesDelta: 0,
          pointsDelta: -creditsNeeded,
          balanceAfter: newBalance,
          description: `Amazon Pay Gift Card Redemption (₹${amount})`,
        },
      });

      const redemption = await tx.volunteerRedemption.create({
        data: {
          id: redemptionId,
          volunteerId,
          type: 'AMAZON_PAY_GIFT_CARD',
          amount,
          creditsUsed: creditsNeeded,
          currency: 'INR',
          status: 'PENDING',
          idempotencyKey,
        },
      });

      return { newBalance, creditTx, redemption };
    });

    // Step 2: Communicate with RazorpayX
    let contactId: string;
    let fundAccountId: string;
    let payoutResult: any;

    try {
      contactId = await RazorpayPayoutService.getOrCreateContact(volunteer);
      fundAccountId = await RazorpayPayoutService.createAmazonFundAccount(contactId, volunteer.phone);
      payoutResult = await RazorpayPayoutService.initiateAmazonPayout({
        fundAccountId,
        amountInRupees: amount,
        idempotencyKey,
        notes: {
          volunteerId,
          volunteerName: volunteer.name,
          redemptionId,
        },
      });

      const isImmediateSuccess = payoutResult.status === 'processed';

      // Update redemption record with Razorpay identifiers
      const updatedRedemption = await prisma.volunteerRedemption.update({
        where: { id: redemptionId },
        data: {
          razorpayContactId: contactId,
          razorpayFundAccountId: fundAccountId,
          razorpayPayoutId: payoutResult.id,
          status: isImmediateSuccess ? 'SUCCESS' : 'PROCESSING',
          completedAt: isImmediateSuccess ? new Date() : null,
        },
      });

      // Dispatch notification
      dispatchSaathiRedemptionRequested(volunteerId, {
        volunteerName: volunteer.name,
        credits: creditsNeeded,
        giftCardBrand: 'Amazon Pay',
      }).catch((err) => console.warn('[Amazon Payout ST-031 Warning]:', err.message));

      if (isImmediateSuccess) {
        dispatchSaathiAmazonPayoutSuccess(volunteerId, {
          amount,
          credits: creditsNeeded,
          recipientContact: volunteer.phone,
          payoutId: payoutResult.id,
        }).catch((err) => console.warn('[Amazon Payout Success Warning]:', err.message));
      }

      res.status(200).json(
        new ApiResponse(
          200,
          {
            redemption: updatedRedemption,
            balance: dbResult.newBalance,
            message: `Amazon Pay redemption of ₹${amount} is being processed.`,
          },
          'Redemption initiated successfully'
        )
      );
    } catch (payoutError: any) {
      console.error('[Amazon Payout Initiation Failure]:', payoutError.message);

      // Rollback credits atomically
      await prisma.$transaction(async (tx) => {
        await tx.volunteer.update({
          where: { id: volunteerId },
          data: { totalCreditPoints: { increment: creditsNeeded } },
        });

        await tx.volunteerCreditTransaction.create({
          data: {
            volunteerId,
            type: 'adjustment',
            minutesDelta: 0,
            pointsDelta: creditsNeeded,
            balanceAfter: volunteer.totalCreditPoints,
            description: `Amazon Pay redemption failed — credits refunded`,
          },
        });

        await tx.volunteerRedemption.update({
          where: { id: redemptionId },
          data: {
            status: 'FAILED',
            failureReason: payoutError.message || 'Provider payout initiation failed',
          },
        });
      }).catch((rollbackErr) => {
        console.error('[Amazon Payout Critical Rollback Error]:', rollbackErr.message);
      });

      throw new ApiError(
        400,
        payoutError.message || 'Unable to initiate Amazon Pay payout with provider. Your credits have been restored.'
      );
    }
  }
);

/**
 * GET /api/sathi/redemptions
 * Fetches payout redemptions for the authenticated volunteer.
 */
router.get('/redemptions', authenticate, async (req: AuthRequest, res: Response) => {
  const volunteerId = req.userId!;

  const redemptions = await prisma.volunteerRedemption.findMany({
    where: { volunteerId },
    orderBy: { createdAt: 'desc' },
  });

  res.json(new ApiResponse(200, redemptions, 'Redemption history retrieved'));
});

/**
 * POST /api/sathi/webhooks/razorpay-payout
 * Dedicated webhook endpoint for RazorpayX Payout events.
 */
router.post('/webhooks/razorpay-payout', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // 1. Signature Verification
  const isValid = RazorpayPayoutService.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.warn('[RazorpayX Webhook Signature Invalid]: Rejected incoming event');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const { event, payload: eventPayload, id: eventId } = req.body;
  const payout = eventPayload?.payout?.entity || eventPayload?.payout;

  if (!payout || !payout.id) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const razorpayPayoutId = payout.id;

  // 2. Locate matching redemption record
  const redemption = await prisma.volunteerRedemption.findFirst({
    where: {
      OR: [
        { razorpayPayoutId },
        { id: payout.notes?.redemptionId },
        { idempotencyKey: payout.notes?.redemptionId },
      ],
    },
    include: { volunteer: true },
  });

  if (!redemption) {
    console.warn(`[RazorpayX Webhook]: No VolunteerRedemption found for payout ${razorpayPayoutId}`);
    return res.status(200).json({ received: true, not_found: true });
  }

  // Idempotency: skip if event was already processed
  if (redemption.razorpayEventId === eventId) {
    return res.status(200).json({ received: true, already_processed: true });
  }

  // 3. Handle Events
  try {
    if (event === 'payout.processed') {
      if (redemption.status !== 'SUCCESS') {
        await prisma.volunteerRedemption.update({
          where: { id: redemption.id },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            razorpayEventId: eventId,
          },
        });

        if (redemption.volunteer) {
          dispatchSaathiAmazonPayoutSuccess(redemption.volunteerId, {
            amount: redemption.amount,
            credits: redemption.creditsUsed,
            recipientContact: redemption.volunteer.phone,
            payoutId: razorpayPayoutId,
          }).catch((err) => console.warn('[Webhook ST-033 Error]:', err.message));
        }
      }
    } else if (event === 'payout.reversed' || event === 'payout.failed') {
      if (redemption.status !== 'FAILED') {
        const failureReason =
          payout.failure_reason ||
          payout.status_details?.description ||
          `Payout ${event === 'payout.reversed' ? 'reversed' : 'failed'}`;

        await prisma.$transaction(async (tx) => {
          await tx.volunteerRedemption.update({
            where: { id: redemption.id },
            data: {
              status: 'FAILED',
              failureReason,
              razorpayEventId: eventId,
            },
          });

          // Refund credits to volunteer
          const vol = await tx.volunteer.update({
            where: { id: redemption.volunteerId },
            data: { totalCreditPoints: { increment: redemption.creditsUsed } },
          });

          await tx.volunteerCreditTransaction.create({
            data: {
              volunteerId: redemption.volunteerId,
              type: 'adjustment',
              minutesDelta: 0,
              pointsDelta: redemption.creditsUsed,
              balanceAfter: vol.totalCreditPoints,
              description: `Amazon Pay payout ${event === 'payout.reversed' ? 'reversed' : 'failed'} — credits refunded`,
            },
          });
        });

        dispatchSaathiAmazonPayoutFailed(redemption.volunteerId, {
          amount: redemption.amount,
          credits: redemption.creditsUsed,
          reason: failureReason,
        }).catch((err) => console.warn('[Webhook ST-034 Error]:', err.message));
      }
    }
  } catch (handlerErr: any) {
    console.error(`[RazorpayX Webhook Handling Error for ${razorpayPayoutId}]:`, handlerErr.message);
  }

  return res.status(200).json({ received: true });
});

export default router;
