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

### Read-Only 모드 동작
- **API**: 모든 POST/PUT/PATCH/DELETE 요청이 403 응답 반환 (Slack API 제외)
- **UI**: 생성/편집/삭제 버튼이 숨겨짐
- **영향 범위**: Vision, Milestone, Stream, Epic 링크, Sprint 라벨, Issue 수정, Member 정보, Operation, Confluence Suggestion

### 구현 파일
- `src/javis-viewer/src/contexts/ReadOnlyContext.tsx` - React Context + Hook
- `src/javis-viewer/src/lib/readonly.ts` - API용 체크 함수

## Model Selection for This Project

### When to Use Each Model

#### 🟢 Haiku (Fast, Cost-efficient)
Use for quick lookups and simple queries:
- Code search: "What files use the Modbus pattern?"
- Quick questions: "How does the risk detection work?"
- Configuration: "What's the current database setup?"
- Simple reads: "List all Vision statuses"

#### 🟡 Sonnet (Balanced, Recommended Default)
Use for most development tasks:
- Feature implementation: "Add new API endpoint for..."
- Code review: "Review this PR against best practices"
- Medium refactoring: "Refactor the sync logic"
- Performance optimization: "Analyze slow milestone queries"
- Story/Task creation: `/javis-stories create [epic]`
- Data analysis: "Show velocity trend for Sprint X"

#### 🔵 Opus (Deep, Comprehensive)
Use for complex architecture and planning:
- System design: "Design the entire auth flow for..."
- Large refactoring: "Refactor the entire sync architecture"
- Complex analysis: "How to optimize data sync across Jira/Confluence/DB?"
- Planning: "Plan Phase 4 implementation roadmap"
- Multi-module coordination: "Design better separation between UI/API/DB"

### Model Router Integration

The global **model-router** skill provides automatic suggestions based on your input. However, you can override it if needed:

```
Default behavior (no action needed):
"Implement new risk detection endpoint" → Auto-selects Sonnet ✅

Override when needed:
[Opus] Design the entire risk system → Forces Opus

Use project skills for standard workflows:
/javis-stories context OQC    # Predefined workflows, optimal model
/review-pr <PR_URL>            # Code review skill
/javis-dev team                 # Developer dashboard
```

### Project-Specific Optimizations

#### Javis is a complex project with:
- **Bidirectional Sync** (Jira ↔ DB ↔ Confluence) → Higher complexity
- **Risk Detection Logic** → Requires deep understanding
- **Permission/Read-only System** → Requires careful handling
- **Python + Next.js Stack** → Multi-layer coordination

Therefore:
- ✅ Favor **Sonnet** for most tasks
- ✅ Use **Opus** for architecture decisions
- 🟢 Use **Haiku** only for simple lookups
- ⚠️ Avoid Haiku for sync, API, or business logic changes

---

## Javis Skills (Claude Code)

프로젝트 전용 slash commands. 자세한 사용법: `docs/skills-usage.md`

| Skill | 용도 | 예시 |
|-------|------|------|
| `/javis-stories` | Story 관리 (생성, 정제, Jira push) | `/javis-stories context OQC` |
| `/javis-sprint` | 스프린트 관리 (현황, velocity) | `/javis-sprint velocity` |
| `/javis-dev` | 개발자 대시보드 (작업, 커밋/PR) | `/javis-dev team` |
| `/javis-report` | 프로젝트 리포트 생성 | `/javis-report weekly` |
| `/javis-risk` | 리스크 감지/관리 | `/javis-risk detect` |
| `/javis-sync` | 데이터 동기화 | `/javis-sync all` |

### 주요 워크플로우

```bash
# 아침 동기화
/javis-sync all

# Story 작업
/javis-stories context OQC      # 맥락 파악
/javis-stories list EUV-3299    # Epic의 Story 확인
/javis-stories create EUV-3299  # AI Story 생성
/javis-stories push EUV-3299    # Jira에 생성

# 스프린트 관리
/javis-sprint                   # 현재 스프린트 현황
/javis-sprint velocity          # Velocity 추이

# 리스크 체크
/javis-risk detect              # 자동 리스크 감지
/javis-risk analyze EUV-3299    # Epic 리스크 분석

# Slack 연동 테스트
python3 scripts/javis_cli.py slack test     # 테스트 메시지 전송
python3 scripts/javis_cli.py slack risk     # 리스크 알림 전송
python3 scripts/javis_cli.py slack status   # 연동 상태 확인
```
=======
**Behavior:**
- API: 403 response on POST/PUT/PATCH/DELETE (Slack API excluded)
- UI: Edit/create/delete buttons hidden
>>>>>>> 628860fa8f123c1d7983897ca14381226fceeec4

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
