# Risk Examples - 사용 예시 및 워크플로우

## 워크플로우 예시

### 1. 데일리 리스크 체크

```bash
/javis-risk detect      # 자동 감지 실행
/javis-risk             # 요약 확인
```

### 2. 스프린트 리스크 분석

```bash
/javis-risk analyze "Sprint14"    # 스프린트 분석
/javis-risk list --severity high  # High 이상 리스크
```

### 3. Epic 리스크 분석

```bash
/javis-risk analyze EUV-3299  # Epic 분석
```

### 4. 리스크 해결

```bash
/javis-risk resolve <id>  # 리스크 해결 처리
```

### 5. 주간 리스크 리포트

```bash
/javis-risk report  # 전체 현황 리포트
```

## 출력 예시

### `/javis-risk`

```
=== Risk Summary ===

Open Risks: 5
- Critical: 1
- High: 2
- Medium: 2

By Type:
- delay: 1
- blocker: 1
- resource_conflict: 2
- stale_issue: 1
```

### `/javis-risk detect`

```
=== Risk Detection ===

[1] SPRINT DELAY - CRITICAL
Sprint: Scaled Sprint14
Days Left: 3
Completion: 45% (expected: 70%)
Action: Review sprint scope, consider descoping

[2] BLOCKER - CRITICAL
Issue: EUV-3310 - Critical bug in parser
Assignee: Gerald
Status: In Progress
Action: Needs immediate attention

[3] RESOURCE CONFLICT - HIGH
Member: Gerald
Open Issues: 8 (threshold: 6)
Action: Redistribute workload

[4] STALE ISSUE - MEDIUM
Issue: EUV-3302 - Implement mock simulator
Last Update: 18 days ago
Action: Check status with assignee

=== Summary ===
Detected: 4 new risks
Critical: 2, High: 1, Medium: 1
```

### `/javis-risk list`

```
=== Open Risks ===

ID  | Type             | Severity | Title                    | Epic     | Detected
----|------------------|----------|--------------------------|----------|----------
1   | delay            | critical | Sprint 14 at risk        | -        | 2024-01-23
2   | blocker          | critical | Critical bug blocking    | EUV-3299 | 2024-01-23
3   | resource_conflict| high     | Gerald overloaded        | -        | 2024-01-22
4   | stale_issue      | medium   | EUV-3302 no progress     | EUV-3299 | 2024-01-20
```

### `/javis-risk analyze EUV-3299`

```
=== Epic Risk Analysis: EUV-3299 ===

Epic: Implement Simulator Integration
Status: In Progress

## Progress
- Stories: 1/5 (20%)
- Days since start: 18

## Detected Risks

[MEDIUM] Completion Rate
- Current: 20%
- Expected by now: 40%
- Gap: -20%

[HIGH] Stale Issues
- EUV-3302: 18 days without update

[LOW] Resource Distribution
- 3 stories unassigned

## Recommendations
1. Review EUV-3302 status with team
2. Assign remaining stories
3. Consider scope reduction if needed
```

## 스크립트 사용

```bash
# 리스크 요약
python3 .claude/skills/risk/scripts/risk.py summary

# 자동 감지
python3 .claude/skills/risk/scripts/risk.py detect

# 리스크 목록
python3 .claude/skills/risk/scripts/risk.py list

# Epic 분석
python3 .claude/skills/risk/scripts/risk.py analyze EUV-3299
```
