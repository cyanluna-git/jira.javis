# Sync Examples - 사용 예시 및 워크플로우

## 워크플로우 예시

### 1. 아침 전체 동기화

```bash
/javis-sync all
```

또는 개별 실행:

```bash
python3 scripts/sync_bidirectional.py --pull-only
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py
```

### 2. 스프린트 시작 시

```bash
/javis-sync boards
/javis-sync members --init
```

### 3. 작업 후 Push

```bash
/javis-sync issues push --dry-run
/javis-sync issues push
```

### 4. 주간 전체 동기화

```bash
python3 scripts/sync_bidirectional.py
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py --recalculate
python3 scripts/sync_confluence_bidirectional.py
python3 scripts/sync_bitbucket.py
```

### 5. 상태 확인

```bash
/javis-sync status
python3 .claude/skills/sync/scripts/sync.py status
```

## 출력 예시

### `/javis-sync status`

```
=== Sync Status ===

Type       | Scope    | Count | Last Sync
-----------|----------|-------|----------
Issues     | EUV      | 245   | 2024-01-23
Issues     | ASP      | 128   | 2024-01-23
Boards     | EUV      | 3     | 2024-01-23
Members    | -        | 12    | 2024-01-22
BB Repos   | ac-avi   | 8     | 2024-01-23
BB Commits | -        | 1,245 | 2024-01-23
BB PRs     | OPEN     | 5     | 2024-01-23
BB PRs     | MERGED   | 42    | 2024-01-23

=== Summary ===
Last full sync: 2024-01-23 09:15
Status: OK
```

### `/javis-sync all`

```
=== Full Sync Started ===

[1/4] Jira Issues...
  - Pulled: 45 new, 12 updated
  - Duration: 8.2s

[2/4] Boards & Sprints...
  - Synced: 3 boards, 15 sprints
  - Duration: 2.1s

[3/4] Member Stats...
  - Updated: 12 members
  - Duration: 1.5s

[4/4] Bitbucket...
  - Repos: 8
  - Commits: 125 new
  - PRs: 3 new, 2 updated
  - Duration: 12.3s

=== Sync Complete ===
Total Duration: 24.1s
Next recommended sync: 2024-01-24 09:00
```

### `/javis-sync issues pull`

```
=== Jira Issues Sync (Pull) ===

Project: EUV
  - New: 5
  - Updated: 8
  - Unchanged: 232

Project: ASP
  - New: 2
  - Updated: 3
  - Unchanged: 123

Total: 7 new, 11 updated
Duration: 6.8s
```

### `/javis-sync conflicts`

```
=== Sync Conflicts ===

ID | Issue   | Field    | Local Value        | Remote Value       | Detected
---|---------|----------|--------------------|--------------------|----------
1  | EUV-301 | status   | In Progress        | Done               | 2024-01-23
2  | EUV-305 | summary  | Updated locally    | Updated in Jira    | 2024-01-22

Resolution options:
  --force-local   : Apply local values to Jira
  --force-remote  : Apply Jira values to local DB
```

## 스크립트 사용

```bash
# 상태 확인
python3 .claude/skills/sync/scripts/sync.py status

# 전체 동기화 (프로젝트 루트에서)
python3 scripts/sync_bidirectional.py --pull-only
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py
python3 scripts/sync_bitbucket.py
```

## 대상 프로젝트

기본: `EUV`, `ASP`, `PSSM`

프로젝트 설정은 각 스크립트 또는 `.env` 파일에서 관리합니다.
