const SupabaseStorage = require('./supabaseStorage');
const S3Storage = require('./s3Storage');

let storageServiceInstance = null;

function getStorageService() {
  if (storageServiceInstance) return storageServiceInstance;

  const rawProvider = (process.env.STORAGE_PROVIDER || '').replace(/['"]/g, '').trim().toLowerCase();
  
  // Auto-detect S3 if explicitly set to 's3' OR if Supabase credentials are not configured and S3 bucket is present
  const isS3 = rawProvider === 's3' || 
               (!process.env.SUPABASE_URL && (process.env.STORAGE_BUCKET || '').toLowerCase().includes('maihoonna'));

  if (isS3) {
    storageServiceInstance = new S3Storage();
  } else {
    // Default to supabase
    storageServiceInstance = new SupabaseStorage();
  }

  return storageServiceInstance;
}

// Export dynamic proxy to prevent stale uninitialized instance
const storageProxy = new Proxy({}, {
  get(target, prop) {
    const service = getStorageService();
    const val = service[prop];
    if (typeof val === 'function') {
      return val.bind(service);
    }
    return val;
  }
});

module.exports = storageProxy;
module.exports.getStorageService = getStorageService;

