# PLC Code Review Architecture Guide

This document is a unified guide referenced during CODESYS ST code reviews for the Edwards Unify Plasma project.

---

## 1. System Architecture

### 3-Layer Structure

```
Application (UnifyPackage)
    ├── Modules (CInletManager, CPlasmaSequencer, CWaterSystem, etc.)
    ├── Factory (CUnifyModuleFactory)
    └── Orchestrator (CSystemOrchestrator)

Infrastructure (Edwards.Infrastructure)
    ├── IO: CAnalogueInput, CAnalogueOutput, CDigitalInput, CDigitalOutput
    ├── Alerts: CDigitalAlert, CThresholdAlert
    ├── Valves: CValve, CGenericValve, CFeedbackValve
    └── Managers: CIOManager, CAlertManager, CValveManager, CModuleManager, CResourceManager

Core (Edwards.Infrastructure.Core)
    ├── Interfaces: IMemoryProvider, IElement, IBaseModule
    ├── Collections: LinkedList, LinkedListIterator
    └── SFC: CSFCEngine, CStep, CTransition
```

### Key Design Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| Service Provider | `CUnifyServiceProvider` | Central hub for all manager access |
| Message Broker | `CMessageBroker` | Inter-module communication (interface queries) |
| Factory | `IUnifyModuleFactory` | Module creation and registration |
| Template Method | `CUnifyBaseModule` | Common module execution pattern |
| Strategy | Normal/IntCtrl/External | Operating modes (real/simulation/external) |
| Observer | MemoryProvider | Monitoring/control data sharing |

---

## 2. Naming Conventions

### Type Prefixes

| Target | Prefix | Example |
|--------|--------|---------|
| Function Block | `C` | `CInletManager`, `CWaterSystem` |
| Interface | `I` | `IUnifyBaseModule`, `IWaterSystem` |
| Struct (TYPE) | `T` | `TConfigInletManager`, `TMonitoringWaterSystem` |
| Enum | `E` | `EControlMode`, `EWaterState` |

### Struct Category Rules

```
TConfig{ModuleName}      — Configuration struct (e.g., TConfigInletManager)
TControl{ModuleName}     — Control command struct (e.g., TControlInletManager)
TMonitoring{ModuleName}  — Status monitoring struct (e.g., TMonitoringInletManager)
TInfo{ModuleName}        — Additional info struct (e.g., TInfoPlasmaSequencer)
```

### Instance/Variable Rules

| Target | Rule | Example |
|--------|------|---------|
| Local/member variables | `_` prefix + camelCase | `_cfg`, `_monitoring`, `_control`, `_monitoringSize` |
| SFC Step | `st` prefix | `stIdle`, `stAutoRunning`, `stManualStopped` |
| SFC Transition | `t` prefix | `tIdle_To_AutoStopped` |
| Transition Flag | `_` prefix + From_To_To | `_Idle_To_AutoStopped` |

### Resource Variable Prefixes

| Prefix | Meaning | Infrastructure Class |
|--------|---------|---------------------|
| `ai` | Analogue Input | `CAnalogueInput` |
| `ao` | Analogue Output | `CAnalogueOutput` |
| `di` | Digital Input | `CDigitalInput` |
| `do` | Digital Output | `CDigitalOutput` |
| `vlv` | Valve | `CValve`, `CGenericValve` |
| `alm` | Alarm (ALARM priority) | `CThresholdAlert`, `CDigitalAlert` |
| `wrn` | Warning (WARNING priority) | `CThresholdAlert`, `CDigitalAlert` |
| `flt` | Fault | Built-in (`ai.fltSensorFault`, `vlv.fltOpenFault`) |

---

## 3. Module Lifecycle

### Required Implementation Order (9 stages)

```
1. Types Definition
   └── TConfig{Module}, TControl{Module}, TMonitoring{Module}, related Enums

2. Interface Definition
   └── I{Module} EXTENDS IUnifyBaseModule + module-specific methods

3. Class Implementation
   └── C{Module} EXTENDS CUnifyBaseModule IMPLEMENTS I{Module}

4. Required Methods
   ├── SetConfigure(cfg)       — Configuration propagation
   ├── InitializeModule(base)  — Resource registration
   ├── IsReady()               — Readiness check
   ├── ProcessControlData()    — Control data read
   ├── ProcessMonitoringData() — Monitoring data write
   ├── GetMonitoringSize()     — Monitoring size
   ├── GetControlSize()        — Control size
   └── Execute()               — THIS^() call

5. Function Block Body
   └── IF IsReady() THEN ... END_IF pattern

6. MessageBroker Registration
   └── Add variables/queries/properties to CMessageBroker

7. Factory Registration
   └── Add to CUnifyModuleFactory.CreateAndRegisterModules()

8. Config Helper Function
   └── Make{Module}Config() factory function (optional)

9. Testing
```

