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

---

## 라벨 시스템

### 라벨 분류 기준

| 라벨 | 키워드 힌트 | 설명 |
|------|-------------|------|
| `frontend` | UI, 화면, React, 컴포넌트, 버튼, 폼, 모달, 페이지, 대시보드 | 프론트엔드/UI 작업 |
| `backend` | API, 서버, DB, 엔드포인트, 인증, 데이터, 처리, 로직 | 백엔드/서버 작업 |
| `plc` | PLC, Modbus, 프로토콜, 장비, Gateway, Simulator, 통신, Hostlink | 장비 통신/제어 |
| `infra` | CI/CD, 배포, Docker, 설정, 환경변수, 파이프라인 | 인프라/DevOps |
| `test` | 테스트, QA, 검증, 자동화, unit, integration, e2e | 테스트/QA |
| `docs` | 문서, README, 가이드, 매뉴얼 | 문서화 |

### 라벨 자동 부여 로직

```python
LABEL_KEYWORDS = {
    'frontend': ['ui', '화면', 'react', '컴포넌트', '버튼', '폼', '모달', '페이지', '대시보드', 'css', 'style'],
    'backend': ['api', '서버', 'db', '엔드포인트', '인증', '데이터', '처리', '로직', 'rest', 'graphql'],
    'plc': ['plc', 'modbus', '프로토콜', '장비', 'gateway', 'simulator', '통신', 'hostlink', '시뮬레이터'],
    'infra': ['ci/cd', '배포', 'docker', '설정', '환경변수', 'pipeline', 'kubernetes'],
    'test': ['테스트', 'qa', '검증', '자동화', 'unit', 'integration', 'e2e'],
    'docs': ['문서', 'readme', '가이드', '매뉴얼', 'documentation']
}

def detect_labels(text: str) -> list[str]:
    """텍스트에서 라벨 자동 감지"""
    text_lower = text.lower()
    labels = []
    for label, keywords in LABEL_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            labels.append(label)
    return labels or ['backend']  # 기본값
```

---

## Epic 자동 탐색

### 키워드 기반 Epic 찾기

```sql
-- 프로젝트 내 키워드로 관련 Epic 탐색
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

### Vision → Project 매핑

```sql
-- Vision 이름으로 프로젝트 키 찾기
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

### 활성 Epic 목록 (Story 배치용)

```sql
-- 프로젝트의 활성 Epic 목록 (Story 추가 대상)
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

## `/javis-stories add` 맥락 수집 쿼리

### 최근 커밋에서 파일 패턴 추출

```sql
-- Epic 관련 최근 커밋의 변경 파일 패턴
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

### Epic 설명에서 기술 키워드 추출

```sql
-- Epic description에서 기술 스택 파악
SELECT
    key,
    summary,
    raw_data->'fields'->>'description' as description
FROM jira_issues
WHERE key = '{epic_key}';
```

### 기존 Story에서 패턴 파악

```sql
-- Epic 하위 Story들의 AC/Description 패턴 분석
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

### 오픈 PR에서 진행 중인 작업 파악

```sql
-- Epic 관련 오픈 PR
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

## Story 생성 시 참조할 정보 체크리스트

| 정보 | 용도 | 쿼리/스크립트 |
|------|------|---------------|
| Vision 목표 | 전체 방향성 이해 | `context {project}` |
| Milestone 상태 | 우선순위 판단 | `context {project}` |
| Epic 설명 | 도메인 용어 파악 | `list {epic}` |
| 기존 Story | 중복 방지, 패턴 참조 | `list {epic}` |
| 최근 커밋 | 진행 중 작업, 파일 구조 | `dev {epic}` |
| 오픈 PR | 의존성 파악 | `dev {epic}` |
| 팀 구성 | 담당자 제안 | `context {project}` |
