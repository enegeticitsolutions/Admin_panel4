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

  // If STORAGE_PROVIDER is explicitly set:
  //   - 'supabase' forces SupabaseStorage
  //   - 's3' forces S3Storage
  // When unset, auto-detect: S3 if Supabase URL is missing and S3 bucket is configured.
  const isS3 =
    rawProvider === 's3' ||
    (rawProvider !== 'supabase' && (!process.env.SUPABASE_URL && (process.env.STORAGE_BUCKET || '').toLowerCase().includes('maihoonna')));

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
