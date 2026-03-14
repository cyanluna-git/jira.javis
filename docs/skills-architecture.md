# Javis Skills Architecture

Javis project skills follow a 2-tier architecture within the `cyanluna.dev` workspace. This document explains the tier structure, API dependencies, and symlink chain.

## 2-Tier Architecture

### Tier 1 — Public Skills (cyanluna.skills, cyanluna.tools, community.skills)

Public skills are standalone and require no external API credentials beyond what Claude Code provides. They are distributed across 3 repos:

| Repo | Skills | Purpose |
|------|--------|---------|
| cyanluna.skills | kanban, kanban-batch-run, kanban-board, kanban-explore, kanban-init, kanban-refine, kanban-run, review-pr, review-backend, review-frontend, review-plc | Kanban pipeline + code review |
| cyanluna.tools | card-news-generator, code-changelog, code-prompt-coach, reports/*, tmux/* | Utility skills |
| community.skills | codex, flutter-init, nextjs15-init, vercel-react-best-practices, web-to-markdown | Curated external |

### Tier 2 — Private/Embedded Skills (jira.javis)

Private skills live inside `jira.javis/.claude/skills/` and require Jira, Confluence, Slack, or PostgreSQL credentials. They are tightly coupled to the Javis data model.

| Skill | Scope | Description |
|-------|-------|-------------|
| javis-init | Global | Initialize per-project Javis config (.claude/javis.json) |
| javis-story | Global | Story lifecycle (context, list, create, refine, push to Jira) |
| javis-dev | Local | Developer dashboard (assigned issues, commits, PRs, team comparison) |
| javis-report | Local | Project reports (sprint, team, epic, weekly, velocity, vision) |
| javis-risk | Local | Risk detection and management (auto-detect, analyze, resolve) |
| javis-sprint | Local | Sprint management (current, velocity, burndown, plan, member) |
| javis-sync | Local | Data sync orchestration (Jira, Confluence, Bitbucket, Boards, Members) |
| javis-sync-deploy | Local | Sync local DB + deploy to remote server |

**Global** skills are symlinked to `~/.skills/` and usable from any project after running `/javis-init`.
**Local** skills are only available when working inside the `jira.javis/` directory.

## API Dependency Matrix

Each Tier 2 skill depends on a subset of external APIs. The matrix below shows which APIs each skill requires at runtime.

| Skill | Jira | Confluence | Bitbucket | Slack | PostgreSQL | Remote Server |
|-------|:----:|:----------:|:---------:|:-----:|:----------:|:-------------:|
| javis-init | - | - | - | - | - | - |
| javis-story | **Y** | - | - | - | **Y** | - |
| javis-dev | **Y** | - | **Y** | - | **Y** | - |
| javis-report | **Y** | - | **Y** | - | **Y** | - |
| javis-risk | **Y** | - | - | **Y** | **Y** | - |
| javis-sprint | **Y** | - | - | - | **Y** | - |
| javis-sync | **Y** | **Y** | **Y** | - | **Y** | - |
| javis-sync-deploy | - | - | - | - | **Y** | **Y** |

Legend: **Y** = required at runtime, `-` = not used.

### Credential Sources

| API | Env Variable(s) | Location |
|-----|-----------------|----------|
| Jira | `JIRA_URL`, `JIRA_EMAIL`, `JIRA_TOKEN` | `jira.javis/.env` |
| Confluence | (same Jira credentials) | `jira.javis/.env` |
| Bitbucket | SSH key + `BITBUCKET_*` | `~/.ssh/` + `jira.javis/.env` |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | `jira.javis/.env` |
| PostgreSQL | `DATABASE_URL` | `jira.javis/.env` |
| Remote Server | SSH key | `~/.ssh/` |

When a global skill (javis-init, javis-story) is invoked from another project, it reads credentials via the `.claude/.javis-env` symlink that `/javis-init` creates pointing to `~/dev/jira.javis/.env`.

## Symlink Chain

```
Source repos (4)                ~/.skills/ hub              ~/.claude/skills/
===================             ==============              =================
                                                            (+ ~/.codex/skills/)
cyanluna.skills/
  kanban/           ──ln──>   ~/.skills/kanban/     ──ln──>  ~/.claude/skills/kanban/
  kanban-run/       ──ln──>   ~/.skills/kanban-run/ ──ln──>  ~/.claude/skills/kanban-run/
  review-pr/        ──ln──>   ~/.skills/review-pr/  ──ln──>  ~/.claude/skills/review-pr/
  ...

cyanluna.tools/
  reports/*         ──ln──>   ~/.skills/report-*/   ──ln──>  ~/.claude/skills/report-*/
  tmux/*            ──ln──>   ~/.skills/tmux-*/     ──ln──>  ~/.claude/skills/tmux-*/
  ...

community.skills/
  codex/            ──ln──>   ~/.skills/codex/      ──ln──>  ~/.claude/skills/codex/
  flutter-init/     ──ln──>   ~/.skills/flutter-init/ ──ln──> ~/.claude/skills/flutter-init/
  ...

jira.javis/.claude/skills/
  javis-init/       ──ln──>   ~/.skills/javis-init/  ──ln──> ~/.claude/skills/javis-init/
  javis-story/      ──ln──>   ~/.skills/javis-story/ ──ln──> ~/.claude/skills/javis-story/
  _shared/          ──ln──>   ~/.skills/_shared/     (infrastructure, not a skill)
```

`bootstrap.sh` creates all these symlinks in a single pass. The hub (`~/.skills/`) acts as a deduplication layer -- if two repos provide a skill with the same name, the last writer wins.

## Setup Procedure for New Projects

To use Javis global skills (javis-init, javis-story) from a new project:

```bash
# 1. Ensure bootstrap has run (creates symlinks)
cd ~/dev && ./bootstrap.sh

# 2. Navigate to target project
cd ~/dev/my-other-project

# 3. Run /javis-init (creates .claude/javis.json and .claude/.javis-env)
/javis-init

# 4. Verify
cat .claude/javis.json      # Project config (Jira key, component, labels)
ls -la .claude/.javis-env   # Symlink to ~/dev/jira.javis/.env
```

After setup, `/javis-story context` and `/javis-story create` will use the project config from `javis.json` and credentials from the shared `.env`.

## Related Documentation

- `~/dev/README.md` — Workspace project manifest (Skills section)
- `~/dev/SETUP.md` — Machine setup guide
- `~/dev/jira.javis/CLAUDE.md` — Javis project guardrails (Skills & Workflows section)
- `~/dev/jira.javis/docs/guides/skills-usage.md` — Detailed skill command reference
