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

Project-specific Claude Code skills (`.claude/skills/`):

| Skill | Purpose |
|-------|----------|
| `/javis-stories` | Story management (CRUD, Jira push) |
| `/javis-sprint` | Sprint tracking (velocity, health) |
| `/javis-dev` | Developer dashboard |
| `/javis-report` | Project reports |
| `/javis-risk` | Risk detection |
| `/javis-sync` | Data sync automation |

## Deployment

- **Local Dev:** `npm run dev` (frontend) + `python3 scripts/...` (backend)
- **Production:** Docker/Kubernetes (via deploy/ configs)
- **Database Migrations:** psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/<migration>.sql

## Useful Docs

- **CLAUDE.md** — This file
- **README.md** — Project features and architecture
- **docs/skills-usage.md** — Detailed skill examples
- **docs/database-schema.md** — DB table definitions
