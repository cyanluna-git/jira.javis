---
name: javis-stories
description: 로컬 DB 기반 Story 관리. Vision/Epic 맥락 조회, Story 목록, AI 생성/정제, Jira 동기화. 사용법: /javis-stories context, /javis-stories list <epic>, /javis-stories create <epic>, /javis-stories refine <epic>, /javis-stories push <epic>
---

# /stories - 로컬 DB 기반 Story 관리

로컬 PostgreSQL DB를 기반으로 Story를 관리하고 Jira와 동기화합니다.

## 데이터 소스

모든 정보는 로컬 DB에서 조회합니다 (Jira/Bitbucket과 bidirectional sync 상태):

| 정보 | 테이블 |
|------|--------|
| Vision 목표 | `roadmap_visions` |
| Milestone 현황 | `roadmap_milestones` |
| Epic/Story | `jira_issues` (raw_data 필드) |
| 팀 구성 | `roadmap_vision_members` + `team_members` |
| Epic 연결 | `roadmap_epic_links` |
| 커밋 이력 | `bitbucket_commits` (jira_keys 필드로 Epic/Story 연결) |
| PR 현황 | `bitbucket_pullrequests` (jira_keys 필드로 Epic/Story 연결) |
| 레포지토리 | `bitbucket_repositories` |

**DB 연결**: localhost:5439, javis_brain, user: javis

---

## 명령어

### `/stories context [vision_title]`
Vision의 프로젝트 맥락 조회 (Bitbucket 개발 현황 포함)

**출력 정보:**
- Vision 목표 및 North Star Metric
- Milestone 진행률 (planned/in_progress/completed)
- Epic 현황 (전체/진행중/완료)
- 팀 구성 및 역할
- **Bitbucket 개발 현황** (최근 커밋, 오픈 PR, 개발자 활동)

**실행:**

1. **Vision/Milestone 정보:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
SELECT v.title, v.description, v.status, v.north_star_metric, v.north_star_target,
       COUNT(m.id) as milestone_count,
       ROUND(AVG(m.progress_percent), 1) as avg_progress
FROM roadmap_visions v
LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
WHERE v.title ILIKE '%{vision_title}%' OR '{vision_title}' = ''
GROUP BY v.id
ORDER BY v.created_at DESC;
"
```

2. **Bitbucket 개발 현황 (Vision 관련 Epic/Story 기준):**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
-- Vision 관련 Epic keys 조회
WITH vision_epics AS (
    SELECT el.epic_key
    FROM roadmap_epic_links el
    JOIN roadmap_milestones m ON m.id = el.milestone_id
    JOIN roadmap_visions v ON v.id = m.vision_id
    WHERE v.title ILIKE '%{vision_title}%'
),
-- Epic 하위 Story keys 포함
related_keys AS (
    SELECT epic_key as issue_key FROM vision_epics
    UNION
    SELECT ji.key FROM jira_issues ji
    JOIN vision_epics ve ON ji.raw_data->'fields'->'parent'->>'key' = ve.epic_key
)
-- 최근 7일 커밋 (관련 이슈)
SELECT
    bc.committed_at::date as date,
    bc.author_name,
    LEFT(bc.message, 60) as message,
    bc.jira_keys,
    br.slug as repo
FROM bitbucket_commits bc
JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
WHERE bc.committed_at > NOW() - INTERVAL '7 days'
  AND bc.jira_keys && (SELECT ARRAY_AGG(issue_key) FROM related_keys)
ORDER BY bc.committed_at DESC
LIMIT 10;
"
```

3. **오픈 PR 현황:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH vision_epics AS (
    SELECT el.epic_key
    FROM roadmap_epic_links el
    JOIN roadmap_milestones m ON m.id = el.milestone_id
    JOIN roadmap_visions v ON v.id = m.vision_id
    WHERE v.title ILIKE '%{vision_title}%'
),
related_keys AS (
    SELECT epic_key as issue_key FROM vision_epics
    UNION
    SELECT ji.key FROM jira_issues ji
    JOIN vision_epics ve ON ji.raw_data->'fields'->'parent'->>'key' = ve.epic_key
)
SELECT
    bp.pr_number,
    bp.title,
    bp.state,
    bp.author_name,
    bp.source_branch,
    bp.jira_keys,
    br.slug as repo
