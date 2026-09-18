const storageService = require('./index');

function extractStorageKey(keyOrUrl) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;
  
  if (trimmed.includes('X-Amz-Signature') || trimmed.includes('X-Amz-Algorithm')) return null;
  if (trimmed.includes('unsplash.com') || trimmed.includes('supabase.co')) return null;
  
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.replace(/^s3:\/\/[^/]+\//, '').replace(/^\/+/, '') || null;
  }
  
  try {
    const url = new URL(trimmed);
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const parts = pathname.split('/');
    if (parts[0] && (parts[0].includes('maihoonna') || parts[0].includes('staging') || parts[0].includes('production') || parts[0].includes('media') || parts[0].includes('staff'))) {
      parts.shift();
      pathname = parts.join('/');
    }
    return pathname || null;
  } catch {
    return trimmed;
  }
}

async function resolveFileUrl(keyOrUrl, ttlSeconds = 1800) {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;

  if (trimmed.includes('X-Amz-Signature') || trimmed.includes('unsplash.com') || trimmed.includes('supabase.co')) {
    return trimmed;
  }

  const key = extractStorageKey(trimmed);
  if (!key) return trimmed;

  try {
    console.log('[urlResolver] Presigning key:', key.substring(0, 60));
    const url = await storageService.getPresignedUrl(key, ttlSeconds);
    console.log('[urlResolver] Presigned OK, URL starts:', url?.substring(0, 60));
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
