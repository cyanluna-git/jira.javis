# Dashboard 필터 기능 구현

## 개요
Dashboard 페이지에 프로젝트별, 기간별 필터링 기능을 추가했습니다. URL 파라미터로 필터 상태를 관리하여 공유 가능합니다.

## 주요 변경사항

### 추가한 것
- **프로젝트 필터**: 드롭다운으로 특정 프로젝트만 조회
- **기간 필터**: All Time, 7/30/90/180/365일 옵션
- **필터 태그**: 활성 필터를 시각적으로 표시
- **Clear 버튼**: 모든 필터 초기화
- **URL 동기화**: `?project=XXX&days=30` 형태로 공유 가능

### 보안 수정 (Gemini 리뷰 반영)
- SQL Injection 취약점 수정
- 문자열 보간 → 파라미터화된 쿼리로 변경

## 핵심 코드

### 파라미터화된 필터 빌더
```typescript
function buildFilters(filters: FilterParams, dateColumn: string) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filters.project) {
    conditions.push(`project = $${paramIndex}`);
    params.push(filters.project);
    paramIndex++;
  }

  if (filters.days) {
    conditions.push(`${dateColumn} >= NOW() - INTERVAL '1 day' * $${paramIndex}`);
    params.push(filters.days);
    paramIndex++;
  }

  return { conditions: conditions.join(' AND '), params };
}
```

### 쿼리 사용 예
```typescript
const { conditions, params } = buildFilters(filters, "created::timestamp");
const res = await client.query(
  `SELECT * FROM jira_issues WHERE 1=1 ${conditions}`,
  params
);
```

## 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/dashboard/page.tsx` | 수정 | 필터 파라미터 + 쿼리 수정 |
| `src/app/dashboard/DashboardFilters.tsx` | 생성 | 필터 UI 컴포넌트 |

## 결과
- 빌드 성공
- Gemini 코드 리뷰 통과 (SQL Injection 수정)

## 다음 단계
- 검색 결과 페이지네이션
- Full-Text Search 인덱스 (성능)
