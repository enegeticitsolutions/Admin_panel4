import crypto from 'crypto';
import prisma from '../core/database';
import { getRazorpayCredentials } from './razorpay_service';

export interface RazorpayPayoutInput {
  fundAccountId: string;
  amountInRupees: number;
  idempotencyKey: string;
  notes?: Record<string, string>;
}

export class RazorpayPayoutService {
  private static readonly RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

  private static getAuthHeader(): string {
    const { key_id, key_secret } = getRazorpayCredentials();
    if (!key_id || !key_secret) {
      throw new Error('Razorpay credentials are not configured in environment variables');
    }
    return 'Basic ' + Buffer.from(`${key_id}:${key_secret}`).toString('base64');
  }

  public static getAccountNumber(): string {
    const acc = process.env.RAZORPAY_X_ACCOUNT_NUMBER || '2323230086129235';
    return acc.replace(/["']/g, '').trim();
  }

  public static getWebhookSecret(): string {
    const secret = process.env.RAZORPAY_X_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    return secret.replace(/["']/g, '').trim();
  }

  /**
   * Normalizes an Indian phone number to +91XXXXXXXXXX format.
   */
  public static normalizePhone(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  /**
   * Retrieves an existing Razorpay Contact or creates a new one.
   * Caches razorpayContactId directly on the Volunteer record.
   */
  public static async getOrCreateContact(volunteer: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    razorpayContactId?: string | null;
  }): Promise<string> {
    if (volunteer.razorpayContactId) {
      return volunteer.razorpayContactId;
    }

    const normalizedPhone = this.normalizePhone(volunteer.phone);
    const body: Record<string, any> = {
      name: volunteer.name || 'Saathi Volunteer',
      contact: normalizedPhone,
      type: 'customer',
      reference_id: volunteer.id,
      notes: {
        role: 'saathi_volunteer',
        volunteerId: volunteer.id,
      },
    };

    if (volunteer.email && volunteer.email.includes('@')) {
      body.email = volunteer.email;
    }

    const res = await fetch(`${this.RAZORPAY_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (!res.ok || !data.id) {
      console.error('[RazorpayX Contact Error]:', data);
      throw new Error(data.error?.description || 'Failed to create RazorpayX contact');
    }

    // Cache on volunteer
    await prisma.volunteer.update({
      where: { id: volunteer.id },
      data: { razorpayContactId: data.id },
    }).catch((err: any) => {
      console.warn('[RazorpayX Contact Cache Warning]:', err.message);
    });

    return data.id;
  }

  /**
   * Creates an Amazon Pay Wallet Fund Account for a given contact.
   */
  public static async createAmazonFundAccount(contactId: string, phone: string): Promise<string> {
    const normalizedPhone = this.normalizePhone(phone);
    const body = {
      contact_id: contactId,
      account_type: 'wallet',
      wallet: {
        provider: 'amazonpay',
        phone: normalizedPhone,
      },
    };

    const res = await fetch(`${this.RAZORPAY_API_BASE}/fund_accounts`, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (!res.ok || !data.id) {
      console.error('[RazorpayX Fund Account Error]:', data);
      throw new Error(data.error?.description || 'Failed to link Amazon Pay wallet');
    }

    return data.id;
  }

  /**
   * Dispatches an Amazon Pay wallet payout.
   */
  public static async initiateAmazonPayout(input: RazorpayPayoutInput): Promise<any> {
    const accountNumber = this.getAccountNumber();
    const amountInPaise = Math.round(input.amountInRupees * 100);

    const body = {
      account_number: accountNumber,
      fund_account_id: input.fundAccountId,
      amount: amountInPaise,
      currency: 'INR',
      mode: 'amazonpay',
      purpose: 'payout',
      queue_if_low_balance: true,
      notes: input.notes || { source: 'MHN_SAATHI_VOLUNTEER_REDEMPTION' },
    };

    const res = await fetch(`${this.RAZORPAY_API_BASE}/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'X-Payout-Idempotency': input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (!res.ok || !data.id) {
      console.error('[RazorpayX Payout Error]:', data);
      throw new Error(data.error?.description || 'Failed to dispatch Amazon Pay payout');
    }

    return data;
  }

  /**
   * Verifies RazorpayX webhook signature (HMAC-SHA256).
   */
  public static verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = this.getWebhookSecret();
    if (!secret || !signature) return false;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const signatureBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch (err) {
      console.error('[RazorpayX Webhook Signature Verification Error]:', err);
      return false;
    }
  }
}
