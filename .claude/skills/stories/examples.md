# Stories Examples - 사용 예시 및 워크플로우

## 워크플로우 예시

### 1. 자연어로 빠르게 Story 추가 (add)

```bash
/javis-stories add OQC에 유저스토리를 추가하고 싶어.
지금 Simulation Engine 기본 구조까지 있는데.
에러 핸들링 기능을 확인하고 추가해야해.
그러면 시뮬레이터 실패 시 자동 재시도가 가능해져.
```

**AI가 자동으로:**
1. OQC → Vision 매칭
2. "Simulation Engine" → EUV-3299 Epic 탐색
3. "에러 핸들링", "재시도" → `backend`, `plc` 라벨 부여
4. 구조화된 유저스토리 생성

### 2. Epic 기반 다수 Story 생성 (create)

```bash
# 1. 프로젝트 맥락 파악
/javis-stories context OQC

# 2. 현재 Story 확인
/javis-stories list EUV-3299

# 3. AI가 Story 초안 생성 (Epic 분석 후 빠진 영역 다수 생성)
/javis-stories create EUV-3299

# 4. AC/Points 정제
/javis-stories refine EUV-3299

# 5. 생성 예정 목록 확인
/javis-stories push EUV-3299 --dry-run

# 6. Jira에 직접 생성
/javis-stories push EUV-3299
```

### 2. 스크립트 사용

```bash
# Vision 맥락 조회
python3 .claude/skills/stories/scripts/stories.py context OQC

# Epic Story 목록
python3 .claude/skills/stories/scripts/stories.py list EUV-3299

# Epic 개발 현황
python3 .claude/skills/stories/scripts/stories.py dev EUV-3299

# Story 생성 (dry-run)
python3 .claude/skills/stories/scripts/stories.py push EUV-3299 --dry-run
```

### 3. Push 후 로컬 DB 동기화

```bash
python3 scripts/sync_bidirectional.py --pull-only --project EUV
```

## 출력 예시

### `/javis-stories context OQC`

```
=== Vision: OQC Digitalization ===
Description: OQC 검사 프로세스 디지털화
Status: in_progress
North Star: OQC 처리 시간 (목표: 50% 단축)

=== Milestones ===
Q1 2024: Phase 1 - 기본 인프라 (진행률: 75%)
Q2 2024: Phase 2 - 자동화 (진행률: 30%)

=== 팀 구성 ===
Gerald Park - Tech Lead (1.0 MM)
Tushar - Backend Developer (0.8 MM)

=== 최근 개발 활동 (7일) ===
2024-01-15 | Gerald | feat: add simulator interface | EUV-3301
2024-01-14 | Tushar | fix: data validation | EUV-3299
```

### `/javis-stories list EUV-3299`

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

=== 최근 커밋 (7일) ===
2024-01-15 | Gerald | feat: add simulator interface | oqc-backend
2024-01-14 | Tushar | fix: data validation | oqc-backend

=== 오픈 PR ===
#42 | feat/simulator-interface | Gerald | OPEN
```

### `/javis-stories add` 예시 (맥락 기반)

**입력:**
```
/javis-stories add OQC에 유저스토리를 추가하고 싶어.
지금 Gateway REST API까지 있는데.
PLC 연결 상태를 실시간으로 모니터링하는 UI가 필요해.
그러면 운영자가 장비 상태를 한눈에 파악할 수 있어.
```

**AI 실행 흐름:**

```bash
# Step 1: 프로젝트 맥락 조회
$ python3 .claude/skills/stories/scripts/stories.py context OQC

=== Vision: OQC Digitalization ===
North Star: Zero Manual QC, 100% Data Trust
Status: active

=== Milestones ===
2026-02: The Walking Skeleton (in_progress) - 진행률: 25%

=== 팀 구성 ===
Gerald Park - Tech Lead (1.0 MM)
Owen Rim - Edge/Frontend Engineer (0.5 MM)
```

```bash
# Step 2: 관련 Epic 탐색 (키워드: Gateway)
$ python3 .claude/skills/stories/scripts/stories.py list EUV-3300

=== Epic: EUV-3300 ===
Summary: Gateway REST API Integration
Status: In Progress

=== Stories (3) ===
EUV-3310 | Implement /api/devices endpoint | Done | Gerald | 3
EUV-3311 | Add /api/status endpoint       | Done | Gerald | 2
EUV-3312 | WebSocket event streaming      | To Do | -     | 5
```

```bash
# Step 3: 최근 개발 현황
$ python3 .claude/skills/stories/scripts/stories.py dev EUV-3300

