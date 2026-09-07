import { apiClient } from '../core/api'; // adjust this import to match your actual API client path

/**
 * PresignedUrlService — Client-side helper for fetching presigned file URLs
 *
 * Wraps the backend's GET /api/files/presigned endpoint.
 * Every file access goes through this — never use raw fileUrl/fileKey directly.
 *
 * The backend:
 *   1. Verifies your JWT (who are you?)
 *   2. Checks you're authorized to see this specific resource
 *   3. Returns a time-limited signed URL (default: 15 minutes)
 *
 * Usage:
 *   const url = await PresignedUrlService.get('medical_record', record.id);
 *   <Image source={{ uri: url }} />
 */
export class PresignedUrlService {
  /** In-memory URL cache keyed by "type:id". Auto-cleared on expiry. */
  private static cache = new Map<string, { url: string; expiresAt: number }>();

  /**
   * Fetch a presigned URL for a file resource.
   * Caches the URL until 60 seconds before it expires to avoid redundant requests.
   *
   * @param type - resource type (e.g. 'medical_record', 'visit_image', 'profile_photo')
   * @param id   - the resource ID
   * @returns    - the presigned HTTPS URL, ready to use in <Image> or WebBrowser
   * @throws     - if the user is not authorized or the request fails
   */
  static async get(type: string, id: string): Promise<string> {
    const cacheKey = `${type}:${id}`;
    const cached = this.cache.get(cacheKey);
    const nowMs = Date.now();

    // Return cached URL if still valid (with 60-second buffer before expiry)
    if (cached && cached.expiresAt - 60_000 > nowMs) {
      return cached.url;
    }

    const response = await apiClient.get<{
      success: boolean;
      url: string;
      expiresAt: string;
      ttlSeconds: number;
    }>(`/files/presigned?type=${type}&id=${encodeURIComponent(id)}`);

    if (!response.data.success || !response.data.url) {
      throw new Error(`Failed to get presigned URL for ${type}:${id}`);
    }

    const { url, expiresAt } = response.data;

    // Cache it until expiry
    this.cache.set(cacheKey, {
      url,
      expiresAt: new Date(expiresAt).getTime(),
    });

    return url;
  }

  /**
   * Clear the cache for a specific resource (e.g. after re-uploading a file).
   * @param type - resource type
   * @param id   - resource ID
   */
  static invalidate(type: string, id: string): void {
    this.cache.delete(`${type}:${id}`);
  }

  /** Clear the entire URL cache (e.g. on logout). */
  static clearAll(): void {
    this.cache.clear();
  }
}
