# EUV-3351 Story Refine & Gherkin Test Structure Generation

## Overview

EUV-3351 유저 스토리를 인터뷰 기반으로 Refine하고, FT&CC 문서와 Modbus Mapfile을 AI로 분석하여 Gherkin 기반 테스트 구조 문서(.md) 22개를 자동 생성했다. Jira 이슈도 Refined 내용으로 업데이트 완료.

## Context

- **원본 스토리**: "Analysis FT&CC and Modbus Mapfile and suggest that the Test Structure based on Gherkin"
- **문제**: FT&CC 문서(테스트 절차)와 Modbus Mapfile(PLC 메모리 주소) 간 1:1 매핑이 어려움. 암묵적 작성이 많아 시나리오↔컴포넌트 주소 간 연결이 불명확
- **목표**: AI를 활용해 체계적으로 분석하고 Gherkin 기반 테스트 구조를 생성하여 Akshay에게 전달

## Approach: Interview-Based Story Refinement

스토리가 넓고 암묵적이었기 때문에, 사용자 인터뷰를 4라운드 진행하여 구체화:

### Round 1 - 핵심 방향
| 질문 | 답변 |
|------|------|
| Deliverable | 테스트 구조 문서(.md) |
| Scope | Category 3 (I/O check) + Category 4 (Component functional test) |
| Input format | 둘 다 Excel, `D:\00.Dev\euv.io.db\ref\` |
| 수행 주체 | AI 주도 분석, 결과물만 Akshay에게 전달 |

### Round 2 - 세부 범위
| 질문 | 답변 |
|------|------|
| FT&CC 섹션 | Sheet2 "Factory setup & test" |
| Test depth | 시나리오 목록 수준 (Given/When/Then 골격) |
| AI 환경 | Gerald이 분석 후 결과물만 전달 |

### Round 3 - 정밀 범위
| 질문 | 답변 |
|------|------|
| Target sections | 2.16~2.36 (기능테스트만) |
| Output location | `D:\00.Dev\16.oqc_digitalization\edwards.oqc.infra\docs\` |
| System variant | NKB943000 전용 (H2D), N/A 항목 제외 |

## Changes Made

### 1. Jira EUV-3351 업데이트
- **Method**: Jira REST API v3 PUT (ADF format)
- **Updated fields**:
  - Summary: `Analyze FT&CC (2.16~2.36) and Modbus Mapfile → Gherkin test structure for NKB943000`
  - Story Points: 5
  - Labels: `oqc-automation`, `gherkin`, `test-structure`
  - Description: User Story, Background, Scope, Deliverable, Acceptance Criteria 5개

### 2. 데이터 추출 (중간 산출물)

#### FT&CC 추출
- **Input**: `Factory Test and Commissioning Checklist_Gen2 plus SKHYNIX _21 v4.xlsx` (Sheet2)
- **Output**: `javis.gerald/tmp/ftcc_sections_2.16_2.36.json` (143KB)
- **결과**: 21개 섹션, 224 tasks, 91개 컴포넌트 태그
- NKB943000 N/A 항목 7개 식별 (2.17에서 1개, 2.20에서 6개)

#### Modbus Mapping 추출
- **Input**: `5D Distributed PLC Memory Map PLC_Ver42_GEN2.xlsx` (IO Master + Modbus Master)
- **Output**: `javis.gerald/tmp/modbus_mapping.json` (347KB)
- **결과**: 1,004 IO 컴포넌트, 243 Modbus 디바이스, 40개 인스트루먼트 태그

### 3. Gherkin 테스트 구조 .md 파일 생성

**Output directory**: `D:\00.Dev\16.oqc_digitalization\edwards.oqc.infra\docs\gherkin-test-structure\`

22개 파일 생성:

| File | Scenarios | Size |
|------|-----------|------|
| `00-test-structure-overview.md` | Overview | 5.5KB |
| `2.16-electrical-and-control-system-functional-tests.md` | 60 | 32.9KB |
| `2.17-n2-gas-module-purge-check.md` | 10 | 3.7KB |
| `2.18-o2-sensor-check.md` | 25 | 8.6KB |
| `2.19-pump-stack-performance-test.md` | 1 | 1.1KB |
| `2.20-o2-bypass-test.md` | 3 | 2.1KB |
| `2.21-pcm-test.md` | 3 | 1.6KB |
| `2.22-remote-hmi-setup-and-functional-test.md` | 2 | 1.4KB |
| `2.23-setup-for-smoke-detectors-...md` | 6 | 1.9KB |
| `2.24-functional-test-for-smoke-detectors.md` | 2 | 1.4KB |
| `2.25-h2-mfm-box-test.md` | 10 | 4.3KB |
| `2.26-nova-redundant-functional-test.md` | 13 | 3.6KB |
| `2.27-functional-test-for-uv-ir-sensor.md` | 1 | 0.9KB |
| `2.28-output-signal-of-diffuser-...md` | 6 | 2.2KB |
| `2.29-h2d-component-function-logic-test.md` | 38 | 17.0KB |
| `2.30-differential-pressure-at-h2d-exhaust.md` | 4 | 2.8KB |
| `2.31-h2d-switching-logic-check.md` | 4 | 2.6KB |
| `2.32-h2d-air-flow-rate-test.md` | 3 | 1.2KB |
| `2.33-air-filter-cleaning-before-shipping.md` | 3 | 1.4KB |
| `2.34-output-signal-reliability-test.md` | 1 | 1.0KB |
| `2.35-gemsecs-test.md` | 4 | 1.0KB |
| `2.36-quality.md` | 18 | 3.9KB |

**Total: 217 Gherkin scenarios (224 - 7 N/A)**

## Code Examples

### 각 .md 파일 구조

```gherkin
# 2.29 - H2D Component function & logic test

