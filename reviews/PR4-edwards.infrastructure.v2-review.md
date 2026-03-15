## PR #4 PLC Code Review: Corrected control offset calculation for module

**Repo**: ac-avi/edwards.infrastructure.v2
**Branch**: feature/scaled-sprint16/EUV-3392-create-foundation-application → feature/scaled-sprint16/main
**Author**: Prakashbhai Koladiya
**Date**: 2026-03-05
**Domain**: PLC / CODESYS ST

---

### Change Summary

This PR fixes a bug in `CModuleManager`'s offset assignment method where Control Offsets were not being calculated correctly.

In the original code, only the Monitoring Offset was incremented per module in the loop. The Control Offset had two problems:
1. It was never reset to `baseControlOffset` before the loop began
2. It was never incremented per module inside the loop

As a result, every module received the same (incorrect) Control Offset, completely breaking HMI ↔ PLC control data exchange. The variable was also renamed from `moduleSize` → `monitoringSize` + `controlSize` for clarity.

---

### Must-fix Before Merge

None.

---

### Suggested Improvements

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Naming] | `Edwards.Infrastructure.xml` | Indentation inconsistency in added code (tabs vs spaces) |
| 2 | [Architecture] | `Edwards.Infrastructure.st` | Missing PR description — required for core engine changes |
| 3 | [Memory] | `Edwards.Infrastructure.xml:9486` | Unexplained UINT initial value change: 50 → 60,000 |

#### 1. [Naming] Indentation Inconsistency in XML

```xml
<!-- Existing code: uses spaces -->
             monitoringSize := modules[i].GetMonitoringSize();
             _currentMonitoringOffset := _currentMonitoringOffset + monitoringSize;

<!-- Added code: uses tabs (inconsistent) -->
	   		 controlSize := modules[i].GetControlSize();
	   		 _currentControlOffset := _currentControlOffset + controlSize;
```

Mixing tabs and spaces is not a build error in CODESYS, but it breaks XML consistency and makes future diffs harder to read. Please reformat using the IDE or unify indentation style.

#### 2. [Architecture] PR Description Required for Core Engine Changes

This PR modifies `CModuleManager` in `Edwards.Infrastructure` — the central component responsible for assigning memory addresses to all modules. Changes at this level should always include a PR description covering:

```markdown
## Why
- _currentControlOffset was never reset to baseControlOffset before the loop,
  causing all modules to receive wrong/zero Control Offsets

## Impact
- All module Control Offsets recalculated → verify HMI control commands reach correct modules

## Testing
- Confirm HMI control commands are correctly routed to each module in the simulator
```

#### 3. [Memory] Unexplained Initial Value Change: 50 → 60,000

**Location**: `Edwards.Infrastructure.xml` line ~9486, UINT variable in localVars

```xml
<!-- Before -->
<simpleValue value="50" />
<!-- After -->
<simpleValue value="60000" />
```

A UINT variable's initial value changed from 50 to 60,000 with no mention in the commit message or PR description. The variable name is not visible in the diff (the `<variable name="...">` line falls outside the diff context), so the intent cannot be verified from the diff alone.

Possible interpretations:
| Role | Impact |
|------|--------|
| Modbus base address | Shifts all register addresses to the 60,000 range |
| Timeout value (ms) | 50ms → 60,000ms (60 seconds) — significantly longer recovery time |

**Recommendation**: Even for confirmed-correct changes, add a comment or PR note explaining what this variable is and why 60,000 is the correct value. Core infrastructure changes must be traceable.

---

### Well Done

- **Correct root cause fix**: Simultaneously addressed both missing issues — the missing reset of `_currentControlOffset` before the loop, and the missing per-module increment inside the loop. Demonstrates a solid understanding of the symmetric relationship between Monitoring and Control offset assignment.
- **Improved variable naming**: Splitting `moduleSize` into `monitoringSize` + `controlSize` makes the intent immediately obvious and avoids ambiguity about which size is being tracked.
- **Pattern consistency**: The Control Offset implementation now mirrors the Monitoring Offset pattern exactly, making the code easy to follow for any engineer unfamiliar with this section.

---

### Final Verdict

**APPROVED with suggestions**

The core bug fix is accurate and necessary — all modules were receiving incorrect Control Offsets, which would have broken HMI control commands across the board. The fix correctly mirrors the established Monitoring Offset pattern. The suggestions above (especially adding a PR description and explaining the 50 → 60,000 change) are recommended as process improvements for a core engine component where traceability matters.
