# OQC Digitalization - Milestone 1: The Walking Skeleton

> February 목표: Simulation Mode에서 Hello World 시나리오 실행 → 결과가 Server Dashboard에 표시

## 현재 상태

| 구분 | 상태 |
|------|------|
| Gateway REST-ification | Done (Modbus, PLF, Hostlink 각각 분리된 API) |
| BDD Step Layers | Done (raw call 방식 - POST /modbus/write 등) |
| Server JWT Auth | Done |
| Dashboard | 목업 있음, 샘플 데이터, JWT 기반 사용자별 화면 구성됨 |

## 팀 구성

| 담당자 | 역할 | M/M |
|--------|------|-----|
| Dhananjay | Technical PM | 0.5 |
| Bipin | Fullstack (Server Backend/Frontend, DB, CI/CD) | 1.0 |
| Owen Rim | Edge/Frontend | 1.0 |
| Dave Kim | Gateway/API (Bridge 담당) | 1.0 |
| Andrew Oh | Scenario Engineer (EUV) | - |
| Jess Kim | Scenario Engineer (Vacuum Pump) | - |
| Daniel Choi | Scenario Engineer (Abatement) | - |
| Seokwon Yu | Scenario Engineer (Abatement) | - |
| GECIA PLC Engineer | 시나리오 개발/검증 | 1.0 |

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│ Edge                                                            │
│ ┌──────────┐  ┌─────────────────────────────┐  ┌─────────────┐ │
│ │ React FE │──│ Gateway (Modbus/PLF/Hostlink│──│ BDD (Python │ │
│ │          │  │  → REST)                    │  │   Behave)   │ │
│ └──────────┘  └─────────────────────────────┘  └─────────────┘ │
│                            │                          │         │
│                      ┌─────┴─────┐                    │         │
│                      │  SQLite3  │────────────────────┘         │
│                      └───────────┘                              │
└────────────────────────────┬────────────────────────────────────┘
                             │ The Bridge (Sync API)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server                                                          │
│ ┌──────────┐  ┌─────────────┐  ┌──────────────┐                │
│ │ FastAPI  │──│ PostgreSQL  │──│ React        │                │
│ │          │  │             │  │ Dashboard    │                │
│ └──────────┘  └─────────────┘  └──────────────┘                │
│                      │                                          │
│                ┌─────┴─────┐                                    │
│                │Azure Blob │                                    │
│                └───────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 단일 추상화 API 제안

### 현재 상태 (L0)
```
Gherkin Step → POST /modbus/write(fc, addr, value)
             → POST /hostlink/write(memtype, addr, value)
             → POST /plf/write(...)
```

### 제안하는 추상화 (L1)
```
Gherkin Step → equipment.write(point_id, value)
                    ↓
             Protocol Router (설정 기반)
                    ↓
             Modbus / PLF / Hostlink Adapter
```

### 추상화 레벨 비교

| 레벨 | 예시 | Milestone 1 |
|------|------|-------------|
| L0 (현재) | `POST /modbus/write` | - |
| **L1 (최소)** | `equipment.io(product, point, value)` | **권장** |
| L2 (완전) | `Set_Pump_Speed(100)` | Phase 2+ |

> L1만 해도 Gherkin이 프로토콜 독립적이 되고, description metadata 없이도 동작합니다.

---

