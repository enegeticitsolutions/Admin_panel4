import crypto from 'crypto';
import { notificationProducer } from '../redis/notification.producer';
import { notificationService } from './notification.service';

export type SubscriptionConsentRole = 'subscriber' | 'beneficiary';
export type AccessConsentAction = 'APPROVE' | 'REJECT';

function cleanPhone10(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function timingSafeCompare(aStr: string, bStr: string): boolean {
  try {
    const a = Buffer.from(aStr);
    const b = Buffer.from(bStr);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Cryptographic HMAC Signing & Verification (Single Source of Truth) ──────

export function generateSubscriptionConsentHmac(subscriptionId: string, role: string): string | null {
  const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`${subscriptionId}:${role}`).digest('hex').slice(0, 16);
}

export function verifySubscriptionConsentHmac(subscriptionId: string, role: string, sig?: string): boolean {
  if (!sig) return false;
  const expected = generateSubscriptionConsentHmac(subscriptionId, role);
  if (!expected) return false;
  return timingSafeCompare(sig, expected);
}

export function generateAccessConsentHmac(requestId: string, action: AccessConsentAction): string | null {
  const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`access:${requestId}:${action}`).digest('hex').slice(0, 16);
}

export function verifyAccessConsentHmac(requestId: string, action: AccessConsentAction, sig?: string): boolean {
  if (!sig) return false;
  const expected = generateAccessConsentHmac(requestId, action);
  if (!expected) return false;
  return timingSafeCompare(sig, expected);
}

// ─── Unified Consent Notification Service ────────────────────────────────────

export interface PackageConsentInput {
  subscriptionId?: string;
  subscriber?: { id?: string; name?: string | null; phone?: string | null } | null;
  beneficiary?: { userId?: string; name?: string | null; phone?: string | null; user?: { phone?: string | null } | null } | null;
  packageName?: string | null;
  termsUrl?: string;
  forceDirect?: boolean;
}

export interface AccessRequestConsentInput {
  requestId: string;
  requesterName: string;
  relationship: string;
  accessLevel: string;
  recipients: Array<{ name?: string | null; phone?: string | null }>;
  forceDirect?: boolean;
}

export interface AccessDecisionConsentInput {
  requestId: string;
  requesterPhone?: string | null;
  requesterName?: string | null;
  beneficiaryName: string;
  decision: 'Approved' | 'Declined';
  forceDirect?: boolean;
}

async function publishOrSendWhatsApp(params: {
  idempotencyKey: string;
  event: string;
  phone: string;
  variables: Record<string, string>;
  buttonPayload?: string;
  components?: Record<string, any>;
  forceDirect?: boolean;
}) {
  if (!params.forceDirect) {
    const pubRes = await notificationProducer.publish({
      idempotencyKey: params.idempotencyKey,
      channel: 'whatsapp',
      event: params.event,
      recipient: { phone: params.phone },
      variables: params.variables,
      buttonPayload: params.buttonPayload,
      components: params.components,
    });
    if (pubRes.success) return pubRes;
  }

  return notificationService.send({
    channel: 'whatsapp',
    event: params.event,
    to: params.phone,
    variables: params.variables,
    buttonPayload: params.buttonPayload,
    components: params.components,
  });
}

export const consentNotificationService = {
  /**
   * Dispatches MSG91 `package_consent_activation` template:
   *   body_1 = recipientName
   *   body_2 = packageName
   *   body_3 = beneficiaryName
   *   body_4 = termsUrl
   * to Subscriber and (if distinct) Beneficiary via Redis Streams + direct fallback.
   */
  async sendPackageConsentActivation(input: PackageConsentInput) {
    const subPhone = cleanPhone10(input.subscriber?.phone);
    const benPhone = cleanPhone10(input.beneficiary?.phone || input.beneficiary?.user?.phone);
    const isSamePerson =
      (subPhone && benPhone && subPhone === benPhone) ||
      Boolean(input.subscriber?.id && input.beneficiary?.userId && input.subscriber.id === input.beneficiary.userId);

    const targets: Array<{ role: SubscriptionConsentRole; phone: string; name: string }> = [];
    if (subPhone.length === 10) {
      targets.push({
        role: 'subscriber',
        phone: subPhone,
        name: input.subscriber?.name || 'Subscriber',
      });
    }
    if (!isSamePerson && benPhone.length === 10) {
      targets.push({
        role: 'beneficiary',
        phone: benPhone,
        name: input.beneficiary?.name || 'Beneficiary',
      });
    }

    const termsUrl = input.termsUrl || process.env.LEGAL_TERMS_URL || 'https://maihoonna.com/terms';
    const packageName = input.packageName || 'Care Package';
    const beneficiaryName = input.beneficiary?.name || input.subscriber?.name || 'Beneficiary';
    const includeButton = process.env.MSG91_CONSENT_INCLUDE_BUTTON !== 'false';

    const results: Array<{ target: SubscriptionConsentRole; phone: string; success: boolean; error?: string }> = [];

    for (const target of targets) {
      let buttonPayload: string | undefined;
      if (includeButton && input.subscriptionId) {
        const sig = generateSubscriptionConsentHmac(input.subscriptionId, target.role);
        if (sig) {
          buttonPayload = `ACTIVATE_SUB:${input.subscriptionId}:${target.role}:${sig}`;
        }
      }

      try {
        const res = await publishOrSendWhatsApp({
          idempotencyKey: input.subscriptionId
            ? `consent-sub-${input.subscriptionId}-${target.role}`
            : `consent-manual-${target.phone}-${Date.now()}`,
          event: 'PACKAGE_CONSENT_ACTIVATION',
          phone: target.phone,
          variables: {
            recipientName: target.name,
            packageName,
            beneficiaryName,
            termsUrl,
          },
          buttonPayload,
          forceDirect: input.forceDirect,
        });
        results.push({ target: target.role, phone: target.phone, success: Boolean(res?.success), error: res?.error });
      } catch (err: any) {
        results.push({ target: target.role, phone: target.phone, success: false, error: err.message });
      }
    }

    return results;
  },

  /**
   * Dispatches MSG91 `profile_access_request` template with Approve/Decline Quick Reply buttons:
   *   body_1 = recipientName
   *   body_2 = requesterName
   *   body_3 = relationship
   *   body_4 = accessLevel
   */
  async sendProfileAccessRequest(input: AccessRequestConsentInput) {
    const approveSig = generateAccessConsentHmac(input.requestId, 'APPROVE');
    const rejectSig = generateAccessConsentHmac(input.requestId, 'REJECT');

    const components =
      approveSig && rejectSig
        ? {
            button_1: {
              subtype: 'quick_reply',
              type: 'payload',
              value: `ACCESS_APPROVE:${input.requestId}:${approveSig}`,
            },
            button_2: {
              subtype: 'quick_reply',
              type: 'payload',
              value: `ACCESS_REJECT:${input.requestId}:${rejectSig}`,
            },
          }
        : undefined;

    const sentPhones = new Set<string>();
    const results: Array<{ phone: string; success: boolean; error?: string }> = [];

    for (const r of input.recipients) {
      const phone = cleanPhone10(r.phone);
      if (phone.length !== 10 || sentPhones.has(phone)) continue;
      sentPhones.add(phone);

      try {
        const res = await publishOrSendWhatsApp({
          idempotencyKey: `access-req-${input.requestId}-${phone}`,
          event: 'PROFILE_ACCESS_REQUEST',
          phone,
          variables: {
            recipientName: r.name || 'Member',
            requesterName: input.requesterName,
            relationship: input.relationship,
            accessLevel: input.accessLevel,
          },
          components,
          forceDirect: input.forceDirect,
        });
        results.push({ phone, success: Boolean(res?.success), error: res?.error });
      } catch (err: any) {
        results.push({ phone, success: false, error: err.message });
      }
    }

    return results;
  },

  /**
   * Dispatches MSG91 `profile_access_decision` template back to the requester:
   *   body_1 = requesterName
   *   body_2 = beneficiaryName
   *   body_3 = decision ("Approved" | "Declined")
   */
  async sendProfileAccessDecision(input: AccessDecisionConsentInput) {
    const phone = cleanPhone10(input.requesterPhone);
    if (phone.length !== 10) return { success: false, error: 'Invalid requester phone' };

    return publishOrSendWhatsApp({
      idempotencyKey: `access-dec-${input.requestId}-${input.decision.toLowerCase()}`,
      event: 'PROFILE_ACCESS_DECISION',
      phone,
      variables: {
        requesterName: input.requesterName || 'Member',
        beneficiaryName: input.beneficiaryName,
        decision: input.decision,
      },
      forceDirect: input.forceDirect,
    });
  },
};
