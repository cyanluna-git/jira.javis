---
name: javis-sync
description: Jira/Confluence/Bitbucket/Boards/Sprints/Members data sync. Usage: /javis-sync all, /javis-sync issues, /javis-sync boards, /javis-sync sprints, /javis-sync members, /javis-sync confluence, /javis-sync bitbucket, /javis-sync status
argument-hint: "[all|issues|boards|sprints|members|confluence|bitbucket|status] [pull|push]"
allowed-tools: Bash(python3 *)
---

# /javis-sync - Data Synchronization

Manages data synchronization between the local PostgreSQL DB and Jira/Confluence/Bitbucket.

## Sync Targets

| Command | Script | Target |
|---------|--------|--------|
| `/javis-sync issues` | `sync_bidirectional.py` | Jira Issues |
| `/javis-sync boards` | `sync_boards.py` | Boards |
| `/javis-sync sprints` | `sync_sprints.py` | Sprints + Issue mapping |
| `/javis-sync members` | `sync_member_stats.py` | Member statistics |
| `/javis-sync confluence` | `sync_confluence_bidirectional.py` | Confluence Pages |
| `/javis-sync bitbucket` | `sync_bitbucket.py` | Commits, PRs |

## Quick Run

```bash
# Full sync
/javis-sync all

# Issues only (Jira → DB)
python3 scripts/sync_bidirectional.py --pull-only

# Sprint sync
python3 scripts/sync_sprints.py
python3 scripts/sync_sprints.py --project EUV
python3 scripts/sync_sprints.py --active-only
python3 scripts/sync_sprints.py --list

# Status check
python3 .claude/skills/javis-sync/scripts/sync.py status
```

## Resources

- Sync script details: [reference.md](reference.md)
- Usage examples & workflows: [examples.md](examples.md)
- Status check helper: [scripts/sync.py](scripts/sync.py)

## Key Scripts (from project root)

```bash
# Jira bidirectional sync
python3 scripts/sync_bidirectional.py              # Full
python3 scripts/sync_bidirectional.py --pull-only  # Jira → DB
python3 scripts/sync_bidirectional.py --push-only  # DB → Jira
python3 scripts/sync_bidirectional.py --dry-run    # Simulation

# Boards
python3 scripts/sync_boards.py

# Sprints (sprint metadata + issue mapping)
python3 scripts/sync_sprints.py                    # Full
python3 scripts/sync_sprints.py --project EUV      # Specific project
python3 scripts/sync_sprints.py --active-only      # Active only
python3 scripts/sync_sprints.py --list             # List DB sprints

# Member statistics
python3 scripts/sync_member_stats.py

# Bitbucket
python3 scripts/sync_bitbucket.py
```
