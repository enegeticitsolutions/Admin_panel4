import { getStorageService } from './index';

/**
 * Extract storage object key from either a raw key ("profiles/...", "visits/...")
 * or an absolute S3 URL ("https://maihoonna-media-staging.s3.ap-south-1.amazonaws.com/profiles/...").
 *
 * Returns null if the URL is already presigned (contains X-Amz-Signature) or is
 * an external public host (Unsplash, Supabase public, etc.) that requires no signing.
 */
export function extractStorageKey(keyOrUrl?: string | null): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;

  // Already a presigned AWS URL with active signatures
  if (trimmed.includes('X-Amz-Signature') || trimmed.includes('X-Amz-Algorithm')) {
    return null;
  }

  // Known external public hosts — no S3 signing needed
  if (trimmed.includes('unsplash.com') || trimmed.includes('supabase.co')) {
    return null;
  }

  // Not an HTTP/HTTPS URL — this is a direct storage path key
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    // Also strip s3:// protocol if present
    const clean = trimmed.replace(/^s3:\/\/[^/]+\//, '').replace(/^\/+/, '');
    return clean || null;
  }

  // Parse HTTP/HTTPS URL pointing to an S3 bucket
  try {
    const url = new URL(trimmed);
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const parts = pathname.split('/');
    // If pathname begins with the bucket name (e.g. s3.amazonaws.com/maihoonna-media-staging/...)
    if (
      parts[0] &&
      (parts[0].includes('maihoonna') ||
        parts[0].includes('staging') ||
        parts[0].includes('production') ||
        parts[0].includes('media') ||
        parts[0].includes('staff'))
    ) {
      parts.shift();
      pathname = parts.join('/');
    }
    return pathname || null;
  } catch {
    return trimmed;
  }
}

/**
 * Resolve a single storage key or raw URL to a secure, time-limited presigned URL.
 * If the input is already a valid external URL or presigned URL, it is returned as-is.
 *
 * @param keyOrUrl   Storage path, raw S3 URL, or public URL
 * @param ttlSeconds Lifetime of generated presigned URL in seconds (default: 1800 / 30m)
 */
export async function resolveFileUrl(
  keyOrUrl?: string | null,
  ttlSeconds = 1800
): Promise<string | null> {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;

  // If already presigned or public external host, return directly
  if (
    trimmed.includes('X-Amz-Signature') ||
    trimmed.includes('unsplash.com') ||
    trimmed.includes('supabase.co')
  ) {
    return trimmed;
  }

  const key = extractStorageKey(trimmed);
  if (!key) {
    return trimmed;
  }

  try {
    const storage = getStorageService();
    return await storage.getPresignedUrl(key, ttlSeconds);
  } catch (error: any) {
    console.warn(`[urlResolver] Failed to presign URL for key "${key}":`, error?.message || error);
    return trimmed;
  }
}

/**
 * Parse and resolve a collection of image URLs / keys into secure presigned URLs.
 * Accepts:
 *   - string array: ['visits/1.jpg', 'visits/2.jpg']
 *   - JSON string array: '["visits/1.jpg", "visits/2.jpg"]'
 *   - comma-separated string: 'visits/1.jpg, visits/2.jpg'
 *
 * @param rawList    Raw array or serialized string
 * @param ttlSeconds Lifetime in seconds (default: 1800)
 */
export async function resolveFileUrls(
  rawList?: (string | null | undefined)[] | string | null,
  ttlSeconds = 1800
): Promise<string[]> {
  if (!rawList) return [];

  let items: string[] = [];

  if (Array.isArray(rawList)) {
    items = rawList.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } else if (typeof rawList === 'string') {
    const trimmed = rawList.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        }
      } catch {
        items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (items.length === 0) return [];

  const resolved = await Promise.all(items.map(item => resolveFileUrl(item, ttlSeconds)));
  return resolved.filter((url): url is string => typeof url === 'string' && url.length > 0);
}
