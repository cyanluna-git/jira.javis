---
name: javis-stories
description: 로컬 DB 기반 Story 관리. Vision/Epic 맥락 조회, Story 목록, AI 생성/정제, Jira 동기화. 사용법: /javis-stories context, /javis-stories list <epic>, /javis-stories create <epic>, /javis-stories add <자연어>, /javis-stories push <epic>
argument-hint: "[context|list|create|add|refine|push] [vision_title|epic_key|자연어설명]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-stories - Story 관리

로컬 PostgreSQL DB를 기반으로 Story를 관리하고 Jira와 동기화합니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/javis-stories context [vision]` | Vision의 프로젝트 맥락 조회 |
| `/javis-stories list <epic_key>` | Epic 하위 Story 목록 |
| `/javis-stories create <epic_key>` | AI가 Epic 기반 Story 다수 생성 |
| `/javis-stories add <자연어>` | **자연어 → 단일 Story 생성 (Epic/라벨 자동)** |
| `/javis-stories refine <epic_key>` | 기존 Story AC/Points 정제 |
| `/javis-stories push <epic_key>` | Story를 Jira에 생성 |

## 빠른 실행

```bash
# Vision 맥락 조회
python3 .claude/skills/stories/scripts/stories.py context OQC

# Epic Story 목록
python3 .claude/skills/stories/scripts/stories.py list EUV-3299

# Epic 개발 현황 (커밋/PR)
python3 .claude/skills/stories/scripts/stories.py dev EUV-3299
```

## 추가 리소스

- 상세 쿼리 및 API 문서: [reference.md](reference.md)
- 사용 예시 및 워크플로우: [examples.md](examples.md)
- 헬퍼 스크립트: [scripts/stories.py](scripts/stories.py)

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| Vision 목표 | `roadmap_visions` |
| Milestone 현황 | `roadmap_milestones` |
| Epic/Story | `jira_issues` |
| 팀 구성 | `roadmap_vision_members` + `team_members` |
| 커밋 이력 | `bitbucket_commits` |
| PR 현황 | `bitbucket_pullrequests` |

---

## `/javis-stories add` 상세

자연어로 Story를 설명하면 AI가 자동으로 구조화된 유저스토리를 생성합니다.

### 입력 형식

```
/javis-stories add {프로젝트}에 유저스토리를 추가하고 싶어.
지금 {현재 상황}까지 있는데.
{추가할 기능}을 확인하고 추가해야해.
그러면 {기대 결과}를 할 수 있게 돼.
```

### AI 처리 단계

1. **프로젝트 → Vision 매칭**: 프로젝트명으로 Vision 찾기
2. **키워드 → Epic 탐색**: 현재 상황/기능에서 관련 Epic 자동 탐색
3. **유저스토리 변환**: As a... I want... So that... 형식
4. **AC 자동 생성**: 검증 가능한 Acceptance Criteria
5. **라벨 자동 부여**: 키워드 기반 라벨 추론
6. **Story Points 추정**: 복잡도 기반 추정

### 라벨 분류 기준

| 라벨 | 키워드 힌트 |
|------|-------------|
| `frontend` | UI, 화면, React, 컴포넌트, 버튼, 폼, 모달, 페이지 |
| `backend` | API, 서버, DB, 엔드포인트, 인증, 데이터 처리 |
| `plc` | PLC, Modbus, 프로토콜, 장비, Gateway, Simulator, 통신 |
| `infra` | CI/CD, 배포, Docker, 설정, 환경변수 |
| `test` | 테스트, QA, 검증, 자동화 테스트 |
| `docs` | 문서, README, 가이드 |

### Epic 자동 탐색 쿼리

```sql
-- 키워드로 관련 Epic 찾기
SELECT key, summary
FROM jira_issues
WHERE raw_data->'fields'->'issuetype'->>'name' = 'Epic'
  AND (summary ILIKE '%{keyword}%' OR raw_data->'fields'->>'description' ILIKE '%{keyword}%')
  AND project = '{project_key}'
ORDER BY updated_at DESC
LIMIT 5;
```

### 출력 예시

```markdown
## Story: Implement Auto-Retry on Simulator Failure

**Epic**: EUV-3299 (Simulation Engine)
**Labels**: `backend`, `plc`
**Project**: OQC

### Description
As a developer, I want automatic retry on simulator failures
so that transient errors don't interrupt the test flow.

### Acceptance Criteria
- [ ] 실패 시 최대 3회 재시도
- [ ] 재시도 간격: exponential backoff (1s, 2s, 4s)
- [ ] 영구 실패 시 명확한 에러 메시지 및 로깅
- [ ] 재시도 횟수/결과 모니터링 가능

### Technical Notes
- 기존 ErrorHandler 패턴 활용
- Retry 설정은 config로 관리

### Story Points: 3
```

### 저장 위치

생성된 Story는 `docs/stories/{epic_key}-stories.md`에 추가됩니다.
