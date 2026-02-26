---
name: javis-story
description: Local DB-based Story management. Vision/Epic context lookup, Story listing, AI generation/refinement, Jira sync. Usage: /javis-story context, /javis-story list <epic>, /javis-story create <epic>, /javis-story add <description>, /javis-story push <epic>
argument-hint: "[context|list|create|add|refine|push] [vision_title|epic_key|description]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-story - Story Management

Manages Stories in the local PostgreSQL DB and synchronizes them with Jira.

## Commands

| Command | Description |
|---------|-------------|
| `/javis-story context [vision]` | View project context for a Vision |
| `/javis-story list <epic_key>` | List Stories under an Epic |
| `/javis-story create <epic_key>` | AI generates multiple Stories based on Epic |
| `/javis-story add <description>` | **Natural language → single Story (auto-assigns Epic/labels)** |
| `/javis-story refine <epic_key>` | Refine existing Story AC/Points |
| `/javis-story push <epic_key>` | Create Stories in Jira |

## Quick Run

```bash
# View Vision context
python3 .claude/skills/javis-story/scripts/stories.py context OQC

# List Epic Stories
python3 .claude/skills/javis-story/scripts/stories.py list EUV-3299

# Epic development activity (commits/PRs)
python3 .claude/skills/javis-story/scripts/stories.py dev EUV-3299
```

## Resources

- Detailed queries & API docs: [reference.md](reference.md)
- Usage examples & workflows: [examples.md](examples.md)
- Helper script: [scripts/stories.py](scripts/stories.py)

## Data Sources

| Info | Table |
|------|-------|
| Vision goals | `roadmap_visions` |
| Milestone status | `roadmap_milestones` |
| Epic/Story | `jira_issues` |
| Team composition | `roadmap_vision_members` + `team_members` |
| Commit history | `bitbucket_commits` |
| PR status | `bitbucket_pullrequests` |

## Vision Defaults Auto-Applied

When creating Stories/Epics in Jira, **Vision's `default_component` and `default_labels` are automatically applied**.

| Project | Component | Labels |
|---------|-----------|--------|
| EUV | OQCDigitalization | oqc-digitalization |
| ASP | Unify Plasma | unify-plasma-single |

Check Vision defaults:
```bash
python3 .claude/skills/javis-story/scripts/stories.py push {epic_key} --dry-run
```

Modify Vision defaults:
```sql
UPDATE roadmap_visions
SET default_component = 'ComponentName', default_labels = ARRAY['label1', 'label2']
WHERE project_key = 'EUV';
```

---

## `/javis-story add` Details

Describe a Story in natural language and AI will **analyze project context** to generate a concrete user story.

### Input Format

```
/javis-story add I want to add a user story to {project}.
Currently we have {current state}.
We need to add {feature to add}.
Then we can {expected outcome}.
```

---

## Cross-Project Config (javis.json)

When invoked from a non-jarvis project (via global symlink), read `.claude/javis.json` for defaults:

```bash
cat .claude/javis.json 2>/dev/null
```

If found, use these defaults automatically:
- **`vision`** → default project name for `context` command (no need for user to specify)
- **`default_component`** → auto-apply when creating/pushing Stories to Jira
- **`default_labels`** → auto-apply when creating/pushing Stories to Jira
- **`jira_project`** → default Jira project key

If `.claude/javis.json` is not found, fall back to requiring explicit arguments (existing behavior).

---

## AI Required Execution Steps (MUST FOLLOW)

When receiving the `add` command, **you must** collect context in the following order before generating a Story.

### Step 0: Load Project Config (if available)

```bash
cat .claude/javis.json 2>/dev/null
```

If found, use `vision` as the default project name for Step 1. Use `default_component` and `default_labels` when pushing to Jira.

### Step 1: Fetch Project Context

```bash
python3 .claude/skills/javis-story/scripts/stories.py context {project_name}
```

If `project_name` is not provided by the user, use the `vision` value from `javis.json`.

**Collected info:**
- Vision goals and North Star
- Milestone status and progress
- Team composition and roles

### Step 2: Find Related Epic & Check Existing Stories

Extract keywords from user input to find the related Epic.

```bash
# List Stories under the Epic
python3 .claude/skills/javis-story/scripts/stories.py list {epic_key}
```

**Collected info:**
- Epic goals and description
- Existing Story list (to prevent duplicates)
- Current progress status