## Epic 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     The Walking Skeleton (February)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Epic 1          │  │ Epic 2          │  │ Epic 3          │              │
│  │ Simulation      │  │ Protocol        │  │ Local           │  Week 1-2   │
│  │ Engine          │  │ Abstraction     │  │ Persistence     │  (병렬)     │
│  │ (Dave)          │  │ (Dave)          │  │ (Owen)          │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ Epic 4: Hello World Scenarios (Week 2-3)                    │            │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │            │
│  │ │ EUV         │ │ Abatement   │ │ Vacuum Pump │             │            │
│  │ │ (Andrew)    │ │ (Daniel)    │ │ (Jess)      │             │            │
│  │ └─────────────┘ └─────────────┘ └─────────────┘             │            │
│  │                      ↑ Support: Akshay (온보딩 후 확장)      │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                │                                            │
│           ┌────────────────────┼────────────────────┐                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Epic 5          │  │ Epic 6          │  │ Epic 7          │  Week 3-4   │
│  │ The Bridge      │  │ Edge FE         │  │ Dashboard       │              │
│  │ (Bipin)         │  │ Enhancement     │  │ Integration     │              │
│  │                 │  │ (Owen)          │  │ (Bipin)         │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                       │
│           └────────────────────┴────────────────────┘                       │
│                                │                                            │
│                                ▼                                            │
│                          ✅ DoD 검증                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Epic 상세

### Epic 1: Simulation Engine

**담당**: Dave Kim
**목표**: 장비 없이 개발/테스트 가능한 Mock 환경
**의존성**: 없음 (병렬 시작 가능)

| Story | 설명 | Points |
|-------|------|--------|
| Simulator 공통 인터페이스 | ISimulator 추상 클래스 정의 | 3 |
| Simulation Config Schema | YAML/JSON 기반 mock 응답 설정 구조 | 2 |
| EUV Simulator | EUV 장비 모사 (설정 기반 응답) | 5 |
| Abatement Simulator | Abatement 장비 모사 | 5 |
| Vacuum Pump Simulator | Vacuum Pump 장비 모사 | 5 |
| Mode Switcher | Physical ↔ Simulation 전환 API | 3 |

**Simulation Config 예시:**
```yaml
# simulation/euv_config.yaml
product: EUV
protocol: modbus
points:
  pump_pressure:
    address: 100
    type: holding_register
    default: 0
    range: [0, 500]
    behavior: echo  # write한 값을 그대로 read

  chamber_temp:
    address: 200
    type: input_register
    default: 25.5
    behavior: random  # range 내 랜덤값
    range: [20.0, 30.0]

  alarm_status:
    address: 300
    behavior: sequence  # 정의된 시퀀스대로
    sequence: [0, 0, 1, 0, 0]
```

**공통 추상화 구조:**
```python
class ISimulator(ABC):
    @abstractmethod
    def read(self, point: str) -> Any: ...

    @abstractmethod
    def write(self, point: str, value: Any) -> bool: ...

    @abstractmethod
    def load_config(self, config_path: str): ...

class ModbusSimulator(ISimulator):
    """EUV, Vacuum Pump용"""

class PLFSimulator(ISimulator):
    """Abatement용 (if different)"""
```

**DoD**: Simulation 모드에서 read/write 호출 시 mock 응답 반환

---

### Epic 2: Protocol Abstraction Layer

**담당**: Dave Kim
**목표**: Gherkin이 프로토콜에 독립적으로 동작
**의존성**: Epic 1과 병렬 가능

| Story | 설명 | Points |
|-------|------|--------|
| 통합 Equipment API 설계 | /equipment/io 단일 엔드포인트 | 3 |
| Product Registry | 제품-프로토콜 매핑 관리 | 2 |
| Protocol Router | 설정 기반 adapter 라우팅 | 5 |
| BDD Step 공통화 | equipment_steps.py 통합 step | 3 |

**API 설계:**
```python
# POST /equipment/io
{
  "product": "EUV",           # 제품 식별
  "point": "pump_pressure",   # 논리적 포인트명
  "action": "read" | "write",
  "value": 100,               # write시
  "mode": "simulation"        # optional, default=physical
}

# Response
{
  "success": true,
  "value": 100,
  "timestamp": "2026-02-15T10:00:00Z",
  "mode": "simulation"
}
```

**Before (raw):**
```
POST /modbus/write {"fc": 6, "addr": 100, "value": 50}
```

**After (L1 abstraction):**
```json
POST /equipment/io {
  "product": "EUV",
  "point": "pump_pressure",
  "action": "write",
  "value": 50
}
```

