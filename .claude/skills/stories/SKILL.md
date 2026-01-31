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

## Vision 기본값 자동 적용

Jira에 Story/Epic 생성 시 **Vision의 `default_component`와 `default_labels`가 자동 적용**됩니다.

| 프로젝트 | Component | Labels |
|----------|-----------|--------|
| EUV | OQCDigitalization | oqc-digitalization |
| ASP | Unify Plasma | unify-plasma-single |

Vision별 기본값 확인:
```bash
python3 .claude/skills/stories/scripts/stories.py push {epic_key} --dry-run
```

Vision 기본값 수정:
```sql
UPDATE roadmap_visions
SET default_component = '컴포넌트명', default_labels = ARRAY['label1', 'label2']
WHERE project_key = 'EUV';
```

---

## `/javis-stories add` 상세

자연어로 Story를 설명하면 AI가 **프로젝트 맥락을 분석**하여 구체적인 유저스토리를 생성합니다.

### 입력 형식

```
/javis-stories add {프로젝트}에 유저스토리를 추가하고 싶어.
지금 {현재 상황}까지 있는데.
{추가할 기능}을 확인하고 추가해야해.
그러면 {기대 결과}를 할 수 있게 돼.
```

---

## ⚠️ AI 필수 실행 단계 (MUST FOLLOW)

`add` 명령 수신 시 **반드시** 아래 순서로 맥락을 수집한 후 Story를 생성하세요.

### Step 1: 프로젝트 맥락 조회

```bash
python3 .claude/skills/stories/scripts/stories.py context {프로젝트명}
```

**수집 정보:**
- Vision 목표 및 North Star
- Milestone 현황 및 진행률
- 팀 구성 및 역할

### Step 2: 관련 Epic 탐색 및 기존 Story 확인

사용자 입력에서 키워드를 추출하여 관련 Epic을 찾습니다.

```bash
# Epic 하위 Story 목록 조회
python3 .claude/skills/stories/scripts/stories.py list {epic_key}
```

**수집 정보:**
- Epic 목표 및 설명
- 기존 Story 목록 (중복 방지)
- 현재 진행 상태

### Step 3: 최근 개발 현황 파악

```bash
python3 .claude/skills/stories/scripts/stories.py dev {epic_key}
```

**수집 정보:**
- 최근 7일 커밋 로그 (작업 중인 파일, 패턴)
- 오픈 PR 상태
- 개발자별 작업 영역

### Step 4: 맥락 기반 Story 생성

위에서 수집한 정보를 바탕으로 **구체적이고 현실적인** Story를 생성합니다.

**생성 시 반드시 반영할 것:**
- 기존 코드베이스의 **용어/네이밍** 사용 (커밋 메시지, Epic 설명 참조)
- 실제 **파일명/함수명** 참조 (커밋 로그에서 확인)
- 기존 **패턴/아키텍처** 따르기
- 현재 진행 중인 작업과 **의존성** 명시
- **중복 Story 방지** (기존 Story 목록 확인)

---

## 라벨 분류 기준

| 라벨 | 키워드 힌트 |
|------|-------------|
| `frontend` | UI, 화면, React, 컴포넌트, 버튼, 폼, 모달, 페이지 |
| `backend` | API, 서버, DB, 엔드포인트, 인증, 데이터 처리 |
| `plc` | PLC, Modbus, 프로토콜, 장비, Gateway, Simulator, 통신 |
| `infra` | CI/CD, 배포, Docker, 설정, 환경변수 |
| `test` | 테스트, QA, 검증, 자동화 테스트 |
| `docs` | 문서, README, 가이드 |

---

## 출력 형식 (맥락 반영)

```markdown
## Story: [구체적인 Summary]

**Epic**: {epic_key} ({epic_summary})
**Labels**: `{label1}`, `{label2}`
**Project**: {project_name}
**의존성**: {관련 Story 또는 "없음"}

### Description
As a {역할}, I want {기능}
so that {기대 효과}.

### Context (현재 상황)
- 현재 {epic_key}에서 {진행 중인 작업} 진행 중
- 최근 커밋: `{recent_commit_message}` by {author}
- 관련 파일: `{file_path}`

### Acceptance Criteria
- [ ] {기존 패턴/클래스명 활용한 구체적 조건 1}
- [ ] {실제 파일/함수 참조한 조건 2}
- [ ] {기존 설정 파일 참조한 조건 3}
- [ ] {테스트 조건}

### Technical Notes
- 기존 `{클래스/패턴명}` 패턴 따르기 (`{파일경로}` 참조)
- {epic_key}의 기존 Story `{관련_story_key}` 완료 후 착수 권장
- 설정값은 `{config_file}`에서 관리

### Story Points: {points}
```

---

## 예시: 맥락 기반 Story 생성

### 사용자 입력
```
/javis-stories add OQC에 유저스토리를 추가하고 싶어.
지금 Simulation Engine 기본 구조까지 있는데.
에러 핸들링 기능을 확인하고 추가해야해.
그러면 시뮬레이터 실패 시 자동 재시도가 가능해져.
```

### AI 실행 흐름

1. `context OQC` → Vision 목표, North Star 확인
2. 키워드 "Simulation Engine" → EUV-3299 Epic 탐색
3. `list EUV-3299` → 기존 Story 6개 확인 (에러 핸들링 없음 확인)
4. `dev EUV-3299` → 최근 커밋 확인:
   - `feat: add ISimulator interface` (Gerald, 01-15)
   - `feat: implement EUV simulator config` (Tushar, 01-14)

### 생성된 Story

```markdown
## Story: Implement Error Handling with Auto-Retry for Simulators

**Epic**: EUV-3299 (Simulation Engine)
**Labels**: `backend`, `plc`
**Project**: OQC
**의존성**: EUV-3301 (ISimulator interface) 완료 필요

### Description
As a developer, I want automatic retry mechanism on simulator connection failures
so that transient network errors don't interrupt the BDD test execution.

### Context (현재 상황)
- 현재 EUV-3299에서 ISimulator 인터페이스 정의 완료
- 최근 커밋: `feat: add ISimulator interface` by Gerald (01-15)
- 관련 파일: `src/simulator/interface.py`, `src/simulator/euv_simulator.py`

### Acceptance Criteria
- [ ] `ISimulator.connect()` 실패 시 최대 3회 재시도 (Gateway의 `RetryPolicy` 패턴 적용)
- [ ] 재시도 간격: exponential backoff 1s → 2s → 4s (`config/simulator.yaml`의 `retry.backoff` 설정)
- [ ] 실패 로그를 `edge_gateway/logs/simulator.log`에 기록 (기존 `LogManager` 활용)
- [ ] 영구 실패 시 `SimulatorConnectionError` 예외 발생 및 BDD step 실패 처리
- [ ] 재시도 횟수/결과를 `/api/simulator/status` 엔드포인트에서 조회 가능

### Technical Notes
- Gateway의 기존 `RetryPolicy` 클래스 재사용 (`src/common/retry.py`)
- EUV-3301 (ISimulator interface) 완료 후 착수 권장
- 설정값은 `config/simulator.yaml`에서 관리
- 단위 테스트: `tests/simulator/test_retry.py` 추가

### Story Points: 3
```

---

## 저장 위치

생성된 Story는 `docs/stories/{epic_key}-stories.md`에 추가됩니다.
