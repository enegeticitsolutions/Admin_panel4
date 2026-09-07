const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const StorageService = require('./storageInterface');

/**
 * S3Storage — AWS S3 Storage Provider (admin-backend)
 *
 * Extends StorageService (Strategy Pattern). Activated when STORAGE_PROVIDER=s3.
 * Used in all deployed AWS environments (Staging + Production).
 *
 * Authentication:
 *   - ECS Fargate: Task IAM Role provides credentials automatically.
 *   - Local testing: set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in .env.
 *
 * File access model:
 *   - Bucket is PRIVATE. Files served via presigned URLs only.
 */
class S3Storage extends StorageService {
  constructor() {
    super();
    this.bucketName = process.env.STORAGE_BUCKET || 'maihoonna-media-staging';

    const region = process.env.AWS_REGION || 'ap-south-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    const clientConfig = { region };
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = { accessKeyId, secretAccessKey };
    }

    this.s3Client = new S3Client(clientConfig);
    this.region = region;
    console.log('[Storage] Using AWS S3 provider → bucket:', this.bucketName, '| region:', region);
  }

  async upload(fileBuffer, path, mimeType) {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: path,
      Body: fileBuffer,
      ContentType: mimeType,
      // Bucket is private — access via presigned URLs only
    }));

    return { path, url: path };
  }

  async delete(path) {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    }));
  }

  /**
   * Returns raw S3 URI. Not for client use — bucket is private.
   * Use getPresignedUrl() to generate client-accessible URLs.
   */
  async getPublicUrl(path) {
    return `s3://${this.bucketName}/${path}`;
  }

  /**
   * Generate a cryptographically signed, time-limited URL for secure file access.
   * The signature is bound to the exact path — any modification invalidates it.
   *
   * @param {string} path        - storage key (from upload result)
   * @param {number} ttlSeconds  - validity window. Default: 900 (15 minutes)
   * @returns {Promise<string>}  - HTTPS presigned URL valid for ttlSeconds
   */
  async getPresignedUrl(path, ttlSeconds = 900) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
  }
}

module.exports = S3Storage;



