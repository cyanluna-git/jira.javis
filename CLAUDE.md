# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Javis is a project management system bridging Jira, Confluence, and internal workflow. It features a Next.js frontend dashboard (port 3009), PostgreSQL backend, and Python automation scripts for bidirectional data synchronization and AI-powered recommendations.

## Repository Structure

- `src/javis-viewer/` — Next.js 16 + React 19 frontend (TypeScript)
- `scripts/` — Python 3.10+ CLI tools, sync engines, and Slack integration
- `.claude/rules/` — Code style, testing, API conventions, security guidelines
- `.claude/skills/` — Custom Claude Code skills (stories, sync, risk, sprint, etc.)

**Important:** Always sync Jira/Confluence changes via bidirectional sync scripts (never full-scan mirrors).

## Quick Commands

### Frontend (from `src/javis-viewer/`)
```bash
npm run dev      # Vite dev server on port 3009
npm run build    # Production build
npm run lint     # ESLint check
npm run type-check
```

### Python CLI (from project root)
```bash
python3 scripts/javis_cli.py suggest           # AI recommendations
python3 scripts/javis_cli.py context           # View work context
python3 scripts/javis_cli.py sync all          # Bidirectional sync
```

### Data Sync (Bidirectional — from project root)
```bash
python3 scripts/sync_bidirectional.py              # Full Jira ↔ DB
python3 scripts/sync_bidirectional.py --pull-only  # Jira → DB only
python3 scripts/sync_bidirectional.py --dry-run    # Simulate
python3 scripts/sync_confluence_bidirectional.py   # Confluence ↔ DB
```

## Architecture

### Frontend (`src/javis-viewer/src/`)
- `app/` — Next.js App Router + API routes
- `api/` — RESTful endpoints (roadmap, search, slack, issues, members)
- `components/` — React components (dashboard, cards, charts)
- `types/` — TypeScript definitions
- `lib/db.ts` — PostgreSQL connection pool
- `contexts/` — React Context (read-only mode, etc.)

### Backend API Pattern
```
/api/roadmap/*           # Vision, Milestone, Stream, Epic CRUD
/api/members             # Team statistics
/api/search              # Full-text search
/api/slack/*             # Slack commands and interactivity
/api/issues              # Jira issue proxy
```

### Python (`scripts/`)
- `sync_bidirectional.py` — Jira ↔ DB bidirectional (incremental)
- `sync_confluence_bidirectional.py` — Confluence ↔ DB
- `javis_cli.py` — CLI entry point
- `lib/` — Shared utilities (db, config, ai_client, slack_client)
- `cli/` — Command modules (suggest, context, tag, sync, slack)

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS 4
- **Database:** PostgreSQL (port 5439, `javis_brain`)
- **Backend:** Python 3.10+, psycopg2, requests
- **Charts:** Recharts
- **AI:** Anthropic Claude API for recommendations
- **Integrations:** Jira REST API, Confluence API, Slack API

## Configuration

Environment variables in `.env`:
- `DATABASE_URL` / `POSTGRES_*` — DB connection
- `JIRA_URL`, `JIRA_EMAIL`, `JIRA_TOKEN` — Jira API auth
- `ANTHROPIC_API_KEY` — Claude AI API
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` — Slack bot
- `NEXT_PUBLIC_READ_ONLY` — Read-only mode (true for deployed servers)

## Read-Only Mode

Protects server deployments from accidental data modifications:

```bash
# .env
NEXT_PUBLIC_READ_ONLY=true   # Server: all modifications blocked
NEXT_PUBLIC_READ_ONLY=false  # Local: modifications allowed
```

**Behavior:**
- API: 403 response on POST/PUT/PATCH/DELETE (Slack API excluded)
- UI: Edit/create/delete buttons hidden
- Scope: Vision, Milestone, Stream, Epic links, Sprint labels, Issue edits, Member info, Operations, Confluence Suggestions

**Implementation files:**
- `src/javis-viewer/src/contexts/ReadOnlyContext.tsx` — React Context + Hook
- `src/javis-viewer/src/lib/readonly.ts` — API check utility

## Key Concepts

- **Roadmap Hierarchy:** Vision → Milestone → Stream → Epic
- **Bidirectional Sync:**
  - Incremental: Only changes since `last_synced_at`
  - Conflict detection: Local modifications vs. remote changes
  - Automatic tracking: Triggers record modifications in `local_modified_at`, `local_modified_fields`
- **Risk Detection:** Delay, blocker, velocity_drop, dependency_block, resource_conflict
- **Slack Integration:** Outbound alerts (risk, status) + inbound `/jarvis` commands

## Import Rules & Conventions

This project uses modular rules (Unify/OQC structure):

```
Backend/Frontend Code:
  @./.claude/rules/code-style.md
  @./.claude/rules/api-conventions.md

Testing & Quality:
  @./.claude/rules/testing.md

Git & Deployment:
  @./.claude/rules/commit-workflow.md
  @./.claude/rules/security.md

Submodules:
  src/.claude/CLAUDE.md        (Next.js-specific patterns)
  scripts/.claude/CLAUDE.md    (Python-specific patterns)
