/**
 * Minimal RBAC guard.
 *
 * In production, plug in a real JWT verifier (e.g. verify Firebase / your OTP
 * provider). For now we accept `x-user-id` + `x-user-role` headers so the API
 * is usable behind a private admin gateway and easy to test.
 *
 * NEVER trust these headers on a public endpoint without an upstream gateway
 * enforcing them from a verified token.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../errors.js';

export type Role = 'HOST' | 'OWNER' | 'OFFICE' | 'MARKETER' | 'CUSTOMER' | 'ADMIN';

export interface CallerContext { userId: string; role: Role; }

export function getCaller(req: FastifyRequest): CallerContext | null {
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  if (typeof userId !== 'string' || typeof role !== 'string') return null;
  return { userId, role: role as Role };
}

export function requireAuth(req: FastifyRequest, _reply: FastifyReply): CallerContext {
  const c = getCaller(req);
  if (!c) throw unauthorized();
  return c;
}

export function requireRole(roles: Role[]) {
  return (req: FastifyRequest, reply: FastifyReply) => {
    const c = requireAuth(req, reply);
    if (!roles.includes(c.role)) throw forbidden(`requires one of: ${roles.join(', ')}`);
    return c;
  };
}
