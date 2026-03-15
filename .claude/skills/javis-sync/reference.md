# Sync Reference - Sync Script Details

## Sync Scripts

### Jira Issues Bidirectional Sync

```bash
# Full bidirectional sync
python3 scripts/sync_bidirectional.py

# Jira → DB only
python3 scripts/sync_bidirectional.py --pull-only

# DB → Jira only
python3 scripts/sync_bidirectional.py --push-only

# Specific project only
python3 scripts/sync_bidirectional.py --pull-only --project EUV

# Dry run
python3 scripts/sync_bidirectional.py --push-only --dry-run

# Conflict resolution
python3 scripts/sync_bidirectional.py --show-conflicts
python3 scripts/sync_bidirectional.py --force-local
python3 scripts/sync_bidirectional.py --force-remote
```

### Boards Sync

```bash
# All boards
python3 scripts/sync_boards.py

# Specific project only
python3 scripts/sync_boards.py --project EUV
```

### Sprints Sync (Sprint Metadata + Issue Mapping)

```bash
# All sprints
python3 scripts/sync_sprints.py

# Specific project only
python3 scripts/sync_sprints.py --project EUV

# Active sprints only
python3 scripts/sync_sprints.py --active-only

# Full re-sync
python3 scripts/sync_sprints.py --force

# List DB sprints
python3 scripts/sync_sprints.py --list
```

### Member Statistics Sync

```bash
# Incremental update
python3 scripts/sync_member_stats.py

# Full initialization
python3 scripts/sync_member_stats.py --init

# Recalculate statistics
python3 scripts/sync_member_stats.py --recalculate

# Specific sprint statistics
python3 scripts/sync_member_stats.py --sprint <sprint_id>
```

### Confluence Bidirectional Sync

```bash
# Full bidirectional
python3 scripts/sync_confluence_bidirectional.py

# Pull only
python3 scripts/sync_confluence_bidirectional.py --pull-only

# Push only
python3 scripts/sync_confluence_bidirectional.py --push-only
```

### Bitbucket Sync

```bash
# Full sync (Repos + Commits + PRs)
python3 scripts/sync_bitbucket.py

# Repositories only
python3 scripts/sync_bitbucket.py --repos-only

# Commits only (default 30 days)
python3 scripts/sync_bitbucket.py --commits-only

# Last 7 days commits only
python3 scripts/sync_bitbucket.py --commits-only --days 7

# PRs only (OPEN + MERGED)
python3 scripts/sync_bitbucket.py --prs-only

# Dry run
python3 scripts/sync_bitbucket.py --dry-run
```

## DB Tables

| Table | Purpose | Sync Script |
|-------|---------|-------------|
| `jira_issues` | Jira issues | sync_bidirectional.py |
| `jira_boards` | Board list | sync_boards.py |
| `jira_sprints` | Sprints | sync_sprints.py |
| `jira_issue_sprints` | Issue-Sprint mapping | sync_sprints.py |
| `team_members` | Team member info | sync_member_stats.py |
| `member_stats` | Member statistics | sync_member_stats.py |
| `confluence_v2_content` | Confluence pages | sync_confluence_bidirectional.py |
| `bitbucket_repositories` | Bitbucket repositories | sync_bitbucket.py |
| `bitbucket_commits` | Bitbucket commits | sync_bitbucket.py |
| `bitbucket_pullrequests` | Bitbucket PRs | sync_bitbucket.py |
| `sync_conflicts` | Conflict records | sync_bidirectional.py |

## Sync Status Check Query

```sql
-- Issues sync status
SELECT 'Issues' as type, project,
       COUNT(*) as total,
       MAX(last_synced_at)::date as last_sync
FROM jira_issues GROUP BY project

UNION ALL

-- Boards sync status
SELECT 'Boards' as type, project_key,
       COUNT(*),
       MAX(synced_at)::date
FROM jira_boards GROUP BY project_key

UNION ALL

-- Members sync status
SELECT 'Members' as type, '-',
       COUNT(*),
       MAX(updated_at)::date
FROM team_members WHERE is_active = true

UNION ALL

-- Bitbucket Repos sync status
SELECT 'BB Repos' as type, workspace,
       COUNT(*),
       MAX(last_synced_at)::date
FROM bitbucket_repositories GROUP BY workspace

UNION ALL

-- Bitbucket Commits sync status (last 30 days)
SELECT 'BB Commits' as type, '-',
       COUNT(*),
       MAX(synced_at)::date
FROM bitbucket_commits WHERE committed_at > NOW() - INTERVAL '30 days'

UNION ALL

-- Bitbucket PRs sync status
SELECT 'BB PRs' as type, state,
       COUNT(*),
       MAX(synced_at)::date
FROM bitbucket_pullrequests GROUP BY state

ORDER BY type;
```

## Bidirectional Sync Concepts

### Incremental Sync
- Only syncs changes since the `last_synced_at` timestamp

### Local Modification Tracking
- PostgreSQL triggers automatically record `local_modified_at` and `local_modified_fields`

### Conflict Detection
- When the same field is modified both locally and remotely, records are saved to the `sync_conflicts` table

### Conflict Resolution
```bash
python3 scripts/sync_bidirectional.py --show-conflicts   # List conflicts
python3 scripts/sync_bidirectional.py --force-local      # Local wins
python3 scripts/sync_bidirectional.py --force-remote     # Remote wins
```