FROM bitbucket_pullrequests bp
JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
WHERE bp.state = 'OPEN'
  AND bp.jira_keys && (SELECT ARRAY_AGG(issue_key) FROM related_keys)
ORDER BY bp.created_at DESC;
"
```

4. **개발자 활동 요약 (최근 7일):**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
WITH vision_epics AS (
    SELECT el.epic_key
    FROM roadmap_epic_links el
    JOIN roadmap_milestones m ON m.id = el.milestone_id
    JOIN roadmap_visions v ON v.id = m.vision_id
    WHERE v.title ILIKE '%{vision_title}%'
),
related_keys AS (
    SELECT epic_key as issue_key FROM vision_epics
    UNION
    SELECT ji.key FROM jira_issues ji
    JOIN vision_epics ve ON ji.raw_data->'fields'->'parent'->>'key' = ve.epic_key
)
SELECT
    bc.author_name,
    COUNT(*) as commits,
    COUNT(DISTINCT bc.repo_uuid) as repos,
    ARRAY_AGG(DISTINCT UNNEST(bc.jira_keys)) FILTER (WHERE bc.jira_keys IS NOT NULL) as worked_on_issues
FROM bitbucket_commits bc
WHERE bc.committed_at > NOW() - INTERVAL '7 days'
  AND bc.jira_keys && (SELECT ARRAY_AGG(issue_key) FROM related_keys)
GROUP BY bc.author_name
ORDER BY commits DESC;
"
```

---

### `/stories list <epic_key>`
Epic 하위 Story 목록 및 개발 현황 조회

**출력 정보:**
- Story key, summary, status
- 담당자, Story Points
- 생성/수정일
- **Bitbucket 개발 현황** (Epic 관련 커밋/PR)

**실행:**

1. **Epic 및 Story 목록:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

2. **Epic 관련 최근 커밋 (7일):**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

3. **Epic 관련 오픈 PR:**
```bash
PGPASSWORD=javis_password psql -h localhost -p 5439 -U javis -d javis_brain -c "
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
"
```

---

### `/stories create <epic_key>`
AI가 Epic 목표 기반으로 Story 초안 생성

**절차:**
1. DB에서 Epic 정보 조회 (summary, description)
2. Vision/Milestone 맥락 파악
3. 기존 Story 패턴 분석
4. Story 초안 생성 (summary, description, AC, story points)

**Story 템플릿:**
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

**주의사항:**
- Epic description을 기반으로 생성
- 프로젝트 도메인 용어 사용
- 적절한 granularity 유지 (1-3 Sprint 내 완료 가능)

---

### `/stories refine <epic_key>`
기존 Story들 AI 정제

**절차:**
1. Epic 하위 모든 Story 조회
2. 각 Story AC 완성도 검토
3. Story Points 적정성 검증
4. 프로젝트 맥락 반영하여 개선안 제시

**검토 기준:**
- AC가 검증 가능한가?
- Story Points가 팀 velocity에 적합한가?
- 의존성이 명확한가?
- 도메인 용어가 일관적인가?

---

### `/stories push <epic_key> [--dry-run]`
Story를 Jira에 직접 생성 (API 호출)

**워크플로우:**
1. `/stories create`로 Story 초안 생성
2. `/stories refine`으로 AC/Points 정제
3. `/stories push`로 Jira에 직접 생성
4. 자동으로 `sync_bidirectional.py --pull-only` 실행하여 로컬 DB 동기화