---

### Epic 3: Local Persistence & State

**담당**: Owen Rim
**목표**: 오프라인 실행 결과 안전하게 저장
**의존성**: 없음 (병렬 시작 가능)

| Story | 설명 | Points |
|-------|------|--------|
| SQLite Schema 설계 | executions, results, sync_queue | 3 |
| Execution Tracker | 시작/종료/상태 기록 | 3 |
| Step Result Logger | step별 pass/fail 기록 | 3 |
| Sync Queue Manager | 동기화 대기 데이터 관리 | 2 |
| Immutable Fields | started_at, operator 변경 불가 처리 | 2 |

**스키마 예시:**
```sql
CREATE TABLE test_executions (
  id TEXT PRIMARY KEY,
  scenario_name TEXT,
  product TEXT,
  operator TEXT,
  started_at DATETIME,
  ended_at DATETIME,
  status TEXT, -- running, passed, failed
  synced_at DATETIME  -- NULL if not synced
);
```

---

### Epic 4: Hello World Scenarios

**담당**: Andrew (EUV), Daniel (Abatement), Jess (Vacuum Pump)
**Support**: Akshay (온보딩 → 확장)
**목표**: 각 제품별 기본 시나리오 검증
**의존성**: Epic 1, 2 완료 후

| Story | 담당 | 설명 |
|-------|------|------|
| Gherkin 템플릿 & 가이드 | Akshay | 시나리오 작성 표준 문서 |
| EUV Hello World | Andrew | 기본 read/write 사이클 |
| Abatement Hello World | Daniel | 기본 read/write 사이클 |
| Vacuum Pump Hello World | Jess | 기본 read/write 사이클 |
| Step Definition 공통화 | Akshay | 3개 시나리오의 공통 step 추출 |

**시나리오 템플릿:**
```gherkin
# features/hello_world_euv.feature
@product:EUV @simulation
Feature: EUV Basic Communication Test
  As a QC engineer
  I want to verify basic equipment communication
  So that I can ensure the test infrastructure works

  Background:
    Given the system is in "simulation" mode
    And I select product "EUV"

  Scenario: Basic read/write cycle
    When I write "100" to "pump_pressure"
    Then reading "pump_pressure" should return "100"

  Scenario: Verify default values
    When I read "chamber_temp"
    Then the value should be within "20" and "30"
```

**온보딩 플로우:**
- **Week 1**: Akshay - Behave/Gherkin 기초 학습 / Andrew/Daniel/Jess - 도메인별 테스트 포인트 정의
- **Week 2**: Andrew/Daniel/Jess - 각자 Hello World 작성 (Akshay 페어링) / Akshay - 공통 step 추출 및 정리
- **Week 3+**: Akshay - 패턴 기반으로 추가 시나리오 확장

---

### Epic 5: The Bridge (Sync API)

**담당**: Bipin
**목표**: Edge → Server 데이터 동기화
**의존성**: Epic 3 (Local Persistence 스키마 확정 후)

| Story | 설명 | Points |
|-------|------|--------|
| Sync API 엔드포인트 | POST /api/sync/executions | 3 |
| Bulk Insert 처리 | 다건 결과 효율적 저장 | 3 |
| Idempotent 처리 | 중복 sync 방지 (execution_id 기반) | 2 |
| Sync Status 트래킹 | Edge에서 sync 완료 여부 확인 | 2 |

**API 예시:**
```json
POST /api/sync/results
{
  "executions": [
    {
      "id": "exec-001",
      "scenario_name": "Hello World",
      "product": "EUV",
      "operator": "andrew.oh",
      "started_at": "2026-02-15T10:00:00Z",
      "ended_at": "2026-02-15T10:05:00Z",
      "status": "passed",
      "results": [...]
    }
  ]
}
```

---

### Epic 6: Edge FE Enhancement

**담당**: Owen Rim
**목표**: 테스터 워크플로우 개선

