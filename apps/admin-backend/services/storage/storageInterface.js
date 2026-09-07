/**
 * StorageService — Abstract Base Class (Strategy Pattern)
 *
 * All storage providers must extend this class and implement every method.
 * Switching providers: set STORAGE_PROVIDER env var — no code change needed.
 * Adding a provider: extend this class, implement the 4 methods.
 */
class StorageService {
  /**
   * Upload a file buffer to the given storage path.
   * @param {Buffer} fileBuffer - raw file bytes
   * @param {string} path       - destination key/path inside the bucket
   * @param {string} mimeType   - MIME type (e.g. 'image/jpeg', 'application/pdf')
   * @returns {Promise<{ path: string, url: string }>}
   */
  async upload(fileBuffer, path, mimeType) {
    throw new Error('upload() must be implemented by subclass');
  }

  /**
   * Delete a file by its storage key/path.
   * @param {string} path - key returned from upload()
   * @returns {Promise<void>}
   */
  async delete(path) {
    throw new Error('delete() must be implemented by subclass');
  }

  /**
   * Get the public URL for a stored file.
   * For private S3 buckets, use getPresignedUrl() instead.
   * @param {string} path
   * @returns {Promise<string>}
   */
  async getPublicUrl(path) {
    throw new Error('getPublicUrl() must be implemented by subclass');
  }

  /**
   * Generate a short-lived, cryptographically signed URL for secure file access.
   * The URL is bound to the exact path — any modification invalidates the signature.
   * After ttlSeconds, the URL permanently expires.
   *
   * @param {string} path        - storage key (from upload result)
   * @param {number} ttlSeconds  - validity window. Default: 900 (15 minutes)
   * @returns {Promise<string>}  - signed, time-limited HTTPS URL
   */
  async getPresignedUrl(path, ttlSeconds = 900) {
    throw new Error('getPresignedUrl() must be implemented by subclass');
  }
}

module.exports = StorageService;