### Auto-Initialization Flow (ServiceProvider.AutoInitializeAllModules)

```
Stage 1: Factory.CreateAndRegisterModules()     — Module creation & ModuleManager registration
Stage 2: ModuleManager.MakeListAsArray()         — Linked list → array conversion
Stage 3: InitializeAllUnifyModules()             — Call each module's InitializeModule()
Stage 4: ResourceManager.MakeListAsArray()       — Arrayify all resources
Stage 5: ResourceManager.InitializeAllResources(memProv) — MemProvider initialization
Stage 6: ResourceManager.AutoAssignOffsets()     — Automatic Modbus address assignment
Stage 7: MessageBroker.RegisterAllModules()      — Interface query & binding
Stage 8: GetTotal...Size()                       — Total memory size calculation
```

---

## 4. Standard Execution Patterns

### Function Block Body (executed every scan cycle)

```pascal
// ---- BODY #1 ----
IF IsReady() THEN
    ProcessControlData();       // 1. Read HMI/SCADA commands
    StateMachine();             // 2. Execute state machine (module-specific logic)
    ControlAlerts();            // 3. Update alerts
    ProcessMonitoringData();    // 4. Write status data
    _monitoring.common.InService := TRUE;
ELSE
    _monitoring.common.InService := FALSE;
END_IF
```

### IsReady() Pattern

```pascal
METHOD IsReady : BOOL
    _monitoring.common.Ready := _monitoring.common.Configured AND _monitoring.common.Initialized;
    IsReady := _monitoring.common.Ready;
END_METHOD
```

### ProcessControlData() Pattern

```pascal
METHOD ProcessControlData : BOOL
    IF _base.MemProvider <> 0 AND _address.ControlOffset > 0 THEN
        _base.MemProvider.ReadControlData(
            offset := _address.ControlOffset,
            pData := ADR(_control),
            size := GetControlSize()
        );
    END_IF
END_METHOD
```

### ProcessMonitoringData() Pattern

```pascal
METHOD ProcessMonitoringData
    IF _base.MemProvider <> 0 AND _address.MonitoringOffset > 0 THEN
        _base.MemProvider.WriteMonitoringData(
            offset := _address.MonitoringOffset,
            pData := ADR(_monitoring),
            size := _monitoringSize
        );
    END_IF
END_METHOD
```

### Size Calculation Formula

```pascal
GetMonitoringSize := (SIZEOF(TMonitoring{Module}) + 1) / 2;  // WORD units
GetControlSize := (SIZEOF(TControl{Module}) + 1) / 2;
```

---

## 5. Resource Registration Rules

### Registration Order in InitializeModule()

```pascal
METHOD InitializeModule : BOOL
    VAR_INPUT
        base : IUnifyServiceProvider;
    END_VAR

    _base := base;

    // 1. IO registration (order: AI → DI/DO from valves → standalone DI/DO → AO)
    _base.IoManager.AppendIO(aiPressure);
    _base.IoManager.AppendIO(vlvMain.diOpenLimit);
    _base.IoManager.AppendIO(vlvMain.diCloseLimit);
    _base.IoManager.AppendIO(vlvMain.doOpen);

    // 2. Valve registration
    _base.ValveManager.AppendValve(vlvMain);

    // 3. Alert registration (valve faults → sensor faults → threshold alerts → digital alerts)
    _base.AlertManager.AppendAlert(vlvMain.fltOpenFault);
    _base.AlertManager.AppendAlert(vlvMain.fltCloseFault);
    _base.AlertManager.AppendAlert(aiPressure.fltSensorFault);
    _base.AlertManager.AppendAlert(almPressureHiHi);
    _base.AlertManager.AppendAlert(wrnPressureHi);

    _monitoring.common.Initialized := TRUE;
END_METHOD
```

### Common Mistakes

- Declaring a resource but not registering it → no address assigned → data exchange impossible
- Not registering Valve's internal IO (`diOpenLimit`, `diCloseLimit`, `doOpen`) to IoManager
- Not registering sensor fault alert (`ai.fltSensorFault`) to AlertManager
- Not registering valve fault alerts (`vlv.fltOpenFault`, `vlv.fltCloseFault`) to AlertManager

---

## 6. State Machine (CSFCEngine)

### Structure

```pascal
VAR
    SFCEngine : Infra.Core.CSFCEngine;
    stIdle : Infra.Core.CStep;
    stRunning : Infra.Core.CStep;
    tIdle_To_Running : Infra.Core.CTransition;
    _Idle_To_Running : BOOL;  // Transition condition flag
END_VAR
```

### Initialization Pattern