| Story | 설명 | Points |
|-------|------|--------|
| Product/Scenario Browser | 제품별 시나리오 패키지 탐색 UI | 5 |
| Execution Monitor | 현재 실행 중인 테스트 실시간 표시 | 5 |
| Result Summary View | CLI 출력 → 구조화된 결과 뷰 | 3 |
| Mode Indicator | Physical/Simulation 모드 명확히 표시 | 2 |

**UI 와이어프레임:**
```
┌─────────────────────────────────────────────────────────┐
│  🔧 OQC Test Runner           [Simulation Mode] 🟡      │
├─────────────────────────────────────────────────────────┤
│  Products          │  Scenarios                        │
│  ┌───────────────┐ │  ┌─────────────────────────────┐  │
│  │ ▶ EUV        │ │  │ 📋 Hello World              │  │
│  │   Abatement   │ │  │ 📋 Pump Calibration        │  │
│  │   Vacuum Pump │ │  │ 📋 Full Sequence Test      │  │
│  └───────────────┘ │  └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ▶ Running: Hello World (EUV)         [Step 2/5]       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ Step 1: Connect to equipment                 │   │
│  │ 🔄 Step 2: Write pump_pressure = 100            │   │
│  │ ⬜ Step 3: Read pump_pressure                   │   │
│  │ ⬜ Step 4: Verify value                         │   │
│  │ ⬜ Step 5: Save result                          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

### Epic 7: Dashboard Integration

**담당**: Bipin
**목표**: 동기화된 결과를 Server에서 확인
**의존성**: Epic 5 완료 후

| Story | 설명 | Points |
|-------|------|--------|
| Execution List View | 제품/날짜/상태별 필터링 | 3 |
| Execution Detail View | step별 결과, 메타데이터 | 3 |
| Real-time Update | 새 결과 도착 시 알림/갱신 | 2 |

---

## 타임라인 (February)

| Week | 작업 | 담당자 |
|------|------|--------|
| **Week 1-2** | Epic 1, 2, 3 병렬 진행 | Dave: Simulation + Abstraction, Owen: Local Persistence, Bipin: Sync API 설계 시작 |
| **Week 2-3** | Epic 4 (Hello World Scenario) | Andrew/Daniel/Jess: Gherkin 작성 + Step 구현 |
| **Week 3-4** | Epic 5, 6, 7 (Bridge + Edge FE + Dashboard) | Bipin: 동기화 구현 + Dashboard 연동, Owen: Edge FE |
| **Week 4** | E2E 통합 테스트 + DoD 검증 | 전원 |

---

## 담당자별 워크로드

| 담당자 | Epic | Week 1-2 | Week 3-4 |
|--------|------|----------|----------|
| Dave | 1, 2 | Simulation + Abstraction | 시나리오 연동 지원 |
| Owen | 3, 6 | Local Persistence | Edge FE Enhancement |
| Bipin | 5, 7 | Sync API 설계/구현 | Dashboard Integration |
| Andrew | 4 | 도메인 포인트 정의 | EUV 시나리오 작성 |
| Daniel | 4 | 도메인 포인트 정의 | Abatement 시나리오 |
| Jess | 4 | 도메인 포인트 정의 | Vacuum Pump 시나리오 |
| Akshay | 4 | Behave 온보딩 | 공통 step 정리 + 확장 |
| Dhananjay | - | Jira 관리, 리뷰 | E2E 검증 조율 |

---

## DoD 검증 체크리스트

- [ ] Simulation Mode에서 EUV Hello World 실행 성공
- [ ] Simulation Mode에서 Abatement Hello World 실행 성공
- [ ] Simulation Mode에서 Vacuum Pump Hello World 실행 성공
- [ ] 실행 결과가 Edge SQLite에 저장됨
- [ ] Edge FE에서 실행 진행 상황 확인 가능
- [ ] Sync API로 결과가 Server PostgreSQL에 전송됨
- [ ] Server Dashboard에서 3개 제품 결과 모두 확인 가능
