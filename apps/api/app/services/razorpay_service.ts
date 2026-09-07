import Razorpay from 'razorpay';
import crypto from 'crypto';

const clean = (s?: string) => (s || '').toString().replace(/^["']|["']$/g, '').trim();

/**
 * Determines whether Razorpay should run in Test mode.
 * Controlled by RAZORPAY_TEST_MODE in .env ('true' or 'false').
 * Falls back to checking key prefix if RAZORPAY_TEST_MODE is not explicitly defined.
 */
export const isRazorpayTestMode = (): boolean => {
  const toggle = clean(process.env.RAZORPAY_TEST_MODE).toLowerCase();
  if (toggle === 'true' || toggle === '1') return true;
  if (toggle === 'false' || toggle === '0') return false;
  
  // Fallback: check prefix of default RAZORPAY_KEY_ID
  const defaultKey = clean(process.env.RAZORPAY_KEY_ID);
  return defaultKey.startsWith('rzp_test_');
};

/**
 * Returns active Razorpay credentials based on RAZORPAY_TEST_MODE toggle.
 */
export const getRazorpayCredentials = () => {
  const testMode = isRazorpayTestMode();

  const key_id = clean(
    testMode
      ? (process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID)
      : (process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID)
  );

  const key_secret = clean(
    testMode
      ? (process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET)
      : (process.env.RAZORPAY_LIVE_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET)
  );

  return { key_id, key_secret, isTestMode: testMode };
};

// Cached instance
let razorpayInstance: Razorpay | null = null;
let currentKeyId: string | null = null;

export const getRazorpayInstance = (): Razorpay => {
  const { key_id, key_secret, isTestMode } = getRazorpayCredentials();
  
  if (!key_id || !key_secret || key_secret === 'PASTE_FULL_SECRET_HERE') {
    throw new Error(`Razorpay credentials are not fully configured in .env (active mode: ${isTestMode ? 'TEST' : 'LIVE'})`);
  }

  // Re-initialize if null or if credentials changed
  if (!razorpayInstance || currentKeyId !== key_id) {
    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
    currentKeyId = key_id;
    console.log(`[Razorpay Service] Initialized in ${isTestMode ? 'TEST 🧪' : 'LIVE 🚀'} mode (Key ID: ${key_id.substring(0, 14)}...)`);
  }

  return razorpayInstance;
};

/**
 * Creates a new Razorpay order.
 * @param amountInRupees The amount in INR (e.g. 500.50)
 * @param receiptId A unique identifier for the receipt (e.g. user ID or timestamp)
 * @returns The Razorpay Order object containing the `id` and the active public `key_id`
 */
export const createOrder = async (amountInRupees: number, receiptId: string) => {
  const rzp = getRazorpayInstance();
  const { key_id, isTestMode } = getRazorpayCredentials();
  
  // Razorpay expects amount in the smallest currency sub-unit (paise for INR)
  const amountInPaise = Math.round(amountInRupees * 100);

  const options = {
    amount: amountInPaise,
    currency: "INR",
    receipt: receiptId,
  };

  try {
    const order = await rzp.orders.create(options);
    return {
      ...order,
      key_id,
      isTestMode
    };
  } catch (error) {
    console.error('[Razorpay] Order Creation Error:', error);
    throw new Error('Failed to create Razorpay order');
  }
};

/**
 * Verifies the Razorpay payment signature.
 * @param razorpay_order_id The order ID returned during creation
 * @param razorpay_payment_id The payment ID returned after successful payment
 * @param razorpay_signature The signature returned after successful payment
 * @returns boolean true if the signature is valid
 */
export const verifyPaymentSignature = (
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string
): boolean => {
  const { key_secret } = getRazorpayCredentials();
  if (!key_secret || key_secret === 'PASTE_FULL_SECRET_HERE') {
    throw new Error("Razorpay credentials are not fully configured in .env");
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac('sha256', key_secret)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === razorpay_signature;
};
