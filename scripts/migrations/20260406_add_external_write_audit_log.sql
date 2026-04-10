CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
);

CREATE INDEX IF NOT EXISTS idx_external_write_audit_entity
  ON external_write_audit_log(product, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_write_audit_user
  ON external_write_audit_log(app_user_key, created_at DESC);
