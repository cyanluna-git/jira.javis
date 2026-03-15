---
name: javis-sprint
description: Sprint management. View current/past sprints, velocity tracking, sprint planning, per-member workload. Usage: /javis-sprint, /javis-sprint list, /javis-sprint velocity, /javis-sprint plan
argument-hint: "[current|list|velocity|plan|burndown|member] [sprint_name|member_name]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-sprint - Sprint Management

View sprint status, track velocity, and plan sprints.

## Commands

| Command | Description |
|---------|-------------|
| `/javis-sprint` | Current active sprint status |
| `/javis-sprint list` | Recent sprint list |
| `/javis-sprint <name>` | Specific sprint details |
| `/javis-sprint velocity` | Velocity trend analysis |
| `/javis-sprint plan [epic]` | Next sprint planning |
| `/javis-sprint burndown` | Burndown chart data |
| `/javis-sprint member <name>` | Per-member status |

## Quick Run

```bash
# Current sprint
python3 .claude/skills/javis-sprint/scripts/sprint.py current

# Velocity trend
python3 .claude/skills/javis-sprint/scripts/sprint.py velocity

# Per-assignee status
python3 .claude/skills/javis-sprint/scripts/sprint.py assignees
```

## Resources

- Detailed queries & analysis: [reference.md](reference.md)
- Usage examples & workflows: [examples.md](examples.md)
- Helper script: [scripts/sprint.py](scripts/sprint.py)

## Data Sources

| Info | Table |
|------|-------|
| Sprints | `jira_sprints` |
| Boards | `jira_boards` |
| Issue-Sprint mapping | `jira_issue_sprints` |
| Issue details | `jira_issues` |
| Member stats | `member_stats` |
