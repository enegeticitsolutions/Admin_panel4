const { createClient } = require('@supabase/supabase-js');
const StorageService = require('./storageInterface');

/**
 * SupabaseStorage — Supabase Storage Provider (admin-backend)
 *
 * Extends StorageService (Strategy Pattern). Activated when STORAGE_PROVIDER=supabase (default).
 * Used LOCALLY during development only — never in any deployed AWS environment.
 *
 * getPresignedUrl() uses Supabase createSignedUrl() to mirror S3 presigned URL behaviour
 * so local dev is identical to production.
 */
class SupabaseStorage extends StorageService {
  constructor() {
    super();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    this.bucketName = process.env.STORAGE_BUCKET || 'staff-documents';

    const isPlaceholder = !supabaseKey || supabaseKey === 'your-service-role-key-here';

    if (!supabaseUrl || isPlaceholder) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (isPlaceholder) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      console.error(`[SupabaseStorage] Missing env vars: ${missing.join(', ')}. Set in apps/admin-backend/.env`);
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        global: { WebSocket: require('ws') },
      });
      console.log('[Storage] Using Supabase provider → bucket:', this.bucketName);
    }
  }

  async upload(fileBuffer, path, mimeType) {
    if (!this.supabase) throw new Error('Supabase client is not initialized');

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, fileBuffer, { contentType: mimeType, upsert: false });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const url = await this.getPublicUrl(path);
    return { path: data.path, url };
  }

  async delete(path) {
    if (!this.supabase) throw new Error('Supabase client is not initialized');

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  /**
   * Returns the Supabase public URL.
   * Valid only if the bucket has public access. Use getPresignedUrl() for private buckets.
   */
  async getPublicUrl(path) {
    if (!this.supabase) throw new Error('Supabase client is not initialized');
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Generate a time-limited signed URL via Supabase createSignedUrl.
   * Mirrors the presigned URL behaviour of S3 in local development.
   *
   * @param {string} path        - storage key (from upload result)
   * @param {number} ttlSeconds  - validity window. Default: 900 (15 minutes)
   * @returns {Promise<string>}  - Signed Supabase URL valid for ttlSeconds
   */
  async getPresignedUrl(path, ttlSeconds = 900) {
    if (!this.supabase) throw new Error('Supabase client is not initialized');

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, ttlSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`[SupabaseStorage] Presigned URL failed: ${error?.message ?? 'no URL returned'}`);
    }
    return data.signedUrl;
  }
}

module.exports = SupabaseStorage;

