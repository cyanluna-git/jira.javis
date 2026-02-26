---
name: javis-risk
description: 프로젝트 리스크 감지 및 관리. 자동 감지, 리스크 목록, 분석, 해결. 사용법: /javis-risk, /javis-risk detect, /javis-risk list, /javis-risk analyze, /javis-risk resolve
argument-hint: "[detect|list|analyze|resolve|report] [epic_key|risk_id]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-risk - 리스크 관리

프로젝트 리스크를 자동 감지하고 관리합니다.

## 리스크 유형

| Type | 설명 |
|------|------|
| `delay` | 스프린트 종료 임박 + 낮은 완료율 |
| `blocker` | Blocker priority 이슈 존재 |
| `velocity_drop` | 이전 평균 대비 20% 이상 하락 |
| `resource_conflict` | 한 명에게 과다 할당 |
| `stale_issue` | In Progress 14일 이상 |

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/javis-risk` | 현재 오픈 리스크 요약 |
| `/javis-risk detect` | 자동 리스크 감지 실행 |
| `/javis-risk list` | 리스크 목록 조회 |
| `/javis-risk analyze <epic>` | Epic/Sprint 리스크 분석 |
| `/javis-risk resolve <id>` | 리스크 해결 처리 |

## 빠른 실행

```bash
# 리스크 요약
python3 .claude/skills/javis-risk/scripts/risk.py summary

# 자동 감지
python3 .claude/skills/javis-risk/scripts/risk.py detect

# 리스크 목록
python3 .claude/skills/javis-risk/scripts/risk.py list
```

## 추가 리소스

- 감지 로직 및 기준: [reference.md](reference.md)
- 사용 예시 및 워크플로우: [examples.md](examples.md)
- 헬퍼 스크립트: [scripts/risk.py](scripts/risk.py)

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 리스크 | `roadmap_risks` |
| 스프린트 | `jira_sprints`, `jira_issue_sprints` |
| 이슈 | `jira_issues` |