```

## Skills & Workflows

Project-specific Claude Code skills (`.claude/skills/`). See `docs/skills-usage.md` for details.

| Skill | Scope | Purpose | Example |
|-------|-------|---------|---------|
| `/javis-init` | **Global** | Initialize per-project Javis config | `/javis-init EUV` |
| `/javis-review-pr` | **Global** | Bitbucket PR code review (auto-detects backend/frontend/PLC) | `/javis-review-pr <PR_URL>` or `/javis-review-pr 42` |
| `/javis-story` | **Global** | Story lifecycle (context, list, create, add, refine, push to Jira) | `/javis-story context` |
| `/javis-sprint` | Local | Sprint management (current, velocity, burndown, plan, member) | `/javis-sprint velocity` |
| `/javis-sync` | Local | Data sync orchestration (Jira, Confluence, Bitbucket, Boards, Sprints, Members) | `/javis-sync all` |
| `/javis-sync-deploy` | Local | Sync local DB + deploy to remote server | `/javis-sync-deploy` |

### Global Skills (Available from Any Project)

Skills marked **Global** are symlinked to `~/.claude/skills/` and can be used from any repository after running `/javis-init`.

**Setup (one-time per project):**
```bash
cd ~/Dev/my-other-project
# Run /javis-init to create .claude/javis.json and .claude/.javis-env
/javis-init
```

**What `/javis-init` creates:**
- `.claude/javis.json` — Project config (Jira project key, component, labels, repos, vision)
- `.claude/.javis-env` — Symlink to `~/Dev/jarvis.gerald/.env` (shared credentials)

**Cross-project shortcuts:**
- `/javis-review-pr 42` — Review PR #42 using repo from `javis.json`
- `/javis-story context` — Auto-uses vision from `javis.json`
- `/javis-story add ...` — Auto-applies component/labels from `javis.json`

**javis.json schema:**
```json
{
  "jira_project": "EUV",
  "default_component": "OQCDigitalization",
  "default_labels": ["oqc-digitalization"],
  "bitbucket_repos": ["ac-avi/edwards.oqc.infra"],
  "vision": "OQC"
}
```

**Symlink registration** (managed in `~/.claude/skills/`):
```
~/.claude/skills/javis-init/       → jarvis.gerald/.claude/skills/javis-init/
~/.claude/skills/javis-review-pr/  → jarvis.gerald/.claude/skills/javis-review-pr/
~/.claude/skills/javis-story/      → jarvis.gerald/.claude/skills/javis-story/
~/.claude/skills/_shared/          → jarvis.gerald/.claude/skills/_shared/
```

### Common Workflows
```bash
# Morning sync
/javis-sync all

# Story workflow
/javis-story context OQC      # Understand context
/javis-story list EUV-3299    # List stories in Epic
/javis-story create EUV-3299  # AI-generate stories
/javis-story push EUV-3299    # Push to Jira

# Sprint management
/javis-sprint                   # Current sprint status
/javis-sprint velocity          # Velocity trend

# Code review
/javis-review-pr <PR_URL>                 # Full review + post comment
/javis-review-pr <PR_URL> --no-post       # Analysis only

# Deploy to server
/javis-sync-deploy

# Slack integration
python3 scripts/javis_cli.py slack test     # Send test message
python3 scripts/javis_cli.py slack risk     # Send risk alerts
python3 scripts/javis_cli.py slack status   # Check connection
```

## Model Routing Guidelines

When spawning subagents via the Task tool, select the appropriate `model` parameter based on task complexity to optimize cost.

### Tier 1 — Haiku (`model: "haiku"`)
Simple, local tasks requiring minimal reasoning:
- Git operations: commit message generation, status, log, diff
- Single file reads, lookups, or searches
- Typo fixes, formatting, variable renaming
- 1-3 line code edits
- Config value lookups, directory structure listing
- Simple Q&A, translations, rewording

### Tier 2 — Sonnet (`model: "sonnet"`)
Tasks requiring analysis, moderate code changes, or design thinking:
- Code analysis or review across 1-5 files
- Small to medium feature implementation
- Bug investigation and fix across 2-5 files
- Module-level design discussion and architecture suggestions
- API integration, writing/updating tests
- Refactoring 2-5 files, business logic code generation

### Tier 3 — Opus (default, omit `model` or `model: "opus"`)
Deep, broad tasks requiring expert-level reasoning:
- Architecture analysis spanning 6+ files or entire codebase
- Large-scale refactoring or restructuring
- Complex system design (multi-component, cross-cutting concerns)
- Performance profiling and optimization strategy
- Security analysis, complex algorithmic problem solving
- Multi-step planning with many unknowns

### Routing Principles
- **When in doubt, choose the lower-cost model** — escalate only if needed
- **Main context always keeps the current model** — only subagents are routed
- **For parallel work, assign appropriate models per independent task**

### Usage Examples
```
# Haiku — generate commit message
Task(subagent_type="Bash", model="haiku", prompt="Analyze changes and generate commit message")

# Sonnet — code analysis (3 files)
Task(subagent_type="Explore", model="sonnet", prompt="Analyze the authentication module")

# Opus — large-scale architecture design (default, model can be omitted)
Task(subagent_type="Plan", prompt="Plan microservices migration strategy")
```

### Scenario Quick Reference

| Scenario | Model |
|----------|-------|
| "What does this function do?" (single function) | Haiku |
| "Fix this typo" | Haiku |
| "Write a commit message" | Haiku |
| "Explain this file" | Haiku |
| "Add error handling to this function" | Sonnet |
| "Implement user authentication" | Sonnet |
| "Refactor this module to a new pattern" | Sonnet |
| "Review my PR (4 files)" | Sonnet |
| "Redesign the entire state management" | Opus |
| "Find performance bottlenecks across the codebase" | Opus |
| "Plan a microservices migration" | Opus |

## Deployment

- **Local Dev:** `npm run dev` (frontend) + `python3 scripts/...` (backend)
- **Production:** Docker/Kubernetes (via deploy/ configs)
- **Database Migrations:** psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/<migration>.sql

## Useful Docs

- **CLAUDE.md** — This file
- **README.md** — Project features and architecture
- **docs/skills-usage.md** — Detailed skill examples
- **docs/database-schema.md** — DB table definitions
