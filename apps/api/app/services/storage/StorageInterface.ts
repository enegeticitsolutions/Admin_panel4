/**
 * StorageService — Abstract Base Class (Strategy Pattern)
 *
 * All storage providers (AWS S3, Supabase, etc.) must extend this class
 * and implement every abstract method.
 *
 * Switching providers: set STORAGE_PROVIDER env var — no code change ever needed.
 * Adding a new provider: extend this class, implement the 4 abstract methods.
 */
export interface UploadResult {
  /** The storage key / object path where the file was saved (e.g. "profiles/abc/photo.jpg") */
  path: string;
  /** The URL to the file — public URL (Supabase dev) or direct S3 URL */
  url: string;
}

export abstract class StorageService {
  /**
   * Upload a file buffer to the given storage path.
   * @param fileBuffer - raw file bytes
   * @param path       - destination key/path inside the bucket
   * @param mimeType   - MIME type (e.g. 'image/jpeg', 'application/pdf')
   * @returns UploadResult containing the storage path and URL
   */
  abstract upload(fileBuffer: Buffer, path: string, mimeType: string): Promise<UploadResult>;

  /**
   * Delete a file from storage by its storage key/path.
   * @param path - the key returned from upload()
   */
  abstract delete(path: string): Promise<void>;

  /**
   * Get the public URL for a stored file.
   * For private buckets (S3), use getPresignedUrl() instead.
   * @param path - the key/path of the stored file
   */
  abstract getPublicUrl(path: string): Promise<string>;

  /**
   * Generate a short-lived, cryptographically signed URL that allows secure access
   * to a private file without making the bucket public.
   *
   * The URL is signed — modifying the path or query string invalidates the signature.
   * After ttlSeconds the URL expires permanently.
   *
   * @param path       - the storage key/path of the file (from UploadResult.path)
   * @param ttlSeconds - how long the URL is valid. Default: 900 (15 minutes)
   * @returns A signed, time-limited URL safe to hand to a client
   */
  abstract getPresignedUrl(path: string, ttlSeconds?: number): Promise<string>;
}
