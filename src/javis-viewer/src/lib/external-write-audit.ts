import pool from '@/lib/db';
import type { AuthUser } from '@/lib/access';

type ExternalWriteProduct = 'jira' | 'confluence';
type ExternalWriteEntityType = 'issue' | 'page' | 'suggestion';

interface ExternalWriteAuditInput {
  product: ExternalWriteProduct;
  entityType: ExternalWriteEntityType;
  entityId: string;
  action: string;
  appUserKey: string;
  user: AuthUser | null;
  payload?: Record<string, unknown>;
}

let hasEnsuredExternalWriteAuditTable = false;

export async function recordExternalWriteEvent(input: ExternalWriteAuditInput): Promise<void> {
  await ensureExternalWriteAuditTable();

  await pool.query(
    `
      INSERT INTO external_write_audit_log (
        product,
        entity_type,
        entity_id,
        action,
        app_user_key,
        app_user_id,
        app_user_email,
        app_user_name,
        app_user_username,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      input.product,
      input.entityType,
      input.entityId,
      input.action,
      input.appUserKey,
      input.user?.id ?? null,
      input.user?.email ?? null,
      input.user?.name ?? null,
      input.user?.username ?? null,
      JSON.stringify(input.payload ?? {}),
    ]
  );
}

async function ensureExternalWriteAuditTable(): Promise<void> {
  if (hasEnsuredExternalWriteAuditTable) {
    return;
  }

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS external_write_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      app_user_key TEXT NOT NULL,
      app_user_id TEXT,
      app_user_email TEXT,
      app_user_name TEXT,
      app_user_username TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_external_write_audit_entity
      ON external_write_audit_log(product, entity_type, entity_id, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_external_write_audit_user
      ON external_write_audit_log(app_user_key, created_at DESC)
  `);

  hasEnsuredExternalWriteAuditTable = true;
}
