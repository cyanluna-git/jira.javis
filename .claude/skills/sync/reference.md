# Sync Reference - 동기화 스크립트 상세

## 동기화 스크립트

### Jira Issues 양방향 동기화

```bash
# 전체 양방향 싱크
python3 scripts/sync_bidirectional.py

# Jira → DB만
python3 scripts/sync_bidirectional.py --pull-only

# DB → Jira만
python3 scripts/sync_bidirectional.py --push-only

# 특정 프로젝트만
python3 scripts/sync_bidirectional.py --pull-only --project EUV

# Dry run
python3 scripts/sync_bidirectional.py --push-only --dry-run

# 충돌 해결
python3 scripts/sync_bidirectional.py --show-conflicts
python3 scripts/sync_bidirectional.py --force-local
python3 scripts/sync_bidirectional.py --force-remote
```

### Boards/Sprints 동기화

```bash
# 전체 보드
python3 scripts/sync_boards.py

# 특정 프로젝트만
python3 scripts/sync_boards.py --project EUV
```

### Member 통계 동기화

```bash
# 증분 업데이트
python3 scripts/sync_member_stats.py

# 전체 초기화
python3 scripts/sync_member_stats.py --init

# 통계 재계산
python3 scripts/sync_member_stats.py --recalculate

# 특정 스프린트 통계
python3 scripts/sync_member_stats.py --sprint <sprint_id>
```

### Confluence 양방향 동기화

```bash
# 전체 양방향
python3 scripts/sync_confluence_bidirectional.py

# Pull only
python3 scripts/sync_confluence_bidirectional.py --pull-only

# Push only
python3 scripts/sync_confluence_bidirectional.py --push-only
```

### Bitbucket 동기화

```bash
# 전체 동기화 (Repos + Commits + PRs)
python3 scripts/sync_bitbucket.py

# 레포지토리만
python3 scripts/sync_bitbucket.py --repos-only

# 커밋만 (기본 30일)
python3 scripts/sync_bitbucket.py --commits-only

# 최근 7일 커밋만
python3 scripts/sync_bitbucket.py --commits-only --days 7

# PR만 (OPEN + MERGED)
python3 scripts/sync_bitbucket.py --prs-only

# Dry run
python3 scripts/sync_bitbucket.py --dry-run
```

## DB 테이블

| 테이블 | 용도 | Sync 스크립트 |
|--------|------|---------------|
| `jira_issues` | Jira 이슈 | sync_bidirectional.py |
| `jira_boards` | 보드 목록 | sync_boards.py |
| `jira_sprints` | 스프린트 | sync_boards.py |
| `jira_issue_sprints` | 이슈-스프린트 매핑 | sync_boards.py |
| `team_members` | 팀원 정보 | sync_member_stats.py |
| `member_stats` | 멤버 통계 | sync_member_stats.py |
| `confluence_v2_content` | Confluence 페이지 | sync_confluence_bidirectional.py |
| `bitbucket_repositories` | Bitbucket 레포지토리 | sync_bitbucket.py |
| `bitbucket_commits` | Bitbucket 커밋 | sync_bitbucket.py |
| `bitbucket_pullrequests` | Bitbucket PR | sync_bitbucket.py |
| `sync_conflicts` | 충돌 기록 | sync_bidirectional.py |

## 동기화 상태 확인 쿼리

```sql
-- Issues 동기화 상태
SELECT 'Issues' as type, project,
       COUNT(*) as total,
       MAX(last_synced_at)::date as last_sync
FROM jira_issues GROUP BY project

UNION ALL

-- Boards 동기화 상태
SELECT 'Boards' as type, project_key,
       COUNT(*),
       MAX(synced_at)::date
FROM jira_boards GROUP BY project_key

UNION ALL

-- Members 동기화 상태
SELECT 'Members' as type, '-',
       COUNT(*),
       MAX(updated_at)::date
FROM team_members WHERE is_active = true

UNION ALL

-- Bitbucket Repos 동기화 상태
SELECT 'BB Repos' as type, workspace,
       COUNT(*),
       MAX(last_synced_at)::date
FROM bitbucket_repositories GROUP BY workspace

UNION ALL

-- Bitbucket Commits 동기화 상태 (최근 30일)
SELECT 'BB Commits' as type, '-',
       COUNT(*),
       MAX(synced_at)::date
FROM bitbucket_commits WHERE committed_at > NOW() - INTERVAL '30 days'

UNION ALL

-- Bitbucket PRs 동기화 상태
SELECT 'BB PRs' as type, state,
       COUNT(*),
       MAX(synced_at)::date
FROM bitbucket_pullrequests GROUP BY state

ORDER BY type;
```

## 양방향 동기화 개념

### 증분 동기화
- `last_synced_at` 타임스탬프 이후 변경분만 동기화

### 로컬 수정 추적
- PostgreSQL 트리거가 `local_modified_at`, `local_modified_fields` 자동 기록

### 충돌 감지
- 같은 필드가 로컬/원격 모두 변경된 경우 `sync_conflicts` 테이블에 저장

### 충돌 해결
```bash
python3 scripts/sync_bidirectional.py --show-conflicts   # 충돌 목록
python3 scripts/sync_bidirectional.py --force-local      # 로컬 우선
python3 scripts/sync_bidirectional.py --force-remote     # 원격 우선
```
