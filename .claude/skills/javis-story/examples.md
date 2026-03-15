# Stories Examples - Usage Examples & Workflows

## Workflow Examples

### 1. Quick Story Addition via Natural Language (add)

```bash
/javis-story add I want to add a user story to OQC.
Currently we have the Simulation Engine basic structure.
We need to add error handling.
Then we can have automatic retry on simulator failures.
```

**AI automatically:**
1. OQC → Vision match
2. "Simulation Engine" → EUV-3299 Epic search
3. "error handling", "retry" → `backend`, `plc` labels assigned
4. Generates structured user story

### 2. Epic-Based Multi-Story Generation (create)

```bash
# 1. Understand project context
/javis-story context OQC

# 2. Check existing Stories
/javis-story list EUV-3299

# 3. AI generates Story drafts (analyzes Epic and generates for missing areas)
/javis-story create EUV-3299

# 4. Refine AC/Points
/javis-story refine EUV-3299

# 5. Preview what will be created
/javis-story push EUV-3299 --dry-run

# 6. Create in Jira
/javis-story push EUV-3299
```

### 3. Script Usage

```bash
# Vision context lookup
python3 .claude/skills/javis-story/scripts/stories.py context OQC

# Epic Story list
python3 .claude/skills/javis-story/scripts/stories.py list EUV-3299

# Epic development activity
python3 .claude/skills/javis-story/scripts/stories.py dev EUV-3299

# Story creation (dry-run)
python3 .claude/skills/javis-story/scripts/stories.py push EUV-3299 --dry-run
```

### 4. Sync Local DB After Push

```bash
python3 scripts/sync_bidirectional.py --pull-only --project EUV
```

## Output Examples

### `/javis-story context OQC`

```
=== Vision: OQC Digitalization ===
Description: OQC inspection process digitalization
Status: in_progress
North Star: OQC processing time (target: 50% reduction)

=== Milestones ===
Q1 2024: Phase 1 - Basic Infrastructure (progress: 75%)
Q2 2024: Phase 2 - Automation (progress: 30%)

=== Team ===
Gerald Park - Tech Lead (1.0 MM)
Tushar - Backend Developer (0.8 MM)

=== Recent Dev Activity (7 days) ===
2024-01-15 | Gerald | feat: add simulator interface | EUV-3301
2024-01-14 | Tushar | fix: data validation | EUV-3299
```

### `/javis-story list EUV-3299`

```
=== Epic: EUV-3299 ===
Summary: Implement Simulator Integration
Status: In Progress

=== Stories (5) ===
Key        | Summary                    | Status      | Assignee | Points
-----------|----------------------------|-------------|----------|-------
EUV-3301   | Define ISimulator interface| In Progress | Gerald   | 3
EUV-3302   | Implement mock simulator   | To Do       | -        | 5
EUV-3303   | Add unit tests             | To Do       | Tushar   | 2
EUV-3304   | Integration testing        | To Do       | -        | 3
EUV-3305   | Documentation              | Done        | Gerald   | 1

Progress: 1/5 (20%) | Points: 14 total, 1 done

=== Recent Commits (7 days) ===
2024-01-15 | Gerald | feat: add simulator interface | oqc-backend
2024-01-14 | Tushar | fix: data validation | oqc-backend

=== Open PRs ===
#42 | feat/simulator-interface | Gerald | OPEN
```

### `/javis-story add` Example (Context-Based)

**Input:**
```
/javis-story add I want to add a user story to OQC.
Currently we have the Gateway REST API.
We need real-time PLC connection status monitoring UI.
Then operators can see equipment status at a glance.
```

**AI Execution Flow:**

```bash
# Step 1: Fetch project context
$ python3 .claude/skills/javis-story/scripts/stories.py context OQC

=== Vision: OQC Digitalization ===
North Star: Zero Manual QC, 100% Data Trust
Status: active

=== Milestones ===
2026-02: The Walking Skeleton (in_progress) - progress: 25%

=== Team ===
Gerald Park - Tech Lead (1.0 MM)
Owen Rim - Edge/Frontend Engineer (0.5 MM)
```