### Step 3: Check Recent Development Activity

```bash
python3 .claude/skills/javis-story/scripts/stories.py dev {epic_key}
```

**Collected info:**
- Last 7 days commit log (files worked on, patterns)
- Open PR status
- Per-developer work areas

### Step 4: Context-Based Story Generation

Generate a **concrete and realistic** Story based on the collected information.

**Must reflect when generating:**
- Use **terminology/naming** from the existing codebase (from commit messages, Epic descriptions)
- Reference actual **file names/function names** (from commit logs)
- Follow existing **patterns/architecture**
- Specify **dependencies** with current in-progress work
- **Prevent duplicate Stories** (check existing Story list)

---

## Label Classification Criteria

| Label | Keyword Hints |
|-------|---------------|
| `frontend` | UI, screen, React, component, button, form, modal, page |
| `backend` | API, server, DB, endpoint, auth, data processing |
| `plc` | PLC, Modbus, protocol, equipment, Gateway, Simulator, communication |
| `infra` | CI/CD, deployment, Docker, config, environment variables |
| `test` | test, QA, validation, automation testing |
| `docs` | documentation, README, guide |

---

## Output Format (Context-Aware)

```markdown
## Story: [Concrete Summary]

**Epic**: {epic_key} ({epic_summary})
**Labels**: `{label1}`, `{label2}`
**Project**: {project_name}
**Dependencies**: {related Story or "None"}

### Description
As a {role}, I want {feature}
so that {expected benefit}.

### Context (Current State)
- Currently {epic_key} has {in-progress work} in progress
- Recent commit: `{recent_commit_message}` by {author}
- Related files: `{file_path}`

### Acceptance Criteria
- [ ] {Concrete condition using existing patterns/class names 1}
- [ ] {Condition referencing actual files/functions 2}
- [ ] {Condition referencing existing config files 3}
- [ ] {Test condition}

### Technical Notes
- Follow existing `{class/pattern name}` pattern (see `{file_path}`)
- Recommended to start after {epic_key}'s existing Story `{related_story_key}` is complete
- Config values managed in `{config_file}`

### Story Points: {points}
```

---

## Example: Context-Based Story Generation

### User Input
```
/javis-story add I want to add a user story to OQC.
Currently we have the Simulation Engine basic structure.
We need to add error handling.
Then we can have automatic retry on simulator failures.
```

### AI Execution Flow

1. `context OQC` → Confirm Vision goals, North Star
2. Keyword "Simulation Engine" → Find EUV-3299 Epic
3. `list EUV-3299` → Check existing 6 Stories (confirm no error handling Story)
4. `dev EUV-3299` → Check recent commits:
   - `feat: add ISimulator interface` (Gerald, 01-15)
   - `feat: implement EUV simulator config` (Tushar, 01-14)

### Generated Story

```markdown
## Story: Implement Error Handling with Auto-Retry for Simulators

**Epic**: EUV-3299 (Simulation Engine)
**Labels**: `backend`, `plc`
**Project**: OQC
**Dependencies**: EUV-3301 (ISimulator interface) must be complete

### Description
As a developer, I want automatic retry mechanism on simulator connection failures
so that transient network errors don't interrupt the BDD test execution.

### Context (Current State)
- Currently EUV-3299 has ISimulator interface definition complete
- Recent commit: `feat: add ISimulator interface` by Gerald (01-15)
- Related files: `src/simulator/interface.py`, `src/simulator/euv_simulator.py`

### Acceptance Criteria
- [ ] `ISimulator.connect()` retries up to 3 times on failure (apply Gateway's `RetryPolicy` pattern)
- [ ] Retry interval: exponential backoff 1s → 2s → 4s (`config/simulator.yaml` `retry.backoff` setting)
- [ ] Failure logs written to `edge_gateway/logs/simulator.log` (use existing `LogManager`)
- [ ] On permanent failure, raise `SimulatorConnectionError` and fail the BDD step
- [ ] Retry count/results queryable via `/api/simulator/status` endpoint

### Technical Notes
- Reuse Gateway's existing `RetryPolicy` class (`src/common/retry.py`)
- Recommended to start after EUV-3301 (ISimulator interface) is complete
- Config values managed in `config/simulator.yaml`
- Unit test: add `tests/simulator/test_retry.py`

### Story Points: 3
```

---

## Save Location

Generated Stories are appended to `docs/stories/{epic_key}-stories.md`.
