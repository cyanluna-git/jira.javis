# Dev Examples - 사용 예시 및 워크플로우

## 워크플로우 예시

### 1. 아침 내 작업 확인

```bash
/javis-dev          # 내 대시보드
/javis-dev me       # 동일
```

### 2. 팀원 상황 파악

```bash
/javis-dev Tushar   # 특정 팀원 현황
/javis-dev team     # 팀 전체 비교
```

### 3. 코드 리뷰 대상 파악

```bash
/javis-dev prs              # 오픈된 PR 목록
/javis-dev prs --name Gerald  # 내 PR 확인
```

### 4. 주간 활동 리뷰

```bash
/javis-dev commits          # 7일간 커밋 활동
/javis-dev stats Gerald     # 내 통계 추이
```

### 5. 작업 분배 시

```bash
/javis-dev workload   # 팀원별 작업 부하
/javis-dev team       # 스프린트 할당 비교
```

## 출력 예시

### `/javis-dev`

```
=== 내 대시보드: Gerald Park ===

=== 현재 스프린트 할당 이슈 (8) ===
Key      | Summary                       | Status      | Points | Epic
---------|-------------------------------|-------------|--------|--------
EUV-3301 | Define ISimulator interface   | In Progress | 3      | EUV-3299
EUV-3303 | Add unit tests                | In Progress | 2      | EUV-3299
EUV-3310 | Fix critical bug              | In Progress | 3      | EUV-3299
EUV-3302 | Implement mock simulator      | To Do       | 5      | EUV-3299
EUV-3305 | Documentation                 | Done        | 1      | EUV-3299
...

Progress: 1/8 done | Points: 21 total

=== 최근 커밋 (7일) ===
Date       | Repo        | Message
-----------|-------------|------------------------------------------
2024-01-23 | oqc-backend | feat: add simulator interface
2024-01-22 | oqc-backend | fix: data validation issue
2024-01-21 | oqc-backend | refactor: clean up error handling

=== 오픈 PR ===
#42 | feat/simulator-interface | oqc-backend | OPEN
```

### `/javis-dev team`

```
=== Team Dashboard: Scaled Sprint14 ===

Member     | Assigned | Done | In Progress | Completion | Points | Commits(7d)
-----------|----------|------|-------------|------------|--------|------------
Gerald     | 8        | 1    | 3           | 12%        | 21     | 15
Tushar     | 6        | 3    | 2           | 50%        | 15     | 12
James      | 5        | 2    | 1           | 40%        | 12     | 8
Unassigned | 5        | 0    | 0           | 0%         | 14     | -

=== Summary ===
Total: 24 issues assigned
Team completion: 25%
Most active: Gerald (15 commits)
```

### `/javis-dev commits`

```
=== Commit Activity (Last 7 Days) ===

Author      | Commits | Repos | Active Days
------------|---------|-------|------------
Gerald Park | 15      | 2     | 5
Tushar      | 12      | 1     | 4
James       | 8       | 2     | 3

=== By Repository ===
oqc-backend: 25 commits
oqc-frontend: 10 commits
```

### `/javis-dev workload`

```
=== Workload Analysis ===

Member     | To Do | In Progress | Open Total | Open Points
-----------|-------|-------------|------------|------------
Gerald     | 4     | 3           | 7          | 18
Tushar     | 1     | 2           | 3          | 8
James      | 2     | 1           | 3          | 7

Warning: Gerald has high workload (7 open issues, 18 points)
```

## 스크립트 사용

```bash
# 내 대시보드
python3 .claude/skills/dev/scripts/dev.py me

# 특정 개발자
python3 .claude/skills/dev/scripts/dev.py show Tushar

# 팀 현황
python3 .claude/skills/dev/scripts/dev.py team

# 커밋 활동
python3 .claude/skills/dev/scripts/dev.py commits

# PR 현황
python3 .claude/skills/dev/scripts/dev.py prs

# 작업 부하
python3 .claude/skills/dev/scripts/dev.py workload
```
