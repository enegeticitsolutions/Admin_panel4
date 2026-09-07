import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService, UploadResult } from './StorageInterface';

/**
 * SupabaseStorage — Supabase Storage Provider
 *
 * Extends StorageService (Strategy Pattern). Activated when STORAGE_PROVIDER=supabase (default).
 * Used LOCALLY during development only — never in any deployed AWS environment.
 *
 * File access model mirrors production S3 behaviour:
 *   - getPresignedUrl() calls Supabase createSignedUrl() — same TTL-based signed access.
 *   - This ensures local dev behaves identically to the S3 production environment.
 */
export class SupabaseStorage extends StorageService {
  private readonly client: SupabaseClient;
  private readonly bucketName: string;

  constructor() {
    super();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        '[SupabaseStorage] Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
        'Set them in apps/api/.env for local development.'
      );
    }

    this.bucketName = process.env.STORAGE_BUCKET || 'staff-documents';
    this.client = createClient(url, key);
    console.log('[Storage] Using Supabase provider → bucket:', this.bucketName);
  }

  async upload(fileBuffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(path, fileBuffer, { contentType: mimeType, upsert: true });

    if (error) throw new Error(`[SupabaseStorage] Upload failed: ${error.message}`);

    const url = await this.getPublicUrl(path);
    return { path, url };
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) throw new Error(`[SupabaseStorage] Delete failed: ${error.message}`);
  }

  /**
   * Returns the Supabase public URL (valid only if bucket has public access enabled).
   * For local dev with a public bucket this works fine for quick testing.
   * In production (S3), use getPresignedUrl() instead.
   */
  async getPublicUrl(path: string): Promise<string> {
    const { data } = this.client.storage.from(this.bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Generate a time-limited signed URL via Supabase createSignedUrl.
   * Mirrors the presigned URL behaviour of S3 in local development.
   *
   * @param path       - storage key (from UploadResult.path)
   * @param ttlSeconds - validity window. Default: 900 (15 minutes)
   * @returns          - Signed Supabase URL, valid for ttlSeconds from now
   */
  async getPresignedUrl(path: string, ttlSeconds = 900): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .createSignedUrl(path, ttlSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`[SupabaseStorage] Presigned URL failed: ${error?.message ?? 'no URL returned'}`);
    }
    return data.signedUrl;
  }
}

