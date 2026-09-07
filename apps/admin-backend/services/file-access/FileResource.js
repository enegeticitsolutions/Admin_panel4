/**
 * FileResource — Abstract Base Class (Registry Pattern + Template Method)
 *
 * All file types in the admin system are FileResource subclasses.
 * Each subclass owns its authorization logic.
 *
 * ─── Adding a new file type ───────────────────────────────────────────────────
 *   1. Create: services/file-access/resources/YourResource.js
 *   2. Extend FileResource, implement resourceType + getFileKey()
 *   3. Register one line in server.js: registry.register(new YourResource())
 *   Route, endpoint, signing logic — nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
class FileResource {
  /**
   * Unique type identifier used in the query string.
   * Must be lowercase with underscores. E.g: 'staff_document', 'profile_photo'
   * @type {string}
   */
  get resourceType() {
    throw new Error('resourceType must be implemented by subclass');
  }

  /**
   * How long the presigned URL is valid, in seconds.
   * Override in subclass to customize per resource type.
   * Default: 900 seconds (15 minutes).
   * @type {number}
   */
  get ttlSeconds() {
    return 900;
  }

  /**
   * Fetch the storage key for a resource, with authorization check.
   *
   * Implementation must:
   *   1. Look up the resource by resourceId in the database
   *   2. Verify userId (staff/admin) is allowed to access it
   *   3. Return fileKey string if authorized, null if not
   *
   * @param {string} resourceId - the ID of the resource
   * @param {string} userId     - the authenticated staff/admin user ID
   * @returns {Promise<string|null>} storage key, or null for 403
   */
  async getFileKey(resourceId, userId) {
    throw new Error('getFileKey() must be implemented by subclass');
  }
}

module.exports = FileResource;
