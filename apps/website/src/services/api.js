// API Service for Website Frontend using backend routes (same as mobile app)

const getApiBase = () => {
  let envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // Respect the exact URL from .env (just strip trailing slash)
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return '/api';
};


export const API_BASE = getApiBase();

/**
 * Allowed user roles for website login
 */
export const ALLOWED_WEBSITE_ROLES = ['subscriber', 'prospect'];

/**
 * Validate role for website login access
 */
export const checkWebsiteRoleAccess = (user) => {
  if (!user || !user.role) return;
  const role = String(user.role).toLowerCase();
  if (!ALLOWED_WEBSITE_ROLES.includes(role)) {
    const formattedRole = role.replace(/_/g, ' ');
    throw new Error(`Login restricted: Only Subscriber and Prospect accounts can log in on the website. Your account role (${formattedRole}) is not permitted on this portal.`);
  }
};

/**
 * Format 10-digit phone to 91XXXXXXXXXX or +91XXXXXXXXXX
 */
export const formatPhone = (phoneRaw, prefixPlus = true) => {
  const clean = String(phoneRaw || '').replace(/\D/g, '').slice(-10);
  if (!clean) return '';
  return prefixPlus ? `+91${clean}` : `91${clean}`;
};

/**
 * Check if a JWT token is expired
 */
export const isTokenExpired = (jwtToken) => {
  if (!jwtToken || typeof jwtToken !== 'string') return true;
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    const nowInSecs = Math.floor(Date.now() / 1000);
    return payload.exp < nowInSecs;
  } catch (e) {
    return true;
  }
};

/**
 * Handle unauthorized / expired session
 */
export const handleSessionExpired = () => {
  try {
    localStorage.removeItem('mhn_token');
    localStorage.removeItem('mhn_user');
    window.dispatchEvent(new CustomEvent('mhn:auth_expired'));
  } catch (e) {}
};

/**
 * Secure fetch wrapper that handles auth headers and auto-detects 401s
 */
const secureFetch = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    handleSessionExpired();
    throw new Error('Your session has expired. Please log in again.');
  }

  return response;
};

/**
 * 1. Send OTP to user phone
 * Endpoint: POST /api/auth/send-otp
 */
export const sendOtp = async (phoneRaw) => {
  const phone = formatPhone(phoneRaw, false); // "919999999999"
  const response = await secureFetch(`${API_BASE}/auth/send-otp`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to send OTP.');
  }
  return data.data; // { success: true, isNewUser: boolean, ... }
};

/**
 * 2. Verify OTP entered by user
 * Endpoint: POST /api/auth/verify-otp
 */
export const verifyOtp = async (phoneRaw, otpCode) => {
  const phone = formatPhone(phoneRaw, true); // "+919999999999"
  const response = await secureFetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    body: JSON.stringify({ phone, otp: otpCode }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Invalid or expired OTP entered.');
  }
  const result = data.data;
  if (result && result.user) {
    checkWebsiteRoleAccess(result.user);
  }
  return result; // { isNewUser, user, token, ... }
};

/**
 * 3. Register user with OTP verification data
 * Endpoint: POST /api/auth/register-otp
 */
