# Sprint Examples - 사용 예시 및 워크플로우

## 워크플로우 예시

### 1. 스프린트 시작 시

```bash
/javis-sprint current      # 현재 스프린트 확인
/javis-sprint velocity     # velocity 추이 확인
```

### 2. 데일리 스크럼

```bash
/javis-sprint              # 진행 상황 확인
/javis-sprint member Gerald  # 내 작업 확인
```

### 3. 스프린트 계획

```bash
/javis-sprint velocity      # 예상 capacity 확인
/javis-sprint plan          # 백로그에서 이슈 선택
/javis-sprint plan EUV-3299 # 특정 Epic 이슈만 확인
```

### 4. 스프린트 회고

```bash
/javis-sprint "Scaled Sprint13"  # 완료된 스프린트 상세
/javis-sprint velocity           # velocity 변화 분석
```

## 출력 예시

### `/javis-sprint`

```
=== Sprint: Scaled Sprint14 ===
Goal: Complete simulator integration
Period: 2024-01-15 ~ 2024-01-26
Days Left: 5

=== Progress ===
Total: 24 issues
Done: 12 (50%)
In Progress: 8 (33%)
To Do: 4 (17%)

Points: 45 done / 72 total (62.5%)

=== By Assignee ===
Assignee   | Issues | Done | In Progress | Points
-----------|--------|------|-------------|-------
Gerald     | 8      | 4    | 3           | 21
Tushar     | 6      | 3    | 2           | 15
Unassigned | 4      | 0    | 0           | 8
```

### `/javis-sprint velocity`

```
=== Velocity (Last 6 Sprints) ===

Sprint          | Committed | Done | Completion | Points
----------------|-----------|------|------------|-------
Sprint 9        | 20        | 18   | 90%        | 42
Sprint 10       | 22        | 19   | 86%        | 45
Sprint 11       | 24        | 20   | 83%        | 48
Sprint 12       | 23        | 21   | 91%        | 50
Sprint 13       | 25        | 22   | 88%        | 52
Sprint 14 (cur) | 24        | 12   | 50%        | 45*

=== Statistics ===
Average Velocity: 20 issues / 47 points per sprint
Range: 42-52 points
Trend: Stable (+5% over 6 sprints)

=== Recommendation ===
Next sprint commitment: 22-25 issues / 48-52 points
```

### `/javis-sprint plan`

```
=== Next Sprint Planning ===

Next Sprint: Scaled Sprint15
Start: 2024-01-29
Capacity (based on velocity): 48-52 points

=== Backlog (Priority Order) ===
Key      | Summary                      | Priority | Points | Epic
---------|------------------------------|----------|--------|--------
EUV-3310 | Fix critical bug in parser   | Highest  | 3      | EUV-3299
EUV-3311 | Add error handling           | High     | 5      | EUV-3299
EUV-3312 | Implement logging            | Medium   | 3      | EUV-3300
EUV-3313 | Update documentation         | Low      | 2      | EUV-3299

=== Suggested for Sprint ===
Total: 15 issues, 48 points
(Fits within average velocity)
```

### `/javis-sprint burndown`

```
=== Burndown: Scaled Sprint14 ===

Day        | Completed | Cumulative | Ideal
-----------|-----------|------------|------
2024-01-15 | 0         | 0          | 0
2024-01-16 | 2         | 2          | 2.4
2024-01-17 | 3         | 5          | 4.8
2024-01-18 | 2         | 7          | 7.2
2024-01-19 | 1         | 8          | 9.6
2024-01-22 | 2         | 10         | 12
2024-01-23 | 2         | 12         | 14.4
...

Status: On track (within 10% of ideal)
```

## 스크립트 사용

```bash
# 현재 스프린트
python3 .claude/skills/sprint/scripts/sprint.py current

# 스프린트 목록
python3 .claude/skills/sprint/scripts/sprint.py list

# Velocity 분석
python3 .claude/skills/sprint/scripts/sprint.py velocity

# 담당자별 현황
python3 .claude/skills/sprint/scripts/sprint.py assignees

# 특정 스프린트
python3 .claude/skills/sprint/scripts/sprint.py show "Sprint 13"
```
