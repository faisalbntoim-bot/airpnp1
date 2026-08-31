import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { resetDb, shutdown, buildTestApp } from './helpers.js';
import propertyRoutes from '../src/routes/properties.js';
import complaintRoutes from '../src/routes/complaints.js';
import mediaRoutes from '../src/routes/media.js';
import adminPropertyRoutes from '../src/routes/admin.properties.js';
import { getPrisma } from '../src/db.js';

async function serverWithHelmet() {
  const app = Fastify({ logger: false, bodyLimit: 1024 * 5 }); // 5KB tiny cap for the test
  await app.register(helmet, { contentSecurityPolicy: false });
  app.post('/echo', async (req) => req.body);
  await app.ready();
  return app;
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await shutdown(); });

describe('security headers (helmet)', () => {
  it('sets the standard hardening headers', async () => {
    const app = await serverWithHelmet();
    const res = await app.inject({ method: 'POST', url: '/echo', payload: { x: 1 }, headers: { 'content-type': 'application/json' } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    await app.close();
  });
});

describe('body size limit', () => {
  it('rejects a body larger than the configured limit', async () => {
    const app = await serverWithHelmet();
    const big = { blob: 'a'.repeat(6000) };
    const res = await app.inject({ method: 'POST', url: '/echo', payload: JSON.stringify(big), headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(413);
    await app.close();
  });
});

describe('complaints — anonymous + admin', () => {
  it('anyone can file; admin can list; non-admin sees only their own listings', async () => {
    const prisma = getPrisma();
    const alice = await prisma.user.create({ data: { phone: '+9660800', nameAr: 'أ' } });
    const bob   = await prisma.user.create({ data: { phone: '+9660801', nameAr: 'ب' } });
    const admin = await prisma.user.create({ data: { phone: '+9660802', nameAr: 'م' } });
    const property = await prisma.property.create({
      data: { listingNumber: 'L-CMP-1', ownerId: alice.id, category: 'apartment', purpose: 'daily' },
    });

    const app = await buildTestApp(async (a) => { await a.register(complaintRoutes); });
    // Bob files a complaint against alice's property
    const filed = await app.inject({
      method: 'POST', url: '/v1/complaints',
      payload: { category: 'advertisement', propertyId: property.id, description: 'المعلومات غير دقيقة على الإطلاق.' },
      headers: { 'content-type': 'application/json', 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(filed.statusCode).toBe(200);

    // Bob cannot list — CUSTOMER not in allowed roles → 403
    const bobList = await app.inject({
      method: 'GET', url: '/v1/complaints',
      headers: { 'x-user-id': bob.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(bobList.statusCode).toBe(403);

    // Alice (as property owner + HOST role) sees only her own listings' complaints
    const aliceList = await app.inject({
      method: 'GET', url: '/v1/complaints',
      headers: { 'x-user-id': alice.id, 'x-user-role': 'HOST' },
    });
    expect(aliceList.statusCode).toBe(200);
    expect(aliceList.json().total).toBe(1);

    // Admin sees all
    const adminList = await app.inject({
      method: 'GET', url: '/v1/complaints',
      headers: { 'x-user-id': admin.id, 'x-user-role': 'ADMIN' },
    });
    expect(adminList.statusCode).toBe(200);
    expect(adminList.json().total).toBe(1);
    await app.close();
  });

  it('rejects a description under 10 chars', async () => {
    const app = await buildTestApp(async (a) => { await a.register(complaintRoutes); });
    const res = await app.inject({
      method: 'POST', url: '/v1/complaints',
      payload: { category: 'other', description: 'short' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('property compliance lifecycle', () => {
  it('DRAFT → SUBMITTED → VERIFIED → PUBLISHED (happy path)', async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.create({ data: { phone: '+9660810', nameAr: 'م' } });
    const host  = await prisma.user.create({ data: { phone: '+9660811', nameAr: 'ه' } });
    const p = await prisma.property.create({
      data: { listingNumber: 'L-LIFE-1', ownerId: host.id, category: 'apartment', purpose: 'daily' },
    });

    const app = await buildTestApp(async (a) => { await a.register(adminPropertyRoutes); });
    const auth = { 'x-user-id': admin.id, 'x-user-role': 'ADMIN' };

    const r1 = await app.inject({ method: 'POST', url: `/v1/admin/properties/${p.id}/submit`, payload: {}, headers: { 'content-type': 'application/json', ...auth } });
    expect(r1.json().advertisementLifecycle).toBe('SUBMITTED');

    const r2 = await app.inject({
      method: 'POST', url: `/v1/admin/properties/${p.id}/mark-verified`,
      payload: {
        regaLicenseNumber: 'REGA-2026-000001',
        regaLicenseIssuedAt:  '2026-01-01T00:00:00.000Z',
        regaLicenseExpiresAt: '2027-01-01T00:00:00.000Z',
      },
      headers: { 'content-type': 'application/json', ...auth },
    });
    expect(r2.json().advertisementLifecycle).toBe('VERIFIED');

    const r3 = await app.inject({ method: 'POST', url: `/v1/admin/properties/${p.id}/publish`, payload: {}, headers: { 'content-type': 'application/json', ...auth } });
    expect(r3.json().advertisementLifecycle).toBe('PUBLISHED');
    await app.close();
  });

  it('refuses publish without a REGA licence', async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.create({ data: { phone: '+9660820', nameAr: 'م' } });
    const host  = await prisma.user.create({ data: { phone: '+9660821', nameAr: 'ه' } });
    const p = await prisma.property.create({
      data: { listingNumber: 'L-LIFE-2', ownerId: host.id, category: 'apartment', purpose: 'daily' },
    });
    // Try to publish directly from DRAFT
    const app = await buildTestApp(async (a) => { await a.register(adminPropertyRoutes); });
    const res = await app.inject({
      method: 'POST', url: `/v1/admin/properties/${p.id}/publish`,
      payload: {}, headers: { 'content-type': 'application/json', 'x-user-id': admin.id, 'x-user-role': 'ADMIN' },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('refuses an expired licence at publish time', async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.create({ data: { phone: '+9660830', nameAr: 'م' } });
    const host  = await prisma.user.create({ data: { phone: '+9660831', nameAr: 'ه' } });
    const p = await prisma.property.create({
      data: {
        listingNumber: 'L-LIFE-3', ownerId: host.id, category: 'apartment', purpose: 'daily',
        advertisementLifecycle: 'VERIFIED',
        regaLicenseNumber: 'REGA-old',
        regaLicenseIssuedAt: new Date(Date.now() - 365 * 24 * 3600 * 1000),
        regaLicenseExpiresAt: new Date(Date.now() - 24 * 3600 * 1000),
      },
    });
    const app = await buildTestApp(async (a) => { await a.register(adminPropertyRoutes); });
    const res = await app.inject({
      method: 'POST', url: `/v1/admin/properties/${p.id}/publish`,
      payload: {}, headers: { 'content-type': 'application/json', 'x-user-id': admin.id, 'x-user-role': 'ADMIN' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/expired/i);
    await app.close();
  });
});

describe('media signed upload', () => {
  it('refuses an oversized file', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { phone: '+9660840', nameAr: 'م' } });
    const app = await buildTestApp(async (a) => { await a.register(mediaRoutes); });
    const res = await app.inject({
      method: 'POST', url: '/v1/media/upload-url',
      payload: {
        kind: 'image', contentType: 'image/png',
        sizeBytes: 100 * 1024 * 1024,
        sha256: 'a'.repeat(64),
      },
      headers: { 'content-type': 'application/json', 'x-user-id': user.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('refuses an unsupported content type', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { phone: '+9660841', nameAr: 'م' } });
    const app = await buildTestApp(async (a) => { await a.register(mediaRoutes); });
    const res = await app.inject({
      method: 'POST', url: '/v1/media/upload-url',
      payload: {
        kind: 'image', contentType: 'application/x-msdownload',
        sizeBytes: 1024, sha256: 'a'.repeat(64),
      },
      headers: { 'content-type': 'application/json', 'x-user-id': user.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('signs a valid upload request and returns a short-lived URL', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { phone: '+9660842', nameAr: 'م' } });
    const app = await buildTestApp(async (a) => { await a.register(mediaRoutes); });
    const res = await app.inject({
      method: 'POST', url: '/v1/media/upload-url',
      payload: {
        kind: 'image', contentType: 'image/jpeg', sizeBytes: 500_000, sha256: 'a'.repeat(64),
      },
      headers: { 'content-type': 'application/json', 'x-user-id': user.id, 'x-user-role': 'CUSTOMER' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe('sandbox');
    expect(body.uploadUrl).toMatch(/^sandbox:\/\//);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await app.close();
  });
});
