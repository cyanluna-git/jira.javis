/**
 * Unit tests for buildPrompt logic.
 *
 * Because buildPrompt is not exported from the route, we verify its
 * observable effects by checking what gets sent to PCAS (the body.messages[0].content).
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('@/lib/access', () => ({
  resolveAccessContextFromRequest: jest.fn().mockResolvedValue({
    user: { email: 'test@example.com' },
  }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { POST } from '@/app/api/service-desk/ai-assist/route';
import pool from '@/lib/db';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3009/api/service-desk/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function capturePrompt(): string {
  const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
  const reqBody = JSON.parse(options.body as string) as { messages: Array<{ role: string; content: string }> };
  return reqBody.messages[0].content;
}

describe('buildPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PCAS_API_URL = 'https://pcas.example.com';
    process.env.PCAS_API_TOKEN = 'test-token';
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      text: async () => 'ok',
    });
  });

  afterEach(() => {
    delete process.env.PCAS_API_URL;
    delete process.env.PCAS_API_TOKEN;
  });

  it('includes group, component, and summary in prompt', async () => {
    await POST(makeRequest({
      summary: 'Login error',
      group: 'Digital',
      component: 'OQCDigitalization',
      draft_description: 'Error since yesterday',
    }));

    const prompt = capturePrompt();
    expect(prompt).toContain('Digital');
    expect(prompt).toContain('OQCDigitalization');
    expect(prompt).toContain('Login error');
  });

  it('includes draft description text in prompt', async () => {
    await POST(makeRequest({
      summary: 'PDF export broken',
      group: 'MES',
      component: 'Reporting',
      draft_description: 'PDF export crashes on large datasets',
    }));

    const prompt = capturePrompt();
    expect(prompt).toContain('PDF export crashes on large datasets');
  });

  it('uses placeholder (초안 없음) when draft_description is empty', async () => {
    await POST(makeRequest({
      summary: 'API timeout',
      group: 'Integration',
      component: 'Middleware',
      draft_description: '',
    }));

    const prompt = capturePrompt();
    expect(prompt).toContain('(초안 없음)');
  });

  it('includes similar issue keys when FTS returns results', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        { key: 'PSSM-42', summary: 'Similar login issue', description: 'Fixed by resetting session cache' },
      ],
    });

    await POST(makeRequest({
      summary: 'Login broken',
      group: 'Digital',
      component: 'OQCDigitalization',
      draft_description: '',
    }));

    const prompt = capturePrompt();
    expect(prompt).toContain('PSSM-42');
    expect(prompt).toContain('Similar login issue');
  });

  it('omits examples block when FTS returns no results', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await POST(makeRequest({
      summary: 'Obscure widget error',
      group: 'MES',
      component: 'Widget',
      draft_description: '',
    }));

    const prompt = capturePrompt();
    expect(prompt).not.toContain('유사 해결 사례');
  });

  it('truncates issue description to 300 chars in prompt', async () => {
    const longDesc = 'A'.repeat(500);
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ key: 'PSSM-99', summary: 'Issue', description: longDesc }],
    });

    await POST(makeRequest({
      summary: 'Long desc test',
      group: 'IT',
      component: 'Infrastructure',
      draft_description: '',
    }));

    const prompt = capturePrompt();
    // Description portion should not contain more than 300 A's
    const aCount = (prompt.match(/A/g) ?? []).length;
    expect(aCount).toBeLessThanOrEqual(300);
  });

  it('instructs PCAS to write Korean structured response under 400 chars', async () => {
    await POST(makeRequest({
      summary: 'Test',
      group: 'G',
      component: 'C',
      draft_description: '',
    }));

    const prompt = capturePrompt();
    expect(prompt).toContain('한국어 400자 이내');
    expect(prompt).toContain('현재 상황');
    expect(prompt).toContain('요청 사항');
    expect(prompt).toContain('기대 효과');
  });
});
