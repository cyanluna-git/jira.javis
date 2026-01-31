# Navigation Buttons 추가 및 Markdown 테이블 렌더링 지원

## Overview
모든 페이지에 뒤로가기(Back)와 홈(Home) 네비게이션 버튼을 추가하고, Roadmap 페이지의 MarkdownRenderer에 테이블 렌더링 기능을 구현했습니다.

## Context
- 기존에는 대부분의 페이지에 ArrowLeft 버튼 하나만 있었고, `/roadmap`과 `/members` 페이지는 네비게이션 버튼이 없었음
- Markdown 테이블 문법이 테이블로 렌더링되지 않고 인라인 코드 블록처럼 표시되는 문제가 있었음

---

## 변경 사항

### 1. NavigationButtons 컴포넌트 생성

**파일**: `src/components/NavigationButtons.tsx` (신규)

재사용 가능한 클라이언트 컴포넌트로 Back 버튼(browser history)과 Home 버튼(/)을 제공합니다.

```tsx
// src/components/NavigationButtons.tsx
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export function NavigationButtons() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.back()}
        className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </button>
      <Link
        href="/"
        className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Go to home"
      >
        <Home className="w-5 h-5 text-gray-600" />
      </Link>
    </div>
  );
}
```

### 2. First-Level 페이지 업데이트 (10개)

기존 ArrowLeft → "/" 링크를 `NavigationButtons` 컴포넌트로 교체:

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/jira/page.tsx` | NavigationButtons 적용 |
| `src/app/sprints/page.tsx` | NavigationButtons 적용 |
| `src/app/dashboard/page.tsx` | NavigationButtons 적용 (정상/에러 상태 모두) |
| `src/app/operations/page.tsx` | NavigationButtons 적용 |
| `src/app/bundles/page.tsx` | NavigationButtons 적용 |
| `src/app/confluence/page.tsx` | NavigationButtons 적용 |
| `src/app/search/page.tsx` | NavigationButtons 적용 (정상/에러 상태 모두) |
| `src/app/service-desk/page.tsx` | NavigationButtons 적용 |
| `src/app/roadmap/page.tsx` | NavigationButtons **신규 추가** (기존에 없었음) |
| `src/app/members/MemberDashboard.tsx` | NavigationButtons **신규 추가** (기존에 없었음) |

### 3. Nested 페이지 업데이트 (3개)

부모 페이지로 가는 Back 링크는 유지하고 Home 버튼만 추가:

| 파일 | Back 대상 | Home |
|------|-----------|------|
| `src/app/sprints/compare/page.tsx` | `/sprints` | `/` |
| `src/app/roadmap/[visionId]/page.tsx` | `/roadmap` | `/` |
| `src/app/members/[id]/MemberDetailClient.tsx` | `/members` | `/` |

```tsx
// 예시: sprints/compare/page.tsx
<div className="flex items-center gap-2">
  <Link href="/sprints" className="p-2 bg-white rounded-lg border...">
    <ArrowLeft className="w-5 h-5 text-gray-600" />
  </Link>
  <Link href="/" className="p-2 bg-white rounded-lg border...">
    <Home className="w-5 h-5 text-gray-600" />
  </Link>
</div>
```

### 4. MarkdownRenderer 테이블 지원 추가

**파일**: `src/components/MarkdownRenderer.tsx`

Markdown 테이블 문법(`| col1 | col2 |`)을 HTML `<table>`로 렌더링하는 기능 추가:

```tsx
// 테이블 파싱 헬퍼 함수들
const parseTableRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\||\|$/g, '');
  return trimmed.split('|').map(cell => cell.trim());
};

const isTableSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  return /^\|?[\s\-:|]+\|[\s\-:|]+\|?$/.test(trimmed);
};

const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.split('|').length >= 2;
};
```

**테이블 렌더링 결과**:
- 헤더: `bg-gray-100` 배경, 굵은 텍스트
- 본문: 짝수/홀수 행 구분 (zebra striping)
- 테두리와 적절한 padding 적용

**적용 범위** (MarkdownRenderer 사용 위치):
- `MilestoneCard.tsx` - Milestone/Epic 설명
- `roadmap/[visionId]/page.tsx` - Vision 상세 설명

---

## Verification Results

### Build Verification

```bash
> npm run build

▲ Next.js 16.1.5 (Turbopack)
✓ Compiled successfully in 5.7s
✓ Generating static pages (20/20)

Route (app)
├ ƒ /bundles
├ ○ /confluence
├ ƒ /dashboard
├ ƒ /jira
├ ƒ /members
├ ƒ /members/[id]
├ ƒ /operations
├ ○ /roadmap
├ ƒ /roadmap/[visionId]
├ ƒ /search
├ ƒ /service-desk
├ ƒ /sprints
└ ƒ /sprints/compare

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## 사용자 동작

### Navigation Buttons
- **Back 버튼**: 브라우저 히스토리에서 이전 페이지로 이동 (`router.back()`)
- **Home 버튼**: 메인 대시보드(`/`)로 이동

### Markdown 테이블

**입력**:
```markdown
| Story | 설명 | Points |
|-------|------|--------|
| Simulator 공통 인터페이스 | `ISimulator` 추상 클래스 정의 | 3 |
| EUV Simulator | EUV 장비 모사 | 5 |
```

**출력**: 스타일이 적용된 HTML 테이블

---

## 파일 변경 요약

| 작업 | 파일 수 |
|------|---------|
| 신규 생성 | 1개 (`NavigationButtons.tsx`) |
| 수정 | 13개 |
| **총 변경** | **14개 파일** |

### 변경된 파일 목록
1. `src/components/NavigationButtons.tsx` (신규)
2. `src/components/MarkdownRenderer.tsx`
3. `src/app/jira/page.tsx`
4. `src/app/sprints/page.tsx`
5. `src/app/sprints/compare/page.tsx`
6. `src/app/dashboard/page.tsx`
7. `src/app/operations/page.tsx`
8. `src/app/bundles/page.tsx`
9. `src/app/confluence/page.tsx`
10. `src/app/search/page.tsx`
11. `src/app/service-desk/page.tsx`
12. `src/app/roadmap/page.tsx`
13. `src/app/roadmap/[visionId]/page.tsx`
14. `src/app/members/MemberDashboard.tsx`
15. `src/app/members/[id]/MemberDetailClient.tsx`
