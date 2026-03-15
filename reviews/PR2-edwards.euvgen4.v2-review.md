## PR #2 PLC Design Review: Feature/scaled sprint16/EUV-3392 — Foundation Application

**Repo**: ac-avi/edwards.euvgen4.v2
**Branch**: feature/scaled-sprint16/EUV-3392-create-foundation-application → feature/scaled-sprint16/main
**Author**: Prakashbhai Koladiya
**Date**: 2026-03-05
**Domain**: PLC / CODESYS ST — Design Review (New Creation)
**Focus**: Infrastructure Harness Compliance · OOP Modularity

---

### Change Summary

This PR creates the first foundation of the `euv.vizeon` application from scratch, replacing the legacy `euv.gen4.tumalo` project. It establishes the full module scaffold for an EUV Vizeon facility control system, including:

- **App layer** (`euv.vizeon.app.v2.ST`): `Main` program, `CApp`, `CFacility` (the new unit-of-execution, equivalent to the old `CUnifyUnit`)
- **Package layer** (`euv.vizeon.package.v2.ST`): ~35 module type definitions, all interfaces, `CServiceProvider`, `CMessageBroker`, `CBaseModule`, and concrete module implementations (`CVacuumPump` being the most complete)

The infrastructure harness (ServiceProvider, AutoInitializeAllModules, ResourceManager, MemoryProvider pattern) has been successfully ported from the Unify architecture to the new Vizeon namespace. `CVacuumPump` is the reference implementation demonstrating the expected full-lifecycle pattern.

---

### Must-fix Before Merge

| # | Type | File | Location | Description |
|---|------|------|----------|-------------|
| 1 | [Memory] | `euv.vizeon.package.v2.ST` | `CVacuumPump.FB_Init` | `_controlSize` initialized with raw `SIZEOF()` (bytes), never corrected to WORD units |
| 2 | [Memory] | `euv.vizeon.package.v2.ST` | All stub modules (CSliceGroupControl, CBDMControl, etc.) | `_monitoringSize` and `_controlSize` never calculated in `SetConfigure` → return 0 |
| 3 | [Architecture] | `euv.vizeon.package.v2.ST` | `CMessageBroker.RegisterAllModules` | Loop is empty — no `__QUERYINTERFACE` bindings → all inter-module communication broken |
| 4 | [Memory] | `euv.vizeon.package.v2.ST` | `CH2DSystem` VAR | `_control` declared as `TControlH2D_LH` instead of `TControlH2DSystem` — wrong struct type |
| 5 | [Execution] | `euv.vizeon.package.v2.ST` | All modules | Standard FB body pattern missing `ProcessControlData()`, `ProcessMonitoringData()`, `InService` |
| 6 | [Architecture] | `euv.vizeon.app.v2.ST` | `CFacility` body | Direct access to private `_base._resourceManager._alertManager()` — encapsulation violation |

---

#### 1. [Memory] `CVacuumPump._controlSize` — Raw `SIZEOF()` vs WORD Unit

**Location**: `euv.vizeon.package.v2.ST`, `CVacuumPump.FB_Init`

```pascal
// FB_Init (WRONG — byte count, not WORD count)
_monitoringSize := SIZEOF(_monitoring);  // bytes
_controlSize    := SIZEOF(_control);     // bytes

// SetConfigure (CORRECT — word count, overwrites _monitoringSize only)
_monitoringSize := (SIZEOF(TMonitoringVacuumPump) + 1) / 2;  // WORDs ✓
// _controlSize is NEVER corrected here!
```

The Memory Provider operates in WORD (16-bit) units. `SIZEOF()` returns bytes. Passing byte count where WORDs are expected causes `ReadControlData` to read **double** the intended data, corrupting the memory region.

`_monitoringSize` gets corrected in `SetConfigure` (good), but `_controlSize` remains as the raw byte count from `FB_Init`. This means:
- `ProcessControlData` reads `SIZEOF(TControlVacuumPump)` bytes where `(SIZEOF+1)/2` WORDs are expected
- Control commands from HMI will be misinterpreted

**Fix**: Remove size initialization from `FB_Init`. Calculate both sizes consistently in `SetConfigure`:
```pascal
// SetConfigure
_monitoringSize := (SIZEOF(TMonitoringVacuumPump) + 1) / 2;
_controlSize    := (SIZEOF(TControlVacuumPump) + 1) / 2;      // ← add this
_monitoring.common.Configured := TRUE;
```

