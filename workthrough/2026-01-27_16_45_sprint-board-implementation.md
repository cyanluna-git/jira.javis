# Jira Sprint Board Viewer 구현

## 개요
Jira Agile API를 통해 보드/스프린트 정보를 동기화하고, Next.js 기반 스프린트 뷰어 페이지를 구현했습니다. Gemini-Claude 루프를 활용하여 코드 품질을 검증받으며 진행했습니다.

## 주요 변경사항

### 1. 데이터베이스 (3개 테이블 생성)
- `jira_boards`: 보드 정보 (scrum/kanban)
- `jira_sprints`: 스프린트 정보 (active/future/closed)
- `jira_issue_sprints`: 이슈-스프린트 매핑 (FK 제약조건 포함)

### 2. Python 동기화 스크립트
- `scripts/mirror_jira_sprints.py` 생성
- Jira Agile REST API 사용 (`/rest/agile/1.0/board`, `/sprint`, `/issue`)
- 프로젝트 필터링, FK 검증, 트랜잭션 처리

### 3. Frontend 페이지 (Next.js App Router)
- `src/app/sprints/page.tsx`: Server Component (SSR)
- `src/app/sprints/SprintContent.tsx`: Client Component (UI)
- `src/app/sprints/SprintCard.tsx`: 스프린트 카드
- `src/app/sprints/SprintIssueRow.tsx`: 이슈 행

### 4. 홈 페이지 업데이트
- Sprint Board 카드 추가 (녹색 테마)
- 3컬럼 그리드 레이아웃

## 핵심 코드

```sql
-- FK 제약조건이 있는 이슈-스프린트 매핑
CREATE TABLE jira_issue_sprints (
    issue_key TEXT REFERENCES jira_issues(key) ON DELETE CASCADE,
    sprint_id INTEGER REFERENCES jira_sprints(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_key, sprint_id)
);
```

```typescript
// URL Search Params 패턴 (Server Component)
export default async function SprintsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const boardId = params.board ? parseInt(params.board) : null;
  const sprints = boardId ? await getSprints(boardId) : [];
  // ...
}
```

## 결과
- ✅ 빌드 성공 (Next.js 16.1.5)
- ✅ 데이터 동기화 완료 (3 boards, 48 sprints, 928 mappings)
- ✅ 페이지 정상 동작 (http://localhost:3009/sprints)

## 동기화된 데이터
| 항목 | 개수 |
|------|------|
| Boards | 3 |
| Sprints | 48 (active: 1, future: 3, closed: 44) |
| Issue-Sprint Mappings | 928 |

## 다음 단계
- [ ] 스프린트 번다운 차트 추가
- [ ] 이슈 상태 변경 기능 (Jira API 연동)
- [ ] 스프린트 목표 달성률 시각화
- [ ] 담당자별 이슈 필터링
- [ ] 이슈 상세 모달 (클릭 시 상세 정보 표시)
