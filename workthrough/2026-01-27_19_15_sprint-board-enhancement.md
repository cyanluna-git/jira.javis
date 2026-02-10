# Sprint Board 기능 확장

## 개요
Sprint Board 페이지에 담당자 필터, 이슈 모달, 번다운 차트, 달성률 시각화, 컴포넌트별 차트 기능을 추가하여 스프린트 관리 기능을 대폭 강화했습니다.

## 주요 변경사항

### 추가한 것
- **담당자별 필터링**: 체크박스로 담당자 선택하여 이슈 필터링
- **목표 달성률**: 이슈 수/스토리 포인트 프로그레스 바
- **이슈 상세 모달**: 클릭 시 description, labels, comments 표시
- **번다운 차트**: Ideal/Actual 라인으로 스프린트 진행 시각화
- **컴포넌트 분포 차트**: 파이 차트로 컴포넌트별 이슈 분포
- **컴포넌트 진행률 차트**: 스택 바 차트로 컴포넌트별 To Do/In Progress/Done

### 수정한 것
- `IssueDetailModal`: description 시인성 개선 (jira 페이지 스타일 적용)
- `SprintIssueRow`: 클릭 핸들러 추가

### 새 파일
- `src/types/sprint.ts` - 공통 타입 정의
- `src/components/IssueDetailModal.tsx` - 이슈 상세 모달
- `src/components/BurndownChart.tsx` - 번다운 차트
- `src/components/ComponentPieChart.tsx` - 컴포넌트 분포 파이 차트
- `src/components/ComponentProgressChart.tsx` - 컴포넌트 진행률 차트

## 핵심 코드

```typescript
// 담당자 필터링
const assignees = useMemo(() => {
  const map = new Map<string, number>();
  issues.forEach(issue => {
    const name = issue.raw_data?.fields?.assignee?.displayName || 'Unassigned';
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}, [issues]);

// 진행률 계산
const progressRate = useMemo(() => {
  const done = filteredIssues.filter(i =>
    ['done', 'closed', 'resolved'].includes(i.status.toLowerCase())
  ).length;
  return Math.round((done / filteredIssues.length) * 100);
}, [filteredIssues]);
```

## 결과
- ✅ 빌드 성공
- ✅ recharts 라이브러리 추가

## 다음 단계
- 이슈 상세 모달에서 JIRA 링크 열기 기능
- 번다운 차트 데이터 히스토리 기반으로 개선 (현재는 단순 계산)
- 필터 상태 URL 파라미터 동기화
- 컴포넌트 클릭 시 해당 컴포넌트 이슈만 필터링