---

#### 2. [Memory] `_monitoringSize` / `_controlSize` = 0 in Stub Modules

**Location**: All stub modules — `CSliceGroupControl`, `CBDMControl`, `CHRSControl`, `CO2Sensor`, `CParticleFlush`, `CTowerLamp`, `CWaterSupply`, `CGroupMonitor`, `CPumpGroupControl`, and ~20 more

```pascal
// CSliceGroupControl.SetConfigure (as implemented)
METHOD SetConfigure
    _cfg := cfg;
    _monitoring.common.Configured := TRUE;  // ← _monitoringSize never set!
END_METHOD

// GetMonitoringSize
METHOD GetMonitoringSize : UINT
    GetMonitoringSize := _monitoringSize;   // ← always returns 0!
END_METHOD
```

`_monitoringSize` and `_controlSize` are UINT fields defaulting to 0. Since `SetConfigure` never calculates them, `AutoAssignOffsets` allocates zero-sized memory blocks for these modules. Consequences:

- `GetMonitoringSize()` = 0 → module occupies no Modbus register space → HMI cannot observe module state
- `GetControlSize()` = 0 → module reads 0 bytes → HMI commands are silently dropped
- Even for a foundation skeleton, the infrastructure requires non-zero sizes to function

**Fix for all stub modules** — add to `SetConfigure`:
```pascal
_monitoringSize := (SIZEOF(TMonitoringSliceGroupControl) + 1) / 2;
_controlSize    := (SIZEOF(TControlSliceGroup) + 1) / 2;
_monitoring.common.Configured := TRUE;
```
This is a one-line-per-size change, but it must be applied to every module that declares `_monitoringSize` / `_controlSize`.

---

#### 3. [Architecture] `CMessageBroker.RegisterAllModules` — Empty Loop

**Location**: `euv.vizeon.package.v2.ST`, line ~1659

```pascal
// New CMessageBroker (BROKEN)
METHOD RegisterAllModules : BOOL
    FOR i := 1 TO moduleCount DO
        module := moduleManager.GetModule(i);
        // ← nothing here! No __QUERYINTERFACE calls
    END_FOR
END_METHOD
```

Compare with the required pattern (from old `CMessageBroker`):
```pascal
// Required pattern
IF _sliceGroupControl = 0 AND_THEN __QUERYINTERFACE(module, _sliceGroupControl) THEN ;
ELSIF _h2dSystem = 0 AND_THEN __QUERYINTERFACE(module, _h2dSystem) THEN ;
// ... for every inter-module dependency
END_IF
```

Without the `__QUERYINTERFACE` calls, `CServiceProvider.MsgBroker` never gets any module interface references. Any module that calls `_base.MsgBroker.SomeModule` will get a null reference and silently skip its logic. This breaks all cross-module coordination at runtime.

The `IMessageBroker` interface now also adds `SetMsgBroker` — if the intent is to delegate to a sub-broker (e.g., per-slice broker), that delegation logic is also missing from `RegisterAllModules`.

**Fix**: Define all inter-module interface variables in `CMessageBroker` and add `__QUERYINTERFACE` bindings for every module that needs cross-module access.

---

#### 4. [Memory] `CH2DSystem` Uses Wrong Control Struct

**Location**: `euv.vizeon.package.v2.ST`, `CH2DSystem` VAR block

```pascal
FUNCTION_BLOCK CH2DSystem EXTENDS CBaseModule IMPLEMENTS IH2DSystem
    VAR
        _cfg     : TConfigH2DSystem;
        _monitoring : TMonitoringH2DSystem;  // ✓ correct
        _control : TControlH2D_LH;           // ✗ wrong type!
```

`CH2DSystem` controls the H2D subsystem as a whole, but its `_control` struct is typed as `TControlH2D_LH` (the Low/High variant control struct). This means:
- `ProcessControlData` reads HMI commands into the wrong struct layout
- H2D System-level commands are silently misinterpreted
- `WriteControlData` writes back a mismatched struct

**Fix**:
```pascal
_control : TControlH2DSystem;  // requires defining TControlH2DSystem TYPE
```
If `TControlH2DSystem` doesn't exist yet, it needs to be defined. Using `TControlH2D_LH` as a placeholder is not acceptable because the field sizes may differ.

---

#### 5. [Execution] Standard FB Body Pattern Missing in Most Modules

