import prisma from '../../core/database';

/**
 * FileResource — Abstract Base Class (Registry Pattern + Template Method)
 *
 * Every file type in the system is a FileResource subclass.
 * Each subclass encapsulates its own authorization logic:
 *   "Can userId access this resourceId's file?"
 *
 * The presigned URL endpoint calls getFileKey(resourceId, userId).
 * If the result is null → 403 Forbidden. If it's a string → sign that key.
 *
 * ─── Adding a new file type ───────────────────────────────────────────────────
 *   1. Create a file: services/file-access/resources/YourResource.ts
 *   2. Extend FileResource and implement resourceType + getFileKey()
 *   3. Register one line in main.ts: registry.register(new YourResource())
 *   Route, endpoint, signing logic — nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export abstract class FileResource {
  /**
   * Unique type identifier used in the query string.
   * Example: 'medical_record', 'visit_image', 'profile_photo'
   * Must be URL-safe (lowercase, underscores only).
   */
  abstract readonly resourceType: string;

  /**
   * How long the presigned URL is valid, in seconds.
   * Override in subclass if this resource type needs a different TTL.
   * Default: 900 seconds (15 minutes).
   */
  readonly ttlSeconds: number = 900;

  /**
   * Fetch the storage key (file path) for a resource, with authorization.
   *
   * Implementation must:
   *   1. Look up the resource by resourceId in the database
   *   2. Verify that userId is authorized to access it
   *   3. Return the fileKey string if authorized, or null if not
   *
   * Returning null causes the endpoint to respond with 403 Forbidden.
   * Throw an Error to cause a 500 Internal Server Error.
   *
   * @param resourceId - the ID of the specific resource (e.g. medicalRecord.id)
   * @param userId     - the authenticated user's ID (from JWT)
   * @returns          - the storage key/path, or null if access is denied
   */
  abstract getFileKey(resourceId: string, userId: string): Promise<string | null>;
}
