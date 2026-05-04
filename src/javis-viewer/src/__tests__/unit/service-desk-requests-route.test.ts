/**
 * Unit tests for /api/service-desk/requests (JSM raiseOnBehalfOf migration)
 *
 * Strategy: mock global.fetch and resolveAccessContextFromRequest to exercise
 * all branches added in the JSM migration (task #2777) without a live Jira
 * instance.
 *
 * Follows the same mock-before-import pattern as ai-assist-route.test.ts.
 */

import { NextRequest } from 'next/server';

// ─── Mocks set up before module import ───────────────────────────────────────

jest.mock('@/lib/access', () => ({
  resolveAccessContextFromRequest: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ─── Import after mocks ───────────────────────────────────────────────────────

import { POST } from '@/app/api/service-desk/requests/route';
import { resolveAccessContextFromRequest } from '@/lib/access';

const mockAccess = resolveAccessContextFromRequest as jest.Mock;

// ─── Base env vars ────────────────────────────────────────────────────────────

const BASE_ENV: Record<string, string> = {
  JIRA_URL: 'https://jira.example.com',
  JIRA_EMAIL: 'gerald.park@edwards.com',
  JIRA_TOKEN: 'fake-token',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormDataRequest(fields: Record<string, string>, files: File[] = []): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  for (const file of files) {
    fd.append('files', file);
  }
  return new NextRequest('http://localhost:3009/api/service-desk/requests', {
    method: 'POST',
    body: fd,
  });
}

function mockAccessOk(email = 'submitter@edwards.com', name = 'Test User') {
  mockAccess.mockResolvedValueOnce({
    isAuthenticated: true,
    user: { email, name, username: 'test', id: 'u1', source: 'claims_cookie' },
    hasRefreshSession: true,
    mode: 'strict',
    isReadOnly: false,
    capabilities: { generalWrite: true, jiraWrite: true, confluenceWrite: true },
    reasons: {},
  });
}

function mockJsmCreateOk(issueKey = 'PSSM-999') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ issueKey }),
    text: async () => JSON.stringify({ issueKey }),
  } as unknown as Response);
}

function mockJsmCreateError(status: number, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => { throw new Error('not-json'); },
    text: async () => body,
  } as unknown as Response);
}

function mockJsmCreateErrorJson(status: number, bodyObj: object) {
  const bodyStr = JSON.stringify(bodyObj);
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => bodyObj,
    text: async () => bodyStr,
  } as unknown as Response);
}

