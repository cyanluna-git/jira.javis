# Read-Only 모드 구현

## 개요
서버 배포 시 read-only 모드로 운영하고, 로컬에서만 편집 가능하도록 환경 변수 기반 제어 시스템 구현. `NEXT_PUBLIC_READ_ONLY=true` 설정 시 모든 쓰기 작업이 차단됨.

## 변경 사항

### 1. 새 파일 생성

#### `src/contexts/ReadOnlyContext.tsx`
React Context를 사용한 클라이언트 측 read-only 상태 관리.
```tsx
'use client';
import { createContext, useContext, ReactNode } from 'react';

const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';
  return (
    <ReadOnlyContext.Provider value={isReadOnly}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}
```

#### `src/lib/readonly.ts`
API Route용 read-only 체크 유틸리티.
```ts
import { NextResponse } from 'next/server';

export function isReadOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';
}

export function readOnlyResponse() {
  return NextResponse.json(
    { error: 'This server is in read-only mode', code: 'READ_ONLY_MODE' },
    { status: 403 }
  );
}
```

### 2. Layout 수정
`src/app/layout.tsx`에 ReadOnlyProvider 적용.

### 3. API Routes 보호 (18개 파일)
모든 POST/PUT/PATCH/DELETE 핸들러에 read-only 체크 추가:
- `/api/roadmap/visions/*` - Vision CRUD
- `/api/roadmap/milestones/*` - Milestone CRUD
- `/api/roadmap/streams/*` - Stream 생성
- `/api/roadmap/risks/*` - Risk 생성/수정
- `/api/roadmap/local-epics/*` - Local Epic CRUD
- `/api/roadmap/visions/[id]/members/*` - Vision Member 관리
- `/api/sprints/[id]/labels` - Sprint 라벨 수정
- `/api/issues/[key]` - Issue 수정
- `/api/members/[id]/*` - Member 수정/평가
- `/api/operations/*` - Operation CRUD
- `/api/confluence/suggestions/*` - Suggestion 관리

패턴:
```ts
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

export async function POST(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();
  // ... 기존 로직
}
```

### 4. UI 컴포넌트 수정 (6개 파일)
편집 버튼 조건부 렌더링 및 Read-Only 배지 추가:

| 파일 | 변경 내용 |
|------|----------|
| `VisionCard.tsx` | 편집 버튼 숨김 |
| `MilestoneCard.tsx` | Epic 추가/제거 버튼 숨김 |
| `SprintContent.tsx` | 라벨 편집 버튼 숨김, Read-Only 배지 |
| `roadmap/page.tsx` | Vision 생성/편집 버튼 숨김, Read-Only 배지 |
| `roadmap/[visionId]/page.tsx` | 편집/삭제/Milestone 추가 버튼 숨김, Read-Only 배지 |
| `page.tsx` (홈) | Operations, Members 카드 숨김 |

패턴:
```tsx
const isReadOnly = useReadOnly();

{!isReadOnly && (
  <button onClick={handleEdit}>편집</button>
)}

{isReadOnly && (
  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
    Read-Only
  </span>
)}
```

### 5. 문서 업데이트
- `.env` - `NEXT_PUBLIC_READ_ONLY=false` 추가
- `CLAUDE.md` - Read-Only 모드 설명 추가

## 개선 사항

1. **환경 변수 타입 안전성**: `?.toLowerCase()` 사용으로 대소문자 무관하게 처리
2. **UX 개선**: Read-Only 배지로 사용자에게 현재 모드 표시
3. **API 에러 표준화**: `{ error: '...', code: 'READ_ONLY_MODE' }` 형식으로 에러 코드 추가

## 빌드 검증

```bash
> npm run build

✓ Compiled successfully
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

Exit code: 0
```

## 테스트 방법

```bash
# 로컬 (편집 가능)
NEXT_PUBLIC_READ_ONLY=false npm run dev

# Read-only 모드 테스트
NEXT_PUBLIC_READ_ONLY=true npm run dev
```

확인 항목:
- 각 페이지에 "Read-Only" 배지 표시
- 편집 버튼 숨김
- 홈에서 Operations, Members 카드 숨김
- API POST/PUT/PATCH/DELETE 시 403 응답

## 향후 개선 가능 사항

- Toast 알림으로 read-only 모드 안내
- 특정 역할에만 편집 권한 부여 (RBAC)
