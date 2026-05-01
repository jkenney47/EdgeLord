import type { SqliteDatabase } from "../db/database.js";

export type AuditAction = "create" | "update" | "delete";

export type AuditPayload = {
  entityType: string;
  entityId: string;
  action: AuditAction;
  before: unknown | null;
  after: unknown | null;
};

function serializeJson(value: unknown | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

export function recordAudit(db: SqliteDatabase, payload: AuditPayload): void {
  db.prepare(
    `insert into audit_log (
      entity_type,
      entity_id,
      action,
      before_json,
      after_json,
      created_at
    ) values (?, ?, ?, ?, ?, ?)`
  ).run(
    payload.entityType,
    payload.entityId,
    payload.action,
    serializeJson(payload.before),
    serializeJson(payload.after),
    new Date().toISOString()
  );
}
