const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify Cloudflare Turnstile token on apps/api backend
 * @param token - Captcha verification token from client
 * @param clientIp - Optional client IP address
 */
export async function verifyTurnstileToken(token?: string, clientIp?: string): Promise<{ success: boolean; bypassed?: boolean }> {
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();

  // If secret key is not configured, bypass in development/test
  if (!secretKey) {
    return { success: true, bypassed: true };
  }

  // If token is missing
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Security verification required. Please complete the captcha.');
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
      throw new Error('Security verification service temporarily unavailable');
    }

    const outcome = (await response.json()) as { success: boolean; 'error-codes'?: string[] };

    if (!outcome.success) {
      console.warn('[Turnstile] Verification failed on apps/api:', outcome['error-codes']);
      throw new Error('Security verification failed. Please complete the captcha again.');
    }

    return { success: true };
  } catch (error: any) {
    if (error.message && error.message.includes('Security verification')) {
      throw error;
    }
    console.error('[Turnstile] Error during verification:', error);
    throw new Error('Failed to verify security challenge');
  }
}
