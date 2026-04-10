import crypto from 'node:crypto';
import { cookies as serverCookies, headers as serverHeaders } from 'next/headers';
import type { NextRequest } from 'next/server';

const REFRESH_COOKIE_NAME = 'javis_eob_refresh';
const CLAIMS_COOKIE_NAME = 'javis_eob_user';

export type WriteCapability = 'general' | 'jira' | 'confluence';
export type AccessReason =
  | 'write_enabled'
  | 'global_read_only'
  | 'authentication_required'
  | 'identity_unresolved'
  | 'general_write_not_enabled'
  | 'jira_write_not_enabled'
  | 'confluence_write_not_enabled';

export interface AuthUser {
  id: string | null;
  email: string | null;
  name: string | null;
  username: string | null;
  source: 'claims_cookie' | 'trusted_headers' | 'unknown';
}

export interface AccessContext {
  mode: 'legacy' | 'strict';
  isAuthenticated: boolean;
  hasRefreshSession: boolean;
  user: AuthUser | null;
  capabilities: {
    generalWrite: boolean;
    jiraWrite: boolean;
    confluenceWrite: boolean;
  };
  reasons: Record<WriteCapability, AccessReason>;
  isReadOnly: boolean;
}

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type RequestLike = {
  cookies: CookieReader;
  headers: Headers;
};

interface SessionClaims {
  id: string | null;
  email: string | null;
  name: string | null;
  username: string | null;
}

export function getCapabilityReason(
  access: AccessContext,
  capability: WriteCapability = 'general'
): AccessReason {
  return access.reasons[capability];
}

export function hasWriteCapability(
  access: AccessContext,
  capability: WriteCapability = 'general'
): boolean {
  if (capability === 'jira') return access.capabilities.jiraWrite;
  if (capability === 'confluence') return access.capabilities.confluenceWrite;
  return access.capabilities.generalWrite;
}

export function getUserIdentityKey(user: Pick<AuthUser, 'id' | 'email' | 'username'> | null): string | null {
  if (!user) {
    return null;
  }

  const normalizedValues = [user.id, user.email, user.username]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  return normalizedValues[0] ?? null;
}

export async function resolveServerAccessContext(): Promise<AccessContext> {
  const [cookieStore, headerStore] = await Promise.all([serverCookies(), serverHeaders()]);

  return buildAccessContext({
    cookies: cookieStore,
    headers: new Headers(headerStore),
  });
}

export async function resolveAccessContextFromRequest(
  request: Pick<NextRequest, 'cookies' | 'headers'>
): Promise<AccessContext> {
  return buildAccessContext({
    cookies: request.cookies,
    headers: request.headers,
  });
}

function buildAccessContext(request: RequestLike): AccessContext {
  const mode = readCapabilityMode();
  const globalReadOnly = isGlobalReadOnly();
  const hasRefreshSession = Boolean(request.cookies.get(REFRESH_COOKIE_NAME)?.value);

  const signedClaims = verifySignedClaimsCookie(request.cookies.get(CLAIMS_COOKIE_NAME)?.value);
  const trustedHeaderClaims = readTrustedHeaderClaims(request.headers);
  const claims = signedClaims ?? trustedHeaderClaims;

  const source: AuthUser['source'] = signedClaims
    ? 'claims_cookie'
    : trustedHeaderClaims
      ? 'trusted_headers'
      : 'unknown';

  const user: AuthUser | null = claims
    ? {
        ...claims,
        source,
      }
    : null;

  const isAuthenticated = hasRefreshSession || Boolean(user);
  const generalWrite = resolveCapability({
    mode,
    globalReadOnly,
    isAuthenticated,
    user,
    allowlistEnv: 'JAVIS_GENERAL_WRITE_USERS',
    fallbackLegacyAllow: true,
  });
  const jiraWrite = resolveCapability({
    mode,
    globalReadOnly,
    isAuthenticated,
    user,
    allowlistEnv: 'JAVIS_JIRA_WRITE_USERS',
    fallbackLegacyAllow: generalWrite,
  });
  const confluenceWrite = resolveCapability({
    mode,
    globalReadOnly,
    isAuthenticated,
    user,
    allowlistEnv: 'JAVIS_CONFLUENCE_WRITE_USERS',
    fallbackLegacyAllow: generalWrite,
  });

  const access: AccessContext = {
    mode,
    isAuthenticated,
    hasRefreshSession,
    user,
    capabilities: {
      generalWrite,
      jiraWrite,
      confluenceWrite,
    },
    reasons: {
      general: resolveReason({
        capability: 'general',
        allowed: generalWrite,
        globalReadOnly,
        isAuthenticated,
        hasIdentity: Boolean(user),
      }),
      jira: resolveReason({
        capability: 'jira',
        allowed: jiraWrite,
        globalReadOnly,
        isAuthenticated,
        hasIdentity: Boolean(user),
      }),
      confluence: resolveReason({
        capability: 'confluence',
        allowed: confluenceWrite,
        globalReadOnly,
        isAuthenticated,
        hasIdentity: Boolean(user),
      }),
    },
    isReadOnly: !generalWrite,
  };

  return access;
}

