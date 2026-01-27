# Full-Text Search 구현

## 개요
PostgreSQL GIN 인덱스와 pg_trgm 확장을 활용하여 검색 성능을 대폭 개선했습니다. 한국어 텍스트에 대한 유사도 검색도 지원합니다.

## 주요 변경사항

### 추가한 것
- **tsvector 컬럼**: 검색용 벡터 컬럼 추가 (auto-update 트리거)
- **GIN 인덱스**: Full-Text Search 인덱스
- **Trigram 인덱스**: 한국어 유사도 검색용
- **relevance ranking**: ts_rank + similarity 기반 정렬

### 수정한 것 (Gemini 리뷰 반영)
- `to_tsquery` → `plainto_tsquery` (특수문자 안전 처리)
- ILIKE 와일드카드 이스케이프 (`%`, `_`, `\`)
- 파라미터 수 최적화

## 핵심 코드

### 인덱스 생성 (SQL)
```sql
-- FTS 인덱스
CREATE INDEX idx_jira_issues_fts ON jira_issues USING GIN (search_vector);

-- Trigram 인덱스 (한국어 지원)
CREATE INDEX idx_jira_issues_summary_trgm ON jira_issues USING GIN (summary gin_trgm_ops);
```

### 검색 쿼리
```typescript
// ILIKE 와일드카드 이스케이프
function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// plainto_tsquery로 안전한 FTS
const res = await client.query(`
  SELECT *, ts_rank(search_vector, plainto_tsquery('simple', $1)) as rank
  FROM jira_issues
  WHERE search_vector @@ plainto_tsquery('simple', $1)
     OR similarity(summary, $1) > 0.1
  ORDER BY GREATEST(rank, sim) DESC
`, [query]);
```

## 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `scripts/create_fts_indexes.sql` | 생성 | FTS/Trigram 인덱스 스크립트 |
| `src/app/search/page.tsx` | 수정 | FTS 기반 검색 쿼리 |

## 결과
- 빌드 성공
- 특수문자 검색 안전 처리 (`(`, `)`, `|` 등)
- 한국어 유사도 검색 동작 확인

## 다음 단계
- 검색 결과 하이라이팅 (ts_headline)
- 자동완성 기능
- 검색 통계 대시보드
