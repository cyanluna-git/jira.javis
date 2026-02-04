## PR #1 Code Review: Feature/scaled sprint13/ASP-231 web based simulator phase2 final branch

**Repo**: ac-avi/edwards.web.simulator
**Branch**: feature/scaled-sprint13/ASP-231-web-based-simulator-phase2-final-branch → main
**Author**: Prakashbhai Koladiya
**Date**: 2026-02-03

---

### 변경 요약

Phase 2 최종 브랜치로, 크게 세 가지 영역의 변경이 포함됩니다:
1. **위젯 타입 단순화**: 11개 위젯 타입을 4개(DI/AI/DO/AO) + Valve/FeedbackValve로 축소. State, PowerLevel, WaterTank, SystemStateRing 위젯 렌더링 제거.
2. **시뮬레이션 아키텍처 전환**: 기존 프론트엔드 시뮬레이션 엔진(AutoSimulationEngine, SimulationControlPanel 등)을 삭제하고, 백엔드 V2 Entity API 기반 sim mode(S/A/M 오버레이)로 전환.
3. **라우팅/인증 추가**: 로그인 페이지, 인증 기반 라우팅, 새로운 Dashboard/PID/Systems 페이지 구조 도입.

약 170개 파일 변경, 대규모 리팩토링 PR입니다.

---

### 머지 전 확인 필요

| # | 유형 | 파일 | 내용 |
|---|------|------|------|
| 1 | [Bug] | `EditWidgetModal.tsx:30-97` | widget이 null일 때 모든 useState가 기본값으로 초기화된 후 하단에서 null 체크 |
| 2 | [Security] | `.env.example`, `.env.simulator` | 환경변수 예시 파일 삭제 - 신규 개발자 온보딩 영향 |
| 3 | [Breaking] | `DashboardGrid.tsx` | State/PowerLevel/WaterTank/SystemStateRing 위젯 렌더링 코드 삭제 |
| 4 | [Bug] | `AddWidgetModal.tsx:168-173` | 삭제된 위젯 타입(GroupBox, State, PowerLevel 등)에 대한 boolean 플래그가 여전히 존재 |

**1. [Bug] EditWidgetModal null 안전성 문제** (`EditWidgetModal.tsx:30-97`)

`widget` 변수를 찾지 못했을 때(null), `if (!widget) return null;`이 모든 `useState` 호출 **이후** (line 219)에 위치합니다. React Hooks 규칙상 조건부 return 전에 모든 hook을 호출해야 하므로 현재 위치는 맞습니다. 하지만 문제는 `widget`이 null일 때 모든 state가 기본값(`widget?.type || 'AI'` 등)으로 초기화되면서 **잘못된 초기 상태로 effect가 실행**될 수 있다는 점입니다. 특히 `useEffect`에서 `widget?.binding?.deviceId`와 비교하는 로직은 `widget`이 null이면 항상 불일치하여 state를 리셋합니다.

```
제안: widget이 null인 경우 모든 hook 호출 후 즉시 return null 하기 전에,
useEffect 내부에서 widget 존재 여부를 먼저 체크하세요.
```

**2. [Security] 환경변수 예시 파일 삭제** (`.env.example`, `.env.simulator`)

`.env.example`과 `.env.simulator`가 삭제되었습니다. 이 파일들은 신규 개발자가 프로젝트를 설정할 때 필요한 환경변수 목록을 제공하는 중요한 파일입니다. 삭제 의도가 맞다면 README나 다른 문서에 필요한 환경변수 목록이 포함되어야 합니다. 현재 `QUICKSTART.md`가 추가되었는지 확인이 필요합니다.

**3. [Breaking] 기존 위젯 타입 호환성** (`DashboardGrid.tsx`)

`DashboardGrid`에서 `State`, `PowerLevel`, `WaterTank`, `SystemStateRing`, `DivertValve` 위젯의 렌더링 케이스가 완전히 삭제되었습니다. 기존에 이 위젯들을 사용하는 저장된 스크린 YAML 파일이 있다면, 해당 위젯이 "Unknown widget type" 오류 메시지로 표시됩니다. 마이그레이션 전략이 필요합니다.

**4. [Bug] 삭제된 위젯 타입의 잔여 코드** (`AddWidgetModal.tsx:168-173`)

```typescript
const isGroupBox = widgetType === 'GroupBox';
const isState = widgetType === 'State';
const isPowerLevel = widgetType === 'PowerLevel';
const isWaterTank = widgetType === 'WaterTank';
const isSystemStateRing = widgetType === 'SystemStateRing';
```

DashboardGrid에서 이 위젯 타입들의 렌더링이 삭제되었는데, AddWidgetModal과 EditWidgetModal에는 이 타입들의 선택/설정 UI와 boolean 플래그가 그대로 남아있습니다. 사용자가 이 타입들을 선택해서 위젯을 추가하면 렌더링되지 않는 위젯이 생성됩니다.

---

### 개선 권장

