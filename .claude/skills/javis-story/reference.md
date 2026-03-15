# Stories Reference - Detailed Queries & API Documentation

## Database Schema

### Key Tables

```sql
-- Vision goals (includes component/label defaults)
roadmap_visions (
  id, title, description, status,
  north_star_metric, north_star_target, project_key,
  default_component,  -- Jira component default
  default_labels      -- TEXT[] label defaults
)

-- Milestone
roadmap_milestones (id, vision_id, title, quarter, progress_percent, status)

-- Epic-Milestone link
roadmap_epic_links (epic_key, milestone_id)

-- Jira issues (Epic, Story, Task, Bug)
jira_issues (key, summary, status, project, raw_data, created_at, updated_at)

-- Team composition
roadmap_vision_members (vision_id, member_account_id, role_title, role_category, mm_allocation)
team_members (account_id, display_name, email, role, team, skills)

-- Bitbucket
bitbucket_commits (hash, repo_uuid, author_name, message, jira_keys[], committed_at)
bitbucket_pullrequests (id, repo_uuid, pr_number, title, state, author_name, jira_keys[])
```

## SQL Query Collection

### Vision Context Lookup

```sql
SELECT v.title, v.description, v.status, v.north_star_metric, v.north_star_target,
       COUNT(m.id) as milestone_count,
       ROUND(AVG(m.progress_percent), 1) as avg_progress
FROM roadmap_visions v
LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
WHERE v.title ILIKE '%{vision_title}%' OR '{vision_title}' = ''
GROUP BY v.id
ORDER BY v.created_at DESC;
```

### Epic + Story List

```sql
-- Epic info
SELECT key, summary, status,
       raw_data->'fields'->>'description' as description
FROM jira_issues
WHERE key = '{epic_key}';

-- Stories under Epic
SELECT
    key,
    summary,
    status,
    raw_data->'fields'->'assignee'->>'displayName' as assignee,
    raw_data->'fields'->>'customfield_10016' as story_points,
    raw_data->'fields'->'issuetype'->>'name' as issue_type,
    updated_at
FROM jira_issues
WHERE raw_data->'fields'->'parent'->>'key' = '{epic_key}'
ORDER BY
    CASE status
        WHEN 'In Progress' THEN 1
        WHEN 'To Do' THEN 2
        WHEN 'Done' THEN 3
        ELSE 4
    END,
    key;
```

### Bitbucket Development Activity

```sql
-- Recent commits related to Epic (7 days)
WITH epic_stories AS (
    SELECT key FROM jira_issues
    WHERE key = '{epic_key}'
       OR raw_data->'fields'->'parent'->>'key' = '{epic_key}'
)
SELECT
    bc.committed_at::date as date,
    bc.author_name,
    LEFT(bc.message, 50) as message,
    bc.jira_keys,
    br.slug as repo
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.committed_at > NOW() - INTERVAL '7 days'
  AND bc.jira_keys && (SELECT ARRAY_AGG(key) FROM epic_stories)
ORDER BY bc.committed_at DESC
LIMIT 10;

-- Open PRs related to Epic
WITH epic_stories AS (
    SELECT key FROM jira_issues
    WHERE key = '{epic_key}'
       OR raw_data->'fields'->'parent'->>'key' = '{epic_key}'
)
SELECT
    bp.pr_number,
    LEFT(bp.title, 50) as title,
    bp.state,
    bp.author_name,
    bp.source_branch,
    bp.jira_keys,
    br.slug as repo
FROM bitbucket_pullrequests bp
JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
WHERE bp.jira_keys && (SELECT ARRAY_AGG(key) FROM epic_stories)
ORDER BY bp.created_at DESC
LIMIT 10;
```

### Epic Progress

```sql
SELECT
    e.key as epic_key,
    e.summary as epic_summary,
    COUNT(s.key) as total_stories,
    COUNT(CASE WHEN s.status = 'Done' THEN 1 END) as done_stories,
    ROUND(
        COUNT(CASE WHEN s.status = 'Done' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(s.key), 0) * 100, 1
    ) as completion_pct,
    SUM((s.raw_data->'fields'->>'customfield_10016')::NUMERIC) as total_points
FROM jira_issues e
LEFT JOIN jira_issues s ON s.raw_data->'fields'->'parent'->>'key' = e.key
WHERE e.raw_data->'fields'->'issuetype'->>'name' = 'Epic'
  AND e.project = 'EUV'
GROUP BY e.key, e.summary
ORDER BY completion_pct DESC NULLS LAST;
```

