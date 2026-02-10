---
name: javis-sprint
description: 스프린트 관리. 현재/과거 스프린트 조회, velocity 추적, 스프린트 계획, 멤버별 작업량. 사용법: /javis-sprint, /javis-sprint list, /javis-sprint velocity, /javis-sprint plan
argument-hint: "[current|list|velocity|plan|burndown|member] [sprint_name|member_name]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-sprint - 스프린트 관리

스프린트 현황 조회, velocity 추적, 스프린트 계획을 지원합니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/javis-sprint` | 현재 활성 스프린트 상태 |
| `/javis-sprint list` | 최근 스프린트 목록 |
| `/javis-sprint <name>` | 특정 스프린트 상세 |
| `/javis-sprint velocity` | Velocity 추이 분석 |
| `/javis-sprint plan [epic]` | 다음 스프린트 계획 |
| `/javis-sprint burndown` | 번다운 차트 데이터 |
| `/javis-sprint member <name>` | 멤버별 현황 |

## 빠른 실행

```bash
# 현재 스프린트
python3 .claude/skills/sprint/scripts/sprint.py current

# Velocity 추이
python3 .claude/skills/sprint/scripts/sprint.py velocity

# 담당자별 현황
python3 .claude/skills/sprint/scripts/sprint.py assignees
```

## 추가 리소스

- 상세 쿼리 및 분석 방법: [reference.md](reference.md)
- 사용 예시 및 워크플로우: [examples.md](examples.md)
- 헬퍼 스크립트: [scripts/sprint.py](scripts/sprint.py)

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 스프린트 | `jira_sprints` |
| 보드 | `jira_boards` |
| 이슈-스프린트 매핑 | `jira_issue_sprints` |
| 이슈 상세 | `jira_issues` |
| 멤버 통계 | `member_stats` |
