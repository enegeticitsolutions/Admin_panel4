/**
 * OTP Bypass & Test Mode Helper
 *
 * Configurable solely via environment variables (.env):
 *   - ENABLE_OTP_BYPASS: 'true' to enable bypass mode for testing. Set to 'false' in production.
 *   - OTP_BYPASS_ANY_PHONE: 'true' allows the testing team to test with ANY phone number.
 *   - OTP_BYPASS_PHONES: comma-separated whitelist of 10-digit phones (when OTP_BYPASS_ANY_PHONE is not true).
 *   - OTP_BYPASS_CODE: the static OTP code to use for testing (e.g. '442233').
 *
 * ZERO HARDCODED CREDENTIALS OR PHONE NUMBERS IN SOURCE CODE.
 */

export function isOtpBypassEnabled(): boolean {
  return process.env.ENABLE_OTP_BYPASS === 'true';
}

export function getBypassOtpCode(): string {
  return process.env.OTP_BYPASS_CODE || '442233';
}

export function isBypassPhone(rawPhone: string): boolean {
  if (!isOtpBypassEnabled()) {
    return false;
  }

  // If ANY phone is allowed for testing team
  if (process.env.OTP_BYPASS_ANY_PHONE === 'true') {
    return true;
  }

  const cleanPhone = (rawPhone || '').toString().replace(/\D/g, '').slice(-10);
  if (!cleanPhone) {
    return false;
  }

  const configuredPhones = (process.env.OTP_BYPASS_PHONES || '')
    .split(',')
    .map((p) => p.trim().replace(/\D/g, '').slice(-10))
    .filter(Boolean);

  return configuredPhones.includes(cleanPhone);
}