## Jira API

### Vision Defaults Lookup

```python
from db_helper import get_vision_defaults

# Get Vision defaults for a project
defaults = get_vision_defaults('EUV')
# Returns: {'default_component': 'OQCDigitalization', 'default_labels': ['oqc-digitalization']}
```

### Story Creation (Vision Defaults Auto-Applied)

```python
from stories import create_jira_story

# Vision's component/labels are automatically applied
result = create_jira_story(
    project_key='EUV',
    epic_key='EUV-3304',
    summary='Implement Test Set Selection UI',
    description='As a tester, I want to select a Test Set...',
    labels=['frontend'],       # Added to Vision default labels
    story_points=3,
    dry_run=False
)
# Result: {'key': 'EUV-3313', ...}
# Applied component: OQCDigitalization
# Applied labels: ['oqc-digitalization', 'frontend']
```

### Story Creation (Direct Method)

```python
import requests

def create_story(epic_key, summary, description, story_points, jira_config):
    """Create Story directly in Jira (Vision defaults not applied)"""
    project_key = epic_key.split('-')[0]

    payload = {
        "fields": {
            "project": {"key": project_key},
            "parent": {"key": epic_key},
            "issuetype": {"name": "Story"},
            "summary": summary,
            "description": {
                "type": "doc",
                "version": 1,
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]
            },
            "customfield_10016": story_points  # Story Points
        }
    }

    response = requests.post(
        f"{jira_config['url']}/rest/api/3/issue",
        auth=(jira_config['email'], jira_config['token']),
        headers={"Content-Type": "application/json"},
        json=payload
    )

    if response.ok:
        return response.json()['key']
    else:
        raise Exception(f"Error: {response.status_code} - {response.text}")
```

### ADF (Atlassian Document Format) Conversion

```python
def markdown_to_adf(md_text):
    """Simple markdown → ADF conversion"""
    lines = md_text.strip().split('\n')
    content = []

    for line in lines:
        if line.startswith('- [ ]'):
            content.append({
                "type": "taskList",
                "content": [{
                    "type": "taskItem",
                    "attrs": {"state": "TODO"},
                    "content": [{"type": "text", "text": line[5:].strip()}]
                }]
            })
        elif line.startswith('### '):
            content.append({
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": line[4:]}]
            })
        elif line.strip():
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": line}]
            })

    return {"type": "doc", "version": 1, "content": content}
```

## Story Template

```markdown
## Story: [Summary]

### Description
[User story format: As a [role], I want [feature] so that [benefit]]

### Acceptance Criteria
- [ ] [Verifiable condition 1]
- [ ] [Verifiable condition 2]
- [ ] [Verifiable condition 3]

### Technical Notes
[Implementation hints, caveats]

### Story Points: [1/2/3/5/8]
```

---

## Label System

### Label Classification Criteria

| Label | Keyword Hints | Description |
|-------|---------------|-------------|
| `frontend` | UI, screen, React, component, button, form, modal, page, dashboard | Frontend/UI work |
| `backend` | API, server, DB, endpoint, auth, data, processing, logic | Backend/server work |
| `plc` | PLC, Modbus, protocol, equipment, Gateway, Simulator, communication, Hostlink | Equipment communication/control |
| `infra` | CI/CD, deployment, Docker, config, environment variables, pipeline | Infrastructure/DevOps |
| `test` | test, QA, validation, automation, unit, integration, e2e | Testing/QA |
| `docs` | documentation, README, guide, manual | Documentation |

### Auto-Label Detection Logic

```python
LABEL_KEYWORDS = {
    'frontend': ['ui', 'screen', 'react', 'component', 'button', 'form', 'modal', 'page', 'dashboard', 'css', 'style'],
    'backend': ['api', 'server', 'db', 'endpoint', 'auth', 'data', 'processing', 'logic', 'rest', 'graphql'],
    'plc': ['plc', 'modbus', 'protocol', 'equipment', 'gateway', 'simulator', 'communication', 'hostlink'],
    'infra': ['ci/cd', 'deploy', 'docker', 'config', 'environment', 'pipeline', 'kubernetes'],
    'test': ['test', 'qa', 'validation', 'automation', 'unit', 'integration', 'e2e'],
    'docs': ['documentation', 'readme', 'guide', 'manual']
}

def detect_labels(text: str) -> list[str]:
    """Auto-detect labels from text"""
    text_lower = text.lower()
    labels = []
    for label, keywords in LABEL_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            labels.append(label)
    return labels or ['backend']  # default
```

