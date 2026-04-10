CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS atlassian_oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_key TEXT NOT NULL UNIQUE,
  app_user_id TEXT,
  app_user_email TEXT,
  app_user_name TEXT,
  app_user_username TEXT,
  atlassian_account_id TEXT,
  atlassian_account_email TEXT,
  atlassian_account_name TEXT,
  atlassian_account_picture TEXT,
  site_id TEXT,
  site_url TEXT,
  site_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  granted_products TEXT[] NOT NULL DEFAULT '{}',
  accessible_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atlassian_oauth_connections_site_id
  ON atlassian_oauth_connections(site_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atlassian_oauth_connections_account_site
  ON atlassian_oauth_connections(atlassian_account_id, site_id)
  WHERE atlassian_account_id IS NOT NULL AND site_id IS NOT NULL;
