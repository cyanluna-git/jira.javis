# Javis Viewer - Feature Implementation

**Date**: 2026-01-27
**Author**: Gerald Park (with Claude Code)
**Status**: ✅ Completed

## Overview

Javis Viewer의 핵심 기능들을 구현했습니다. Jira 이슈를 보기 좋게 표시하고, 검색 및 필터링 기능을 추가하여 2,794개의 이슈를 효율적으로 탐색할 수 있게 되었습니다.

## Objectives

1. ✅ DB 복원 및 연결 설정
2. ✅ Jira 이슈 목록 페이지 구현
3. ✅ 이슈 상세보기 (아코디언 방식)
4. ✅ Atlassian Document Format (ADF) 렌더링
5. ✅ 이미지 및 첨부파일 지원
6. ✅ 검색 및 필터 기능 (Key, Project, Component, Version)

---

## Implementation Details

### 1. Database Setup

**Database Restore**
```bash
# PostgreSQL 컨테이너 실행 (포트: 5439)
cd config
docker compose -f javis-db-compose.yml up -d

# SQL 덤프 복원
gunzip -c data/db/backups/javis_brain_backup.sql.gz > /tmp/javis_brain_backup.sql
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -f /tmp/javis_brain_backup.sql
```

**결과**:
- ✅ Jira Issues: 2,794개
- ✅ Confluence Pages: 1,707개

**환경변수 설정** (`src/javis-viewer/.env`):
```env
PORT=3009
POSTGRES_HOST=localhost
POSTGRES_PORT=5439
POSTGRES_USER=javis
POSTGRES_PASSWORD=javis_password
POSTGRES_DB=javis_brain
DATABASE_URL=postgresql://javis:javis_password@localhost:5439/javis_brain
```

---

### 2. Jira Issues List Page

**파일**: `src/app/jira/page.tsx`

**기능**:
- 전체 2,794개 이슈 로드 (초기 LIMIT 100 제거)
- created_at 기준 내림차순 정렬
- 테이블 형식으로 표시 (Key, Summary, Status, Project, Created)

**쿼리**:
```sql
SELECT key, summary, status, project, created_at, raw_data
FROM jira_issues
ORDER BY created_at DESC
```

---

### 3. Issue Detail View (Accordion)

**파일**: `src/app/jira/IssueRow.tsx`

**기능**:
- Key 클릭 시 상세 내용 확장/축소
- 표시 정보:
  - **Type**: Story, Task, Bug 등
  - **Priority**: High, Medium, Low 등
  - **Assignee / Reporter**: 담당자 정보
  - **Labels**: 태그 배지 형태
  - **Description**: Markdown 형식 렌더링

**UI**:
- 확장/축소 아이콘 (▶/▼)
- 회색 배경의 상세 영역
- 색상 구분 (Type: 파란색, Priority: 주황색, Labels: 보라색)

---

### 4. ADF (Atlassian Document Format) Renderer

**파일**: `src/components/AdfRenderer.tsx`

Jira의 Description은 ADF 형식으로 저장되어 있어, 이를 React 컴포넌트로 렌더링하는 시스템 구축.

**지원 포맷**:
- ✅ **텍스트 스타일**: Bold, Italic, Underline, Strikethrough
- ✅ **헤딩**: H1 ~ H6 (크기 및 굵기 차별화)
- ✅ **리스트**: Bullet List (•), Ordered List (1. 2. 3.)
- ✅ **코드**: Inline Code (`code`), Code Block (```language```)
- ✅ **링크**: 파란색 밑줄 + 외부 링크 아이콘
- ✅ **인용구**: 왼쪽 파란색 테두리
- ✅ **패널**: Info, Warning, Error, Success (색상 구분)
- ✅ **테이블**: 표 형태 렌더링
- ✅ **멘션**: @user 파란색 배지
- ✅ **미디어**: 이미지 및 첨부파일

**이미지 렌더링**:
```typescript
// attachment 정보 추출 및 전달
const attachments = (issue.raw_data?.fields?.attachment || []).map((att: any) => ({
  id: att.id,
  filename: att.filename,
  content: att.content,
  thumbnail: att.thumbnail,
  mimeType: att.mimeType,
}));

// ADF와 attachment 매칭하여 이미지 표시
<AdfRenderer doc={descriptionRaw} attachments={attachments} />
```

**이미지 로드 실패 시**:
- "Image requires authentication" 플레이스홀더 표시
- Jira attachment URL은 인증이 필요하여 브라우저에서 직접 로드 불가

---

### 5. Search & Filter System

**파일**: `src/app/jira/JiraContent.tsx`

**검색 기능**:
- Key 기반 검색 (예: "EUV-3284")
- 실시간 필터링

**필터 기능**:

1. **Project Filter** (파란색)
   - ASP, EUV, PSSM
   - 다중 선택 가능
   - 각 프로젝트별 이슈 개수 표시

