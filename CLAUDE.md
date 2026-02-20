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
/api/slack/commands       # Slack slash commands (/jarvis)
/api/slack/interactivity  # Slack button/interaction handlers
```

### Python Scripts (`scripts/`)
- `sync_bidirectional.py` - Jira <-> DB 양방향 증분 동기화
- `sync_confluence_bidirectional.py` - Confluence <-> DB 양방향 증분 동기화
- `javis_cli.py` - CLI entry point
- `lib/` - Shared utilities (db.py, config.py, context_aggregator.py, ai_client.py, slack_client.py, slack_notifications.py)
- `cli/` - CLI commands (suggest.py, context.py, tag.py, sync.py, slack.py)

**Note**: Full scan one-way sync scripts (mirror_*.py) have been removed to prevent accidental data overwrites. Always use bidirectional sync.

### Database Schema
Key tables: `roadmap_visions`, `roadmap_milestones`, `roadmap_streams`, `roadmap_risks`, `team_members`, `jira_issues`, `bitbucket_commits`, `work_tags`, `slack_notifications`, `slack_channel_config`

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
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_DEFAULT_CHANNEL` - Slack integration
- `NEXT_PUBLIC_READ_ONLY` - Read-only mode (see below)

## Read-Only Mode

서버 배포 시 데이터 수정을 방지하기 위한 read-only 모드를 지원합니다.

```bash
# .env 설정
NEXT_PUBLIC_READ_ONLY=true   # 서버 배포 시 (모든 수정 작업 차단)
NEXT_PUBLIC_READ_ONLY=false  # 로컬 개발 시 (기본값)
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

## Key Concepts

- **Roadmap Hierarchy**: Vision → Milestone → Stream → Epic
- **Risk Detection**: Auto-detects delay, blocker, velocity_drop, dependency_block, resource_conflict
- **Bidirectional Sync**:
  - 증분 동기화: `last_synced_at` 타임스탬프 이후 변경분만 동기화
  - 로컬 수정 추적: PostgreSQL 트리거가 `local_modified_at`, `local_modified_fields` 자동 기록
  - 충돌 감지: 같은 필드가 로컬/원격 모두 변경된 경우 `sync_conflicts` 테이블에 저장
  - API/직접 DB 수정 모두 자동 추적됨
- **Content Operations**: Approval workflow for bulk Jira/Confluence changes
- **Slack Integration**:
  - Outbound: Python CLI로 리스크/스프린트 알림 발송 (`javis slack risk`)
  - Inbound: `/jarvis` 슬래시 명령어 (status, search, risk)
  - API: `/api/slack/commands`, `/api/slack/interactivity`
