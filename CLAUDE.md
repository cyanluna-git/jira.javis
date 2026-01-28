# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Javis is a project management and visualization system bridging Jira, Confluence, and internal workflow management. It consists of a Next.js frontend with PostgreSQL backend, plus Python automation scripts for data synchronization.

## Commands

### Frontend (run from `src/javis-viewer/`)
```bash
npm run dev      # Development server on port 3009
npm run build    # Production build
npm run lint     # ESLint checks
```

### Python CLI (run from project root)
```bash
python3 scripts/javis_cli.py suggest           # AI work recommendations
python3 scripts/javis_cli.py context           # View work context
python3 scripts/javis_cli.py tag list          # Manage tags
python3 scripts/javis_cli.py sync all          # Sync all data sources
```

### Database
```bash
# Run migrations (port 5439)
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -f scripts/<migration>.sql
```

## Architecture

### Frontend Structure (`src/javis-viewer/src/`)
- `app/` - Next.js App Router with API routes
- `app/api/` - RESTful endpoints (roadmap, members, operations, issues, search)
- `components/` - React components (RiskPanel, MilestoneCard, Charts, etc.)
- `types/` - TypeScript definitions (roadmap.ts, sprint.ts, member.ts)
- `lib/db.ts` - PostgreSQL connection pool

### API Endpoints Pattern
```
/api/roadmap/visions      # Vision CRUD
/api/roadmap/milestones   # Milestone CRUD
/api/roadmap/epics        # Jira epic sync
/api/roadmap/risks        # Risk detection
/api/members              # Team stats
/api/search               # Full-text search
```

### Python Scripts (`scripts/`)
- `mirror_jira.py` - Jira → PostgreSQL sync
- `sync_bidirectional.py` - Two-way Jira sync
- `javis_cli.py` - CLI entry point
- `lib/` - Shared utilities (db.py, config.py, context_aggregator.py, ai_client.py)
- `cli/` - CLI commands (suggest.py, context.py, tag.py, sync.py)

### Database Schema
Key tables: `roadmap_visions`, `roadmap_milestones`, `roadmap_streams`, `roadmap_risks`, `team_members`, `jira_issues`, `bitbucket_commits`, `work_tags`

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS 4
- **Database**: PostgreSQL at localhost:5439 (javis_brain)
- **Python**: psycopg2, requests for Jira/Confluence API
- **Charts**: Recharts

## Configuration

Environment variables in `.env`:
- `DATABASE_URL` / `POSTGRES_*` - DB connection
- `JIRA_URL`, `JIRA_EMAIL`, `JIRA_TOKEN` - Jira API
- `BITBUCKET_*` - Bitbucket integration
- `AI_PROVIDER`, `ANTHROPIC_API_KEY` - AI features

## Key Concepts

- **Roadmap Hierarchy**: Vision → Milestone → Stream → Epic
- **Risk Detection**: Auto-detects delay, blocker, velocity_drop, dependency_block, resource_conflict
- **Bidirectional Sync**: Local modifications tracked via `local_modified_at` field, synced back to Jira
- **Content Operations**: Approval workflow for bulk Jira/Confluence changes
