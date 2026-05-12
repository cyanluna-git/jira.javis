/**
 * Unit tests for isDocumentOwner — ownership check for KB documents.
 *
 * This function is the core logic all ownership-gated routes depend on.
 * It must handle null/empty inputs safely and match case-insensitively
 * against user.name, user.email, and user.username.
 */

import { isDocumentOwner, AuthUser } from '@/lib/access';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'gerald@example.com',
    name: 'Gerald Park',
    username: 'gerald.park',
    source: 'claims_cookie',
    ...overrides,
  };
}

describe('isDocumentOwner', () => {
  // --- Null / empty guard cases ---

  it('returns false when authorField is null', () => {
    expect(isDocumentOwner(null, makeUser())).toBe(false);
  });

  it('returns false when authorField is empty string', () => {
    expect(isDocumentOwner('', makeUser())).toBe(false);
  });

  it('returns false when authorField is whitespace only', () => {
    expect(isDocumentOwner('   ', makeUser())).toBe(false);
  });

  it('returns false when user is null', () => {
    expect(isDocumentOwner('Gerald Park', null)).toBe(false);
  });

  it('returns false when user is undefined', () => {
    expect(isDocumentOwner('Gerald Park', undefined)).toBe(false);
  });

  // --- Exact field matches ---

  it('returns true when authorField matches user.name exactly', () => {
    expect(isDocumentOwner('Gerald Park', makeUser())).toBe(true);
  });

  it('returns true when authorField matches user.email exactly', () => {
    expect(isDocumentOwner('gerald@example.com', makeUser())).toBe(true);
  });

  it('returns true when authorField matches user.username exactly', () => {
    expect(isDocumentOwner('gerald.park', makeUser())).toBe(true);
  });

  // --- Non-matching case ---

  it('returns false when authorField does not match any user field', () => {
    expect(isDocumentOwner('somebody.else', makeUser())).toBe(false);
  });

  // --- Case-insensitive matching ---

  it('returns true with case-insensitive name match (upper)', () => {
    expect(isDocumentOwner('GERALD PARK', makeUser())).toBe(true);
  });

  it('returns true with case-insensitive name match (mixed)', () => {
    expect(isDocumentOwner('Gerald park', makeUser())).toBe(true);
  });

  it('returns true with case-insensitive email match', () => {
    expect(isDocumentOwner('Gerald@Example.COM', makeUser())).toBe(true);
  });

  it('returns true with case-insensitive username match', () => {
    expect(isDocumentOwner('Gerald.Park', makeUser())).toBe(true);
  });

  // --- Whitespace trimming ---

  it('returns true when authorField has leading whitespace', () => {
    expect(isDocumentOwner('  Gerald Park', makeUser())).toBe(true);
  });

  it('returns true when authorField has trailing whitespace', () => {
    expect(isDocumentOwner('Gerald Park  ', makeUser())).toBe(true);
  });

  it('returns true when authorField has both leading and trailing whitespace', () => {
    expect(isDocumentOwner('  gerald.park  ', makeUser())).toBe(true);
  });

  // --- All user fields null ---

  it('returns false when all user fields (name, email, username) are null', () => {
    const user = makeUser({ name: null, email: null, username: null });
    expect(isDocumentOwner('Gerald Park', user)).toBe(false);
  });

  // --- Partial null user fields still match remaining fields ---

  it('returns true when only email is set and authorField matches it', () => {
    const user = makeUser({ name: null, username: null });
    expect(isDocumentOwner('gerald@example.com', user)).toBe(true);
  });

  it('returns false when partial user fields exist but none match authorField', () => {
    const user = makeUser({ name: null, username: null });
    expect(isDocumentOwner('some.other.person', user)).toBe(false);
  });
});
