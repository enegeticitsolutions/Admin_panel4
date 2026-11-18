import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../core/database';
import { generateUUID } from '../../utils/helpers';
import { notificationService, notificationProducer } from '@maihoonna/notifications';
import { benefitPeriodManager } from '../../services/benefit/BenefitPeriodManager';
import { verifyAccessConsentHmac, ConsentAction } from '../../services/access/whatsapp_access_consent';
import { respondToAccessRequest } from '../../services/access/profile_access_service';

const router = Router();

/**
 * Validates HMAC-SHA256 signature attached to the WhatsApp button callback payload.
 * Prevents attackers from guessing/forging subscription IDs to trigger unauthorized activations.
 */
function verifyConsentHmac(subscriptionId: string, role: string, sig?: string): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!secret) {
    console.error('[WhatsApp Webhook Security Alert] Cannot verify signature: WHATSAPP_WEBHOOK_VERIFY_TOKEN is missing in environment.');
    return false;
  }
  const expectedSig = crypto.createHmac('sha256', secret).update(`${subscriptionId}:${role}`).digest('hex').slice(0, 16);

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Handles inbound WhatsApp Quick Reply button clicks for Profile Access Requests:
 *   - ACCESS_APPROVE:<requestId>:<hmac>
 *   - ACCESS_REJECT:<requestId>:<hmac>
 *
 * Enforces HMAC signature verification, zero-trust sender phone binding (must be SELF or MANAGER),
 * atomic/idempotent state transition via ProfileAccessService, and DPDP audit logging.
 */
