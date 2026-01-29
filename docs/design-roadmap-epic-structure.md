# Roadmap Epic 구조 설계

## 개요

로드맵 시스템에서 Epic을 관리하기 위한 데이터 구조 설계 문서입니다.
Vision → Milestone → Epic → Issue 계층 구조를 지원합니다.

---

## 테이블 구조

### 1. 기존 테이블

#### `jira_issues`
Jira에서 동기화된 모든 이슈 (Epic, Story, Task, Bug 등)

```sql
-- 주요 컬럼
key         TEXT PRIMARY KEY  -- EUV-100
project     TEXT              -- EUV
summary     TEXT
status      TEXT
raw_data    JSONB             -- Jira 원본 데이터
```

#### `roadmap_epic_links`
Milestone과 Jira Epic 간의 연결

```sql
CREATE TABLE roadmap_epic_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id   UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
  stream_id      UUID REFERENCES roadmap_streams(id) ON DELETE SET NULL,
  epic_key       TEXT NOT NULL,  -- jira_issues.key 참조
  last_synced_at TIMESTAMP,
  created_at     TIMESTAMP DEFAULT now()
);
```

### 2. 신규 테이블

#### `roadmap_local_epics`
Jira에 아직 생성되지 않은 Draft Epic 저장

```sql
CREATE TABLE roadmap_local_epics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  assignee     TEXT,
  priority     TEXT DEFAULT 'Medium',
  status       TEXT DEFAULT 'draft',  -- draft | ready | synced
  jira_key     TEXT,                  -- Jira 동기화 후 할당
  story_points INTEGER,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMP DEFAULT now(),
  updated_at   TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_local_epics_milestone ON roadmap_local_epics(milestone_id);
CREATE INDEX idx_local_epics_status ON roadmap_local_epics(status);
```

---

## 데이터 플로우

### Epic 생성 경로 A: 로컬 계획 → Jira 동기화

```
┌──────────────────┐     동기화      ┌──────────────┐     연결      ┌─────────────────┐
│ roadmap_local_   │ ───────────► │ jira_issues  │ ───────────► │ roadmap_epic_   │
│ epics (Draft)    │   Jira 생성   │ (EUV-500)    │   자동생성    │ links           │
└──────────────────┘               └──────────────┘               └─────────────────┘
```

1. `roadmap_local_epics`에 Draft Epic 저장 (status='draft')
2. 검토 완료 후 status='ready'로 변경
3. 동기화 스크립트 실행:
   - Jira API로 Epic 생성 (POST /rest/api/3/issue)
   - 반환된 key를 `jira_key`에 저장
   - `jira_issues` 테이블에 추가
   - `roadmap_epic_links`에 Milestone 연결
   - status='synced'로 업데이트

### Epic 생성 경로 B: Jira 직접 생성 → 로컬 연결

```
┌──────────────────┐    양방향 sync   ┌──────────────┐    UI에서     ┌─────────────────┐
│ Jira에서 직접    │ ───────────► │ jira_issues  │ ───────────► │ roadmap_epic_   │
│ Epic 생성        │               │ (EUV-600)    │   수동 연결   │ links           │
└──────────────────┘               └──────────────┘               └─────────────────┘
```

1. Jira에서 Epic 직접 생성
2. 양방향 동기화로 `jira_issues`에 반영
3. UI에서 해당 Epic을 Milestone에 연결 (roadmap_epic_links에 추가)

---

## UI 표시 구조

```
Milestone: The Walking Skeleton
│
├── 📋 Linked Epics (Jira에 존재)
│   ├── EUV-500: Simulation Engine
│   └── EUV-501: Protocol Abstraction
│
└── 📝 Draft Epics (Jira에 미존재)
    ├── [Draft] Hello World Scenarios
    └── [Draft] The Bridge
```

### 데이터 조회 쿼리

```sql
-- Linked Epics (Jira에 있는 것)
SELECT ji.key, ji.summary, ji.status
FROM roadmap_epic_links el
JOIN jira_issues ji ON ji.key = el.epic_key
WHERE el.milestone_id = :milestone_id;

-- Draft Epics (로컬 전용)
SELECT id, title, description, assignee, status
FROM roadmap_local_epics
WHERE milestone_id = :milestone_id
  AND status IN ('draft', 'ready');
```

---

## Status 정의

### `roadmap_local_epics.status`

| Status | 설명 |
|--------|------|
| `draft` | 초안 작성 중, 검토 필요 |
| `ready` | 검토 완료, Jira 동기화 대기 |
| `synced` | Jira에 생성 완료 |

---

## 동기화 스크립트

### 사용법

```bash
# 특정 Milestone의 ready 상태 Epic을 Jira에 동기화
python3 scripts/sync_local_epics_to_jira.py --milestone "The Walking Skeleton"

# Dry-run (실제 생성 없이 미리보기)
python3 scripts/sync_local_epics_to_jira.py --milestone "The Walking Skeleton" --dry-run

# 모든 ready 상태 Epic 동기화
python3 scripts/sync_local_epics_to_jira.py --all
```

### 동기화 시 생성되는 Jira Epic 필드

| Jira 필드 | 소스 |
|-----------|------|
| project | Vision의 project_key |
| issuetype | Epic |
| summary | roadmap_local_epics.title |
| description | roadmap_local_epics.description |
| assignee | roadmap_local_epics.assignee |
| priority | roadmap_local_epics.priority |

---

## 관련 파일

- 테이블 정의: `scripts/migrations/create_roadmap_local_epics.sql`
- API 엔드포인트: `src/javis-viewer/src/app/api/roadmap/local-epics/`
- 동기화 스크립트: `scripts/sync_local_epics_to_jira.py`
- 타입 정의: `src/javis-viewer/src/types/roadmap.ts`

---

## 작성일

- 2026-01-29
- 작성자: Claude + User
