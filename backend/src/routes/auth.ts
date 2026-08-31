/**
 * Auth routes.
 *
 *   POST /v1/auth/otp                 — request an OTP
 *   POST /v1/auth/otp/verify          — verify + get JWT pair (auto-signup by phone)
 *   POST /v1/auth/refresh             — rotate refresh token, issue new pair
 *   POST /v1/auth/logout              — revoke the presented refresh token
 *   GET  /v1/auth/me                  — introspect the current access token
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { requestOtp, verifyOtp } from '../auth/otp.js';
import { issueTokenPair, rotateRefreshToken, revokeRefreshToken } from '../auth/jwt.js';
import { requireAuth, type Role } from '../auth/rbac.js';
import { audit } from '../audit.js';
import { badRequest, notFound } from '../errors.js';

const requestSchema = z.object({ phone: z.string().min(6).max(20) });
const verifySchema = z.object({
  requestId: z.string().min(1),
  phone: z.string().min(6).max(20),
  code: z.string().regex(/^\d{6}$/, '6-digit code required'),
  nameAr: z.string().optional(),                        // for first-time signup
});
const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export default async function authRoutes(app: FastifyInstance) {
  app.post('/v1/auth/otp', async (req) => {
    const { phone } = requestSchema.parse(req.body);
    const result = await requestOtp(phone);
    return result;
  });

  app.post('/v1/auth/otp/verify', async (req) => {
    const body = verifySchema.parse(req.body);
    await verifyOtp({ requestId: body.requestId, phone: body.phone, code: body.code });

    const prisma = getPrisma();
    let user = await prisma.user.findUnique({ where: { phone: body.phone }, include: { roles: true } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: body.phone,
          nameAr: body.nameAr?.trim() || 'مستخدم جديد',
          roles: { create: { role: 'CUSTOMER', scope: '' } },
        },
        include: { roles: true },
      });
    }
    const role = (user.roles[0]?.role ?? 'CUSTOMER') as Role;
    const pair = await issueTokenPair(user.id, role, {
      ip: (req.ip as string | undefined),
      userAgent: (req.headers['user-agent'] as string | undefined),
    });
    await audit({ actorId: user.id, action: 'AUTH.LOGIN', entity: 'User', entityId: user.id });
    return {
      user: { id: user.id, phone: user.phone, nameAr: user.nameAr, role },
      ...pair,
    };
  });

  app.post('/v1/auth/refresh', async (req) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const pair = await rotateRefreshToken(refreshToken, {
      ip: (req.ip as string | undefined),
      userAgent: (req.headers['user-agent'] as string | undefined),
    });
    return pair;
  });

  app.post('/v1/auth/logout', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const body = req.body ? refreshSchema.partial().parse(req.body) : {};
    if (body.refreshToken) {
      await revokeRefreshToken(body.refreshToken);
    }
    await audit({ actorId: caller.userId, action: 'AUTH.LOGOUT', entity: 'User', entityId: caller.userId });
    return { ok: true };
  });

  app.get('/v1/auth/me', async (req, reply) => {
    const caller = requireAuth(req, reply);
    const user = await getPrisma().user.findUnique({
      where: { id: caller.userId },
      include: { roles: true },
    });
    if (!user) throw notFound('user not found');
    return {
      id: user.id, phone: user.phone, email: user.email,
      nameAr: user.nameAr, nameEn: user.nameEn,
      roles: user.roles.map((r) => r.role),
      currentRole: caller.role,
    };
  });
}
