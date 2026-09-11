import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

/**
 * PresignedUrlService — Client-side helper for fetching presigned file URLs
 *
 * Wraps the backend's GET /api/files/presigned endpoint.
 * Every file access goes through this — never use raw fileUrl/fileKey directly.
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

    const token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('userToken'));

    const response = await fetch(`${API_URL}/files/presigned?type=${type}&id=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.url) {
      throw new Error(data?.message || `Failed to get presigned URL for ${type}:${id}`);
    }

    const { url, expiresAt } = data;

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
