import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { resolveAccessContextFromRequest } from '@/lib/access';

const PCAS_TIMEOUT_MS = 30_000;

interface AiAssistRequestBody {
  group: string;
  component: string;
  summary: string;
  draft_description: string;
}

interface SimilarIssue {
  key: string;
  summary: string;
  description: string | null;
}

interface PcasMessage {
  role: string;
  content: string;
}

interface PcasResponseBody {
  choices?: Array<{ message?: { content?: string } }>;
  message?: { content?: string };
  content?: string;
}

async function findSimilarIssues(summary: string, draftDescription: string, component: string): Promise<SimilarIssue[]> {
  const searchText = `${summary} ${draftDescription.slice(0, 500)}`.trim();
  const componentFilter = JSON.stringify([{ name: component }]);

  const result = await pool.query<{ key: string; summary: string; description: string | null }>(
    `SELECT key, summary, raw_data->'fields'->>'description' AS description
     FROM jira_issues
     WHERE project = 'PSSM'
       AND UPPER(status) IN ('DONE','CLOSED','RESOLVED','COMPLETED','COMPLETE')
       AND search_vector @@ plainto_tsquery('simple', $1)
       AND raw_data->'fields'->'components' @> $2::jsonb
     ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC, updated_at DESC
     LIMIT 3`,
    [searchText, componentFilter]
  );

  return result.rows;
}

function detectLanguage(text: string): 'ko' | 'en' {
  const koreanChars = (text.match(/[가-힣]/g) ?? []).length;
  return koreanChars / Math.max(text.length, 1) >= 0.1 ? 'ko' : 'en';
}

function buildPrompt(
  group: string,
  component: string,
  summary: string,
  draftDescription: string,
  similarIssues: SimilarIssue[]
): string {
  const lang = detectLanguage(summary + ' ' + draftDescription);
  const isKo = lang === 'ko';

  const examplesBlock =
    similarIssues.length > 0
      ? (isKo ? '## 유사 해결 사례 (참고용)' : '## Similar resolved cases (for reference)') +
        '\n' +
        similarIssues
          .map((issue, i) => {
            const desc = issue.description
              ? issue.description.slice(0, 300)
              : isKo ? '(설명 없음)' : '(no description)';
            return `${i + 1}. [${issue.key}] ${issue.summary}\n   ${desc}`;
          })
          .join('\n\n') +
        '\n\n'
      : '';

  const draftOrEmpty = draftDescription.trim() || (isKo ? '(초안 없음)' : '(no draft provided)');

  if (isKo) {
    return `당신은 소프트웨어 지원 요청서 작성 전문가입니다.
아래 초안을 바탕으로 명확하고 구조화된 요청 설명을 작성해 주세요.

## 요청 메타데이터
- 그룹: ${group || '(미지정)'}
- 컴포넌트: ${component || '(미지정)'}
- 요청 제목: ${summary}

${examplesBlock}## 사용자 초안
${draftOrEmpty}

## 출력 지침
- 구조: 아래 4개 항목 순서대로 작성
- 분량: 800자 이내
- 문체: 항목마다 단문(짧고 명확한 문장)으로 끝낼 것
- 금지: 인사말, 서문, 부연 설명, 중복 표현 제거
- 출력: 구조 레이블 포함한 본문만

- 현재 상황: (지금 어떤 문제 또는 상태인지)
- 요청 사항: (구체적으로 무엇이 필요한지)
- 기대 효과: (해결 시 어떤 이점이 생기는지)
- 기타 참고: (관련 티켓·장비·일정 등, 해당 없으면 생략)`;
  }

  return `You are an expert at writing structured software support requests.
Rewrite the draft below into a clear, structured request description.

## Request Metadata
- Group: ${group || '(unspecified)'}
- Component: ${component || '(unspecified)'}
- Title: ${summary}

${examplesBlock}## User Draft
${draftOrEmpty}

## Output Guidelines
- Structure: use the four sections below, in order
- Length: within 800 characters
- Style: end each section with short, direct sentences — no filler, no redundancy
- Forbidden: greetings, preamble, commentary, repetition
- Output: labeled body only

- Current situation: (what the problem or current state is)
- Request: (what specifically is needed)
- Expected outcome: (what improves once resolved)
- Additional notes: (ticket numbers, equipment, deadlines — omit if none)`;
}

async function callPcas(prompt: string, upn: string, signal: AbortSignal): Promise<string> {
  const pcasUrl = process.env.PCAS_API_URL;
  const pcasToken = process.env.PCAS_API_TOKEN;
  const pcasModel = process.env.PCAS_LLM_MODEL ?? 'gpt-5.2';

  if (!pcasUrl || !pcasToken) {
    throw new Error('PCAS_NOT_CONFIGURED');
  }

  const messages: PcasMessage[] = [{ role: 'user', content: prompt }];

  const res = await fetch(`${pcasUrl}/chat`, {
    method: 'POST',
    headers: {
      'ai-brains-token': pcasToken,
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, stream: false, model: pcasModel, user: upn }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[service-desk/ai-assist] PCAS error:', res.status, text);
    throw new Error(`PCAS_HTTP_${res.status}`);
  }

  const data = await res.json() as PcasResponseBody;
  const content =
    data.choices?.[0]?.message?.content ??
    data.message?.content ??
    data.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('PCAS_EMPTY_RESPONSE');
  }

  return content.trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const pcasUrl = process.env.PCAS_API_URL;
  const pcasToken = process.env.PCAS_API_TOKEN;

  if (!pcasUrl || !pcasToken) {
    return NextResponse.json({ error: 'AI assist is not configured' }, { status: 503 });
  }

  let body: Partial<AiAssistRequestBody>;
  try {
    body = await request.json() as Partial<AiAssistRequestBody>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const summary = (body.summary ?? '').trim();
  const group = (body.group ?? '').trim();
  const component = (body.component ?? '').trim();
  const draftDescription = (body.draft_description ?? '').trim();

  if (!summary) {
    return NextResponse.json({ error: 'summary is required' }, { status: 400 });
  }

  const access = await resolveAccessContextFromRequest(request);
  const upn = access.user?.email ?? access.user?.username ?? 'anonymous';

  const abort = new AbortController();
  const timeoutId = setTimeout(() => abort.abort(), PCAS_TIMEOUT_MS);

  try {
    const [similarIssues] = await Promise.all([
      findSimilarIssues(summary, draftDescription, component).catch(() => [] as SimilarIssue[]),
    ]);

    const prompt = buildPrompt(group, component, summary, draftDescription, similarIssues);
    const enhanced = await callPcas(prompt, upn, abort.signal);

    return NextResponse.json({ enhanced_description: enhanced });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 응답 시간이 초과되었습니다. 다시 시도해주세요.' }, { status: 504 });
    }
    console.error('[service-desk/ai-assist] error:', err);
    return NextResponse.json({ error: 'AI 보조 기능에 오류가 발생했습니다. 다시 시도해주세요.' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
