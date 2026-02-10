# 통합 검색 기능 구현

## 개요
Jira 이슈와 Confluence 페이지를 동시에 검색하는 통합 검색 기능을 구현했습니다. 홈페이지 상단에 검색 바를 추가하여 빠른 접근이 가능합니다.

## 주요 변경사항

### 추가한 것
- **Search 페이지**: `/search` 경로로 통합 검색
- **검색 입력**: 2글자 이상 입력 시 검색 실행
- **필터 탭**: All / Jira / Confluence 필터링
- **Jira 결과**: 이슈 키, 요약, 상태, 담당자, 매칭 필드 표시
- **Confluence 결과**: 제목, 발췌, 스페이스명 표시
- **홈페이지 검색 바**: 상단에 검색 입력 링크 추가

### Gemini 리뷰 반영
- Promise.all로 병렬 쿼리 실행 (성능 개선)
- 필터 변경 시 현재 입력값 사용 (UX 개선)

## 핵심 코드

### ILIKE 검색 + 우선순위 정렬
```sql
SELECT key, summary, status, ...
FROM jira_issues
WHERE key ILIKE $1 OR summary ILIKE $1 OR description ILIKE $1
ORDER BY
  CASE WHEN key ILIKE $1 THEN 0 ELSE 1 END,
  updated DESC
LIMIT $2
```

### 병렬 쿼리 실행
```typescript
if (filter === 'all') {
  [jiraResults, confluenceResults] = await Promise.all([
    searchJira(query, limit),
    searchConfluence(query, limit),
  ]);
}
```

### HTML 태그 제거 (발췌)
```typescript
excerpt: row.excerpt?.replace(/<[^>]*>/g, '').substring(0, 150) || ''
```

## 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/search/page.tsx` | 생성 | 서버 컴포넌트, 검색 쿼리 실행 |
| `src/app/search/SearchContent.tsx` | 생성 | 클라이언트 컴포넌트, 검색 UI |
| `src/app/page.tsx` | 수정 | 상단 검색 바 추가 |

## 결과
- 빌드 성공
- Gemini 코드 리뷰 통과

## 다음 단계
- 대시보드 기간/프로젝트별 필터링
- 검색 결과 페이지네이션
- Full-Text Search 인덱스 (성능 최적화)
