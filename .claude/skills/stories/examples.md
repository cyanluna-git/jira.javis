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

### `/javis-stories add` 예시

**입력:**
```
/javis-stories add OQC에 유저스토리를 추가하고 싶어.
지금 Gateway REST API까지 있는데.
PLC 연결 상태를 실시간으로 모니터링하는 UI가 필요해.
그러면 운영자가 장비 상태를 한눈에 파악할 수 있어.
```

**출력:**
```markdown
## Story: Add Real-time PLC Connection Status Dashboard

**Epic**: EUV-3301 (Gateway Integration)
**Labels**: `frontend`, `plc`
**Project**: OQC

### Description
As an operator, I want to see real-time PLC connection status on a dashboard
so that I can monitor equipment health at a glance.

### Acceptance Criteria
- [ ] 연결된 PLC 목록 표시 (IP, 포트, 프로토콜)
- [ ] 연결 상태 표시 (Connected/Disconnected/Error)
- [ ] 상태 변경 시 실시간 업데이트 (WebSocket 또는 polling)
- [ ] 연결 실패 시 알림 표시
- [ ] 최근 5분간 통신 성공률 표시

### Technical Notes
- 기존 Gateway /api/status 엔드포인트 활용
- React Query로 polling (5초 간격)
- Recharts로 통신 성공률 그래프

### Story Points: 3

---
저장 위치: docs/stories/EUV-3301-stories.md
```

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
