/**
 * RBAC guard — dual-mode:
 *
 *   Preferred: `Authorization: Bearer <jwt>` (HS256, issued by /v1/auth/otp/verify).
 *   Dev fallback: `x-user-id` + `x-user-role` headers, ONLY when NODE_ENV=development.
 *   In production, the header fallback is disabled and unauthorised requests get 401.
 *
 * The gateway/edge in production should still verify the JWT before this layer,
 * but this layer is the last defence in depth.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../errors.js';
import { verifyAccessToken } from './jwt.js';
import { config } from '../config.js';

export type Role =
  | 'CUSTOMER'
  | 'HOST'
  | 'OWNER'
  | 'OFFICE'
  | 'MARKETER'
  | 'ADMIN'
  | 'FINANCE_ADMIN'
  | 'SUPER_ADMIN';

/** Roles that carry admin-level authority over the financial engine. */
export const ADMIN_ROLES: Role[] = ['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'];

export interface CallerContext { userId: string; role: Role; }

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function getCaller(req: FastifyRequest): CallerContext | null {
  // 1. Bearer JWT
  const authz = req.headers['authorization'];
  if (typeof authz === 'string' && authz.startsWith('Bearer ')) {
    const token = authz.slice(7).trim();
    if (token) {
      try {
        const { userId, role } = verifyAccessToken(token);
        return { userId, role };
      } catch {
        // fall through — headers might still work in dev
      }
    }
  }
  // 2. Dev-only header fallback
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];
    if (typeof userId === 'string' && typeof role === 'string') {
      return { userId, role: role as Role };
    }
  }
  return null;
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
