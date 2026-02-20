# Dashboard 페이지 구현

## 개요
Gemini-Claude 루프를 활용하여 프로젝트 대시보드 페이지를 구현했습니다. 전체 이슈 현황, 스프린트 속도, 팀 워크로드, 컴포넌트별 진행률을 시각적으로 표시합니다.

## 주요 변경사항

### 추가한 것
- **Dashboard 페이지**: `/dashboard` 경로로 프로젝트 개요 제공
- **Summary Cards**: 총 이슈, 오픈, 완료, 활성 스프린트, 보드 수, 완료율
- **Sprint Velocity 차트**: 최근 8개 스프린트의 포인트/이슈 완료 추이 (LineChart)
- **Status Distribution**: 이슈 상태별 분포 (PieChart)
- **Team Workload**: 담당자별 업무량 (Stacked BarChart)
- **Component Health**: 컴포넌트별 완료율 (Progress Bar)
- **Recent Activity**: 최근 업데이트된 이슈 10개 테이블
- **에러 핸들링**: DB 연결 실패 시 폴백 UI 표시

### 수정한 것
- 홈페이지에 Dashboard 카드 추가

## 핵심 코드

### 병렬 데이터 페칭
```typescript
const [stats, velocity, workload, statusDist, recentIssues, componentHealth] = await Promise.all([
  getDashboardStats(),
  getSprintVelocity(),
  getAssigneeWorkload(),
  getStatusDistribution(),
  getRecentIssues(),
  getComponentHealth(),
]);
```

### 스프린트 속도 쿼리
```sql
SELECT
  s.name,
  COALESCE(SUM(
    COALESCE((ji.raw_data->'fields'->>'customfield_10016')::numeric, 0)
  ), 0) as completed_points
FROM jira_sprints s
JOIN jira_issue_sprints jis ON s.id = jis.sprint_id
JOIN jira_issues ji ON jis.issue_key = ji.key
WHERE s.state IN ('active', 'closed')
  AND LOWER(ji.status) IN ('done', 'closed', 'resolved')
GROUP BY s.id, s.name, s.end_date
ORDER BY s.end_date DESC NULLS LAST
LIMIT 8
```

### 에러 핸들링 (Gemini 리뷰 반영)
```typescript
try {
  const [...] = await Promise.all([...]);
  return (<DashboardContent {...} />);
} catch (error) {
  console.error('Dashboard data fetch error:', error);
  return (<ErrorFallbackUI />);
}
```

## 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/dashboard/page.tsx` | 생성 | 서버 컴포넌트, 6개 데이터 페칭 함수 |
| `src/app/dashboard/DashboardContent.tsx` | 생성 | 클라이언트 컴포넌트, recharts 시각화 |
| `src/app/page.tsx` | 수정 | Dashboard 카드 추가 |

## 결과
- 빌드 성공
- Gemini 코드 리뷰 통과 (에러 핸들링 반영)

## 다음 단계
- 스프린트 간 성과 비교 기능
- 통합 검색 기능
- 대시보드 필터링 (기간, 프로젝트별)