=== 최근 커밋 (7일) ===
2026-01-28 | Gerald | feat: add /api/status endpoint | edge-gateway
2026-01-27 | Gerald | feat: implement device listing | edge-gateway
2026-01-26 | Owen   | fix: CORS configuration       | edge-gateway

=== 오픈 PR ===
#45 | feat/websocket-events | Owen | OPEN
```

**생성된 Story (맥락 반영):**

```markdown
## Story: Add Real-time PLC Connection Status Dashboard

**Epic**: EUV-3300 (Gateway REST API Integration)
**Labels**: `frontend`, `plc`
**Project**: OQC
**의존성**: EUV-3312 (WebSocket event streaming) 완료 후 실시간 업데이트 가능

### Description
As an operator, I want to see real-time PLC connection status on a dashboard
so that I can monitor equipment health at a glance.

### Context (현재 상황)
- 현재 EUV-3300에서 Gateway REST API 구현 중
- `/api/status` 엔드포인트 완료 (EUV-3311)
- WebSocket 스트리밍 PR 진행 중 (#45 by Owen)
- 관련 파일: `edge-gateway/src/api/status.py`

### Acceptance Criteria
- [ ] `/api/devices` 응답 기반 PLC 목록 표시 (IP, 포트, 프로토콜)
- [ ] `/api/status` 응답 기반 연결 상태 표시 (Connected/Disconnected/Error)
- [ ] EUV-3312 완료 시 WebSocket으로 실시간 업데이트 (fallback: 5초 polling)
- [ ] 연결 실패 시 Toast 알림 (기존 `NotificationProvider` 활용)
- [ ] 최근 5분간 통신 성공률 그래프 (Recharts - 기존 Dashboard 패턴)

### Technical Notes
- 기존 `/api/status` 엔드포인트 활용 (`edge-gateway/src/api/status.py`)
- React Query `useQuery` 패턴 따르기 (`src/hooks/useDevices.ts` 참조)
- Recharts 그래프 컴포넌트는 `src/components/charts/` 패턴 따르기
- Owen의 WebSocket PR (#45) 머지 후 실시간 업데이트 적용

### Story Points: 3

---
저장 위치: docs/stories/EUV-3300-stories.md
```

**차이점 비교:**

| 항목 | 맥락 없이 | 맥락 기반 |
|------|----------|----------|
| Epic | 추측 | 정확한 EUV-3300 |
| AC | 일반적 | `/api/status` 등 실제 엔드포인트 참조 |
| 의존성 | 없음 | EUV-3312 명시 |
| Technical Notes | 일반 패턴 | 실제 파일 경로, PR 번호 참조 |

---

### `/javis-stories create EUV-3299`

```
=== AI Story 생성: EUV-3299 ===

Epic 분석 완료:
- Summary: Implement Simulator Integration
- 기존 Story: 5개
- 빠진 영역 감지: Error handling, Configuration

=== 생성된 Story 초안 ===

## Story 1: Implement Error Handling for Simulator

### Description
As a developer, I want proper error handling in simulator integration 
so that failures are gracefully managed and logged.

### Acceptance Criteria
- [ ] SimulatorException 클래스 정의
- [ ] 재시도 로직 구현 (최대 3회)
- [ ] 에러 로깅 및 알림 연동
- [ ] 타임아웃 처리 (30초)

### Technical Notes
- 기존 ErrorHandler 패턴 따르기
- Sentry 연동 고려

### Story Points: 3

---

## Story 2: Add Simulator Configuration Management

### Description
As an operator, I want to configure simulator parameters 
so that I can adjust behavior without code changes.

### Acceptance Criteria
- [ ] 설정 파일 스키마 정의 (YAML)
- [ ] 런타임 설정 변경 지원
- [ ] 설정 검증 로직
- [ ] 기본값 제공

### Story Points: 2
```

## AI Story 생성 기준

### 검토 기준

- AC가 검증 가능한가?
- Story Points가 팀 velocity에 적합한가? (1-3 스프린트 내 완료)
- 의존성이 명확한가?
- 도메인 용어가 일관적인가?

### Story Points 가이드

| Points | 복잡도 | 예시 |
|--------|--------|------|
| 1 | 간단한 수정 | 문서 업데이트, 설정 변경 |
| 2 | 작은 기능 | 단일 API 엔드포인트, 유틸 함수 |
| 3 | 중간 기능 | 새 컴포넌트, 통합 작업 |
| 5 | 큰 기능 | 복잡한 비즈니스 로직 |
| 8 | 복잡한 기능 | 분할 권장 |
