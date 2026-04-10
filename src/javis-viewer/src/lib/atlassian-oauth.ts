import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import pool from '@/lib/db';

const ATLASSIAN_AUTH_BASE_URL = 'https://auth.atlassian.com';
const ATLASSIAN_API_BASE_URL = 'https://api.atlassian.com';
const OAUTH_STATE_COOKIE_NAME = 'javis_atlassian_oauth_state';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

const DEFAULT_REQUESTED_SCOPES = [
  'offline_access',
  'read:me',
  'read:jira-user',
  'read:jira-work',
  'write:jira-work',
  'read:confluence-content.all',
  'write:confluence-content',
] as const;

type AtlassianProduct = 'jira' | 'confluence';

interface SignedStatePayload {
  nonce: string;
  userKey: string;
  returnTo: string;
  issuedAt: string;
}

interface AtlassianTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface AtlassianProfile {
  account_id: string | null;
  email: string | null;
  name: string | null;
  picture: string | null;
  nickname: string | null;
  account_type: string | null;
}

export interface AtlassianAccessibleResource {
  id: string;
  url: string;
  name: string;
  avatarUrl: string | null;
  scopes: string[];
  products: AtlassianProduct[];
}

interface StoredConnectionRow {
  app_user_key: string;
  app_user_id: string | null;
  app_user_email: string | null;
  app_user_name: string | null;
  app_user_username: string | null;
  atlassian_account_id: string | null;
  atlassian_account_email: string | null;
  atlassian_account_name: string | null;
  atlassian_account_picture: string | null;
  site_id: string | null;
  site_url: string | null;
  site_name: string | null;
  scopes: string[] | null;
  granted_products: string[] | null;
  accessible_resources: unknown;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: Date | null;
  last_validated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AtlassianConnectionSummary {
  account: {
    id: string | null;
    email: string | null;
    name: string | null;
    picture: string | null;
  };
  site: {
    id: string | null;
    url: string | null;
    name: string | null;
  };
  scopes: string[];
  products: AtlassianProduct[];
  accessibleResources: AtlassianAccessibleResource[];
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  capabilities: {
    jiraWrite: boolean;
    confluenceWrite: boolean;
  };
}

interface AtlassianConnectionSecretRecord extends AtlassianConnectionSummary {
  accessToken: string;
  refreshToken: string | null;
}

let hasEnsuredConnectionTable = false;

export function getAtlassianRequestedScopes(): string[] {
  const rawScopes = process.env.ATLASSIAN_OAUTH_SCOPES;
  if (!rawScopes?.trim()) {
    return [...DEFAULT_REQUESTED_SCOPES];
  }

  return Array.from(
    new Set(
      rawScopes
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    )
  );
}

export function getAtlassianOAuthStateCookieName(): string {
  return OAUTH_STATE_COOKIE_NAME;
}

export function getAtlassianOAuthStateCookieMaxAge(): number {
  return OAUTH_STATE_MAX_AGE_SECONDS;
}

export function buildAtlassianAuthorizationUrl(
  request: Pick<NextRequest, 'headers' | 'nextUrl'>,
  state: string
): string {
  const config = getOAuthConfig(resolveRequestOrigin(request));
  const authorizationUrl = new URL(`${ATLASSIAN_AUTH_BASE_URL}/authorize`);

  authorizationUrl.searchParams.set('audience', 'api.atlassian.com');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('prompt', 'consent');

  return authorizationUrl.toString();
}

export function createSignedAtlassianOAuthState({
  userKey,
  returnTo,
}: {
  userKey: string;
  returnTo: string;
}): { state: string; signedCookieValue: string } {
  const payload: SignedStatePayload = {
    nonce: crypto.randomBytes(16).toString('hex'),
    userKey,
    returnTo: sanitizeReturnPath(returnTo),
    issuedAt: new Date().toISOString(),
  };

  const signedCookieValue = signPayload(payload, getStateSecret());
  return {
    state: payload.nonce,
    signedCookieValue,
  };
}

export function verifyAtlassianOAuthState(
  rawCookie: string | undefined,
  expectedState: string | null
): SignedStatePayload | null {
  if (!rawCookie || !expectedState) {
    return null;
  }

  const payload = verifySignedPayload<SignedStatePayload>(rawCookie, getStateSecret());
  if (!payload || payload.nonce !== expectedState) {
    return null;
  }

  const issuedAt = Date.parse(payload.issuedAt);
  if (Number.isNaN(issuedAt)) {
    return null;
  }

  if (issuedAt + OAUTH_STATE_MAX_AGE_SECONDS * 1000 < Date.now()) {
    return null;
  }

  return {
    ...payload,
    returnTo: sanitizeReturnPath(payload.returnTo),
  };
}

export async function exchangeCodeForTokenSet({
  code,
  request,
}: {
  code: string;
  request: Pick<NextRequest, 'headers' | 'nextUrl'>;
}): Promise<AtlassianTokenResponse> {
  const config = getOAuthConfig(resolveRequestOrigin(request));

  const response = await fetch(`${ATLASSIAN_AUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(await buildAtlassianErrorMessage(response, 'Atlassian token exchange failed'));
  }

  return parseTokenResponse(await response.json());
}

export async function listAccessibleResources(accessToken: string): Promise<AtlassianAccessibleResource[]> {
  const response = await fetch(`${ATLASSIAN_API_BASE_URL}/oauth/token/accessible-resources`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await buildAtlassianErrorMessage(response, 'Unable to list Atlassian resources'));
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return normalizeAccessibleResources(payload);
}

export async function fetchAtlassianProfile(accessToken: string): Promise<AtlassianProfile | null> {
  const response = await fetch(`${ATLASSIAN_API_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  if (!isObject(payload)) {
    return null;
  }

  return {
    account_id: readString(payload, ['account_id', 'accountId', 'sub']),
    email: readString(payload, ['email']),
    name: readString(payload, ['name']),
    picture: readString(payload, ['picture']),
    nickname: readString(payload, ['nickname']),
    account_type: readString(payload, ['account_type']),
  };
}

export function selectPreferredResource(resources: AtlassianAccessibleResource[]): AtlassianAccessibleResource {
  if (resources.length === 0) {
    throw new Error('No Atlassian cloud resources were granted');
  }

  const preferredSiteUrl = process.env.ATLASSIAN_SITE_URL || process.env.JIRA_URL || process.env.NEXT_PUBLIC_JIRA_URL;
  if (!preferredSiteUrl) {
    return resources[0];
  }

  const preferredUrl = normalizeUrl(preferredSiteUrl);
  const exactMatch = resources.find((resource) => normalizeUrl(resource.url) === preferredUrl);
  if (exactMatch) {
    return exactMatch;
  }

  const preferredHost = safeHost(preferredSiteUrl);
  const hostMatch = preferredHost
    ? resources.find((resource) => safeHost(resource.url) === preferredHost)
    : null;

  if (hostMatch) {
    return hostMatch;
  }

  if (resources.length === 1) {
    return resources[0];
  }

  throw new Error(
    'Configured Atlassian site URL did not match any granted resource. Set ATLASSIAN_SITE_URL explicitly.'
  );
}

export async function upsertAtlassianConnection(params: {
  appUser: {
    key: string;
    id: string | null;
    email: string | null;
    name: string | null;
    username: string | null;
  };
  profile: AtlassianProfile | null;
  resources: AtlassianAccessibleResource[];
  selectedResource: AtlassianAccessibleResource;
  tokenSet: AtlassianTokenResponse;
}): Promise<AtlassianConnectionSummary> {
  await ensureAtlassianConnectionTable();

  const scopes = resolveGrantedScopes(params.tokenSet, params.resources);
  const products = Array.from(
    new Set(params.resources.flatMap((resource) => resource.products))
  ) as AtlassianProduct[];
  const tokenExpiresAt = params.tokenSet.expires_in
    ? new Date(Date.now() + params.tokenSet.expires_in * 1000)
    : null;

  const encryptedAccessToken = encryptSecret(params.tokenSet.access_token);
  const encryptedRefreshToken = params.tokenSet.refresh_token
    ? encryptSecret(params.tokenSet.refresh_token)
    : null;

  const query = `
    INSERT INTO atlassian_oauth_connections (
      app_user_key,
      app_user_id,
      app_user_email,
      app_user_name,
      app_user_username,
      atlassian_account_id,
      atlassian_account_email,
      atlassian_account_name,
      atlassian_account_picture,
      site_id,
      site_url,
      site_name,
      scopes,
      granted_products,
      accessible_resources,
      access_token_encrypted,
      refresh_token_encrypted,
      token_expires_at,
      last_validated_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13::text[], $14::text[], $15::jsonb,
      $16, $17, $18, NOW(), NOW()
    )
    ON CONFLICT (app_user_key) DO UPDATE SET
      app_user_id = EXCLUDED.app_user_id,
      app_user_email = EXCLUDED.app_user_email,
      app_user_name = EXCLUDED.app_user_name,
      app_user_username = EXCLUDED.app_user_username,
      atlassian_account_id = EXCLUDED.atlassian_account_id,
      atlassian_account_email = EXCLUDED.atlassian_account_email,
      atlassian_account_name = EXCLUDED.atlassian_account_name,
      atlassian_account_picture = EXCLUDED.atlassian_account_picture,
      site_id = EXCLUDED.site_id,
      site_url = EXCLUDED.site_url,
      site_name = EXCLUDED.site_name,
      scopes = EXCLUDED.scopes,
      granted_products = EXCLUDED.granted_products,
      accessible_resources = EXCLUDED.accessible_resources,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, atlassian_oauth_connections.refresh_token_encrypted),
      token_expires_at = EXCLUDED.token_expires_at,
      last_validated_at = NOW(),
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    params.appUser.key,
    params.appUser.id,
    params.appUser.email,
    params.appUser.name,
    params.appUser.username,
    params.profile?.account_id ?? null,
    params.profile?.email ?? null,
    params.profile?.name ?? params.profile?.nickname ?? null,
    params.profile?.picture ?? null,
    params.selectedResource.id,
    params.selectedResource.url,
    params.selectedResource.name,
    scopes,
    products,
    JSON.stringify(params.resources),
    encryptedAccessToken,
    encryptedRefreshToken,
    tokenExpiresAt,
  ];

  const result = await pool.query<StoredConnectionRow>(query, values);
  return summarizeConnectionRow(result.rows[0]);
}

export async function getAtlassianConnectionSummary(appUserKey: string): Promise<AtlassianConnectionSummary | null> {
  const record = await getConnectionRecord(appUserKey);
  if (!record) {
    return null;
  }

  return summarizeConnectionRow(record);
}

export async function disconnectAtlassianConnection(appUserKey: string): Promise<boolean> {
  await ensureAtlassianConnectionTable();
  const result = await pool.query('DELETE FROM atlassian_oauth_connections WHERE app_user_key = $1', [appUserKey]);
  return (result.rowCount ?? 0) > 0;
}

export async function getUsableAtlassianConnection(appUserKey: string): Promise<AtlassianConnectionSecretRecord | null> {
  const record = await getConnectionRecord(appUserKey);
  if (!record) {
    return null;
  }

  let accessToken = decryptSecret(record.access_token_encrypted);
  let refreshToken = record.refresh_token_encrypted ? decryptSecret(record.refresh_token_encrypted) : null;
  const expiresAt = record.token_expires_at ? record.token_expires_at.getTime() : null;
  const needsRefresh = expiresAt !== null && expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_MS <= Date.now();

  if (needsRefresh && refreshToken) {
    const refreshed = await refreshStoredConnection(record, refreshToken);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
    return refreshed;
  }

  return {
    ...summarizeConnectionRow(record),
    accessToken,
    refreshToken,
  };
}

async function refreshStoredConnection(
  record: StoredConnectionRow,
  refreshToken: string
): Promise<AtlassianConnectionSecretRecord> {
  const tokenSet = await refreshAccessToken(refreshToken);
  const scopes = resolveGrantedScopes(tokenSet, parseAccessibleResources(record.accessible_resources));
  const tokenExpiresAt = tokenSet.expires_in ? new Date(Date.now() + tokenSet.expires_in * 1000) : null;
  const nextRefreshToken = tokenSet.refresh_token ?? refreshToken;

  const result = await pool.query<StoredConnectionRow>(
    `
      UPDATE atlassian_oauth_connections
      SET access_token_encrypted = $2,
          refresh_token_encrypted = $3,
          scopes = $4::text[],
          token_expires_at = $5,
          last_validated_at = NOW(),
          updated_at = NOW()
      WHERE app_user_key = $1
      RETURNING *;
    `,
    [
      record.app_user_key,
      encryptSecret(tokenSet.access_token),
      encryptSecret(nextRefreshToken),
      scopes,
      tokenExpiresAt,
    ]
  );

  const updatedRecord = result.rows[0];
  return {
    ...summarizeConnectionRow(updatedRecord),
    accessToken: tokenSet.access_token,
    refreshToken: nextRefreshToken,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<AtlassianTokenResponse> {
  const config = getOAuthConfig();

  const response = await fetch(`${ATLASSIAN_AUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(await buildAtlassianErrorMessage(response, 'Atlassian token refresh failed'));
  }

  return parseTokenResponse(await response.json());
}

async function getConnectionRecord(appUserKey: string): Promise<StoredConnectionRow | null> {
  await ensureAtlassianConnectionTable();
  const result = await pool.query<StoredConnectionRow>(
    'SELECT * FROM atlassian_oauth_connections WHERE app_user_key = $1 LIMIT 1',
    [appUserKey]
  );

  return result.rows[0] ?? null;
}

async function ensureAtlassianConnectionTable(): Promise<void> {
  if (hasEnsuredConnectionTable) {
    return;
  }

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
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
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_atlassian_oauth_connections_site_id
      ON atlassian_oauth_connections(site_id)
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_atlassian_oauth_connections_account_site
      ON atlassian_oauth_connections(atlassian_account_id, site_id)
      WHERE atlassian_account_id IS NOT NULL AND site_id IS NOT NULL
  `);

  hasEnsuredConnectionTable = true;
}

function summarizeConnectionRow(record: StoredConnectionRow): AtlassianConnectionSummary {
  const scopes = record.scopes ?? [];
  const resources = parseAccessibleResources(record.accessible_resources);
  const products = normalizeProducts(record.granted_products);

  return {
    account: {
      id: record.atlassian_account_id,
      email: record.atlassian_account_email,
      name: record.atlassian_account_name,
      picture: record.atlassian_account_picture,
    },
    site: {
      id: record.site_id,
      url: record.site_url,
      name: record.site_name,
    },
    scopes,
    products,
    accessibleResources: resources,
    hasRefreshToken: Boolean(record.refresh_token_encrypted),
    tokenExpiresAt: record.token_expires_at?.toISOString() ?? null,
    lastValidatedAt: record.last_validated_at?.toISOString() ?? null,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
    capabilities: {
      jiraWrite: canWriteJira(scopes, products),
      confluenceWrite: canWriteConfluence(scopes, products),
    },
  };
}

function parseTokenResponse(payload: unknown): AtlassianTokenResponse {
  if (!isObject(payload)) {
    throw new Error('Invalid Atlassian token response');
  }

  const accessToken = readString(payload, ['access_token']);
  if (!accessToken) {
    throw new Error('Atlassian token response did not include an access token');
  }

  const expiresInRaw = payload.expires_in;
  const expiresIn =
    typeof expiresInRaw === 'number'
      ? expiresInRaw
      : typeof expiresInRaw === 'string' && expiresInRaw.trim()
        ? Number(expiresInRaw)
        : undefined;

  return {
    access_token: accessToken,
    refresh_token: readString(payload, ['refresh_token']) ?? undefined,
    expires_in: Number.isFinite(expiresIn) ? expiresIn : undefined,
    scope: readString(payload, ['scope']) ?? undefined,
    token_type: readString(payload, ['token_type']) ?? undefined,
  };
}

function resolveGrantedScopes(
  tokenSet: AtlassianTokenResponse,
  resources: AtlassianAccessibleResource[]
): string[] {
  const fromToken = (tokenSet.scope ?? '')
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const fromResources = resources.flatMap((resource) => resource.scopes);

  return Array.from(new Set([...fromToken, ...fromResources])).sort();
}

function normalizeAccessibleResources(payload: unknown[]): AtlassianAccessibleResource[] {
  const resources = new Map<string, AtlassianAccessibleResource>();

  for (const entry of payload) {
    if (!isObject(entry)) {
      continue;
    }

    const id = readString(entry, ['id']);
    const url = readString(entry, ['url']);
    if (!id || !url) {
      continue;
    }

    const scopes = Array.isArray(entry.scopes)
      ? entry.scopes.filter(
          (scope): scope is string => typeof scope === 'string' && Boolean(scope.trim())
        )
      : [];
    const key = `${id}::${normalizeUrl(url)}`;
    const existing = resources.get(key);
    const mergedScopes = Array.from(new Set([...(existing?.scopes ?? []), ...scopes])).sort();

    resources.set(key, {
      id,
      url,
      name: readString(entry, ['name']) ?? existing?.name ?? url,
      avatarUrl: readString(entry, ['avatarUrl']) ?? existing?.avatarUrl ?? null,
      scopes: mergedScopes,
      products: inferProducts(mergedScopes),
    });
  }

  return [...resources.values()];
}

function inferProducts(scopes: string[]): AtlassianProduct[] {
  const products = new Set<AtlassianProduct>();

  scopes.forEach((scope) => {
    if (scope.includes(':jira') || scope.includes('jira-')) {
      products.add('jira');
    }
    if (scope.includes(':confluence') || scope.includes('confluence-')) {
      products.add('confluence');
    }
  });

  return [...products];
}

function normalizeProducts(products: string[] | null): AtlassianProduct[] {
  return Array.from(
    new Set(
      (products ?? []).filter(
        (product): product is AtlassianProduct => product === 'jira' || product === 'confluence'
      )
    )
  );
}

function parseAccessibleResources(payload: unknown): AtlassianAccessibleResource[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return normalizeAccessibleResources(payload);
}

function canWriteJira(scopes: string[], products: AtlassianProduct[]): boolean {
  return products.includes('jira') && scopes.includes('write:jira-work');
}

function canWriteConfluence(scopes: string[], products: AtlassianProduct[]): boolean {
  return products.includes('confluence') && scopes.includes('write:confluence-content');
}

function sanitizeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

function resolveRequestOrigin(request: Pick<NextRequest, 'headers' | 'nextUrl'>): string {
  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.host;

  return `${protocol}://${host}`;
}

function getOAuthConfig(origin?: string): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
} {
  const clientId = process.env.ATLASSIAN_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('ATLASSIAN_OAUTH_CLIENT_ID and ATLASSIAN_OAUTH_CLIENT_SECRET must be configured');
  }

  const redirectUri =
    process.env.ATLASSIAN_OAUTH_REDIRECT_URI ||
    `${origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3009'}/api/auth/atlassian/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: getAtlassianRequestedScopes(),
  };
}

function getStateSecret(): string {
  const secret = process.env.ATLASSIAN_OAUTH_STATE_SECRET || process.env.JAVIS_SESSION_SECRET;
  if (!secret) {
    throw new Error('ATLASSIAN_OAUTH_STATE_SECRET or JAVIS_SESSION_SECRET must be configured');
  }

  return secret;
}

function getTokenEncryptionSecret(): string {
  const secret = process.env.ATLASSIAN_OAUTH_TOKEN_SECRET || process.env.JAVIS_SESSION_SECRET;
  if (!secret) {
    throw new Error('ATLASSIAN_OAUTH_TOKEN_SECRET or JAVIS_SESSION_SECRET must be configured');
  }

  return secret;
}

function signPayload(payload: SignedStatePayload, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySignedPayload<T>(rawValue: string, secret: string): T | null {
  const [encodedPayload, signature] = rawValue.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function encryptSecret(value: string): string {
  const secret = getTokenEncryptionSecret();
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(secret).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSecret(value: string): string {
  const secret = getTokenEncryptionSecret();
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split('.');

  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error('Invalid encrypted secret format');
  }

  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encodedIv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

async function buildAtlassianErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (isObject(payload)) {
      const message =
        readString(payload, ['error_description', 'message', 'error']) ||
        `${fallback} (${response.status})`;
      return message;
    }
  } catch {
    // Ignore parse failure and use fallback.
  }

  return `${fallback} (${response.status})`;
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function safeHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
