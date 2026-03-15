# PLC (CODESYS ST) Review Rubric Guide & Output Format

## Target Platform

- **IDE**: CODESYS V3.5
- **Language**: Structured Text (ST)
- **Framework**: Edwards Infrastructure Library V2.0
- **Architecture**: Core → Infrastructure → Application 3-Layer

---

## Review Perspectives (10)

Analyze the diff from each perspective and classify findings with the tags below.

### 1. Naming Convention `[Naming]`

Verifies compliance with project naming rules.

- **Function Block**: `C` prefix + PascalCase (e.g., `CInletManager`, `CWaterSystem`)
- **Interface**: `I` prefix + PascalCase (e.g., `IUnifyBaseModule`, `IWaterSystem`)
- **Struct**: `T` prefix + PascalCase (e.g., `TConfigInletManager`, `TMonitoringWaterSystem`)
  - Config struct: `TConfig{ModuleName}`
  - Control struct: `TControl{ModuleName}`
  - Monitoring struct: `TMonitoring{ModuleName}`
- **Enum**: `E` prefix + PascalCase (e.g., `EControlMode`, `EWaterState`)
- **Instance variables**: `_` prefix + camelCase (e.g., `_cfg`, `_monitoring`, `_control`)
- **Resource variable prefixes**:
  - `ai` - Analogue Input
  - `ao` - Analogue Output
  - `di` - Digital Input
  - `do` - Digital Output
  - `vlv` - Valve
  - `alm` - Alarm (ALARM priority)
  - `wrn` - Warning (WARNING priority)
  - `flt` - Fault
- **SFC elements**: `st` prefix (Step), `t` prefix (Transition)

### 2. Module Architecture `[Architecture]`

Verifies compliance with Infrastructure architecture patterns.

- `CUnifyBaseModule` inheritance
- `IUnifyBaseModule` interface implementation
- Module lifecycle stage completeness:
  1. Types definition (TConfig, TControl, TMonitoring)
  2. Interface definition
  3. Class implementation (EXTENDS + IMPLEMENTS)
  4. Resource registration (in InitializeModule)
  5. MessageBroker registration
  6. Factory registration
  7. Config Helper functions
- Service Provider pattern usage
- Memory Provider pattern usage

### 3. State Machine `[StateMachine]`

Verifies safety of sequence logic and state machines.

- **Deadlock detection**:
  - Unreachable states (missing incoming transitions)
  - Inescapable states (missing outgoing transitions)
  - Circular dependencies (circular waiting conditions)
- **CSFCEngine patterns**:
  - Step number uniqueness
  - Transition condition completeness (can every state be exited?)
  - `SetCondPtr(ADR(...))` pointer validity
- **State transition conditions**:
  - Mutually exclusive transition condition verification
  - Non-deterministic transition potential (multiple transition conditions true simultaneously)
- **Timer safety**:
  - TON/TOF timer reset omissions
  - Timer condition and state transition consistency

### 4. Memory Management `[Memory]`

Verifies correctness of memory management patterns.

- **TAddress struct**:
  - Correct assignment of MonitoringOffset, ControlOffset, ExternalOffset
  - `MakeListAsArray()` called before `AutoAssignOffsets()`
- **Size calculations**:
  - `GetMonitoringSize()`: `(SIZEOF(TMonitoring...) + 1) / 2` formula
  - `GetControlSize()`: `(SIZEOF(TControl...) + 1) / 2` formula
- **MemProvider safety**:
  - `_base.MemProvider <> 0` check before use
  - `_address.MonitoringOffset > 0` check before use
- **Pointer usage**:
  - Lifetime of target variables when using `ADR()`
  - Prefer static memory allocation over dynamic allocation

### 5. Resource Registration `[Registration]`

Verifies completeness of resource registration.

- **IO registration** (in `InitializeModule`):
  - All `CAnalogueInput` → `_base.IoManager.AppendIO()`
  - All `CAnalogueOutput` → `_base.IoManager.AppendIO()`
  - All `CDigitalInput` → `_base.IoManager.AppendIO()`
  - All `CDigitalOutput` → `_base.IoManager.AppendIO()`
  - Valve internal IO: `vlv.diOpenLimit`, `vlv.diCloseLimit`, `vlv.doOpen`
- **Valve registration**: `_base.ValveManager.AppendValve()`
- **Alert registration**: `_base.AlertManager.AppendAlert()`
  - Threshold alerts
  - Digital alerts
  - Sensor faults: `ai.fltSensorFault`
  - Valve faults: `vlv.fltOpenFault`, `vlv.fltCloseFault`
- **Registration order**: IO → Valve → Alert → Module (order matters)
- **Omission detection**: Compare declared resources vs registered resources

### 6. Execution Pattern `[Execution]`

Verifies compliance with standard execution patterns.

