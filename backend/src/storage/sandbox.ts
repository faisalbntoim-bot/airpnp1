/**
 * SandboxStorageProvider — deterministic in-memory store for dev + tests.
 * Never persists to disk. Returns fake signed URLs that point back at a
 * dev-only route (which we do NOT implement here — tests just assert the
 * URL shape).
 */

import crypto from 'node:crypto';
import type {
  StorageProvider, SignedUploadRequest, SignedUploadResult, SignedDownloadResult,
} from './storage-provider.js';
import { assertUploadShape } from './storage-provider.js';

export class SandboxStorageProvider implements StorageProvider {
  readonly name = 'sandbox';

  async signUpload(input: SignedUploadRequest): Promise<SignedUploadResult> {
    assertUploadShape(input);
    const assetId = crypto.randomBytes(8).toString('hex');
    const providerKey = `sandbox/${input.ownerUserId}/${assetId}`;
    return {
      assetId,
      provider: this.name,
      providerKey,
      uploadUrl: `sandbox://upload/${providerKey}?ct=${encodeURIComponent(input.contentType)}`,
      method: 'PUT',
      headers: { 'x-amz-checksum-sha256': input.sha256 },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async signDownload(providerKey: string, ttlSeconds = 300): Promise<SignedDownloadResult> {
    return {
      assetId: providerKey.split('/').pop() ?? '',
      url: `sandbox://download/${providerKey}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }
}
