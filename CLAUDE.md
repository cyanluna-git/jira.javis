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
```

### Data Sync (Bidirectional - run from project root)
```bash
# Jira <-> DB 양방향 증분 동기화
python3 scripts/sync_bidirectional.py              # 전체 양방향 싱크
python3 scripts/sync_bidirectional.py --pull-only  # Jira → DB만
python3 scripts/sync_bidirectional.py --push-only  # DB → Jira만
python3 scripts/sync_bidirectional.py --dry-run    # 시뮬레이션

# Confluence <-> DB 양방향 증분 동기화
python3 scripts/sync_confluence_bidirectional.py              # 전체 양방향 싱크
python3 scripts/sync_confluence_bidirectional.py --pull-only  # Confluence → DB만
python3 scripts/sync_confluence_bidirectional.py --push-only  # DB → Confluence만

# 충돌 해결
python3 scripts/sync_bidirectional.py --show-conflicts   # 충돌 목록
python3 scripts/sync_bidirectional.py --force-local      # 로컬 우선
python3 scripts/sync_bidirectional.py --force-remote     # 원격 우선
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
- `sync_bidirectional.py` - Jira <-> DB 양방향 증분 동기화
- `sync_confluence_bidirectional.py` - Confluence <-> DB 양방향 증분 동기화
- `javis_cli.py` - CLI entry point
- `lib/` - Shared utilities (db.py, config.py, context_aggregator.py, ai_client.py)
- `cli/` - CLI commands (suggest.py, context.py, tag.py, sync.py)

**Note**: Full scan one-way sync scripts (mirror_*.py) have been removed to prevent accidental data overwrites. Always use bidirectional sync.

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
```

## Key Concepts

- **Roadmap Hierarchy**: Vision → Milestone → Stream → Epic
- **Risk Detection**: Auto-detects delay, blocker, velocity_drop, dependency_block, resource_conflict
- **Bidirectional Sync**:
  - 증분 동기화: `last_synced_at` 타임스탬프 이후 변경분만 동기화
  - 로컬 수정 추적: PostgreSQL 트리거가 `local_modified_at`, `local_modified_fields` 자동 기록
  - 충돌 감지: 같은 필드가 로컬/원격 모두 변경된 경우 `sync_conflicts` 테이블에 저장
  - API/직접 DB 수정 모두 자동 추적됨
- **Content Operations**: Approval workflow for bulk Jira/Confluence changes