const VALID_FIELDS = {
  group: 'IntegratedSystem',
  component: 'Proteus',
  summary: 'Screen freezes on startup',
  description: 'Happens every morning',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/service-desk/requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set all required env vars before each test
    for (const [k, v] of Object.entries(BASE_ENV)) {
      process.env[k] = v;
    }
  });

  afterEach(() => {
    for (const k of Object.keys(BASE_ENV)) {
      delete process.env[k];
    }
  });

  // ── 503: Missing Jira env vars ────────────────────────────────────────────

  describe('returns 503 when any Jira env var is missing', () => {
    const envVarNames = [
      'JIRA_URL',
      'JIRA_EMAIL',
      'JIRA_TOKEN',
    ];

    for (const varName of envVarNames) {
      it(`returns 503 when ${varName} is missing`, async () => {
        delete process.env[varName];
        const res = await POST(makeFormDataRequest(VALID_FIELDS));
        expect(res.status).toBe(503);
        const body = await res.json() as { error: string };
        expect(body.error).toMatch(/not configured/i);
      });
    }
  });

  // ── 401: Missing email claim ──────────────────────────────────────────────

  describe('returns 401 when session has no email claim', () => {
    it('returns 401 when user is null', async () => {
      mockAccess.mockResolvedValueOnce({
        isAuthenticated: true,
        user: null,
        hasRefreshSession: false,
        mode: 'strict',
        isReadOnly: true,
        capabilities: { generalWrite: false, jiraWrite: false, confluenceWrite: false },
        reasons: {},
      });

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/email/i);
    });

    it('returns 401 when user.email is null', async () => {
      mockAccess.mockResolvedValueOnce({
        isAuthenticated: true,
        user: { email: null, name: 'Some User', username: 'u', id: 'u1', source: 'claims_cookie' },
        hasRefreshSession: true,
        mode: 'strict',
        isReadOnly: false,
        capabilities: { generalWrite: true, jiraWrite: true, confluenceWrite: true },
        reasons: {},
      });

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(401);
    });

    it('returns 401 when user.email is empty string', async () => {
      mockAccess.mockResolvedValueOnce({
        isAuthenticated: true,
        user: { email: '', name: 'Some User', username: 'u', id: 'u1', source: 'claims_cookie' },
        hasRefreshSession: true,
        mode: 'strict',
        isReadOnly: false,
        capabilities: { generalWrite: true, jiraWrite: true, confluenceWrite: true },
        reasons: {},
      });

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(401);
    });
  });

  // ── 201: Happy path ───────────────────────────────────────────────────────

  describe('201 happy path', () => {
    it('returns 201 with issueKey and webUrl on success', async () => {
      mockAccessOk();
      mockJsmCreateOk('PSSM-123');

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(201);
      const body = await res.json() as { issueKey: string; webUrl: string };
      expect(body.issueKey).toBe('PSSM-123');
      expect(body.webUrl).toBe('https://jira.example.com/browse/PSSM-123');
    });

    it('calls JSM servicedeskapi/request endpoint (not rest/api/2/issue)', async () => {
      mockAccessOk();
      mockJsmCreateOk();

      await POST(makeFormDataRequest(VALID_FIELDS));

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(firstCall[0]).toContain('/rest/servicedeskapi/request');
      expect(firstCall[0]).not.toContain('/rest/api/2/issue');
    });

    it('sends raiseOnBehalfOf with submitter email', async () => {
      mockAccessOk('alice@edwards.com');
      mockJsmCreateOk();

      await POST(makeFormDataRequest(VALID_FIELDS));

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(firstCall[1].body as string) as {
        raiseOnBehalfOf: string;
        serviceDeskId: string;
        requestTypeId: string;
      };
      expect(payload.raiseOnBehalfOf).toBe('alice@edwards.com');
    });

    it('sends serviceDeskId and requestTypeId in payload', async () => {
      mockAccessOk();
      mockJsmCreateOk();

      await POST(makeFormDataRequest(VALID_FIELDS));

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(firstCall[1].body as string) as {
        serviceDeskId: string;
        requestTypeId: string;
      };
      expect(payload.serviceDeskId).toBe('1');
      expect(payload.requestTypeId).toBe('4'); // IntegratedSystem
    });

    it('prepends "*Submitted by:*" audit line to description', async () => {
      mockAccessOk('bob@edwards.com', 'Bob Smith');
      mockJsmCreateOk();

      await POST(makeFormDataRequest(VALID_FIELDS));

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(firstCall[1].body as string) as {
        requestFieldValues: { description: string };
      };
      expect(payload.requestFieldValues.description).toContain('*Submitted by:* Bob Smith <bob@edwards.com>');
    });
  });

  // ── Group → requestTypeId mapping ─────────────────────────────────────────

  describe('group → requestTypeId mapping', () => {
    it('maps IntegratedSystem → requestTypeId 4', async () => {
      mockAccessOk();
      mockJsmCreateOk();

      await POST(makeFormDataRequest({ ...VALID_FIELDS, group: 'IntegratedSystem', component: 'Proteus' }));

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(firstCall[1].body as string) as { requestTypeId: string };
      expect(payload.requestTypeId).toBe('4');
    });

    it('maps Abatement → requestTypeId 117', async () => {
      mockAccessOk();
      mockJsmCreateOk();

      await POST(makeFormDataRequest({ ...VALID_FIELDS, group: 'Abatement', component: 'Abatement-Plasma' }));

      const firstCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(firstCall[1].body as string) as { requestTypeId: string };
      expect(payload.requestTypeId).toBe('117');
    });
  });

  // ── 403 mapping for raiseOnBehalfOf failures ──────────────────────────────

  describe('403 mapping for JSM 400 raiseOnBehalfOf errors', () => {
    it('returns 403 when JSM 400 body contains "raiseOnBehalfOf" as plain text', async () => {
      mockAccessOk();
      mockJsmCreateError(400, 'Customer raiseOnBehalfOf not allowed');

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(403);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/not enrolled/i);
    });

    it('returns 403 when JSM 400 JSON body mentions "raiseOnBehalfOf"', async () => {
      mockAccessOk();
      mockJsmCreateErrorJson(400, {
        errorMessages: ['Value for raiseOnBehalfOf is invalid'],
        errors: {},
      });

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(403);
    });

    it('returns 403 when JSM 400 JSON body mentions "cannot be added"', async () => {
      mockAccessOk();
      mockJsmCreateErrorJson(400, {
        errorMessages: ['The user cannot be added as a customer'],
        errors: {},
      });

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(403);
    });

    it('returns 403 when JSM 400 JSON body mentions both "raiseOnBehalfOf" and "cannot be added"', async () => {
      mockAccessOk();
      mockJsmCreateErrorJson(400, {
        errorMessages: ['raiseOnBehalfOf: cannot be added to the project'],
        errors: {},
      });

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(403);
    });

    it('returns 502 (not 403) for JSM 400 without raiseOnBehalfOf tokens', async () => {
      mockAccessOk();
      mockJsmCreateError(400, 'Invalid requestTypeId or some other validation error');

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(502);
    });
  });

  // ── issueKey fallback logic ───────────────────────────────────────────────

  describe('issueKey fallback', () => {
    it('returns 201 using issueKey when present', async () => {
      mockAccessOk();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issueKey: 'PSSM-42' }),
        text: async () => '{"issueKey":"PSSM-42"}',
      } as unknown as Response);

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(201);
      const body = await res.json() as { issueKey: string };
      expect(body.issueKey).toBe('PSSM-42');
    });

    it('falls back to issueId when issueKey is absent', async () => {
      mockAccessOk();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issueId: '10099' }),
        text: async () => '{"issueId":"10099"}',
      } as unknown as Response);

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(201);
      const body = await res.json() as { issueKey: string };
      expect(body.issueKey).toBe('10099');
    });

    it('returns 502 when both issueKey and issueId are absent', async () => {
      mockAccessOk();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => '{}',
      } as unknown as Response);

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(502);
    });
  });

  // ── Attachment soft-fail ──────────────────────────────────────────────────

  describe('attachment soft-fail: ticket created even when attachments fail', () => {
    function makeFakeFile(name: string, sizeBytes: number): File {
      const content = new Uint8Array(sizeBytes).fill(65); // 'A' bytes
      return new File([content], name, { type: 'text/plain' });
    }

    it('returns 201 when tempUpload (attachTemporaryFile) returns non-2xx', async () => {
      mockAccessOk();
      // First call: create issue — success
      mockJsmCreateOk('PSSM-77');
      // Second call: attachTemporaryFile — failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'internal server error',
      } as unknown as Response);

      const file = makeFakeFile('report.txt', 100);
      const res = await POST(makeFormDataRequest(VALID_FIELDS, [file]));
      expect(res.status).toBe(201);
      const body = await res.json() as { issueKey: string };
      expect(body.issueKey).toBe('PSSM-77');
    });

    it('returns 201 when request/{key}/attachment returns non-2xx', async () => {
      mockAccessOk();
      // First call: create issue — success
      mockJsmCreateOk('PSSM-88');
      // Second call: attachTemporaryFile — success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          temporaryAttachments: [{ temporaryAttachmentId: 'tmp-1', fileName: 'report.txt' }],
        }),
        text: async () => '{}',
      } as unknown as Response);
      // Third call: request/{key}/attachment — failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({}),
        text: async () => 'forbidden',
      } as unknown as Response);

      const file = makeFakeFile('report.txt', 100);
      const res = await POST(makeFormDataRequest(VALID_FIELDS, [file]));
      expect(res.status).toBe(201);
      const body = await res.json() as { issueKey: string };
      expect(body.issueKey).toBe('PSSM-88');
    });

    it('returns 201 when attachment upload throws an exception', async () => {
      mockAccessOk();
      mockJsmCreateOk('PSSM-99');
      // attachTemporaryFile — network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const file = makeFakeFile('crash.log', 200);
      const res = await POST(makeFormDataRequest(VALID_FIELDS, [file]));
      expect(res.status).toBe(201);
    });

    it('uses X-ExperimentalApi: opt-in header on attachTemporaryFile call', async () => {
      mockAccessOk();
      mockJsmCreateOk('PSSM-55');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ temporaryAttachments: [{ temporaryAttachmentId: 'tmp-x', fileName: 'f.txt' }] }),
        text: async () => '{}',
      } as unknown as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => '{}',
      } as unknown as Response);

      const file = makeFakeFile('f.txt', 50);
      await POST(makeFormDataRequest(VALID_FIELDS, [file]));

      // call[1] = attachTemporaryFile
      const tempCall = mockFetch.mock.calls[1] as [string, RequestInit & { headers: Record<string, string> }];
      expect(tempCall[1].headers['X-ExperimentalApi']).toBe('opt-in');
      expect(tempCall[1].headers['X-Atlassian-Token']).toBe('no-check');
    });
  });

  // ── File size enforcement ─────────────────────────────────────────────────

  describe('file size enforcement (regression)', () => {
    function makeFileOfSize(name: string, sizeBytes: number): File {
      const content = new Uint8Array(sizeBytes).fill(65);
      return new File([content], name, { type: 'application/octet-stream' });
    }

    it('returns 400 when a single file exceeds 10MB', async () => {
      mockAccessOk();
      const oversized = makeFileOfSize('big.bin', 11 * 1024 * 1024);
      const res = await POST(makeFormDataRequest(VALID_FIELDS, [oversized]));
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('10MB');
    });

    it('returns 400 when total file size exceeds 25MB', async () => {
      mockAccessOk();
      // Two files of 13MB each = 26MB total; each file < 10MB individually? No, 13MB > 10MB.
      // Use files of 9MB each: 9+9+9 = 27MB > 25MB, each 9MB < 10MB.
      const file1 = makeFileOfSize('a.bin', 9 * 1024 * 1024);
      const file2 = makeFileOfSize('b.bin', 9 * 1024 * 1024);
      const file3 = makeFileOfSize('c.bin', 9 * 1024 * 1024);
      const res = await POST(makeFormDataRequest(VALID_FIELDS, [file1, file2, file3]));
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('25MB');
    });
  });

  // ── 400: validation ───────────────────────────────────────────────────────

  describe('returns 400 for invalid fields', () => {
    it('returns 400 when summary is missing', async () => {
      mockAccessOk();
      const { summary: _omit, ...noSummary } = VALID_FIELDS;
      const res = await POST(makeFormDataRequest(noSummary as Record<string, string>));
      expect(res.status).toBe(400);
    });

    it('returns 400 when summary exceeds 255 characters', async () => {
      mockAccessOk();
      const res = await POST(makeFormDataRequest({ ...VALID_FIELDS, summary: 'x'.repeat(256) }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when group is invalid', async () => {
      mockAccessOk();
      const res = await POST(makeFormDataRequest({ ...VALID_FIELDS, group: 'BadGroup' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when component is not in SUBMIT_FORM_GROUPS', async () => {
      mockAccessOk();
      const res = await POST(makeFormDataRequest({ ...VALID_FIELDS, component: 'NotAComponent' }));
      expect(res.status).toBe(400);
    });
  });

  // ── 502: Jira fetch throws ────────────────────────────────────────────────

  describe('returns 502 when Jira fetch throws', () => {
    it('returns 502 on network error during issue creation', async () => {
      mockAccessOk();
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await POST(makeFormDataRequest(VALID_FIELDS));
      expect(res.status).toBe(502);
    });
  });
});
