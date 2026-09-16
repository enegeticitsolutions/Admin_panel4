/**
 * Security URL & DOM Sanitizer for CWE-79 (DOM XSS) and CWE-601 (Open Redirect)
 */

const SAFE_DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';

export function sanitizeImgSrc(url: string | null | undefined, fallback?: string): string {
  if (typeof url === 'string' && (url.trim().startsWith('data:image/') || url.trim().startsWith('blob:'))) {
    return url.trim();
  }

  if (typeof url === 'string' && url.trim()) {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol === 'http:') {
        return `http://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      if (parsed.protocol === 'https:') {
        return `https://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      if (parsed.protocol === 'file:') {
        return `file://${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      if (url.trim().startsWith('/')) {
        return encodeURI(url.trim());
      }
    }
  }

  if (typeof fallback === 'string' && fallback.trim()) {
    try {
      const parsedFallback = new URL(fallback.trim());
      if (parsedFallback.protocol === 'http:') {
        return `http://${parsedFallback.host}${parsedFallback.pathname}${parsedFallback.search}${parsedFallback.hash}`;
      }
      if (parsedFallback.protocol === 'https:') {
        return `https://${parsedFallback.host}${parsedFallback.pathname}${parsedFallback.search}${parsedFallback.hash}`;
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
