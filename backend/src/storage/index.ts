import { SandboxStorageProvider } from './sandbox.js';
import type { StorageProvider } from './storage-provider.js';

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  // Only sandbox is wired today. Production selection would go here once
  // a real provider (S3 / R2) is configured via env.
  cached = new SandboxStorageProvider();
  return cached;
}

/** Test hook — replace the storage provider. */
export function _setStorage(p: StorageProvider | null) { cached = p; }
