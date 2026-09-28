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

  try {
    console.log('[urlResolver] Presigning key:', key.substring(0, 60));
    const url = await storageService.getPresignedUrl(key, ttlSeconds);
    return url;
  } catch (error) {
    console.warn(`[urlResolver] Failed to presign URL for key "${key}":`, error.message);
    return trimmed;
  }
}

module.exports = {
  extractStorageKey,
  resolveFileUrl
};