---

## Epic Auto-Search

### Keyword-Based Epic Finder

```sql
-- Find related Epics by keyword within a project
SELECT
    key,
    summary,
    status,
    raw_data->'fields'->>'description' as description
FROM jira_issues
WHERE raw_data->'fields'->'issuetype'->>'name' = 'Epic'
  AND project = '{project_key}'
  AND (
    summary ILIKE '%{keyword}%'
    OR raw_data->'fields'->>'description' ILIKE '%{keyword}%'
  )
ORDER BY
    CASE WHEN summary ILIKE '%{keyword}%' THEN 0 ELSE 1 END,
    updated_at DESC
LIMIT 5;
```

### Vision → Project Mapping

```sql
-- Find project key by Vision name
SELECT
    v.title as vision,
    v.project_key,
    COUNT(el.epic_key) as epic_count
FROM roadmap_visions v
LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
LEFT JOIN roadmap_epic_links el ON el.milestone_id = m.id
WHERE v.title ILIKE '%{vision_name}%'
GROUP BY v.id
ORDER BY v.created_at DESC;
```

### Active Epic List (for Story placement)

```sql
-- Active Epics in a project (candidates for new Stories)
SELECT
    key,
    summary,
    status,
    (SELECT COUNT(*) FROM jira_issues s
     WHERE s.raw_data->'fields'->'parent'->>'key' = e.key) as story_count
FROM jira_issues e
WHERE e.raw_data->'fields'->'issuetype'->>'name' = 'Epic'
  AND e.project = '{project_key}'
  AND e.status NOT IN ('Done', 'Closed')
ORDER BY e.updated_at DESC;
```

---

## `/javis-story add` Context Collection Queries

### Extract File Patterns from Recent Commits

```sql
-- Recent commit file patterns for an Epic
WITH epic_keys AS (
    SELECT key FROM jira_issues
    WHERE key = '{epic_key}'
       OR raw_data->'fields'->'parent'->>'key' = '{epic_key}'
)
SELECT
    bc.message,
    bc.author_name,
    bc.committed_at::date,
    br.slug as repo
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.jira_keys && (SELECT ARRAY_AGG(key) FROM epic_keys)
  AND bc.committed_at > NOW() - INTERVAL '14 days'
ORDER BY bc.committed_at DESC
LIMIT 10;
```

### Extract Tech Keywords from Epic Description

```sql
-- Identify tech stack from Epic description
SELECT
    key,
    summary,
    raw_data->'fields'->>'description' as description
FROM jira_issues
WHERE key = '{epic_key}';
```

### Identify Patterns from Existing Stories

```sql
-- Analyze AC/Description patterns in existing Stories under Epic
SELECT
    key,
    summary,
    raw_data->'fields'->>'description' as description,
    raw_data->'fields'->'labels' as labels,
    raw_data->'fields'->>'customfield_10016' as story_points
FROM jira_issues
WHERE raw_data->'fields'->'parent'->>'key' = '{epic_key}'
ORDER BY created_at DESC
LIMIT 5;
```

### Identify In-Progress Work from Open PRs

```sql
-- Open PRs related to Epic
WITH epic_keys AS (
    SELECT key FROM jira_issues
    WHERE key = '{epic_key}'
       OR raw_data->'fields'->'parent'->>'key' = '{epic_key}'
)
SELECT
    bp.pr_number,
    bp.title,
    bp.author_name,
    bp.source_branch,
    bp.state,
    br.slug as repo
FROM bitbucket_pullrequests bp
JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
WHERE bp.jira_keys && (SELECT ARRAY_AGG(key) FROM epic_keys)
  AND bp.state = 'OPEN'
ORDER BY bp.created_at DESC;
```

---

## Story Generation Info Checklist

| Info | Purpose | Query/Script |
|------|---------|--------------|
| Vision goals | Understand overall direction | `context {project}` |
| Milestone status | Prioritization | `context {project}` |
| Epic description | Domain terminology | `list {epic}` |
| Existing Stories | Prevent duplicates, reference patterns | `list {epic}` |
| Recent commits | In-progress work, file structure | `dev {epic}` |
| Open PRs | Identify dependencies | `dev {epic}` |
| Team composition | Suggest assignees | `context {project}` |
