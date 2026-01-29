# Stories Skill - Bitbucket 통합

## 개요
`/stories` skill에 Bitbucket 데이터를 통합하여 Epic/Story 관련 개발 현황(커밋, PR, 개발자 활동)을 함께 볼 수 있도록 업데이트했다.

## 주요 변경사항

### 1. `/stories context` 확장
- Vision 맥락 조회 시 Bitbucket 개발 현황 추가
- 최근 7일 커밋 (Vision 관련 Epic/Story 기준)
- 오픈 PR 현황
- 개발자별 활동 요약

### 2. `/stories list` 확장
- Epic 하위 Story 목록과 함께 개발 현황 표시
- Epic 관련 최근 커밋 (7일)
- Epic 관련 오픈/병합된 PR

### 3. `/sync` Skill 업데이트
- Bitbucket 동기화 옵션 상세화 (`--repos-only`, `--commits-only`, `--prs-only`, `--days N`)
- `/sync status`에 Bitbucket 상태 추가
- DB 테이블 목록에 `bitbucket_repositories`, `bitbucket_pullrequests` 추가

## 데이터 소스

| 정보 | 테이블 | 연결 방식 |
|------|--------|-----------|
| 커밋 이력 | `bitbucket_commits` | `jira_keys` 배열로 Epic/Story 연결 |
| PR 현황 | `bitbucket_pullrequests` | `jira_keys` 배열로 Epic/Story 연결 |
| 레포지토리 | `bitbucket_repositories` | `uuid`로 커밋/PR 연결 |

## 쿼리 패턴

```sql
-- Vision 관련 Epic/Story 키 추출
WITH vision_epics AS (
    SELECT el.epic_key FROM roadmap_epic_links el
    JOIN roadmap_milestones m ON m.id = el.milestone_id
    JOIN roadmap_visions v ON v.id = m.vision_id
    WHERE v.title ILIKE '%OQC%'
),
related_keys AS (
    SELECT epic_key as issue_key FROM vision_epics
    UNION
    SELECT ji.key FROM jira_issues ji
    JOIN vision_epics ve ON ji.raw_data->'fields'->'parent'->>'key' = ve.epic_key
)
-- jira_keys 배열 교집합으로 관련 커밋 조회
SELECT * FROM bitbucket_commits
WHERE jira_keys && (SELECT ARRAY_AGG(issue_key) FROM related_keys);
```

## 결과
- `/stories context` - Vision 맥락 + Bitbucket 개발 현황 통합 조회
- `/stories list` - Epic Story + 관련 커밋/PR 통합 조회
- `/sync bitbucket` - 상세 옵션 지원

## 다음 단계
- Phase 2: `/sprint` skill 구현 (스프린트 관리)
- Phase 3: `/dev` skill 구현 (개발자 대시보드)