export const registerWithOtp = async ({ phoneRaw, name, age, email, pincode, location, latitude, longitude }) => {
  const phone = formatPhone(phoneRaw, true); // "+919999999999"
  const response = await secureFetch(`${API_BASE}/auth/register-otp`, {
    method: 'POST',
    body: JSON.stringify({
      phone,
      name: name?.trim(),
      age: Number(age) || 30,
      email: email?.trim() || undefined,
      pincode: pincode?.trim() || undefined,
      location: location?.trim() || undefined,
      latitude,
      longitude,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Registration failed.');
  }
  const result = data.data;
  if (result && result.user) {
    checkWebsiteRoleAccess(result.user);
  }
  return result; // { token, user, ... }
};

export const registerUser = registerWithOtp;

/**
 * 4. Login with phone & password
 * Endpoint: POST /api/auth/login-password
 */
export const loginWithPassword = async ({ phoneRaw, password }) => {
  const phone = formatPhone(phoneRaw, true); // "+919999999999"
  const response = await secureFetch(`${API_BASE}/auth/login-password`, {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Login failed. Check phone or password.');
  }
  const result = data.data;
  if (result && result.user) {
    checkWebsiteRoleAccess(result.user);
  }
  return result; // { token, user, ... }
};

/**
 * 5. Fetch subscription packages
 * Endpoint: GET /api/subscriber/subscriptions/packages
 */
export const fetchSubscriptionPackages = async () => {
  const response = await secureFetch(`${API_BASE}/subscriber/subscriptions/packages`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to load subscription packages.');
  }
  return data.data || [];
};

/**
 * 6. Validate coupon code
 * Endpoint: POST /api/subscriber/coupons/validate
 */
export const validateCouponCode = async (token, couponCode, packageId, amount) => {
  const response = await secureFetch(`${API_BASE}/subscriber/coupons/validate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code: couponCode, packageId, amount }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Invalid coupon code.');
  }
  return data.coupon; // { couponId, discountApplied, finalAmount }
};

/**
 * 6a. Calculate Authoritative Benefit-level Pricing & GST Breakdown
 * Endpoint: POST /api/subscriber/subscriptions/checkout/preview
 */
export const fetchCheckoutPreview = async (token, { packageId, couponCode, durationMonths = 1, selectedAddons = [] }) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await secureFetch(`${API_BASE}/subscriber/subscriptions/checkout/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      packageId,
      couponCode: couponCode || undefined,
      durationMonths: Number(durationMonths) || 1,
      selectedAddons,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to calculate checkout pricing.');
  }
  return data.data;
};

/**
 * 6b. Create Razorpay Order
 * Endpoint: POST /api/subscriber/subscriptions/create-order
 */
export const createRazorpayOrder = async (token, packageId, couponCode, durationMonths = 1) => {
  const response = await secureFetch(`${API_BASE}/subscriber/subscriptions/create-order`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      packageId, 
      couponCode: couponCode || undefined,
      durationMonths: Number(durationMonths) || 1
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to create Razorpay order.');
  }
  return data.data; // { order_id, amount, currency, receipt }
};

/**
 * 7. Purchase Subscription
 * Endpoint: POST /api/subscriber/subscriptions/purchase
 */
export const purchaseSubscription = async (token, payload) => {
  const response = await secureFetch(`${API_BASE}/subscriber/subscriptions/purchase`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      packageId: payload.packageId,
      couponCode: payload.couponCode || undefined,
      durationMonths: payload.durationMonths || 1,
      beneficiaryData: payload.beneficiaryData || null,
      medicalData: payload.medicalData || null,
      emergencyContacts: payload.emergencyContacts || null,
      razorpay_payment_id: payload.razorpay_payment_id || 'DEV_MOCK_PAYMENT_' + Date.now(),
      razorpay_order_id: payload.razorpay_order_id || 'order_mock_' + Date.now(),
      razorpay_signature: payload.razorpay_signature || 'DEV_MOCK_SIGNATURE',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to complete subscription purchase.');
  }
  return data;
};

/**
 * 8. Fetch current subscriber dashboard profile & active subscription
 * Endpoint: GET /api/subscriber/dashboard/me
 */
export const fetchSubscriberDashboard = async (token) => {
  const response = await secureFetch(`${API_BASE}/subscriber/dashboard/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch account details.');
  }
  return data.data || data;
};

/**
 * 9. Fetch Invoice Data & HTML
 * Endpoint: GET /api/subscriber/invoices/:id
 * Endpoint: GET /api/subscriber/invoices/:id/html
 */
export const fetchInvoice = async (token, invoiceId) => {
  const response = await secureFetch(`${API_BASE}/subscriber/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch invoice.');
  }
  return data.data;
};

export const fetchInvoiceHtml = async (token, invoiceId) => {
  const response = await secureFetch(`${API_BASE}/subscriber/invoices/${encodeURIComponent(invoiceId)}/html`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to load invoice HTML preview.');
  }
  return await response.text();
};

export const fetchSubscriberInvoices = async (token) => {
  const response = await secureFetch(`${API_BASE}/subscriber/invoices`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch invoices.');
  }
  return data.data || [];
};


