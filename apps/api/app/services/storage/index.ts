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

  const provider = (process.env.STORAGE_PROVIDER || 'supabase').toLowerCase();

  if (provider === 's3') {
    instance = new S3Storage();
  } else {
    // Default to Supabase for local development
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
