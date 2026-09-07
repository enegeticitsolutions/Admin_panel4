import { FileResource } from './FileResource';

/**
 * FileResourceRegistry — Singleton Registry
 *
 * Holds all registered FileResource instances.
 * The presigned URL endpoint uses this to look up the right resource handler
 * from the `type` query parameter.
 *
 * Registered at server startup in main.ts.
 * Never needs to be modified to add new resource types.
 */
class FileResourceRegistry {
  private readonly resources = new Map<string, FileResource>();

  /**
   * Register a FileResource handler.
   * Called once at server startup for each file type.
   *
   * @param resource - an instance of a FileResource subclass
   * @throws if a resource with the same resourceType is already registered
   */
  register(resource: FileResource): void {
    if (this.resources.has(resource.resourceType)) {
      throw new Error(
        `[FileResourceRegistry] Duplicate registration: "${resource.resourceType}" is already registered.`
      );
    }
    this.resources.set(resource.resourceType, resource);
    console.log(`[FileResourceRegistry] Registered resource type: "${resource.resourceType}" (TTL: ${resource.ttlSeconds}s)`);
  }

  /**
   * Retrieve a FileResource handler by type identifier.
   *
   * @param type - the resourceType string from the query param
   * @returns     - the matching FileResource, or undefined if not found
   */
  get(type: string): FileResource | undefined {
    return this.resources.get(type);
  }

  /** Return all registered type identifiers (for debugging / health checks). */
  types(): string[] {
    return Array.from(this.resources.keys());
  }
}

// Export a single shared instance for the lifetime of the server process
export const fileResourceRegistry = new FileResourceRegistry();
