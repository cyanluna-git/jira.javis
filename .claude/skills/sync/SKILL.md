---
name: javis-sync
description: Jira/Confluence/Bitbucket/Boards/Sprints/Members 전체 동기화. 사용법: /javis-sync all, /javis-sync issues, /javis-sync boards, /javis-sync sprints, /javis-sync members, /javis-sync confluence, /javis-sync bitbucket, /javis-sync status
argument-hint: "[all|issues|boards|sprints|members|confluence|bitbucket|status] [pull|push]"
allowed-tools: Bash(python3 *)
---

# /javis-sync - 데이터 동기화

로컬 PostgreSQL DB와 Jira/Confluence/Bitbucket 간 데이터 동기화를 관리합니다.

## 동기화 대상

| 명령어 | 스크립트 | 대상 |
|--------|----------|------|
| `/javis-sync issues` | `sync_bidirectional.py` | Jira Issues |
| `/javis-sync boards` | `sync_boards.py` | Boards |
| `/javis-sync sprints` | `sync_sprints.py` | Sprints + Issue 매핑 |
| `/javis-sync members` | `sync_member_stats.py` | Member 통계 |
| `/javis-sync confluence` | `sync_confluence_bidirectional.py` | Confluence Pages |
| `/javis-sync bitbucket` | `sync_bitbucket.py` | Commits, PRs |

## 빠른 실행

```bash
# 전체 동기화
/javis-sync all

# Issues만 (Jira → DB)
python3 scripts/sync_bidirectional.py --pull-only

# 스프린트 동기화
python3 scripts/sync_sprints.py
python3 scripts/sync_sprints.py --project EUV
python3 scripts/sync_sprints.py --active-only
python3 scripts/sync_sprints.py --list

# 상태 확인
python3 .claude/skills/sync/scripts/sync.py status
```

## 추가 리소스

- 동기화 스크립트 상세: [reference.md](reference.md)
- 사용 예시 및 워크플로우: [examples.md](examples.md)
- 상태 확인 헬퍼: [scripts/sync.py](scripts/sync.py)

## 주요 스크립트 (프로젝트 루트 기준)

```bash
# Jira 양방향 동기화
python3 scripts/sync_bidirectional.py              # 전체
python3 scripts/sync_bidirectional.py --pull-only  # Jira → DB
python3 scripts/sync_bidirectional.py --push-only  # DB → Jira
python3 scripts/sync_bidirectional.py --dry-run    # 시뮬레이션

# Boards
python3 scripts/sync_boards.py

# Sprints (스프린트 메타데이터 + 이슈 매핑)
python3 scripts/sync_sprints.py                    # 전체
python3 scripts/sync_sprints.py --project EUV      # 특정 프로젝트
python3 scripts/sync_sprints.py --active-only      # Active만
python3 scripts/sync_sprints.py --list             # DB 목록 조회

# Member 통계
python3 scripts/sync_member_stats.py

# Bitbucket
python3 scripts/sync_bitbucket.py
```
