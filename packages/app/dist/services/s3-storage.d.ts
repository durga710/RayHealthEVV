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
import { S3Client } from '@aws-sdk/client-s3';
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
export declare class S3StorageService {
    private readonly client;
    private readonly bucket;
    constructor(client?: S3Client, bucket?: string);
    /** Upload an object with SSE-S3 encryption at rest. Returns the s3:// URI. */
    uploadDocument(params: UploadDocumentParams): Promise<{
        uri: string;
        key: string;
    }>;
    /** Generate a short-lived presigned GET URL. Default TTL 15 minutes. */
    getSignedDownloadUrl(params: SignedDownloadParams): Promise<string>;
}
//# sourceMappingURL=s3-storage.d.ts.map