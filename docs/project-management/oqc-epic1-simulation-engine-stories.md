# Epic 1: Simulation Engine - User Stories

> **Epic Goal**: Build a mock environment for development and testing without physical equipment
> **Owner**: Dave Kim
> **Total Story Points**: 23

---

## Story 1: Define Common Simulator Interface

**Points**: 3 | **Priority**: High

### User Story
```
As a Gateway developer
I want a common interface that all Simulators must follow
So that new equipment types can be implemented in a consistent manner
```

### Acceptance Criteria
- [ ] `ISimulator` abstract class is defined
- [ ] `read(point: str) -> Any` method is defined
- [ ] `write(point: str, value: Any) -> bool` method is defined
- [ ] `load_config(config_path: str)` method is defined
- [ ] `get_mode() -> str` method returns current mode (physical/simulation)
- [ ] Interface documentation (docstrings) is complete

### Technical Notes
```python
from abc import ABC, abstractmethod
from typing import Any

class ISimulator(ABC):
    @abstractmethod
    def read(self, point: str) -> Any:
        """Read value from a named point"""
        pass

    @abstractmethod
    def write(self, point: str, value: Any) -> bool:
        """Write value to a named point, returns success"""
        pass

    @abstractmethod
    def load_config(self, config_path: str) -> None:
        """Load simulation configuration from file"""
        pass
```

---

## Story 2: Define Simulation Config Schema

**Points**: 2 | **Priority**: High

### User Story
```
As a Scenario engineer
I want to configure mock responses using YAML files
So that I can create various test cases without modifying code
```

### Acceptance Criteria
- [ ] YAML schema is defined and documented
- [ ] Default value can be set per point
- [ ] Value range can be set per point
- [ ] Response behavior types supported: `echo`, `random`, `sequence`, `fixed`
- [ ] Schema validation logic exists
- [ ] Clear error messages on invalid config file

### Config Schema Example
```yaml
# simulation/euv_config.yaml
product: EUV
protocol: modbus
version: "1.0"

points:
  pump_pressure:
    address: 100
    type: holding_register
    default: 0
    range: [0, 500]
    behavior: echo          # Returns written value on read

  chamber_temp:
    address: 200
    type: input_register
    default: 25.5
    behavior: random        # Random value within range
    range: [20.0, 30.0]

  alarm_status:
    address: 300
    behavior: sequence      # Cycles through defined sequence
    sequence: [0, 0, 1, 0, 0]

  system_status:
    address: 400
    behavior: fixed         # Always returns fixed value
    value: 1
```

### Behavior Types

| Behavior | Description | Required Fields |
|----------|-------------|-----------------|
| `echo` | Returns written value on read | `default` |
| `random` | Returns random value within range | `range` |
| `sequence` | Cycles through defined sequence | `sequence` |
| `fixed` | Always returns same value | `value` |

---

## Story 3: Implement EUV Simulator

**Points**: 5 | **Priority**: High

### User Story
```
As an EUV Scenario engineer (Andrew)
I want to simulate EUV equipment Modbus communication
So that I can develop and verify test scenarios without physical EUV equipment
```

### Acceptance Criteria
- [ ] `ModbusSimulator` class implements `ISimulator`
- [ ] EUV config file (`euv_config.yaml`) loads successfully
- [ ] `pump_pressure` point read/write works correctly
- [ ] `chamber_temp` point returns random values within range
- [ ] Accessing non-existent point returns appropriate error
- [ ] Unit tests are written with >80% coverage

### Test Cases
```python
def test_euv_echo_behavior():
    """Written value should be returned on read"""
    sim = ModbusSimulator()
    sim.load_config("simulation/euv_config.yaml")

    sim.write("pump_pressure", 100)
    assert sim.read("pump_pressure") == 100

def test_euv_random_behavior():
    """Random behavior should return value within range"""
    sim = ModbusSimulator()
    sim.load_config("simulation/euv_config.yaml")

    value = sim.read("chamber_temp")
    assert 20.0 <= value <= 30.0

def test_euv_invalid_point():
    """Accessing invalid point should raise error"""
    sim = ModbusSimulator()
    sim.load_config("simulation/euv_config.yaml")

    with pytest.raises(PointNotFoundError):
        sim.read("invalid_point")
```

---

## Story 4: Implement Abatement Simulator

**Points**: 5 | **Priority**: Medium

### User Story
```
As an Abatement Scenario engineer (Daniel, Seokwon)
I want to simulate Abatement equipment communication
So that I can develop test scenarios without physical Abatement equipment
```

### Acceptance Criteria
- [ ] Abatement Simulator class implements `ISimulator`
- [ ] Abatement config file (`abatement_config.yaml`) is defined
- [ ] Abatement-specific points are defined (gas_flow, burn_temp, etc.)
- [ ] PLF protocol characteristics are reflected (if applicable)
- [ ] Unit tests are written with >80% coverage

