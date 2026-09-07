const Razorpay = require('razorpay');
const clean = (s) => (s || '').toString().replace(/^["']|["']$/g, '').trim();

function isTestMode() {
  const toggle = clean(process.env.RAZORPAY_TEST_MODE).toLowerCase();
  if (toggle === 'true' || toggle === '1') return true;
  if (toggle === 'false' || toggle === '0') return false;
  const defaultKey = clean(process.env.RAZORPAY_KEY_ID);
  return defaultKey.startsWith('rzp_test_');
}

function getCredentials() {
  const test = isTestMode();
  const key_id = clean(
    test
      ? (process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID)
      : (process.env.RAZORPAY_LIVE_KEY_ID || process.env.RAZORPAY_KEY_ID)
  );
  const key_secret = clean(
    test
      ? (process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET)
      : (process.env.RAZORPAY_LIVE_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET)
  );
  return { key_id, key_secret, isTestMode: test };
}

let razorpayInstance = null;
let currentKeyId = null;

function getRazorpayInstance() {
  const { key_id, key_secret, isTestMode: test } = getCredentials();

  if (key_id && key_secret && key_secret !== 'PASTE_FULL_SECRET_HERE') {
    if (!razorpayInstance || currentKeyId !== key_id) {
      razorpayInstance = new Razorpay({
        key_id,
        key_secret,
      });
      currentKeyId = key_id;
      console.log(`[Admin Razorpay Service] Initialized in ${test ? 'TEST 🧪' : 'LIVE 🚀'} mode`);
    }
  }
  return razorpayInstance;
}

/**
 * Creates a Razorpay Payment Link using the official SDK.
 */
async function createPaymentLink(payload) {
  const rzp = getRazorpayInstance();
  if (!rzp) {
    console.warn('[Razorpay Service] Credentials missing. Cannot generate SDK link.');
    return null;
  }

  const frontendBaseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

  const linkPayload = {
    amount: payload.amountInPaise,
    currency: 'INR',
    accept_partial: false,
    description: payload.description || 'MaiHoonNa Care Package Subscription',
    customer: {
      name: payload.customerName || 'Valued Subscriber',
      contact: payload.customerContact || '9876543210',
      email: payload.customerEmail || 'customer@maihoonna.com',
    },
    notify: {
      sms: true,
      email: true,
    },
    reminder_enable: true,
    notes: payload.notes || {},
    callback_url: `${frontendBaseUrl}/renewals`,
    callback_method: 'get',
  };

  try {
    const razorpayLink = await razorpayInstance.paymentLink.create(linkPayload);
    if (razorpayLink && razorpayLink.short_url) {
      console.log(`[Razorpay Service] Generated Link: ${razorpayLink.short_url} (${razorpayLink.id})`);
      return razorpayLink;
    }
  } catch (err) {
    console.error('[Razorpay Service Error]:', err.message || err);
  }
  return null;
}

/**
 * Fetches current live status of a Razorpay Payment Link by ID (e.g. plink_xxx).
 */
async function fetchPaymentLink(linkId) {
  const rzp = getRazorpayInstance();
  if (!rzp || !linkId || !linkId.startsWith('plink_')) {
    return null;
  }
  try {
    const rzpData = await rzp.paymentLink.fetch(linkId);
    return rzpData;
  } catch (err) {
    console.warn('[Razorpay Service Fetch Warning]:', err.message || err);
    return null;
  }
}

module.exports = {
  createPaymentLink,
  fetchPaymentLink,
  isConfigured: () => !!getRazorpayInstance(),
};