```bash
# Step 2: Find related Epic (keyword: Gateway)
$ python3 .claude/skills/javis-story/scripts/stories.py list EUV-3300

=== Epic: EUV-3300 ===
Summary: Gateway REST API Integration
Status: In Progress

=== Stories (3) ===
EUV-3310 | Implement /api/devices endpoint | Done | Gerald | 3
EUV-3311 | Add /api/status endpoint       | Done | Gerald | 2
EUV-3312 | WebSocket event streaming      | To Do | -     | 5
```

```bash
# Step 3: Recent development activity
$ python3 .claude/skills/javis-story/scripts/stories.py dev EUV-3300

=== Recent Commits (7 days) ===
2026-01-28 | Gerald | feat: add /api/status endpoint | edge-gateway
2026-01-27 | Gerald | feat: implement device listing | edge-gateway
2026-01-26 | Owen   | fix: CORS configuration       | edge-gateway

=== Open PRs ===
#45 | feat/websocket-events | Owen | OPEN
```

**Generated Story (Context-Aware):**

```markdown
## Story: Add Real-time PLC Connection Status Dashboard

**Epic**: EUV-3300 (Gateway REST API Integration)
**Labels**: `frontend`, `plc`
**Project**: OQC
**Dependencies**: EUV-3312 (WebSocket event streaming) — real-time updates available after completion

### Description
As an operator, I want to see real-time PLC connection status on a dashboard
so that I can monitor equipment health at a glance.

### Context (Current State)
- Currently EUV-3300 has Gateway REST API implementation in progress
- `/api/status` endpoint complete (EUV-3311)
- WebSocket streaming PR in progress (#45 by Owen)
- Related files: `edge-gateway/src/api/status.py`

### Acceptance Criteria
- [ ] Display PLC list based on `/api/devices` response (IP, port, protocol)
- [ ] Display connection status based on `/api/status` response (Connected/Disconnected/Error)
- [ ] Real-time updates via WebSocket after EUV-3312 completion (fallback: 5s polling)
- [ ] Toast notification on connection failure (use existing `NotificationProvider`)
- [ ] Last 5 min communication success rate graph (Recharts - existing Dashboard pattern)

### Technical Notes
- Use existing `/api/status` endpoint (`edge-gateway/src/api/status.py`)
- Follow React Query `useQuery` pattern (see `src/hooks/useDevices.ts`)
- Recharts graph components follow `src/components/charts/` pattern
- Apply real-time updates after Owen's WebSocket PR (#45) is merged

### Story Points: 3

---
Save location: docs/stories/EUV-3300-stories.md
```

**Comparison:**

| Item | Without Context | Context-Based |
|------|----------------|---------------|
| Epic | Guessed | Precise EUV-3300 |
| AC | Generic | References actual endpoints like `/api/status` |
| Dependencies | None | EUV-3312 specified |
| Technical Notes | Generic patterns | Actual file paths, PR numbers referenced |

---

### `/javis-story create EUV-3299`

```
=== AI Story Generation: EUV-3299 ===

Epic analysis complete:
- Summary: Implement Simulator Integration
- Existing Stories: 5
- Missing areas detected: Error handling, Configuration

=== Generated Story Drafts ===

## Story 1: Implement Error Handling for Simulator

### Description
As a developer, I want proper error handling in simulator integration
so that failures are gracefully managed and logged.

### Acceptance Criteria
- [ ] Define SimulatorException class
- [ ] Implement retry logic (max 3 attempts)
- [ ] Error logging and alert integration
- [ ] Timeout handling (30 seconds)

### Technical Notes
- Follow existing ErrorHandler pattern
- Consider Sentry integration

### Story Points: 3

---

## Story 2: Add Simulator Configuration Management

### Description
As an operator, I want to configure simulator parameters
so that I can adjust behavior without code changes.

### Acceptance Criteria
- [ ] Define config file schema (YAML)
- [ ] Runtime config change support
- [ ] Config validation logic
- [ ] Provide default values

### Story Points: 2
```

## AI Story Generation Criteria

### Review Criteria

- Are ACs verifiable?
- Are Story Points appropriate for team velocity? (completable within 1-3 sprints)
- Are dependencies clear?
- Is domain terminology consistent?

### Story Points Guide

| Points | Complexity | Example |
|--------|-----------|---------|
| 1 | Simple fix | Documentation update, config change |
| 2 | Small feature | Single API endpoint, utility function |
| 3 | Medium feature | New component, integration work |
| 5 | Large feature | Complex business logic |
| 8 | Complex feature | Recommend splitting |