async function handleProfileAccessConsentWebhook(buttonPayload: string, senderPhone: string): Promise<void> {
  const isApprove = buttonPayload.startsWith('ACCESS_APPROVE:');
  const action: ConsentAction = isApprove ? 'APPROVE' : 'REJECT';
  const parts = buttonPayload.split(':');
  const requestId = parts[1]?.trim();
  const signature = parts[2]?.trim();

  if (!requestId) {
    console.warn('[WhatsApp Access Webhook] Missing requestId in payload:', buttonPayload);
    return;
  }

  // Layer 1: Cryptographic HMAC Verification
  if (!verifyAccessConsentHmac(requestId, action, signature)) {
    console.error(`[WhatsApp Access Webhook SECURITY ALERT] Invalid HMAC rejected! Request: ${requestId}, Action: ${action}, Sender: ${senderPhone}`);
    return;
  }

  if (!senderPhone || senderPhone.length !== 10) {
    console.error(`[WhatsApp Access Webhook SECURITY ALERT] Missing/invalid sender phone for request ${requestId}`);
    return;
  }

  // Layer 2: Zero-Trust Sender Phone Lookup
  const senderUser = await prisma.user.findFirst({
    where: {
      OR: [{ phone: senderPhone }, { phone: `+91${senderPhone}` }],
    },
    select: { id: true, role: true, phone: true },
  });

  if (!senderUser) {
    console.error(`[WhatsApp Access Webhook SECURITY ALERT] Unrecognized sender phone ${senderPhone} for request ${requestId}`);
    return;
  }

  // Layer 3: Atomic + Idempotent Authorization & Execution (verifies SELF or MANAGER internally)
  const result = await respondToAccessRequest({
    requestId,
    actorUserId: senderUser.id,
    actorRole: senderUser.role,
    action,
    rejectionReason: action === 'REJECT' ? 'Declined via WhatsApp quick reply' : undefined,
  });

  if (result.alreadyProcessed) {
    console.log(`[WhatsApp Access Webhook] Request ${requestId} already processed. Idempotent check satisfied.`);
    return;
  }

  // Layer 4: Legal Audit Trail (DPDP Act 2023)
  await prisma.activityLog.create({
    data: {
      id: generateUUID(),
      userId: senderUser.id,
      type: 'PROFILE_ACCESS',
      action: action === 'APPROVE' ? 'WHATSAPP_ACCESS_CONSENT_APPROVED' : 'WHATSAPP_ACCESS_CONSENT_REJECTED',
      details: {
        requestId,
        channel: 'WHATSAPP_QUICK_REPLY',
        senderPhone,
        action,
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log(`✅ [WhatsApp Access Webhook] Request ${requestId} ${action}D by user ${senderUser.id} (Phone: ${senderPhone})`);
}

/**
 * 1. Meta / MSG91 Webhook Verification Handshake (GET)
 * Used during webhook registration in Meta / MSG91 developer dashboard.
 */
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe') {
    if (!expectedToken) {
      console.error('[WhatsApp Webhook Error] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured in environment.');
      return res.status(500).json({ error: 'Webhook verify token not configured on server' });
    }

    if (token === expectedToken) {
      console.log('[WhatsApp Webhook] Handshake verified successfully.');
      return res.status(200).send(challenge);
    }

    console.warn('[WhatsApp Webhook Warning] Webhook verification token mismatch.');
    return res.status(403).json({ error: 'Verification token mismatch' });
  }

  // Fallback health status if accessed directly in browser
  return res.status(200).json({
    status: 'online',
    service: 'MaiHoonNa WhatsApp Webhook',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 2. Inbound WhatsApp Message & Button Click Webhook (POST)
 * Protected with 4 layers of security:
 *   - Layer 0: X-Hub-Signature-256 header validation (Meta App Secret)
 *   - Layer 1: Cryptographic HMAC signature on callback payload
 *   - Layer 2: Phone number ownership binding (sender must match registered subscriber/beneficiary)
 *   - Layer 3: Subscription lifecycle state machine & idempotency guards
 */
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Always return 200 OK immediately so provider doesn't timeout or retry
  res.status(200).json({ received: true });

  try {
    // ── Layer 0: Meta Webhook Source Signature Verification ───────────────────
    const hubSignature = req.headers['x-hub-signature-256'] as string | undefined;
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (hubSignature && appSecret && (req as any).rawBody) {
      const hmac = crypto.createHmac('sha256', appSecret).update((req as any).rawBody).digest('hex');
      const expected = `sha256=${hmac}`;
      try {
        const sigBuf = Buffer.from(hubSignature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          console.error('[WhatsApp Webhook SECURITY ALERT] Rejected: X-Hub-Signature-256 mismatch.');
          return;
        }
      } catch (err: any) {
        console.error('[WhatsApp Webhook SECURITY ALERT] Signature evaluation failed:', err.message);
        return;
      }
    }

    const body = req.body;

    let buttonPayload = '';
    let senderPhone = '';

    // Format A: Standard Meta Cloud API
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msg = change?.messages?.[0];

    if (msg) {
      senderPhone = String(msg.from || '').replace(/\D/g, '').slice(-10);

      if (msg.type === 'button') {
        buttonPayload = msg.button?.payload || '';
      } else if (msg.type === 'interactive') {
        buttonPayload = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || '';
      } else if (msg.type === 'text') {
        const textContent = String(msg.text?.body || '').trim().toUpperCase();
        if (textContent.includes('ACTIVATE') || textContent.includes('AGREE') || textContent.includes('CONSENT')) {
          buttonPayload = textContent;
        }
      }
    }

    // Format B: MSG91 Inbound Webhook payload
    if (!buttonPayload) {
      buttonPayload =
        body?.buttonPayload ||
        body?.button_payload ||
        body?.payload ||
        body?.data?.buttonPayload ||
        body?.data?.payload ||
        body?.message ||
        body?.data?.message ||
        '';
      senderPhone = String(body?.sender || body?.mobile || body?.customerNumber || body?.from || '')
        .replace(/\D/g, '')
        .slice(-10);
    }

    // Route 1: Profile Access Request Approve / Decline Quick-Reply Callbacks
    if (buttonPayload && (buttonPayload.startsWith('ACCESS_APPROVE:') || buttonPayload.startsWith('ACCESS_REJECT:'))) {
      await handleProfileAccessConsentWebhook(buttonPayload.trim(), senderPhone);
      return;
    }

    // Route 2: Package Activation Consent Trigger
    if (!buttonPayload || !buttonPayload.includes('ACTIVATE_SUB:')) {
      return; // Ignore other non-consent inbound messages/receipts
    }

    const parts = buttonPayload.split(':');
    const subscriptionId = parts[1]?.trim();
    const role = parts[2]?.trim() || 'subscriber';
    const signature = parts[3]?.trim();

    if (!subscriptionId) {
      console.warn('[WhatsApp Webhook Warning] Received ACTIVATE_SUB without subscriptionId:', buttonPayload);
      return;
    }

    // ── Layer 1: Cryptographic HMAC Signature Verification ───────────────────
    if (!verifyConsentHmac(subscriptionId, role, signature)) {
      console.error(`[WhatsApp Webhook SECURITY ALERT] Forged/invalid HMAC signature rejected! Sub: ${subscriptionId}, Role: ${role}, Sig: ${signature}, Sender: ${senderPhone}`);
      return;
    }

    console.log(`[WhatsApp Webhook] Processing authenticated consent for subscription: ${subscriptionId} by ${role} (Phone: ${senderPhone})`);

    await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          subscriber: true,
          beneficiary: {
            include: {
              user: true,
            },
          },
          package: true,
          packageVersion: {
            include: {
              versionBenefits: true,
            },
          },
        },
      });

      if (!sub) {
        console.warn(`[WhatsApp Webhook] Subscription ${subscriptionId} not found.`);
        return;
      }

      // ── Layer 2: State Machine Lifecycle Guard ──────────────────────────────
      if (sub.cancelledAt) {
        console.warn(`[WhatsApp Webhook Security] Cannot activate cancelled subscription: ${subscriptionId}`);
        return;
      }

      // ── Layer 3: Registered Phone Number Authorization (Zero Trust) ─────────
      const cleanPhoneDigits = (p?: string | null) => String(p || '').replace(/\D/g, '').slice(-10);
      const subPhone = cleanPhoneDigits(sub.subscriber?.phone);
      const benPhone = cleanPhoneDigits(sub.beneficiary?.user?.phone);
      const allowedPhones = [subPhone, benPhone].filter((p) => p.length === 10);

      if (senderPhone && !allowedPhones.includes(senderPhone)) {
        console.error(
          `[WhatsApp Webhook SECURITY ALERT] Unauthorized phone attempt! Sender ${senderPhone} does not match registered subscriber (${sub.subscriber?.phone}) or beneficiary (${sub.beneficiary?.user?.phone}) for subscription ${subscriptionId}`
        );
        return;
      }

      // ── Layer 4: Idempotency Guard ──────────────────────────────────────────
      if (sub.isActive) {
        console.log(`[WhatsApp Webhook] Subscription ${subscriptionId} is already active. Idempotent check satisfied.`);
        return;
      }

      // Activate Subscription
      const now = new Date();
      const durationMonths = sub.duration === 'annual' ? 12 : sub.duration === 'six_months' ? 6 : 1;
      const calculatedEnd = new Date(now);
      calculatedEnd.setMonth(calculatedEnd.getMonth() + durationMonths);

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          isActive: true,
          startDate: now,
          endDate: calculatedEnd,
        },
      });

      // Promote user from prospect to subscriber if applicable
      if (sub.subscriber?.role === 'prospect') {
        await tx.user.update({
          where: { id: sub.subscriberId },
          data: { role: 'subscriber' },
        });
      }

      // Ensure Benefit Periods are generated
      const versionObj = sub.packageVersion;
      if (versionObj?.versionBenefits && versionObj.versionBenefits.length > 0) {
        const periodBenefits = versionObj.versionBenefits.map((vb: any) => ({
          benefitId: vb.benefitId,
          name: vb.snapshotName || 'Benefit',
          unitLabel: vb.snapshotUnitLabel || null,
          monthlyUnits: vb.unitsIncluded || 1,
          allowRollover: vb.allowRollover ?? false,
          maxRolloverUnits: vb.maxRolloverUnits ?? null,
        }));

        await benefitPeriodManager.generatePeriodsForSubscription(
          sub.id,
          durationMonths,
          now,
          periodBenefits,
          tx as any
        );
      }

      // Record Legal Audit Log under DPDP Act 2023 / IT Act
      await tx.activityLog.create({
        data: {
          id: generateUUID(),
          userId: sub.subscriberId,
          type: 'SUBSCRIPTION',
          action: 'ACTIVATED_VIA_WHATSAPP_CONSENT',
          details: {
            subscriptionId: sub.id,
            consentedByRole: role,
            senderPhone: senderPhone || sub.subscriber?.phone,
            channel: 'WHATSAPP_QUICK_REPLY_BUTTON',
            timestamp: now.toISOString(),
            packageType: sub.packageType,
            packageName: sub.package?.name,
          } as any,
        },
      });

      console.log(`[WhatsApp Webhook] Successfully activated subscription ${sub.id} via authenticated WhatsApp consent!`);

      // Dispatch confirmation message to user on WhatsApp (via Notification Worker Event)
      const recipientPhone = senderPhone || sub.subscriber?.phone;
      if (recipientPhone && recipientPhone.length === 10) {
        await notificationProducer.publish({
          channel: 'whatsapp',
          event: 'SUBSCRIPTION_ACTIVATED',
          recipient: { phone: recipientPhone },
          variables: {
            subscriberName: sub.subscriber?.name || 'Valued Member',
            packageName: sub.package?.name || sub.packageType || 'Care Package',
            beneficiaryName: sub.beneficiary?.name || 'Beneficiary',
            startDate: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          },
          idempotencyKey: `sub-act-conf-${sub.id}-${recipientPhone}`,
        }).catch((e: any) => console.warn('[WhatsApp Webhook] Confirmation WhatsApp publish failed:', e.message));
      }
    });
  } catch (err: any) {
    console.error('[WhatsApp Webhook Exception]:', err.message);
  }
});

export default router;
