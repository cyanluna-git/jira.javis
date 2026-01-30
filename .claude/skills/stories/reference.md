# Stories Reference - 상세 쿼리 및 API 문서

## 데이터베이스 스키마

### 주요 테이블

```sql
-- Vision 목표
roadmap_visions (id, title, description, status, north_star_metric, north_star_target, project_key)

-- Milestone
roadmap_milestones (id, vision_id, title, quarter, progress_percent, status)

-- Epic-Milestone 연결
roadmap_epic_links (epic_key, milestone_id)

-- Jira 이슈 (Epic, Story, Task, Bug)
jira_issues (key, summary, status, project, raw_data, created_at, updated_at)

-- 팀 구성
roadmap_vision_members (vision_id, member_account_id, role_title, role_category, mm_allocation)
team_members (account_id, display_name, email, role, team, skills)

-- Bitbucket
bitbucket_commits (hash, repo_uuid, author_name, message, jira_keys[], committed_at)
bitbucket_pullrequests (id, repo_uuid, pr_number, title, state, author_name, jira_keys[])
```

## SQL 쿼리 모음

### Vision Context 조회

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

### Epic + Story 목록

```sql
-- Epic 정보
SELECT key, summary, status,
       raw_data->'fields'->>'description' as description
FROM jira_issues
WHERE key = '{epic_key}';

-- Epic 하위 Story
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

### Bitbucket 개발 현황

```sql
-- Epic 관련 최근 커밋 (7일)
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

-- Epic 관련 오픈 PR
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

### Epic별 진행률

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

### Story 생성

```python
import requests

def create_story(epic_key, summary, description, story_points, jira_config):
    """Jira에 Story 직접 생성"""
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

### ADF (Atlassian Document Format) 변환

```python
def markdown_to_adf(md_text):
    """간단한 마크다운 → ADF 변환"""
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

## Story 템플릿

```markdown
## Story: [Summary]

### Description
[사용자 스토리 형식: As a [role], I want [feature] so that [benefit]]

### Acceptance Criteria
- [ ] [검증 가능한 조건 1]
- [ ] [검증 가능한 조건 2]
- [ ] [검증 가능한 조건 3]

### Technical Notes
[구현 힌트, 주의사항]

### Story Points: [1/2/3/5/8]
```
