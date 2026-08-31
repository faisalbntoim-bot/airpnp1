import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { resetDb, shutdown, buildTestApp } from './helpers.js';
import authRoutes from '../src/routes/auth.js';
import { getPrisma } from '../src/db.js';

async function server() {
  return buildTestApp(async (app) => { await app.register(authRoutes); });
}

/** Helper: request OTP, then compute the hash the DB stored and re-derive the code by brute-force? Impossible.
 *  Instead: seed a challenge with a known salt+code directly. */
async function seedChallenge(phone: string, code = '123456') {
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
  return getPrisma().otpChallenge.create({
    data: {
      phone, codeHash, salt, maxAttempts: 5,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await shutdown(); });

describe('JWT — verify + refresh + logout', () => {
  it('issues an access + refresh pair on successful OTP verify (auto-signup)', async () => {
    const c = await seedChallenge('+966500000010');
    const app = await server();
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify',
      payload: { requestId: c.id, phone: '+966500000010', code: '123456', nameAr: 'اختبار' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken.split('.').length).toBe(3);        // JWT shape
    expect(body.refreshToken.length).toBeGreaterThan(20);
    expect(body.user.phone).toBe('+966500000010');
    expect(body.user.role).toBe('CUSTOMER');

    // Bearer works against a protected route.
    const me = await app.inject({
      method: 'GET', url: '/v1/auth/me',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().phone).toBe('+966500000010');
    await app.close();
  });

  it('rotates the refresh token and revokes the old one', async () => {
    const c = await seedChallenge('+966500000011');
    const app = await server();
    const first = (await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify',
      payload: { requestId: c.id, phone: '+966500000011', code: '123456' },
      headers: { 'content-type': 'application/json' },
    })).json();

    const rotated = await app.inject({
      method: 'POST', url: '/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken },
      headers: { 'content-type': 'application/json' },
    });
    expect(rotated.statusCode).toBe(200);
    const next = rotated.json();
    expect(next.refreshToken).not.toBe(first.refreshToken);

    // The OLD refresh token is revoked and cannot be reused.
    const replay = await app.inject({
      method: 'POST', url: '/v1/auth/refresh',
      payload: { refreshToken: first.refreshToken },
      headers: { 'content-type': 'application/json' },
    });
    expect(replay.statusCode).toBe(401);
    await app.close();
  });

  it('logout revokes the presented refresh token', async () => {
    const c = await seedChallenge('+966500000012');
    const app = await server();
    const login = (await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify',
      payload: { requestId: c.id, phone: '+966500000012', code: '123456' },
      headers: { 'content-type': 'application/json' },
    })).json();

    const logout = await app.inject({
      method: 'POST', url: '/v1/auth/logout',
      payload: { refreshToken: login.refreshToken },
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${login.accessToken}`,
      },
    });
    expect(logout.statusCode).toBe(200);

    const refresh = await app.inject({
      method: 'POST', url: '/v1/auth/refresh',
      payload: { refreshToken: login.refreshToken },
      headers: { 'content-type': 'application/json' },
    });
    expect(refresh.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an invalid access token', async () => {
    const app = await server();
    const res = await app.inject({
      method: 'GET', url: '/v1/auth/me',
      headers: { authorization: 'Bearer totally.not.a.jwt' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
