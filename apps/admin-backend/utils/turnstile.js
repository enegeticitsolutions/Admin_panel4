const logger = require('./logger');
const ApiError = require('./ApiError');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify Cloudflare Turnstile token
 * @param {string} token - The turnstile token from the client
 * @param {string} [clientIp] - The client IP address
 * @returns {Promise<{success: boolean, bypassed?: boolean}>}
 */
async function verifyTurnstileToken(token, clientIp) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SECRET_KEY.trim() : '';

  // If secret key is not configured:
  // In production, this is a misconfiguration error
  // In development/test, allow bypass with a warning
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('TURNSTILE_SECRET_KEY is not configured in production environment');
      throw new ApiError(500, 'Security verification service is not configured');
    }
    logger.warn('TURNSTILE_SECRET_KEY not set. Skipping captcha verification in non-production mode.');
    return { success: true, bypassed: true };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new ApiError(400, 'Security verification required. Please complete the captcha.');
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      logger.error(`Turnstile verification endpoint returned status ${response.status}`);
      throw new ApiError(502, 'Security verification service temporarily unavailable');
    }

    const outcome = await response.json();

    if (!outcome.success) {
      logger.warn('Turnstile verification failed', {
        errorCodes: outcome['error-codes'],
        clientIp,
      });
      throw new ApiError(400, 'Security verification failed. Please complete the captcha again.');
    }

    return { success: true };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error('Error during Turnstile verification', { error: error.message });
    throw new ApiError(500, 'Failed to verify security challenge');
  }
}

module.exports = {
  verifyTurnstileToken,
};
