# Service Desk 성능 최적화

## 개요
Service Desk 페이지의 DB 쿼리를 병렬화하고 Recharts 번들을 동적 로딩으로 변경하여 페이지 로딩 성능을 개선했습니다.

## 주요 변경사항

### 개선한 것
- **async-parallel**: 6개 DB 쿼리를 `Promise.all`로 병렬 실행 (순차 → 병렬)
- **bundle-dynamic-imports**: Recharts 차트 컴포넌트를 `next/dynamic`으로 분리
- **Gemini 코드 리뷰 반영**: `client.query` → `pool.query`로 진정한 병렬화 달성

## 핵심 코드

```typescript
// lib/service-desk.ts - 병렬 쿼리 실행
// pool.query 사용으로 각 쿼리가 별도 커넥션에서 병렬 실행
const [
  tabCountsResult,
  statsResult,
  statusBreakdownResult,
  componentBreakdownResult,
  ticketsResult,
  filterOptionsResult,
] = await Promise.all([
  pool.query(tabCountsQuery),
  pool.query(statsQuery, values),
  pool.query(statusBreakdownQuery, values),
  pool.query(componentBreakdownQuery, values),
  pool.query(ticketsQuery, ticketsValues),
  pool.query(filterOptionsQuery),
]);
```

```typescript
// ServiceDeskContent.tsx - 동적 차트 로딩
const ServiceDeskCharts = dynamic(
  () => import('./ServiceDeskCharts'),
  { loading: () => <ChartSkeleton />, ssr: false }
);
```

## 파일 구조
```
src/javis-viewer/src/
├── lib/service-desk.ts              # Promise.all 병렬 쿼리
└── app/service-desk/
    ├── ServiceDeskContent.tsx       # dynamic import
    └── ServiceDeskCharts.tsx        # 분리된 차트 컴포넌트
```

## 결과
- ✅ 빌드 성공
- ✅ Gemini 코드 리뷰 통과 (pool.query로 진정한 병렬화)

## 다음 단계
- 티켓 정렬 기능 (Created, Updated, Priority 등)
- 담당자별 워크로드 차트 추가
- SLA 위반 티켓 하이라이트
- 실시간 알림 (WebSocket)