2. **Component Filter** (보라색)
   - HRS, ProtronDualRow 등
   - 스크롤 가능 (max-height: 48)
   - 각 컴포넌트별 이슈 개수 표시

3. **Version/Sprint Filter** (초록색)
   - PW05-x08-00 등
   - fixVersions 필드 활용
   - 릴리스 버전 기반 필터링

**UI 기능**:
- 필터 토글 버튼 (활성 필터 개수 배지)
- Clear 버튼 (모든 필터 초기화)
- 활성 필터 태그 표시
- "Showing X of Y issues" 카운터

**필터링 로직**:
```typescript
const filteredIssues = useMemo(() => {
  return issues.filter(issue => {
    // Key 검색
    if (searchKey && !issue.key.toLowerCase().includes(searchKey.toLowerCase())) {
      return false;
    }
    // Project 필터
    if (selectedProjects.length > 0 && !selectedProjects.includes(issue.project)) {
      return false;
    }
    // Component 필터
    if (selectedComponents.length > 0) {
      const issueComponents = (issue.raw_data?.fields?.components || []).map((c: any) => c.name);
      const hasMatchingComponent = selectedComponents.some(comp => issueComponents.includes(comp));
      if (!hasMatchingComponent) return false;
    }
    // Version 필터
    if (selectedVersions.length > 0) {
      const issueVersions = (issue.raw_data?.fields?.fixVersions || []).map((v: any) => v.name);
      const hasMatchingVersion = selectedVersions.some(ver => issueVersions.includes(ver));
      if (!hasMatchingVersion) return false;
    }
    return true;
  });
}, [issues, searchKey, selectedProjects, selectedComponents, selectedVersions]);
```

---

## Technical Stack

- **Framework**: Next.js 16.1.5 (App Router, React Server Components)
- **Database**: PostgreSQL 16 with pgvector extension
- **UI**: Tailwind CSS 4, Lucide Icons
- **Language**: TypeScript 5
- **Database Client**: node-postgres (pg)

---

## File Structure

```
src/javis-viewer/
├── .env                          # 환경변수 (DB 연결, 포트 설정)
├── src/
│   ├── app/
│   │   ├── page.tsx             # 홈 페이지 (대시보드)
│   │   └── jira/
│   │       ├── page.tsx         # Jira 메인 페이지 (Server Component)
│   │       ├── JiraContent.tsx  # 검색/필터 로직 (Client Component)
│   │       └── IssueRow.tsx     # 이슈 아코디언 (Client Component)
│   ├── components/
│   │   └── AdfRenderer.tsx      # ADF → React 렌더러
│   └── lib/
│       ├── db.ts                # PostgreSQL Pool 설정
│       └── adf-parser.ts        # ADF → Plain Text (사용 안 함)
└── package.json
```

---

## Usage

**서버 실행**:
```bash
cd src/javis-viewer
npm run dev
```

**접속**:
- Home: http://localhost:3009
- Jira Issues: http://localhost:3009/jira

**검색 예시**:
- Key 검색: "EUV-3284"
- Project 필터: "EUV" 선택
- Component 필터: "HRS" 선택
- Version 필터: "PW05-x08-00" 선택

---

## Results

### 성과
- ✅ 2,794개 이슈를 빠르게 탐색 가능
- ✅ Jira와 유사한 렌더링 품질
- ✅ 이미지, 테이블, 코드 블록 등 복잡한 포맷 지원
- ✅ 강력한 필터링으로 원하는 이슈 빠르게 찾기

### 성능
- 페이지 로드: ~1초 (2,794개 이슈)
- 검색/필터: 즉시 반영 (useMemo 최적화)

---

## Next Steps

### Phase 2 계획
1. **Confluence 페이지 뷰어**
   - `/confluence` 라우트 추가
   - 페이지 계층 구조 표시 (Tree View)
   - Confluence Storage Format → HTML 렌더링

2. **통합 검색**
   - Jira + Confluence 통합 검색
   - 전체 텍스트 검색 (PostgreSQL Full-Text Search)

3. **AI 기능 (Jarvis Brain)**
   - Gemini API 연동
   - 이슈 요약 및 분석
   - 음성 입력 → 이슈 자동 생성

4. **대시보드 개선**
   - 프로젝트별 통계 차트
   - 최근 업데이트된 이슈 표시
   - 스프린트 진행률

---

## Lessons Learned

1. **ADF 렌더링**: Jira의 ADF는 복잡하지만 재귀적으로 처리하면 대부분 커버 가능
2. **이미지 인증**: Jira attachment는 인증이 필요하므로 향후 프록시 API 필요
3. **필터 성능**: useMemo를 활용한 메모이제이션으로 2,700+ 이슈도 즉시 필터링
4. **컴포넌트 분리**: Server Component(데이터 로드) + Client Component(인터랙션) 패턴 효과적

---

## References

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)
