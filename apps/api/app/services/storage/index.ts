import { StorageService } from './StorageInterface';
import { SupabaseStorage } from './SupabaseStorage';
import { S3Storage } from './S3Storage';

/**
 * StorageFactory — Singleton
 *
 * Returns the correct storage provider based on the STORAGE_PROVIDER env var:
 *   - STORAGE_PROVIDER=supabase  →  SupabaseStorage (default, for local development)
 *   - STORAGE_PROVIDER=s3        →  S3Storage        (for staging & production on AWS)
 *
 * The instance is created once and reused for the lifetime of the process.
 * To switch providers: change STORAGE_PROVIDER in your .env or AWS Secrets Manager.
 * No code change is ever required.
 */
let instance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (instance) return instance;

  const rawProvider = (process.env.STORAGE_PROVIDER || '').replace(/['"]/g, '').trim().toLowerCase();

  // In AWS environments (Staging / Production), use S3Storage.
  // Auto-detect S3 if explicitly requested, or if STORAGE_BUCKET is configured, or if Supabase is not configured.
  const isS3 =
    rawProvider === 's3' ||
    Boolean(process.env.STORAGE_BUCKET) ||
    !process.env.SUPABASE_URL;

  if (isS3) {
    instance = new S3Storage();
  } else {
    instance = new SupabaseStorage();
  }

  return instance;
}

/** Reset the singleton — only used in tests */
export function _resetStorageInstance(): void {
  instance = null;
}

export * from './StorageInterface';
export * from './urlResolver';