**Location**: Most modules in `euv.vizeon.package.v2.ST`

The infrastructure requires the following execution body for every module:
```pascal
// ---- BODY #1 ---- (required pattern)
IF IsReady() THEN
    ProcessControlData();       // Read HMI commands
    StateMachine();             // Module logic
    ControlAlerts();            // Update alerts
    ProcessMonitoringData();    // Write status to HMI
    _monitoring.common.InService := TRUE;
ELSE
    _monitoring.common.InService := FALSE;
END_IF
```

Most modules have incomplete bodies. Example — `CSliceGroupControl`:
```pascal
// ---- BODY #1 ---- (current, INCOMPLETE)
IF IsReady() THEN
    FOR idx := 1 TO GVC.MAX_NO_SLICE DO
        slices[idx]();
    END_FOR
    // ← missing: ProcessControlData, ProcessMonitoringData, InService
END_IF
```

`_monitoring.common.InService` is never set for most modules (only `CTowerLamp` sets it, at line 4477). This means:
- HMI cannot distinguish "module running" from "module not started" for most modules
- `ProcessControlData()` and `ProcessMonitoringData()` are never called in the body → Modbus exchange never happens even when IsReady() is true

As a design review: the call structure must be established before wiring real IO. Empty bodies without at minimum the MemProvider calls will require significant rework after IO is connected.

---

#### 6. [Architecture] Direct Access to Private `_resourceManager._alertManager`

**Location**: `euv.vizeon.app.v2.ST`, `CFacility` body (line ~302)

```pascal
// ---- BODY #1 ----
IF _inited THEN
    _base.ModuleManager.ExecuteAllModules();
    _base._resourceManager._alertManager();   // ← accesses private field directly
END_IF
```

`_resourceManager` is a private field of `CServiceProvider`. Accessing it directly from `CFacility` bypasses the service provider interface and creates hard coupling. If `CServiceProvider`'s internals change (e.g., alert manager extracted to a property), this line breaks silently.

**Fix**: Expose AlertManager execution through `CServiceProvider`:
```pascal
// In CServiceProvider — add method:
METHOD ExecuteAlertManager
    _resourceManager.AlertManager();
END_METHOD

// CFacility body:
_base.ExecuteAlertManager();
```

Or expose it as a property (already pattern-consistent with `IoManager`, `ValveManager`, etc.).

---

### Suggested Improvements

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Naming] | `euv.vizeon.package.v2.ST` | `CVaccumPumpDataExchanger` / `IVaccumPumpDataExchanger` — typo: "Vaccum" → "Vacuum" |
| 2 | [Naming] | `euv.vizeon.package.v2.ST` | `CH2DDuelControl` / `TControlH2DDuelControl` — "Duel" → "Dual" (combat vs. paired) |
| 3 | [Naming] | `euv.vizeon.package.v2.ST` | `_monitoring.common.configured` (lowercase) in `IsReady()` — should be `Configured` (uppercase) to match field definition |
| 4 | [Architecture] | `euv.vizeon.package.v2.ST` | Stub modules (`CH2D`, `CH2DControl`) have completely empty method bodies with no comments — should have `// TODO` comments explaining implementation status |
| 5 | [Architecture] | `euv.vizeon.package.v2.ST` | `CSliceGroupControl` body iterates slices directly — missing `ProcessControlData` and `ProcessMonitoringData` for the group-level monitoring/control |
| 6 | [Memory] | `euv.vizeon.package.v2.ST` | `CVacuumPump.FB_Init` size calculation is redundant after `SetConfigure` overwrites `_monitoringSize` — `FB_Init` should not set sizes |

#### 1. [Naming] "Vaccum" Typo — Pervasive

```pascal
// Current (WRONG)
FUNCTION_BLOCK CVaccumPumpDataExchanger EXTENDS CBaseModule IMPLEMENTS IVaccumPumpDataExchanger
INTERFACE IVaccumPumpDataExchanger EXTENDS IBaseModule

// Required (CORRECT)
FUNCTION_BLOCK CVacuumPumpDataExchanger EXTENDS CBaseModule IMPLEMENTS IVacuumPumpDataExchanger
INTERFACE IVacuumPumpDataExchanger EXTENDS IBaseModule
```

This typo appears in both the class name and interface name. Fixing it now prevents the mistake from propagating into Modbus tag names, which would require HMI changes later.

#### 2. [Naming] "Duel" vs "Dual"