```pascal
METHOD InitializeSFCEngine
    // Step numbers must be unique
    stIdle.SetNum(1);
    stRunning.SetNum(2);

    // Add Steps to Engine
    SFCEngine.AddStep(stIdle);
    SFCEngine.AddStep(stRunning);

    // Configure Transitions
    tIdle_To_Running.SetFromStep(stIdle);
    tIdle_To_Running.SetToStep(stRunning);
    tIdle_To_Running.SetCondPtr(ADR(_Idle_To_Running));
    SFCEngine.AddTrans(tIdle_To_Running);
END_METHOD
```

### Execution Pattern

```pascal
METHOD StateMachine
    TransitionCondition();   // Update transition conditions
    SFCEngine.Execute();     // Execute engine
    ExecuteAllAction();      // Execute state-specific actions
END_METHOD
```

### Deadlock Verification Points

1. **Unreachable state**: A Step that no transition can enter
2. **Inescapable state**: A Step that no transition can exit
3. **Mutually exclusive transitions**: Multiple transitions from the same Step potentially TRUE simultaneously
4. **Circular waiting**: State A → B → A looping infinitely under certain conditions
5. **Initial state**: Whether InitializeSFCEngine() is called in FB_Init

---

## 7. Configuration Management (SetConfigure)

### Standard Pattern

```pascal
METHOD SetConfigure
    VAR_INPUT
        cfg : TConfig{Module};
    END_VAR

    _cfg := cfg;

    // Infrastructure element configuration
    aiPressure.SetConfigure(Infra.MakeAIConfig(
        name := CONCAT(_cfg.name, '.aiPressure'),
        unit := 'bar',
        minScaled := 0.0,
        maxScaled := 10.0
    ));

    vlvMain.SetConfigure(Infra.MakeGenericValveConfig(
        Fitted := TRUE,
        name := CONCAT(_cfg.name, '.vlvMain'),
        valveType := EValveType.FailClose,
        alertPriority := EAlertPriority.ALARM
    ));

    almPressureHiHi.SetConfigure(Infra.MakeThresholdAlertConfig(
        name := CONCAT(_cfg.name, '.almPressureHiHi'),
        latched := TRUE,
        priority := EAlertPriority.ALARM,
        delaytime := _cfg.delayTime,
        compareType := ECompareType.GreaterThan,
        setpoint := _cfg.spPressureHiHi
    ));

    // Alert binding
    aiPressure.BindThresholdAlerts(
        criHi := Infra.Core.NULL,
        HiHi := almPressureHiHi,
        Hi := wrnPressureHi,
        Lo := wrnPressureLo,
        LoLo := almPressureLoLo
    );

    // Size calculation
    _monitoringSize := (SIZEOF(TMonitoring{Module}) + 1) / 2;
    _monitoring.common.Configured := TRUE;
END_METHOD
```

### Config Helper Functions

| Helper | Created Type | Key Parameters |
|--------|-------------|----------------|
| `MakeAIConfig()` | `TConfigAI` | name, unit, minScaled, maxScaled, sensorType |
| `MakeAOConfig()` | `TConfigAO` | name, scaling |
| `MakeDiConfig()` | `TConfigDI` | name, invert, debounce |
| `MakeDoConfig()` | `TConfigDO` | name, invert |
| `MakeGenericValveConfig()` | `TConfigGenericValve` | Fitted, name, valveType, alertPriority, timings |
| `MakeValveConfig()` | `TConfigValve` | name, valveType |
| `MakeThresholdAlertConfig()` | `TConfigThresholdAlert` | name, latched, priority, delaytime, compareType, setpoint, hysteresis |
| `MakeDigitalAlertConfig()` | `TConfigDigitalAlert` | name, latched, priority, delaytime |

---

## 8. Valve Control Mechanisms

### Valve Types

| Type | Class | IO Configuration | Purpose |
|------|-------|-----------------|---------|
| Simple valve | `CValve` | 1 DO | On/Off control |
| Feedback valve | `CGenericValve` | DO + DI(Open) + DI(Close) | Position confirmation required |
| Divert valve | `CDivertValve` | 2 DO + 2 DI | Bidirectional switching |

### Command Handshake (cmdExist Pattern)

```
HMI → PLC:  TControlValve.cmdOpen := TRUE
PLC action: Command received → valve operation starts
PLC → HMI:  TMonitoringValve.cmdExist := TRUE
HMI → PLC:  TControlValve.cmdOpen := FALSE  (handshake confirmation)
PLC → HMI:  TMonitoringValve.cmdExist := FALSE
```

### Fail-safe Types

| Type | Behavior | Use Case |
|------|----------|----------|
| `FailClose` | Closes on power loss | Gas valves, inlet valves |
| `FailOpen` | Opens on power loss | Exhaust valves |
| `FailInPlace` | Holds current position | Regulating valves |