- **Function Block Body pattern**:
  ```
  IF IsReady() THEN
      ProcessControlData();
      StateMachine();        // or module-specific logic
      ControlAlerts();
      ProcessMonitoringData();
      _monitoring.common.InService := TRUE;
  ELSE
      _monitoring.common.InService := FALSE;
  END_IF
  ```
- **Execute() method**: `THIS^()` call
- **IsReady() implementation**: `Configured AND Initialized` check
- **ProcessControlData()**: MemProvider read pattern
- **ProcessMonitoringData()**: MemProvider write pattern

### 7. Configuration `[Config]`

Verifies configuration management patterns.

- **TConfig struct separation**: Config values in a separate TYPE
- **SetConfigure() method**:
  - Configuration propagation to all child Infrastructure elements
  - Use of `MakeAIConfig()`, `MakeGenericValveConfig()`, etc. helpers
  - `BindThresholdAlerts()` call
  - `_monitoringSize` calculation
  - `_monitoring.common.Configured := TRUE` setting
- **Config Helper functions**: `Make{Element}Config()` factory functions existence
- **Config value validity**: Range validation, default value handling

### 8. Valve Command `[Valve]`

Verifies safety of valve control patterns.

- **cmdExist handshake**: Command → cmdExist confirmation → command release pattern
- **Valve type handling**:
  - CValve: Simple DO output
  - CGenericValve: Open/Close limit + timer-based fault detection
  - CFeedbackValve: Feedback-based control
- **Mode switching safety**:
  - Manual → Auto: valve state handling
  - Auto → Manual: output hold/reset policy
- **Fail-safe**: FailClose/FailOpen settings match actual behavior

### 9. Alert Safety `[Alert]`

Verifies safety of the alert/alarm system.

- **Priority consistency**: Appropriate ALARM vs WARNING classification
- **Latched alerts**: Reset mechanism exists when latched is set
- **Delay times**: Appropriateness of delayTime settings
- **Threshold alerts**:
  - CompareType (GreaterThan/LessThan) accuracy
  - Setpoint value rationality (HiHi > Hi > Lo > LoLo)
  - Hysteresis settings
- **Sensor fault and alert linkage**: Correct `BindThresholdAlerts()` binding

### 10. Testing `[Testing]`

Verifies testability and test code.

- **Simulation mode**: IntCtrl/External mode support
- **Interface-based design**: Test double injection capability
- **State observation**: State verification through Monitoring struct
- **Boundary value testing**: Behavior at scaling and setpoint boundaries
- **Unit test existence**: Test code for critical logic

---

## Classification Criteria

### "Must-fix before merge" (Must-fix)

Meets one of the following:
- **Safety risk**: Sequence deadlocks, valve control errors, missing alerts
- **Memory errors**: Incorrect size calculations, offset collisions, MemProvider unchecked
- **Architecture violations**: Unregistered resources, non-compliance with standard patterns
- **Data integrity**: State machine inconsistencies, missing configuration propagation

### "Suggested improvements" (Nice-to-have)

Meets one of the following:
- Naming convention inconsistencies (no functional impact)
- Code duplication / refactoring opportunities
- Test coverage enhancements
- Performance improvement opportunities
- Insufficient documentation

## Verdict Criteria

| Verdict | Condition |
|---------|-----------|
| **APPROVED** | No "must-fix" items |
| **APPROVED with suggestions** | No "must-fix" items, but "suggested improvements" exist |
| **CHANGES REQUESTED** | 1 or more "must-fix" items |

---

## Output Format

```markdown
## PR #{id} PLC Code Review: {title}

**Repo**: {workspace}/{repo}
**Branch**: {source} → {target}
**Author**: {author}
**Date**: {date}
**Domain**: PLC / CODESYS ST

---

### Change Summary

{2-3 sentence summary of what this PR does}

---

### Must-fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [StateMachine] | `CMyModule.st:142` | Description |
| 2 | [Memory] | `CMyModule.st:89` | Description |

{Detailed explanation and fix suggestion for each item}

---

### Suggested Improvements

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Naming] | `CMyModule.st:15` | Description |
| 2 | [Testing] | Overall | Description |

{Detailed explanation and fix suggestion for each item}

---

### Well Done

- {Commendable implementation decisions or pattern compliance}
- {Safe sequence design or appropriate alert configuration}

---

### Final Verdict

**APPROVED / APPROVED with suggestions / CHANGES REQUESTED**

{1-2 sentence rationale}
```

---

## Review Writing Principles

1. **PLC safety first**: Sequence deadlocks, valve malfunctions, and memory violations can lead to physical equipment damage — review these with top priority.
2. **Infrastructure pattern compliance**: Verify consistency against V2.0 architecture patterns.
3. **Be specific**: Always include file names and line numbers.
4. **Provide evidence**: Explain why it's a problem and under what conditions it occurs.
5. **Suggest alternatives**: Suggest fixes with standard pattern code examples.
6. **Stay balanced**: Mention what was done well, not just issues.