function resolveCapability({
  mode,
  globalReadOnly,
  isAuthenticated,
  user,
  allowlistEnv,
  fallbackLegacyAllow,
}: {
  mode: 'legacy' | 'strict';
  globalReadOnly: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  allowlistEnv: string;
  fallbackLegacyAllow: boolean;
}): boolean {
  if (globalReadOnly || !isAuthenticated) {
    return false;
  }

  const allowlist = parseAllowlist(process.env[allowlistEnv]);
  const hasExplicitAllowlist = allowlist.size > 0;

  if (!user) {
    return mode === 'legacy' && !hasExplicitAllowlist ? fallbackLegacyAllow : false;
  }

  if (hasExplicitAllowlist) {
    return getUserKeys(user).some((value) => allowlist.has(value));
  }

  return mode === 'legacy' ? fallbackLegacyAllow : false;
}

function resolveReason({
  capability,
  allowed,
  globalReadOnly,
  isAuthenticated,
  hasIdentity,
}: {
  capability: WriteCapability;
  allowed: boolean;
  globalReadOnly: boolean;
  isAuthenticated: boolean;
  hasIdentity: boolean;
}): AccessReason {
  if (allowed) return 'write_enabled';
  if (globalReadOnly) return 'global_read_only';
  if (!isAuthenticated) return 'authentication_required';
  if (!hasIdentity) return 'identity_unresolved';
  if (capability === 'jira') return 'jira_write_not_enabled';
  if (capability === 'confluence') return 'confluence_write_not_enabled';
  return 'general_write_not_enabled';
}

function readCapabilityMode(): 'legacy' | 'strict' {
  return process.env.JAVIS_CAPABILITY_MODE?.toLowerCase() === 'strict' ? 'strict' : 'legacy';
}

function isGlobalReadOnly(): boolean {
  return process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';
}

function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getUserKeys(user: Pick<AuthUser, 'id' | 'email' | 'username'>): string[] {
  return [user.id, user.email, user.username]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
}

function readTrustedHeaderClaims(headers: Headers): SessionClaims | null {
  if (process.env.JAVIS_TRUST_AUTH_PROXY_HEADERS?.toLowerCase() !== 'true') {
    return null;
  }

  const claims = {
    id: readHeader(headers, process.env.JAVIS_AUTH_ID_HEADER, 'x-javis-user-id'),
    email: readHeader(headers, process.env.JAVIS_AUTH_EMAIL_HEADER, 'x-javis-user-email'),
    name: readHeader(headers, process.env.JAVIS_AUTH_NAME_HEADER, 'x-javis-user-name'),
    username: readHeader(headers, process.env.JAVIS_AUTH_USERNAME_HEADER, 'x-javis-user-username'),
  };

  return claims.id || claims.email || claims.name || claims.username ? claims : null;
}

function readHeader(headers: Headers, customName: string | undefined, fallbackName: string): string | null {
  const value = headers.get(customName || fallbackName)?.trim();
  return value || null;
}

function verifySignedClaimsCookie(rawCookie: string | undefined): SessionClaims | null {
  if (!rawCookie) {
    return null;
  }

  const secret = process.env.JAVIS_SESSION_SECRET;
  if (!secret) {
    return null;
  }

  const [encodedPayload, encodedSignature] = rawCookie.split('.');
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = createHmac(encodedPayload, secret);
  if (!timingSafeEqual(encodedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));

    return {
      id: readClaimValue(payload, ['id', 'sub', 'userId', 'oid']),
      email: readClaimValue(payload, ['email', 'upn', 'preferred_username']),
      name: readClaimValue(payload, ['name', 'displayName', 'fullName']),
      username: readClaimValue(payload, ['username', 'preferred_username', 'login']),
    };
  } catch {
    return null;
  }
}

function readClaimValue(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function createHmac(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
