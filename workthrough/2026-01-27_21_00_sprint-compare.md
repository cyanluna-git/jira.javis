# Sprint Compare 기능 구현

## 개요
2개의 스프린트를 선택하여 성과를 비교하는 페이지를 구현했습니다. 이슈/포인트 완료율, 담당자별 기여도, 컴포넌트별 완료율을 시각화합니다.

## 주요 변경사항

### 추가한 것
- **Compare 페이지**: `/sprints/compare` 경로
- **스프린트 선택**: 2개 드롭다운으로 비교 대상 선택
- **Summary Cards**: 완료율 변화 (증가/감소 표시)
- **Metrics Comparison**: 가로 막대 차트로 이슈/포인트 비교
- **Performance Radar**: 완료율, 속도를 레이더 차트로 비교
- **Assignee Comparison**: 담당자별 완료 포인트 비교
- **Component Comparison**: 컴포넌트별 완료율 비교
- **Compare 버튼**: Sprint Board 헤더에 보라색 버튼 추가

### Gemini 리뷰 반영
- LEFT JOIN으로 빈 스프린트 처리 (UI 사라짐 방지)
- Radar 차트 속도 스케일링 수정 (상대값 정규화)
- parseInt NaN 체크 추가
- 차트 제목 명확화 ("Completed Points by Assignee")

## 핵심 코드

### FULL OUTER JOIN으로 담당자 비교
```sql
WITH sprint_data AS (
  SELECT jis.sprint_id, assignee_name, COUNT(*) as issue_count, SUM(points) as points
  FROM jira_issue_sprints jis ...
  WHERE jis.sprint_id IN ($1, $2)
  GROUP BY jis.sprint_id, assignee_name
)
SELECT COALESCE(s1.assignee_name, s2.assignee_name) as name, ...
FROM (SELECT * FROM sprint_data WHERE sprint_id = $1) s1
FULL OUTER JOIN (SELECT * FROM sprint_data WHERE sprint_id = $2) s2
  ON s1.assignee_name = s2.assignee_name
```

### 상대적 속도 정규화
```typescript
const maxPoints = Math.max(sprint1Stats.completedPoints, sprint2Stats.completedPoints) || 1;
{ metric: 'Velocity', sprint1: Math.round((sprint1Stats.completedPoints / maxPoints) * 100), ... }
```

## 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/sprints/compare/page.tsx` | 생성 | 서버 컴포넌트, 비교 데이터 페칭 |
| `src/app/sprints/compare/CompareContent.tsx` | 생성 | 클라이언트 컴포넌트, 차트 렌더링 |
| `src/app/sprints/page.tsx` | 수정 | Compare 버튼 추가 |

## 결과
- 빌드 성공
- Gemini 코드 리뷰 통과

## 다음 단계
- 통합 검색 기능 (Jira + Confluence)
- 대시보드 필터링 (기간/프로젝트별)
