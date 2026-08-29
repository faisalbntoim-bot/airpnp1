/**
 * S3StorageProvider — INTENTIONAL STUB.
 *
 * Refuses to instantiate without credentials so that a mis-configured
 * production build fails at boot, not at first upload. When wiring the
 * real S3 / R2 client, keep this file's shape but implement the AWS SDK
 * PresignedURL calls.
 */

import { notImplemented } from '../errors.js';
import type {
  StorageProvider, SignedUploadRequest, SignedUploadResult, SignedDownloadResult,
} from './storage-provider.js';

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    private readonly accessKeyId: string,
    private readonly secretAccessKey: string,
  ) {
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error('S3StorageProvider: BUCKET, REGION, and credentials are all required');
    }
  }

  async signUpload(_input: SignedUploadRequest): Promise<SignedUploadResult> {
    throw notImplemented('s3.signUpload: wire aws-sdk PresignedURL POST/PUT');
  }
  async signDownload(_providerKey: string, _ttl?: number): Promise<SignedDownloadResult> {
    throw notImplemented('s3.signDownload: wire aws-sdk PresignedURL GET');
  }
}
