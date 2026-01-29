---
name: sync
description: Jira/Confluence/Bitbucket/Boards/Members 전체 동기화. 사용법: /sync all, /sync issues, /sync boards, /sync members, /sync confluence, /sync bitbucket, /sync status
---

# /sync - 전체 데이터 동기화

로컬 PostgreSQL DB와 Jira/Confluence/Bitbucket 간 데이터 동기화를 관리합니다.

## 동기화 대상

| 명령어 | 스크립트 | 대상 |
|--------|----------|------|
| `/sync issues` | `sync_bidirectional.py` | Jira Issues |
| `/sync boards` | `sync_boards.py` | Boards, Sprints |
| `/sync members` | `sync_member_stats.py` | Member 통계 |
| `/sync confluence` | `sync_confluence_bidirectional.py` | Confluence Pages |
| `/sync epics` | `sync_roadmap_epics.py` | Roadmap Epic 연결 |
| `/sync bitbucket` | `sync_bitbucket.py` | Bitbucket Commits |

---

## 명령어

### `/sync` 또는 `/sync all`
전체 동기화 (Issues + Boards + Members)

```bash
python3 scripts/sync_bidirectional.py --pull-only
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py
```

---

### `/sync issues [pull|push] [--project PROJECT]`
Jira Issues 양방향 동기화

```bash
# Pull (Jira → DB)
python3 scripts/sync_bidirectional.py --pull-only

# Push (DB → Jira)
python3 scripts/sync_bidirectional.py --push-only

# 특정 프로젝트만
python3 scripts/sync_bidirectional.py --pull-only --project EUV

# Dry run
python3 scripts/sync_bidirectional.py --push-only --dry-run
```

---

### `/sync boards [--project PROJECT]`
Boards 및 Sprints 동기화

```bash
# 전체 보드
python3 scripts/sync_boards.py

# 특정 프로젝트만
python3 scripts/sync_boards.py --project EUV
```

**동기화 대상:**
- Scrum/Kanban 보드 목록
- 스프린트 정보 (이름, 시작일, 종료일, 상태)
- 스프린트별 이슈 매핑

---

### `/sync members [--init|--recalculate]`
Member 통계 동기화

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

**동기화 대상:**
- `team_members`: Assignee에서 추출한 팀원 정보
- `member_stats`: 완료 이슈 기반 통계
- `member_stat_history`: 통계 변경 이력

---

### `/sync confluence [pull|push]`
Confluence Pages 양방향 동기화

```bash
# 전체 양방향
python3 scripts/sync_confluence_bidirectional.py

# Pull only
python3 scripts/sync_confluence_bidirectional.py --pull-only

# Push only
python3 scripts/sync_confluence_bidirectional.py --push-only
```

---

### `/sync epics`
Roadmap Epic 연결 동기화

```bash
python3 scripts/sync_roadmap_epics.py
```

**동기화 대상:**
- `roadmap_epic_links`: Epic과 Milestone 연결

---

### `/sync bitbucket [--repos-only|--commits-only|--prs-only] [--days N]`
Bitbucket Commits, PRs, Repositories 동기화

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

**동기화 대상:**
- `bitbucket_repositories`: 워크스페이스 내 모든 레포지토리
- `bitbucket_commits`: 커밋 이력 + Jira 이슈 키 추출
- `bitbucket_pullrequests`: OPEN/MERGED PR + Jira 이슈 키 추출

**참고:** 레포지토리가 env에 지정되지 않으면 워크스페이스 전체를 자동 탐색합니다.

---

### `/sync status`
동기화 상태 확인

```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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

ORDER BY type, project;
"
```

---

### `/sync conflicts`
충돌 목록 확인 및 해결

```bash
# 충돌 목록
python3 scripts/sync_bidirectional.py --show-conflicts

# 로컬 우선으로 해결
python3 scripts/sync_bidirectional.py --force-local

# 원격 우선으로 해결
python3 scripts/sync_bidirectional.py --force-remote
```

---

## DB 테이블

| 테이블 | 용도 | Sync 스크립트 |
|--------|------|---------------|
| `jira_issues` | Jira 이슈 | sync_bidirectional.py |
| `jira_boards` | 보드 목록 | sync_boards.py |
| `jira_sprints` | 스프린트 | sync_boards.py |
| `team_members` | 팀원 정보 | sync_member_stats.py |
| `member_stats` | 멤버 통계 | sync_member_stats.py |
| `confluence_v2_content` | Confluence 페이지 | sync_confluence_bidirectional.py |
| `bitbucket_repositories` | Bitbucket 레포지토리 | sync_bitbucket.py |
| `bitbucket_commits` | Bitbucket 커밋 (jira_keys 추출) | sync_bitbucket.py |
| `bitbucket_pullrequests` | Bitbucket PR (jira_keys 추출) | sync_bitbucket.py |
| `roadmap_epic_links` | Epic-Milestone 연결 | sync_roadmap_epics.py |
| `sync_conflicts` | 충돌 기록 | sync_bidirectional.py |

---

## 대상 프로젝트

기본: `EUV`, `ASP`, `PSSM`

---

## 워크플로우 예시

### 1. 아침 전체 동기화
```
/sync all
```
또는
```bash
python3 scripts/sync_bidirectional.py --pull-only
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py
```

### 2. 스프린트 시작 시
```
/sync boards
/sync members --init
```

### 3. 작업 후 Push
```
/sync issues push --dry-run
/sync issues push
```

### 4. 주간 전체 동기화
```bash
python3 scripts/sync_bidirectional.py
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py --recalculate
python3 scripts/sync_confluence_bidirectional.py
python3 scripts/sync_bitbucket.py
```