### Fault Detection

- **Open Fault**: diOpenLimit not detected within timeout after open command
- **Close Fault**: diCloseLimit not detected within timeout after close command
- Auto-generated: `vlv.fltOpenFault`, `vlv.fltCloseFault` (must register with AlertManager)

---

## 9. Memory Address Assignment

### 3 Memory Regions

| Region | Purpose | Direction | Start Address |
|--------|---------|-----------|---------------|
| Monitoring | Status data | PLC → HMI (read-only) | 1 |
| Control | Control commands | HMI → PLC (write-only) | 1 |
| External | Simulation/forced values | Bidirectional | 501 |

### Auto-Assignment Order

```
Monitoring: [IO] → [Valve] → [Alert] → [Module]
Control:    [Valve] → [Module]
External:   [IO]
```

### Address Verification Pattern

```pascal
// Always check before reading
IF _base.MemProvider <> 0 AND _address.ControlOffset > 0 THEN
    _base.MemProvider.ReadControlData(...);
END_IF

// Always check before writing
IF _base.MemProvider <> 0 AND _address.MonitoringOffset > 0 THEN
    _base.MemProvider.WriteMonitoringData(...);
END_IF
```

### Manual Address Assignment Prohibited

```pascal
// Never do this
_address.MonitoringOffset := 100;

// AutoAssignOffsets() handles this automatically
```

---

## 10. MessageBroker Pattern

### Purpose

Loose coupling between modules via interfaces without direct references.

### Registration Pattern

```pascal
// CMessageBroker.RegisterAllModules()
FOR i := 1 TO moduleCount DO
    module := moduleManager.GetModule(i);
    IF _waterSystem = 0 AND_THEN __QUERYINTERFACE(module, _waterSystem) THEN
        ;
    ELSIF _inletManager = 0 AND_THEN __QUERYINTERFACE(module, _inletManager) THEN
        ;
    END_IF
END_FOR
```

### Usage Pattern

```pascal
// Access through MessageBroker from other modules
IF _base.MsgBroker.WaterSystem <> 0 THEN
    // Reference WaterSystem's state
END_IF
```

### Verification Points

- Whether new modules are registered in MessageBroker (variables/queries/properties)
- Correct interface type specified in `__QUERYINTERFACE` calls
- Whether property return values reference the correct variables

---

## 11. Module List (Current Project)

| Module | Class | Role |
|--------|-------|------|
| Inlet Manager | `CInletManager` | Inlet valve control, pressure monitoring |
| Oxidizer CDA | `COxidizerCDAControl` | CDA oxidizer control |
| Oxidizer O2 | `COxidizerO2Control` | O2 oxidizer control |
| Plasma Sequencer | `CPlasmaSequencer` | Plasma ignition/extinction sequence |
| Power Modulation | `CPowerModulization` | Power level control (Level0~6) |
| Torch N2 | `CTorchN2Controller` | Torch N2 flow control |
| Water Pump | `CWaterPump` | Cooling water pump control |
| Water System | `CWaterSystem` | Integrated water system control (Strategy pattern) |
| Water Tank | `CWaterTank` | Water level monitoring |
| N2 Purge | `CN2PurgeController` | N2 purge control |
| PCW Controller | `CPCWController` | Cooling water flow control |
| Power Supply Unit | `CPowerSupplyUnit` | PSU voltage/current monitoring |
| System Orchestrator | `CSystemOrchestrator` | System-wide sequence coordination |
| TMS Controller | `CTMSController` | Temperature management system |
| Temp Control | `CTempControlElement` | PID temperature control |

---

## 12. Common Review Issues

### Safety-Related (Must-fix)

1. **Sequence deadlock**: Unable to exit a Step (cannot stop physical equipment)
2. **MemProvider unchecked**: Memory access without `_base.MemProvider <> 0` → runtime error
3. **Unregistered resources**: Declared IO/Valve/Alert not registered with Manager → no address → communication impossible
4. **Size calculation errors**: Incorrect `GetMonitoringSize()` → memory violation → data corruption
5. **Valve fail-safe mismatch**: FailClose valve with FailOpen behavior → gas leak risk
6. **Alert priority errors**: ALARM classified as WARNING → safety system non-activation

### Code Quality (Nice-to-have)

1. **Naming inconsistency**: Missing `C`/`T`/`E` prefixes
2. **Hardcoding**: Magic numbers, inline strings (should be in Config)
3. **Code duplication**: Same logic repeated across multiple modules
4. **Properties usage**: Project convention prefers Methods (Get/Set) over Properties
5. **SFC remnants**: SFC logic not converted to ST
