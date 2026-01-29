# Bundle Board 버그 수정 및 성능 최적화

## 개요
Bundle Board에서 발생하던 버그 수정 및 N+1 쿼리 문제 해결. API 성능을 41개 쿼리에서 3개 쿼리로 대폭 개선.

## 주요 변경사항
- **수정한 것**: Issue API에서 존재하지 않는 컬럼 참조 제거
- **수정한 것**: Recharts ResponsiveContainer 크기 경고 해결
- **개선한 것**: 차트 렌더링 시점 최적화
- **성능 개선**: N+1 쿼리 → 3개 쿼리로 최적화 (93% 감소)

## 핵심 코드

### API 수정 (`app/api/issues/[key]/route.ts`)
```typescript
// Before: local_modified_at, local_modified_fields 컬럼 참조
SELECT key, project, summary, status, created_at, updated_at, raw_data,
       local_modified_at, local_modified_fields, last_synced_at  // 오류 발생

// After: 존재하는 컬럼만 참조
SELECT key, project, summary, status, created_at, updated_at, raw_data, last_synced_at
```

### 차트 수정 (`app/bundles/BundleCharts.tsx`)
```typescript
// isMounted 상태 추가로 DOM 측정 완료 후 렌더링
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
  // Recharts dynamic import
}, []);

// ResponsiveContainer에 고정 높이 사용
<ResponsiveContainer width="100%" height={256}>
```

### N+1 쿼리 최적화 (`app/api/bundles/route.ts`)
```typescript
// Before: 1 + 2N 쿼리 (번들 20개 = 41 쿼리)
for (const row of epicResult.rows) {
  await client.query(...);  // 이슈 조회
  await client.query(...);  // 문서 조회
}

// After: 3개 쿼리 고정
// Query 1: 모든 Bundle Epic 조회
// Query 2: 모든 이슈 일괄 조회 (ANY($1) 사용)
// Query 3: 모든 문서 일괄 조회 (labels && $1 사용)
const issuesResult = await client.query(`
  SELECT ... FROM jira_issues
  WHERE ... AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(raw_data->'fields'->'fixVersions') v
    WHERE v->>'name' = ANY($1)
  )
`, [allVersions]);

// JavaScript에서 버전별 그룹핑
const issuesByVersion = new Map<string, BundleIssue[]>();
```

## 결과
- Bundle Board 이슈 클릭 시 모달 정상 표시
- 차트 width/height -1 경고 해결
- API 응답 속도 대폭 개선 (쿼리 수 93% 감소)

## 라벨 포맷 통일 (추가 작업)
Confluence는 라벨에 마침표(.)를 허용하지 않아 하이픈 포맷으로 통일:
- 기존: `bundle-3.8.3` (도트 포맷)
- 변경: `bundle-3-8-3` (하이픈 포맷)

### 수정 파일
- `lib/bundle.ts`: `getBundleLabel()` 함수 수정
- `scripts/add_bundle_labels.py`: 라벨 생성 포맷 수정
- `scripts/migrate_bundle_labels.py`: 기존 라벨 마이그레이션 스크립트 신규 생성
- `scripts/push_bundle_labels.py`: Confluence에 라벨 푸시 스크립트 신규 생성

### 결과
- 271 페이지의 라벨 마이그레이션 완료
- 259개 라벨을 실제 Confluence에 푸시 완료

## 다음 단계
- 다른 차트 컴포넌트(BurndownChart, ComponentProgressChart)에도 동일 패턴 적용 고려
- 에러 핸들링 개선 (Toast 알림 추가)
