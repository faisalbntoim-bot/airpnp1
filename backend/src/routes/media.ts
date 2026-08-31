/**
 * Media upload flow.
 *
 *   1. Client asks the API for a signed upload URL (POST /v1/media/upload-url)
 *   2. Client PUTs the file directly to the storage provider
 *   3. Client tells the API "I'm done" (POST /v1/media) — server records the
 *      MediaAsset row + optionally invokes the malware scanner hook
 *   4. Reads happen via short-lived signed download URLs (GET /v1/media/:id/url)
 *
 * No blob ever transits the API — the file goes straight to storage.
 * Filenames are provider-generated; users cannot supply their own.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requireAuth, isAdminRole } from '../auth/rbac.js';
import { getStorage } from '../storage/index.js';
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '../storage/storage-provider.js';
import { badRequest, notFound } from '../errors.js';
import { jsonSafe } from '../money.js';

const signSchema = z.object({
  kind: z.enum(['image', 'video', 'document']),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  propertyId: z.string().optional(),
  visibility: z.enum(['private', 'public']).default('private'),
});

const finalizeSchema = z.object({
  assetId: z.string().min(1),
  providerKey: z.string().min(1),
  kind: z.enum(['image', 'video', 'document']),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i),
  propertyId: z.string().optional(),
  visibility: z.enum(['private', 'public']).default('private'),
});

export default async function mediaRoutes(app: FastifyInstance) {
  app.post('/v1/media/upload-url', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = signSchema.parse(req.body);
    // Extra check: contentType must match kind's allow-list (also enforced inside the provider).
    if (!ALLOWED_CONTENT_TYPES[body.kind].includes(body.contentType)) {
      throw badRequest(`contentType ${body.contentType} not allowed for kind=${body.kind}`);
    }
    const storage = getStorage();
    const signed = await storage.signUpload({
      ownerUserId: caller.userId,
      propertyId: body.propertyId,
      kind: body.kind,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      sha256: body.sha256,
      visibility: body.visibility,
    });
    return jsonSafe(signed);
  });

  app.post('/v1/media', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = finalizeSchema.parse(req.body);
    const asset = await getPrisma().mediaAsset.create({
      data: {
        id: body.assetId,
        ownerUserId: caller.userId,
        propertyId: body.propertyId ?? null,
        kind: body.kind,
        provider: getStorage().name,
        providerKey: body.providerKey,
        mimeType: body.contentType,
        sizeBytes: body.sizeBytes,
        sha256: body.sha256,
        visibility: body.visibility,
      },
    });
    // Malware scan hook (fire-and-forget — implementers can await if desired).
    await getStorage().malwareScannerHook?.(asset.providerKey);
    return jsonSafe(asset);
  });

  app.get('/v1/media/:id/url', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const { id } = req.params as { id: string };
    const prisma = getPrisma();
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw notFound('media not found');
    // Private assets only readable by the owner or an admin. Public assets by anyone authed.
    if (asset.visibility === 'private') {
      if (asset.ownerUserId !== caller.userId && !isAdminRole(caller.role)) {
        throw notFound('media not found');
      }
    }
    const signed = await getStorage().signDownload(asset.providerKey, 300);
    return jsonSafe(signed);
  });
}