> **Source**: Factory Test and Commissioning Checklist (Sheet 2)
> **Variant**: NKB943000 (Gen2+ H2D)
> **Category**: I/O Check / Component Functional Test

## Summary
- **Total tasks**: 38
- **Applicable (NKB943000)**: 38

---

```gherkin
@NKB943000 @Sheet2
Feature: 2.29 - H2D Component function & logic test

  Background:
    Given HMI가 정상 동작 상태
    And Edwards Controller가 정상 운전 중

  # === 2.29.2 Cabinet extract differential pressure sensor ===

  @NKB943000 @PT_301
  Scenario: 2.29.2.1 - H2D-1_PT-301
    Given 시스템이 정상 운전 상태
    And Cabinet extract differential pressure sensor
    When 저차압 알람(<10Pa) 트리거
    Then HMI에 알람 표시 확인

## Component-Modbus Mapping
| Component | IO Master Word | Description | Category |
|-----------|---------------|-------------|----------|
| PT-301    | (매핑 필요)    | -           | -        |
```

### Overview 문서 포함 내용
- Summary Statistics (21 섹션, 217 시나리오, 91 컴포넌트)
- Section Index (파일 링크 포함)
- Test Category Mapping (Category 3, 4)
- System Architecture (Master PLC → Slave Slices → Pumps → O2 Sensors)
- Component Tag Reference (15개 태그 prefix별 매핑)
- How to Use 가이드

## Architecture Decisions

1. **인터뷰 기반 Refinement**: 모호한 스토리를 4라운드 인터뷰로 구체화
2. **2단계 처리**: 데이터 추출(JSON) → 문서 생성(.md) 분리로 재활용성 확보
3. **병렬 에이전트**: FT&CC 추출, Modbus 추출, Jira 업데이트를 동시 실행
4. **N/A 필터링**: NKB943000 비해당 항목 자동 식별 및 제외
5. **Modbus 매핑 테이블**: 각 .md 파일에 해당 섹션의 컴포넌트↔IO Master Word 매핑 포함

## Verification Results

### Jira 업데이트
```
HTTP 204 (No Content) - Success
```

### FT&CC 추출 검증
```
Sections: 21
Total tasks: 224
NKB943000 N/A: 7 (2.17: 1, 2.20: 6)
Component tags: 91 unique
Output: ftcc_sections_2.16_2.36.json (143,842 bytes)
```

### Modbus 매핑 추출 검증
```
IO Master components: 1,004
Modbus Master devices: 243
FT&CC relevant: 329
Tagged instruments: 40
Output: modbus_mapping.json (347,381 bytes)
```

### .md 파일 생성 검증
```
Total files: 22
Total applicable scenarios: 217
Output: edwards.oqc.infra/docs/gherkin-test-structure/
All files verified readable
```

## Input Files Reference

| File | Location | Description |
|------|----------|-------------|
| FT&CC Checklist | `euv.io.db/ref/Factory Test and Commissioning Checklist_Gen2 plus SKHYNIX _21 v4.xlsx` | 13 sheets, Sheet2 섹션 2.16~2.36 |
| Modbus Mapfile | `euv.io.db/ref/5D Distributed PLC Memory Map PLC_Ver42_GEN2.xlsx` | IO Master + Modbus Master |
| Hardware Design | `euv.io.db/ref/06.05.06 - Hardware Design Specification_NKB963 1.xlsx` | (참고용, 미사용) |

## Next Steps

1. **Akshay 리뷰**: 생성된 .md 파일의 Gherkin 시나리오 정확성 검증
2. **Modbus 매핑 보완**: 일부 컴포넌트(RL 릴레이 등)의 IO Master Word 매핑이 누락됨 → 수동 보완 필요
3. **.feature 변환**: 리뷰 완료 후 .md → .feature 파일로 1:1 변환
4. **Step Definitions**: 매핑 테이블의 Word/Address를 활용하여 자동화 코드 구현
5. **Sheet7 확장**: Control system testing 섹션으로 범위 확대 (Category 3/4 완전 커버)
