const FileResource = require('./FileResource');

/**
 * FileResourceRegistry — Singleton Registry (admin-backend)
 *
 * Holds all registered FileResource instances for the admin panel.
 * The presigned URL endpoint uses this to look up the correct handler
 * from the `type` query parameter.
 *
 * Registered at server startup in server.js.
 * Never needs to be modified to add new resource types.
 */
class FileResourceRegistry {
  constructor() {
    /** @type {Map<string, FileResource>} */
    this._resources = new Map();
  }

  /**
   * Register a FileResource handler.
   * @param {FileResource} resource - an instance of a FileResource subclass
   */
  register(resource) {
    if (this._resources.has(resource.resourceType)) {
      throw new Error(
        `[FileResourceRegistry] Duplicate: "${resource.resourceType}" is already registered.`
      );
    }
    this._resources.set(resource.resourceType, resource);
    console.log(`[FileResourceRegistry] Registered: "${resource.resourceType}" (TTL: ${resource.ttlSeconds}s)`);
  }

  /**
   * Retrieve a FileResource handler by type identifier.
   * @param {string} type
   * @returns {FileResource|undefined}
   */
  get(type) {
    return this._resources.get(type);
  }

  /** @returns {string[]} All registered type identifiers */
  types() {
    return Array.from(this._resources.keys());
  }
}

// Export a single shared instance for the server process lifetime
module.exports = new FileResourceRegistry();