### Config Example
```yaml
# simulation/abatement_config.yaml
product: Abatement
protocol: plf

points:
  gas_flow:
    address: 100
    default: 0
    range: [0, 100]
    behavior: echo
    unit: "L/min"

  burn_temp:
    address: 200
    default: 800
    range: [700, 900]
    behavior: random
    unit: "°C"

  inlet_pressure:
    address: 300
    default: 1.0
    range: [0.5, 2.0]
    behavior: echo
    unit: "bar"
```

---

## Story 5: Implement Vacuum Pump Simulator

**Points**: 5 | **Priority**: Medium

### User Story
```
As a Vacuum Pump Scenario engineer (Jess)
I want to simulate Vacuum Pump equipment communication
So that I can develop test scenarios without physical Vacuum Pump equipment
```

### Acceptance Criteria
- [ ] Vacuum Pump Simulator implements `ISimulator`
- [ ] Vacuum Pump config file (`vacuum_pump_config.yaml`) is defined
- [ ] Vacuum Pump-specific points are defined (rotation_speed, vacuum_level, etc.)
- [ ] Works with Modbus protocol
- [ ] Unit tests are written with >80% coverage

### Config Example
```yaml
# simulation/vacuum_pump_config.yaml
product: VacuumPump
protocol: modbus

points:
  rotation_speed:
    address: 100
    type: holding_register
    default: 0
    range: [0, 3000]
    behavior: echo
    unit: "RPM"

  vacuum_level:
    address: 200
    type: input_register
    default: 760
    range: [0, 760]
    behavior: echo
    unit: "Torr"

  motor_temp:
    address: 300
    type: input_register
    default: 35
    range: [30, 80]
    behavior: random
    unit: "°C"

  status:
    address: 400
    behavior: fixed
    value: 1  # 1=running, 0=stopped
```

---

## Story 6: Implement Mode Switcher API

**Points**: 3 | **Priority**: High

### User Story
```
As a Test engineer
I want to switch between Physical and Simulation modes via API
So that I can run the same scenario on both real equipment and simulation environment
```

### Acceptance Criteria
- [ ] `POST /gateway/mode` API is implemented
- [ ] `GET /gateway/mode` API returns current mode
- [ ] Existing connections are safely closed on mode switch
- [ ] Simulation mode does not attempt physical equipment connection
- [ ] Mode switch events are logged
- [ ] Invalid mode value returns 400 error

### API Design

**Change Mode**
```http
POST /gateway/mode
Content-Type: application/json

{
  "mode": "simulation",  // "simulation" | "physical"
  "product": "EUV"       // optional, switch specific product only
}

Response 200:
{
  "success": true,
  "previous_mode": "physical",
  "current_mode": "simulation",
  "affected_products": ["EUV"]
}
```

**Get Current Mode**
```http
GET /gateway/mode

Response 200:
{
  "global_mode": "simulation",
  "products": {
    "EUV": "simulation",
    "Abatement": "simulation",
    "VacuumPump": "physical"
  }
}
```

### Gherkin Step Integration
```gherkin
Given the system is in "simulation" mode
# → POST /gateway/mode {"mode": "simulation"}

Given the system is in "physical" mode
# → POST /gateway/mode {"mode": "physical"}

Given product "EUV" is in "simulation" mode
# → POST /gateway/mode {"mode": "simulation", "product": "EUV"}
```

---

## Dependency Diagram

```
┌─────────────────────┐
│ Story 1: Interface  │ ──────────────────────────┐
└─────────────────────┘                           │
          │                                       │
          ▼                                       ▼
┌─────────────────────┐                 ┌─────────────────────┐
│ Story 2: Config     │                 │ Story 6: Mode       │
│ Schema              │                 │ Switcher            │
└─────────────────────┘                 └─────────────────────┘
          │
          ├──────────────────┬──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Story 3: EUV    │ │ Story 4:        │ │ Story 5: Vacuum │
│ Simulator       │ │ Abatement Sim   │ │ Pump Simulator  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Sprint Plan

### Sprint 1 (Week 1)
| Story | Points | Owner |
|-------|--------|-------|
| Story 1: Define Common Simulator Interface | 3 | Dave |
| Story 2: Define Simulation Config Schema | 2 | Dave |
| Story 6: Implement Mode Switcher API | 3 | Dave |
| **Total** | **8** | |

### Sprint 2 (Week 2)
| Story | Points | Owner |
|-------|--------|-------|
| Story 3: Implement EUV Simulator | 5 | Dave |
| Story 4: Implement Abatement Simulator | 5 | Dave |
| Story 5: Implement Vacuum Pump Simulator | 5 | Dave |
| **Total** | **15** | |

---

## Definition of Done (Epic Level)

- [ ] All Stories completed
- [ ] 3 product Simulators (EUV, Abatement, Vacuum Pump) are functional
- [ ] Simulation mode returns mock responses for read/write API calls
- [ ] Mode Switcher allows Physical ↔ Simulation transition
- [ ] Unit test coverage > 80%
- [ ] API documentation is complete
