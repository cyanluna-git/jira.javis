# Confluence Sprint 페이지 라벨링 및 뷰 페이지 생성

## 개요
Sprint-Tumalo 하위 287개 Confluence 페이지에 자동 라벨을 추가하고, 라벨 기반 뷰 페이지 3개를 생성했습니다. 기존 폴더 구조를 유지하면서 유형별 검색이 가능하도록 개선.

## 주요 변경사항

### 개발한 것
- `scripts/sprint_restructure/` 모듈 (6개 파일) - 문서 분류, 유사도 분석, 구조 제안 시스템
- `scripts/add_sprint_labels.py` - 라벨 자동 추가 스크립트
- `scripts/create_view_pages.py` - 뷰 페이지 생성 스크립트

### 수정한 것
- `scripts/lib/confluence_write.py` - v1 API로 라벨 추가 수정
- `scripts/execute_operations.py` - 새 핸들러 3개 추가 (CreateFolder, Restructure, AddLink)
- `scripts/javis_cli.py` - `restructure` 명령 추가

### 적용 결과
- 287개 페이지에 라벨 추가 완료
  - `story-note`: 229개
  - `sprint-review`: 39개
  - `sprint-board`: 13개
  - `sprint-01` ~ `sprint-33`: 스프린트별 라벨
- 뷰 페이지 3개 생성
  - 📋 All Sprint Reviews
  - 📋 All Story Notes
  - 📋 All Sprint Boards

## 핵심 코드

```python
# 라벨 자동 분류 로직 (SQL)
CASE
    WHEN title ~* 'sprint.?review' THEN 'sprint-review'
    WHEN title ~ '^EUV-[0-9]+' THEN 'story-note'
    WHEN title ~* '(sprint|standup).?board' THEN 'sprint-board'
END as type_label

# Confluence v1 API로 라벨 추가
api_request('POST', f'/rest/api/content/{page_id}/label',
            [{'name': label, 'prefix': 'global'} for label in labels])
```

## 결과
- ✅ 287개 페이지 라벨링 성공 (에러 0)
- ✅ 뷰 페이지 3개 생성 완료
- ✅ Confluence + 로컬 DB 동기화 완료

## 다음 단계
- Page Properties Report 매크로로 스프린트별 필터 뷰 추가
- AI 기반 문서 분류기 (현재는 regex 기반)
- `javis restructure` CLI 실제 테스트
- 로컬 DB 먼저 → Confluence 동기화 워크플로우 표준화