| # | 유형 | 파일 | 내용 |
|---|------|------|------|
| 1 | [Redundancy] | `AddWidgetModal.tsx`, `EditWidgetModal.tsx` | 두 파일의 resource selection UI 코드가 거의 동일하게 중복 |
| 2 | [Design] | `App.tsx:88-96` | Routes 내부에서 JSX 조건문 사용은 React Router의 의도된 패턴이 아님 |
| 3 | [Redundancy] | `AnalogBarWidget.tsx` | `useV2ComponentSimMode`와 `useV2EntitySimMode` 두 경로를 모든 위젯에서 개별 관리 |
| 4 | [Testing] | 전체 | 170+ 파일 변경에 대한 테스트 코드 부재 |
| 5 | [Logic] | `resourceMapper.ts:scaledToRaw` | decimal=0일 때 getDecimalMultiplier가 1을 반환하지만, 실제 0이 의미있는 값일 수 있음 |
| 6 | [Perf] | `DashboardGrid.tsx:103` | `min-w-[1200px]` 하드코딩은 반응형 레이아웃을 제한 |
| 7 | [Design] | `DashboardPage.tsx:64-79` | `console.log` 디버그 로그가 프로덕션 코드에 포함 |

**1. [Redundancy] AddWidgetModal/EditWidgetModal 코드 중복**

Resource Selection UI(~70줄), `getResourceType` 함수, `canSubmit` 로직, binding preview 등이 두 파일에 거의 동일하게 복사되어 있습니다. 공통 컴포넌트나 커스텀 hook으로 추출하면 유지보수가 훨씬 쉬워집니다.

**2. [Design] React Router 조건부 라우팅** (`App.tsx:88-96`)

```tsx
{isAuthenticated ? (
  <Route element={<AppLayout />}>...</Route>
) : (
  <Route path="*" element={<Navigate to="/login" replace />} />
)}
```

React Router v6+에서는 `Routes` 내부에서 JSX 조건문을 사용하면 라우트 트리가 변경될 때 전체 재마운트가 발생할 수 있습니다. `loader` 또는 래퍼 컴포넌트(`ProtectedRoute`)로 인증 가드를 구현하는 것이 더 안정적입니다.

**3. [Redundancy] Entity/Component sim mode 이중 경로**

`AnalogBarWidget`, `AnalogGaugeWidget` 등 모든 위젯에서 `hasEntitySimIds` vs `hasComponentSimIds`를 개별적으로 분기하며 `entitySimModeMutation`과 `simModeMutation`을 모두 선언합니다. 이 로직을 커스텀 hook(`useSimControl`)으로 추출하면 위젯 코드가 크게 단순화됩니다.

**4. [Testing] 테스트 부재**

170+ 파일 변경, 시뮬레이션 아키텍처 전환, 위젯 타입 축소, 인증 추가 등 대규모 변경에 대한 테스트 코드가 포함되어 있지 않습니다. 최소한 `scaledToRaw`, `extractScaleRange` 등 핵심 유틸 함수에 대한 단위 테스트가 필요합니다.

**5. [Logic] decimal 값 검증** (`resourceMapper.ts`)

`getDecimalMultiplier`에서 `decimal <= 0`이면 1로 폴백합니다. 하지만 config에서 decimal이 0으로 오는 경우가 실제로 있을 수 있고, 이때 1로 대체하면 스케일 계산이 잘못될 수 있습니다. 이 경우 경고 로그를 남기는 것이 좋습니다.

**7. [Design] 디버그 로그** (`DashboardPage.tsx`)

```typescript
console.log('[DashboardPage] Save successful, refreshing screens...');
console.log('[DashboardPage] Screens refreshed, re-activated screen:', currentScreenId);
```

프로덕션 코드에 디버그용 `console.log`가 포함되어 있습니다. 배포 전 제거하거나, 개발 환경에서만 동작하는 로거로 교체하세요.

---

### 잘 된 부분

- 위젯 타입을 11개에서 4+2개로 단순화한 것은 유지보수성 측면에서 좋은 결정입니다.
- 프론트엔드 시뮬레이션 엔진을 백엔드 API 기반으로 전환한 것은 아키텍처적으로 올바른 방향입니다. 프론트엔드에서 raw 값 계산과 Gateway 직접 쓰기를 제거함으로써 데이터 정합성이 향상됩니다.
- `scaledToRaw` 유틸 함수에서 decimal multiplier를 고려한 정확한 변환 로직이 잘 구현되어 있습니다.
- Entity UUID 기반 바인딩 도입으로 module/component 경로 대신 고유 식별자를 사용하는 것은 바인딩 안정성을 높입니다.
- `useDeviceResources` hook을 통한 리소스 그룹핑(모듈별)이 UX를 개선합니다.

---

### 최종 판정

**CHANGES REQUESTED**

EditWidgetModal의 null 안전성 문제와 삭제된 위젯 타입의 잔여 코드(추가는 되지만 렌더링 불가)는 사용자 경험에 직접적인 영향을 미칩니다. 기존 저장된 스크린에서 사용 중인 위젯 타입의 하위 호환성 전략도 명확히 해야 합니다.
