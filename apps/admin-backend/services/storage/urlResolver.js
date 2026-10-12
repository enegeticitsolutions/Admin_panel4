const storageService = require('./index');

function extractStorageKey(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;
  
  // Public third-party URLs that don't need S3 presigning
  if (trimmed.includes('unsplash.com') || trimmed.includes('supabase.co')) return null;
  
  // Raw S3 key or relative path
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.replace(/^s3:\/\/[^/]+\//, '').replace(/^\/+/, '') || null;
  }
  
  try {
    const url = new URL(trimmed);
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    
    // Strip bucket prefix if this is a path-style S3 URL:
    // e.g. https://s3.ap-south-1.amazonaws.com/<bucket>/<key>
    // The bucket name comes exclusively from STORAGE_BUCKET env var.
    const configuredBucket = process.env.STORAGE_BUCKET;
    if (configuredBucket && pathname.startsWith(configuredBucket + '/')) {
      pathname = pathname.substring(configuredBucket.length + 1);
    } else {
      const parts = pathname.split('/');
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
    }

    // Strip any residual query-string fragments that URL.pathname may have missed
    pathname = pathname.split('?')[0];

    return pathname || null;
  } catch {
    return trimmed;
  }
}

async function resolveFileUrl(keyOrUrl, ttlSeconds = 1800) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;

  // External public CDN URLs
  if (trimmed.includes('unsplash.com') || trimmed.includes('supabase.co')) {
    return trimmed;
  }

  const key = extractStorageKey(trimmed);
  if (!key) {
    // If not an S3 key or URL, return as-is
    return trimmed;
  }

  // Defend against ttlSeconds being 0 or non-number (e.g. when passed from Array.prototype.map)
  const safeTtl = (typeof ttlSeconds === 'number' && ttlSeconds > 0) ? ttlSeconds : 1800;

  try {
    const url = await storageService.getPresignedUrl(key, safeTtl);
    return url;
  } catch (error) {
    console.warn(`[urlResolver] Failed to presign URL for key "${key}":`, error.message);
    return trimmed;
  }
}

/**
 * Resolves a list of storage keys or URLs (from array or JSON string) to presigned URLs.
 * Always passes the explicit ttlSeconds to resolveFileUrl so array index is never used as TTL.
 */
async function resolveFileUrls(rawList, ttlSeconds = 1800) {
  if (!rawList) return [];
  let items = [];
  if (Array.isArray(rawList)) {
    items = rawList.filter(item => typeof item === 'string' && item.trim().length > 0);
  } else if (typeof rawList === 'string') {
    const trimmed = rawList.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
        }
      } catch {
        items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (items.length === 0) return [];
  const safeTtl = (typeof ttlSeconds === 'number' && ttlSeconds > 0) ? ttlSeconds : 1800;
  const resolved = await Promise.all(items.map(item => resolveFileUrl(item, safeTtl)));
  return resolved.filter(Boolean);
}

module.exports = {
  extractStorageKey,
  resolveFileUrl,
  resolveFileUrls,
};