```pascal
// Current
FUNCTION_BLOCK CH2DDuelControl  // "Duel" = combat between two parties
INTERFACE IH2DDuelControl

// Required
FUNCTION_BLOCK CH2DDualControl  // "Dual" = two of something
INTERFACE IH2DDualControl
```

#### 3. [Naming] `configured` Field Case Inconsistency

```pascal
// In CSliceGroupControl.IsReady (WRONG)
_monitoring.common.Ready := _monitoring.common.Initialized AND _monitoring.common.configured;
//                                                                                  ↑ lowercase

// In CVacuumPump.IsReady (ALSO WRONG in same way)
_monitoring.common.Ready := _monitoring.common.Initialized AND _monitoring.common.configured;

// Required — match TMonitoringModuleCommon field definition
_monitoring.common.Ready := _monitoring.common.Initialized AND _monitoring.common.Configured;
```

If `TMonitoringModuleCommon.Configured` is PascalCase (as named elsewhere: `_monitoring.common.Configured := TRUE`), then the `IsReady()` reference must match.

---

### Well Done

- **Infrastructure harness successfully ported**: `CServiceProvider.AutoInitializeAllModules` replicates the full 8-step Unify init sequence correctly (Factory → MakeListAsArray → InitializeAllModules → ResourceManager → InitializeAllResources → AutoAssignOffsets → MessageBroker → GetTotals). This is the critical backbone and it is structurally correct.

- **Hierarchical module registration design**: The nested registration of `CSliceGroupControl → slices[i] → pumpGroupControl → vacuumPumps[i]` in `CreateAndRegisterModules` is architecturally sound and scales cleanly for the EUV system's physical layout. Using `FOR` loops over global constants (`GVC.MAX_NO_SLICE`, `GVC.MAX_NO_VACUUM_PUMP`) is the right approach.

- **`CVacuumPump` is an excellent reference implementation**: It demonstrates the complete pattern — `InitializeModule` with IO/Alert registration, `FB_Init` (though size placement is wrong), `SetConfigure` with proper IO/Alert configuration, `ProcessControlData` with full cmdExist/cfgExist handshake and write-back, `ProcessMonitoringData` with full info field population, `InjectX` methods for testability, and a state machine. This should be used as the template for all other modules.

- **Inject methods for testability**: `CVacuumPump.InjectSliceState`, `InjectPFMSpeed`, `InjectH2Disabled`, `InjectCommand`, `InjectDataFromPump`, `InjectCommsStatus` — all guarded by `_isTestMode`. This is an excellent dependency injection pattern for unit testing without real hardware. Should be applied consistently across other modules.

- **Reserve bits with explicit naming in Control structs**: All `TControl*` structs use `modeReserve`, `actReserve`, `cfgReserve` with numbered suffixes and correct 16-bit alignment. This future-proofs the Modbus layout and avoids bit-packing errors.

- **H2D inheritance hierarchy**: `CH2D → CH2D_HP / CH2D_LH`, `CH2DControl → CH2DDuelControl / CH2DTripleControl` is a clean OOP decomposition that properly uses CODESYS `EXTENDS` for variant behavior. The Strategy-like split between the measurement (H2D) and control (H2DControl) sides shows good domain understanding.

- **Global constants centralized in `GVC`**: `MAX_NO_SLICE`, `MAX_NO_VACUUM_PUMP`, `MAX_NUMBER_BDM`, etc. in a `VAR_GLOBAL CONSTANT` block avoids magic numbers scattered across `CreateAndRegisterModules` and module body loops.

---

### Final Verdict

**CHANGES REQUESTED**

The infrastructure harness architecture is well conceived and correctly structured at the design level — the ServiceProvider, AutoInitialize, and MemoryProvider patterns are faithfully adapted from the Unify architecture. However, **6 must-fix items prevent this from being merged** as a functional foundation:

The two most critical are: (1) `_monitoringSize` / `_controlSize` being 0 for nearly all stub modules, which means the entire Modbus memory map will be empty and HMI communication non-functional at system start; and (2) `CMessageBroker.RegisterAllModules` being an empty loop, which means all inter-module state dependencies (slice ↔ pump coordination, safety interlocks, etc.) will be silently disconnected. Both issues are straightforward to fix but must be addressed before any integration testing is meaningful.

`CVacuumPump` sets the correct standard — bring all other modules up to that baseline, even as stubs.
