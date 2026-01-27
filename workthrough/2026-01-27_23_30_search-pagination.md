# 검색 결과 페이지네이션 구현

## 개요
통합 검색 페이지에 페이지네이션 기능을 추가했습니다. 검색 결과가 많을 때 20개씩 나누어 표시하고, 페이지 번호로 이동할 수 있습니다.

## 주요 변경사항

### 추가한 것
- **페이지네이션 UI**: 페이지 번호, 이전/다음 버튼
- **Ellipsis 처리**: 페이지가 많을 때 `1 ... 5 6 7 ... 20` 형태로 표시
- **결과 카운트**: "Showing 1-20 of 100 results" 표시
- **URL 동기화**: `?q=검색어&page=2` 형태로 공유 가능

### 서버 변경
- COUNT 쿼리 추가로 전체 결과 수 조회
- OFFSET 추가로 페이지별 결과 반환

## 핵심 코드

### 페이지 번호 생성 로직
```typescript
const pages: (number | 'ellipsis')[] = [];
if (totalPages <= showPages + 2) {
  for (let i = 1; i <= totalPages; i++) pages.push(i);
} else {
  pages.push(1);
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) pages.push('ellipsis');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
}
```

### URL 빌더
```typescript
const buildUrl = (page: number) => {
  const params = new URLSearchParams();
  params.set('q', query);
  if (filter !== 'all') params.set('filter', filter);
  if (page > 1) params.set('page', String(page));
  return `/search?${params.toString()}`;
};
```

## 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/search/page.tsx` | 수정 | COUNT 쿼리, OFFSET, page 파라미터 |
| `src/app/search/SearchContent.tsx` | 수정 | Pagination 컴포넌트 추가 |

## 결과
- 빌드 성공
- 검색 결과 20개씩 페이지 분할
- 필터 + 페이지 URL 파라미터 정상 동작

## 다음 단계
- Full-Text Search 인덱스 (성능 개선)
- Sprint Board 기능 확장 (Plan 파일 참조)
