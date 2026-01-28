# 검색 오류 수정 및 Members 카드 추가

## 개요
PostgreSQL 검색 쿼리의 컬럼 별칭 오류를 수정하고, Confluence 페이지에 서버 측 검색 기능을 추가했습니다. 또한 홈페이지에 Members 카드를 추가했습니다.

## 주요 변경사항

### 수정한 것
- **검색 오류 수정**: PostgreSQL에서 ORDER BY 절에 컬럼 별칭 사용 불가 문제 해결
  - `GREATEST(rank, sim)` → `GREATEST(ts_rank(...), similarity(...))` 전체 표현식 사용
- **Confluence 검색**: 로컬 필터링 → DB 검색으로 변경 (1797개 전체 페이지 검색 가능)

### 개발한 것
- **Members 카드**: 홈페이지에 팀 멤버 통계 카드 추가 (67명, 활성 멤버 수 표시)
- **Confluence Tree Search API**: `/api/confluence/tree?search=` 파라미터 지원

## 핵심 코드

```typescript
// search/page.tsx - ORDER BY에서 전체 표현식 사용
ORDER BY
  GREATEST(ts_rank(search_vector, plainto_tsquery('simple', $1)),
           similarity(title, $1)) DESC

// ConfluenceTree.tsx - 서버 검색 호출 (300ms 디바운스)
const fetchSearchResults = async (query: string) => {
  const res = await fetch(`/api/confluence/tree?search=${encodeURIComponent(query)}`);
  setSearchResults(data.nodes || []);
};
```

## 파일 구조
```
src/javis-viewer/src/
├── app/page.tsx                    # Members 카드 추가
├── app/search/page.tsx             # 검색 쿼리 수정
├── app/api/confluence/tree/route.ts # search 파라미터 지원
└── components/ConfluenceTree.tsx   # 서버 검색 호출
```

## 결과
- ✅ 빌드 성공
- ✅ Jira/Confluence 통합 검색 정상 동작
- ✅ Confluence 페이지 검색 정상 동작
- ✅ Members 카드 표시

## 다음 단계
- 검색 결과 하이라이팅
- Members 페이지 필터링 기능 강화
- 검색 자동완성 (Autocomplete)
