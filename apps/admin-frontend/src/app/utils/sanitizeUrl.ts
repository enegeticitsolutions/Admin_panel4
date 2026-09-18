/**
 * Security URL & DOM Sanitizer for CWE-79 (DOM XSS) and CWE-601 (Open Redirect)
 */

const SAFE_DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'file:']);

export function sanitizeImgSrc(url: string | null | undefined, fallback?: string): string {
  if (typeof url === 'string') {
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed);
      if (ALLOWED_PROTOCOLS.has(parsed.protocol) && (parsed.protocol === 'file:' || parsed.hostname)) {
        // Reconstruct from parsed URL components directly.
        // DO NOT call encodeURI() here because it turns existing percent-encodings like '%2F' into '%252F',
        // which breaks AWS S3 presigned URLs with HTTP 403 SignatureDoesNotMatch.
        const safeUrl = new URL(`${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`);
        return safeUrl.href;
      }
    } catch {
      // Invalid URL, fall through to fallback
    }
  }

  if (typeof fallback === 'string') {
    const trimmedFallback = fallback.trim();
    if (trimmedFallback.startsWith('data:image/') || trimmedFallback.startsWith('blob:') || trimmedFallback.startsWith('/')) {
      return trimmedFallback;
    }
    try {
      const parsedFallback = new URL(trimmedFallback);
      if (ALLOWED_PROTOCOLS.has(parsedFallback.protocol) && (parsedFallback.protocol === 'file:' || parsedFallback.hostname)) {
        const safeUrl = new URL(`${parsedFallback.protocol}//${parsedFallback.host}${parsedFallback.pathname}${parsedFallback.search}${parsedFallback.hash}`);
        return safeUrl.href;
      }
    } catch {
      // Invalid fallback URL
    }
  }

  return SAFE_DEFAULT_IMAGE;
}

export function sanitizeTelLink(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '#';
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone) return '#';
  try {
    return encodeURI(`tel:${cleanPhone}`);
  } catch {
    return '#';
  }
}

export function sanitizeWhatsappLink(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '#';
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return '#';
  try {
    return encodeURI(`https://wa.me/${encodeURIComponent(cleanPhone)}`);
  } catch {
    return '#';
  }
}
