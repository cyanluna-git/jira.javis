# Sync Examples - Usage Examples & Workflows

## Workflow Examples

### 1. Morning Full Sync

```bash
/javis-sync all
```

Or run individually:

```bash
python3 scripts/sync_bidirectional.py --pull-only
python3 scripts/sync_boards.py
python3 scripts/sync_sprints.py
python3 scripts/sync_member_stats.py
```

### 2. Sprint Kickoff

```bash
/javis-sync boards
/javis-sync sprints
/javis-sync members --init
```

### 3. Push After Local Work

```bash
/javis-sync issues push --dry-run
/javis-sync issues push
```

### 4. Weekly Full Sync

```bash
python3 scripts/sync_bidirectional.py
python3 scripts/sync_boards.py
python3 scripts/sync_sprints.py
python3 scripts/sync_member_stats.py --recalculate
python3 scripts/sync_confluence_bidirectional.py
python3 scripts/sync_bitbucket.py
```

### 5. Status Check

```bash
/javis-sync status
python3 .claude/skills/javis-sync/scripts/sync.py status
```

## Output Examples

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

## Script Usage

```bash
# Status check
python3 .claude/skills/javis-sync/scripts/sync.py status

# Full sync (from project root)
python3 scripts/sync_bidirectional.py --pull-only
python3 scripts/sync_boards.py
python3 scripts/sync_member_stats.py
python3 scripts/sync_bitbucket.py
```

## Target Projects

Default: `EUV`, `ASP`, `PSSM`

Project settings are managed in each script or the `.env` file.
