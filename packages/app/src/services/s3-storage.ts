/**
 * S3-backed document storage for PHI-bearing uploads (e.g. prior-authorization
 * PDFs).
 *
 * AWS S3 is used because it is the project's BAA-covered storage vendor (the
 * same AWS account already used for Bedrock and SES). Objects are written with
 * server-side encryption (SSE-S3 / AES-256) and are never public — reads go
 * through short-lived presigned URLs only.
 *
 * Credentials follow the same env convention as the email client: explicit
 * AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY when set, otherwise the default SDK
 * credential chain (e.g. an attached IAM role).
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadDocumentParams {
  key: string;
  body: Buffer;
  contentType: string;
  /** Object metadata (string values only, per S3). Avoid putting PHI here. */
  metadata?: Record<string, string>;
}

export interface SignedDownloadParams {
  key: string;
  expiresInSeconds?: number;
}

export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(client?: S3Client, bucket?: string) {
    const resolvedBucket = bucket ?? process.env.DOCUMENTS_S3_BUCKET;
    if (!resolvedBucket) {
      throw new Error('DOCUMENTS_S3_BUCKET env var must be set for document uploads');
    }
    this.bucket = resolvedBucket;

    if (client) {
      this.client = client;
      return;
    }

    const region =
      process.env.DOCUMENTS_S3_REGION?.trim() ||
      process.env.AWS_REGION?.trim() ||
      'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

    this.client = new S3Client({
      region,
      // Explicit creds when provided; otherwise fall back to the default SDK
      // chain (IAM role) by leaving `credentials` undefined.
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  /** Upload an object with SSE-S3 encryption at rest. Returns the s3:// URI. */
  async uploadDocument(params: UploadDocumentParams): Promise<{ uri: string; key: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ServerSideEncryption: 'AES256',
        Metadata: params.metadata,
      }),
    );
    return { uri: `s3://${this.bucket}/${params.key}`, key: params.key };
  }

  /** Generate a short-lived presigned GET URL. Default TTL 15 minutes. */
  async getSignedDownloadUrl(params: SignedDownloadParams): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: params.key });
    return getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds ?? 15 * 60,
    });
  }
}
