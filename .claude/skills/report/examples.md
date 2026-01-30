# Report Examples - 사용 예시 및 출력 샘플

## 워크플로우 예시

### 1. 데일리 스탠드업
```bash
/javis-report sprint
```

### 2. 스프린트 회고
```bash
/javis-report sprint "Scaled Sprint13"
/javis-report velocity
```

### 3. 주간 보고
```bash
/javis-report weekly
/javis-report team
```

### 4. 프로젝트 현황 공유
```bash
/javis-report project EUV
/javis-report vision OQC
```

### 5. Epic 진행 확인
```bash
/javis-report epic EUV-3299
```

## 출력 예시

### `/javis-report sprint`

```markdown
# Sprint Report: Scaled Sprint14

## Summary
- Period: 2024-01-15 ~ 2024-01-26
- Status: active
- Days Left: 5

## Progress
| Status | Count | Percentage |
|--------|-------|------------|
| Done | 12 | 50% |
| In Progress | 8 | 33% |
| To Do | 4 | 17% |
| **Total** | **24** | - |

## Points
- Done: 45 / 72 total (62.5%)

## By Assignee
| Member | Assigned | Done | In Progress |
|--------|----------|------|-------------|
| Gerald | 8 | 1 | 3 |
| Tushar | 6 | 3 | 2 |
| James | 5 | 2 | 1 |

## Completed This Sprint
- EUV-3305: Documentation update
- EUV-3308: Fix login issue
- ...

## Blockers
- EUV-3310: Critical bug in parser (Highest priority, blocked)
```

### `/javis-report weekly`

```markdown
# Weekly Report: Week of 2024-01-22

## Sprint: Scaled Sprint14
- Progress: 50% → 62% (+12%)
- Issues completed: 8

## Completed This Week
| Key | Summary | Assignee |
|-----|---------|----------|
| EUV-3305 | Documentation update | Gerald |
| EUV-3308 | Fix login issue | Tushar |
| EUV-3309 | Add validation | James |

## Development Activity
- Commits: 45
- PRs Opened: 5
- PRs Merged: 3

## Top Contributors
1. Gerald - 3 issues completed
2. Tushar - 3 issues completed
3. James - 2 issues completed

## Focus for Next Week
- EUV-3310: Critical bug fix (Highest)
- EUV-3311: Error handling (High)
```

### `/javis-report epic EUV-3299`

```markdown
# Epic Report: EUV-3299

## Summary
- Title: Implement Simulator Integration
- Status: In Progress
- Component: OQCDigitalization

## Progress
- Stories: 1/5 (20%)
- Story Points: 1/14 (7%)

## Stories
| Key | Summary | Status | Assignee | Points |
|-----|---------|--------|----------|--------|
| EUV-3301 | Define ISimulator interface | In Progress | Gerald | 3 |
| EUV-3302 | Implement mock simulator | To Do | - | 5 |
| EUV-3303 | Add unit tests | To Do | Tushar | 2 |
| EUV-3304 | Integration testing | To Do | - | 3 |
| EUV-3305 | Documentation | Done | Gerald | 1 |

## Development Activity (Last 7 Days)
- Commits: 12
- Open PRs: 1
- Contributors: Gerald, Tushar

## Timeline
- Created: 2024-01-05
- Last Updated: 2024-01-23
```

### `/javis-report velocity`

```markdown
# Velocity Report

## Last 6 Sprints
| Sprint | Committed | Done | Completion | Points |
|--------|-----------|------|------------|--------|
| Sprint 9 | 20 | 18 | 90% | 42 |
| Sprint 10 | 22 | 19 | 86% | 45 |
| Sprint 11 | 24 | 20 | 83% | 48 |
| Sprint 12 | 23 | 21 | 91% | 50 |
| Sprint 13 | 25 | 22 | 88% | 52 |
| Sprint 14* | 24 | 12 | 50% | 45 |

## Statistics
- Average Velocity: 20 issues / 47 points per sprint
- Range: 42-52 points
- Trend: Stable

## Recommendation
- Next sprint commitment: 22-25 issues
- Expected capacity: 48-52 points
```

## 스크립트 사용

```bash
# 스프린트 리포트
python3 .claude/skills/report/scripts/report.py sprint

# 특정 스프린트
python3 .claude/skills/report/scripts/report.py sprint "Sprint 13"

# 주간 리포트
python3 .claude/skills/report/scripts/report.py weekly

# Epic 리포트
python3 .claude/skills/report/scripts/report.py epic EUV-3299

# Velocity 리포트
python3 .claude/skills/report/scripts/report.py velocity
```
