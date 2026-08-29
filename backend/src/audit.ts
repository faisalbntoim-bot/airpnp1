import { getPrisma } from './db.js';

export async function audit(entry: {
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}): Promise<void> {
  await getPrisma().auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ? JSON.stringify(entry.before, bigintReplacer) : null,
      after:  entry.after  ? JSON.stringify(entry.after,  bigintReplacer) : null,
      ip: entry.ip ?? null,
    },
  });
}

function bigintReplacer(_k: string, v: unknown) {
  return typeof v === 'bigint' ? v.toString() : v;
}
