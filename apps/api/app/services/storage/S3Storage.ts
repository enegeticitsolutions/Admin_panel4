import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService, UploadResult } from './StorageInterface';

/**
 * S3Storage — AWS S3 Storage Provider
 *
 * Extends StorageService (Strategy Pattern). Activated when STORAGE_PROVIDER=s3.
 * Used in all deployed environments (Staging + Production) on AWS ECS Fargate.
 *
 * Authentication:
 *   - On ECS Fargate: the Task IAM Role provides credentials automatically via
 *     the ECS metadata endpoint — no AWS_ACCESS_KEY_ID / SECRET needed.
 *   - Locally (if testing S3): set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.
 *
 * File access model:
 *   - Bucket remains PRIVATE (Block All Public Access = ON).
 *   - Files are served via time-limited presigned URLs generated server-side.
 *   - Direct S3 URLs are never given to clients.
 */
export class S3Storage extends StorageService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    super();
    this.bucketName = process.env.STORAGE_BUCKET || 'maihoonna-media-staging';
    this.region = process.env.AWS_REGION || 'ap-south-1';

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = { region: this.region };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = { accessKeyId, secretAccessKey };
      console.log('[Storage] S3: using explicit AWS_ACCESS_KEY_ID credentials from environment.');
    } else {
      // On ECS Fargate with a Task IAM Role this is fine — the SDK resolves creds automatically.
      // On a plain Ubuntu/VPS server (no IAM instance profile), uploads WILL fail.
      // Fix: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.
      console.warn(
        '[Storage] S3: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set in environment. ' +
        'Relying on IAM instance profile / ECS Task Role / ~/.aws/credentials. ' +
        'If this is a plain Ubuntu server (not EC2/ECS), set explicit credentials in .env.'
      );
    }

    this.s3 = new S3Client(clientConfig);
    console.log('[Storage] Using AWS S3 provider → bucket:', this.bucketName, '| region:', this.region);
  }

  async upload(fileBuffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: path,
        Body: fileBuffer,
        ContentType: mimeType,
        // Bucket is private — access via presigned URLs only
      })
    );
    // Return the storage path as url too (callers that need a real URL must call getPresignedUrl)
    return { path, url: path };
  }

  async delete(path: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: path,
      })
    );
  }

  /**
   * Returns the raw S3 URI. Do NOT expose to clients — bucket is private.
   * Provided only for internal logging/debugging. Use getPresignedUrl() for client access.
   */
  async getPublicUrl(path: string): Promise<string> {
    return `s3://${this.bucketName}/${path}`;
  }

  /**
   * Generate a cryptographically signed, time-limited URL for secure file access.
   * The URL signature is bound to the exact path — changing any character invalidates it.
   *
   * @param path       - storage key (from UploadResult.path)
   * @param ttlSeconds - validity window in seconds. Default: 900 (15 minutes).
   * @returns          - HTTPS presigned URL, valid for ttlSeconds from now
   */
  async getPresignedUrl(path: string, ttlSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });
    return getSignedUrl(this.s3, command, { expiresIn: ttlSeconds });
  }
}

