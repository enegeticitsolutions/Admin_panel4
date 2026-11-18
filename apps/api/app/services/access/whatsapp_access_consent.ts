import crypto from 'crypto';
import prisma from '../../core/database';
import { notificationProducer, notificationService } from '@maihoonna/notifications';
import { normalizeIndianPhone } from './profile_access_service';

export type ConsentAction = 'APPROVE' | 'REJECT';

/**
 * Generates a 16-char HMAC-SHA256 signature binding (requestId + action) to our server secret.
 * Prevents forged WhatsApp webhook payloads from granting unauthorized medical profile access.
 */
export function generateAccessConsentHmac(requestId: string, action: ConsentAction): string {
  const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!secret) {
    throw new Error('WHATSAPP_WEBHOOK_VERIFY_TOKEN is required to sign WhatsApp access consent payloads.');
  }
  return crypto.createHmac('sha256', secret).update(`access:${requestId}:${action}`).digest('hex').slice(0, 16);
}

/**
 * Constant-time HMAC verification for inbound WhatsApp quick-reply callbacks.
 */
export function verifyAccessConsentHmac(requestId: string, action: ConsentAction, sig?: string): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!secret) {
    console.error('[WhatsApp Access Consent] Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN in environment.');
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(`access:${requestId}:${action}`).digest('hex').slice(0, 16);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Asynchronously dispatches interactive WhatsApp consent messages (Approve / Decline buttons)
 * to the profile owner (SELF) and any active Care Managers (MANAGER) for proxy approval.
 */
export async function dispatchAccessRequestWhatsApp(requestId: string): Promise<void> {
  try {
    const reqRecord = await prisma.careAccessRequest.findUnique({
      where: { id: requestId },
      include: {
        beneficiary: {
          select: {
            id: true,
            name: true,
            careCircleMembers: {
              where: {
                status: 'active',
                OR: [{ accessRole: { in: ['SELF', 'MANAGER'] } }, { canManageAccess: true }],
              },
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
        requester: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!reqRecord || reqRecord.status !== 'PENDING') return;

    const approveSig = generateAccessConsentHmac(requestId, 'APPROVE');
    const rejectSig = generateAccessConsentHmac(requestId, 'REJECT');

    const approvePayload = `ACCESS_APPROVE:${requestId}:${approveSig}`;
    const rejectPayload = `ACCESS_REJECT:${requestId}:${rejectSig}`;

    const requesterName = reqRecord.requester?.name || reqRecord.requester?.phone || 'A family member';
    const relationship = reqRecord.relationship || 'Family Member';
    const accessLevel = reqRecord.requestedRole === 'EDITOR' ? 'View & Edit' : 'View Only';

    // Deduplicate recipient phones across SELF + MANAGER(s)
    const sentPhones = new Set<string>();
    for (const member of reqRecord.beneficiary.careCircleMembers) {
      const phone = member.user?.phone ? normalizeIndianPhone(member.user.phone) : '';
      if (phone.length !== 10 || sentPhones.has(phone)) continue;
      sentPhones.add(phone);

      const recipientName = member.user?.name || reqRecord.beneficiary.name || 'Member';

      const components = {
        button_1: {
          subtype: 'quick_reply',
          type: 'payload',
          value: approvePayload,
        },
        button_2: {
          subtype: 'quick_reply',
          type: 'payload',
          value: rejectPayload,
        },
      };

      const variables = {
        recipientName,
        requesterName,
        relationship,
        accessLevel,
      };

      const pubRes = await notificationProducer.publish({
        idempotencyKey: `access-req-${requestId}-${phone}`,
        channel: 'whatsapp',
        event: 'PROFILE_ACCESS_REQUEST',
        recipient: { phone },
        variables,
        components,
      });

      if (!pubRes.success) {
        await notificationService.send({
          channel: 'whatsapp',
          event: 'PROFILE_ACCESS_REQUEST',
          to: phone,
          variables,
          components,
        });
      }
    }
  } catch (err: any) {
    // Non-blocking: in-app approval still works even if WhatsApp env/worker is offline
    console.error('[WhatsApp Access Consent] Outbound dispatch error:', err.message);
  }
}

/**
 * Notifies the requester over WhatsApp once their request has been Approved or Declined.
 */
export async function dispatchAccessDecisionWhatsApp(params: {
  requestId: string;
  requesterPhone?: string | null;
  requesterName?: string | null;
  beneficiaryName: string;
  decision: 'Approved' | 'Declined';
}): Promise<void> {
  try {
    const phone = params.requesterPhone ? normalizeIndianPhone(params.requesterPhone) : '';
    if (phone.length !== 10) return;

    await notificationProducer.publish({
      idempotencyKey: `access-dec-${params.requestId}-${params.decision.toLowerCase()}`,
      channel: 'whatsapp',
      event: 'PROFILE_ACCESS_DECISION',
      recipient: { phone },
      variables: {
        requesterName: params.requesterName || 'Member',
        beneficiaryName: params.beneficiaryName,
        decision: params.decision,
      },
    });
  } catch (err: any) {
    console.error('[WhatsApp Access Consent] Decision dispatch error:', err.message);
  }
}