**Jira API로 Story 생성:**
```python
import os, requests, json, psycopg2

# .env 로드
env = {}
with open('.env') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v

JIRA_URL = env['JIRA_URL']
JIRA_EMAIL = env['JIRA_EMAIL']
JIRA_TOKEN = env['JIRA_TOKEN']

def get_epic_components(epic_key):
    """Epic의 Component ID 목록 조회 (로컬 DB에서)"""
    conn = psycopg2.connect(
        host="localhost", port=5439, dbname="javis_brain",
        user="javis", password="javis_password"
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT raw_data->'fields'->'components'
        FROM jira_issues WHERE key = %s
    """, [epic_key])
    result = cur.fetchone()
    conn.close()

    if result and result[0]:
        # [{"id": "10506", "name": "OQCDigitalization", ...}]
        return [{"id": c["id"]} for c in result[0]]
    return []

def create_story(epic_key, summary, description, story_points):
    """Jira에 Story 직접 생성 (Epic의 Component 상속)"""
    project_key = epic_key.split('-')[0]

    # Epic에서 Component 가져오기
    components = get_epic_components(epic_key)

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
            "customfield_10016": story_points,  # Story Points
            "components": components  # Epic에서 상속받은 Component
        }
    }

    response = requests.post(
        f"{JIRA_URL}/rest/api/3/issue",
        auth=(JIRA_EMAIL, JIRA_TOKEN),
        headers={"Content-Type": "application/json"},
        json=payload
    )

    if response.ok:
        return response.json()['key']
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

# 사용 예시
# key = create_story("EUV-3299", "Define ISimulator interface", "AC here...", 3)
# print(f"Created: {key}")
```

**중요:** Story 생성 시 Epic의 `components`를 자동으로 상속받습니다.

**실행 절차:**

1. Story 초안이 준비되면, 위 함수로 각 Story 생성
2. 생성 완료 후 DB 동기화:
```bash
python3 scripts/sync_bidirectional.py --pull-only --project EUV
```

**--dry-run 모드:**
- Story 목록만 출력하고 실제 생성하지 않음
- 사용자 확인 후 실제 push 진행

**ADF (Atlassian Document Format) 변환:**
Jira API v3는 description에 ADF 형식 필요:
```python
def markdown_to_adf(md_text):
    """간단한 마크다운 → ADF 변환"""
    lines = md_text.strip().split('\n')
    content = []

    for line in lines:
        if line.startswith('- [ ]'):
            # Checklist item
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

---

## 데이터 조회 쿼리 모음

### Vision Context 전체
```sql
SELECT
    v.title as vision,
    v.description,
    v.north_star_metric,
    v.north_star_target,
    v.north_star_current,
    m.title as milestone,
    m.quarter,
    m.progress_percent,
    m.status as milestone_status
FROM roadmap_visions v
LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
WHERE v.project_key = 'EUV'
ORDER BY v.title, m.quarter;
```

### Epic + Linked Milestone
```sql
SELECT
    el.epic_key,
    ji.summary as epic_summary,
    ji.status as epic_status,
    m.title as milestone,
    m.progress_percent
FROM roadmap_epic_links el
JOIN jira_issues ji ON ji.key = el.epic_key
JOIN roadmap_milestones m ON m.id = el.milestone_id
WHERE ji.project = 'EUV';
```

### 팀 구성
```sql
SELECT
    tm.display_name,
    vm.role_title,
    vm.role_category,
    vm.mm_allocation,
    v.title as vision
FROM roadmap_vision_members vm
JOIN team_members tm ON tm.account_id = vm.member_account_id
JOIN roadmap_visions v ON v.id = vm.vision_id
WHERE v.project_key = 'EUV'
ORDER BY vm.role_category, tm.display_name;
```

### Epic별 Story 진행률
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

---

## 워크플로우 예시

### 1. 새 Epic Story 생성 (전체 플로우)
```
/stories context OQC              # 프로젝트 맥락 파악
/stories list EUV-3299            # 현재 Story 확인
/stories create EUV-3299          # AI가 Story 초안 생성
/stories refine EUV-3299          # AC/Points 정제
/stories push EUV-3299 --dry-run  # 생성 예정 목록 확인
/stories push EUV-3299            # Jira에 직접 생성
```

### 2. Push 후 로컬 DB 동기화
```bash
python3 scripts/sync_bidirectional.py --pull-only --project EUV
```

### 3. 진행 상황 확인
```
/stories list EUV-3299
/stories context OQC
```
