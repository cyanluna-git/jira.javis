---
name: javis-dev
description: 개발자 대시보드. 내 작업 현황, 커밋/PR 활동, 스프린트 기여도, 팀 비교. 사용법: /javis-dev, /javis-dev <name>, /javis-dev commits, /javis-dev prs, /javis-dev team
argument-hint: "[me|team|commits|prs|workload] [name]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-dev - 개발자 대시보드

개발자별 작업 현황, 커밋/PR 활동, 스프린트 기여도를 조회합니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/javis-dev` | 내 작업 현황 대시보드 |
| `/javis-dev <name>` | 특정 개발자 대시보드 |
| `/javis-dev commits` | 커밋 활동 분석 |
| `/javis-dev prs` | PR 활동 분석 |
| `/javis-dev team` | 팀 전체 현황 |
| `/javis-dev workload` | 작업 부하 분석 |

## 빠른 실행

```bash
# 내 대시보드 (Gerald 기준)
python3 .claude/skills/javis-dev/scripts/dev.py me

# 팀 현황
python3 .claude/skills/javis-dev/scripts/dev.py team

# 커밋 활동 (7일)
python3 .claude/skills/javis-dev/scripts/dev.py commits

# PR 현황
python3 .claude/skills/javis-dev/scripts/dev.py prs
```

## 추가 리소스

- 상세 쿼리 및 분석: [reference.md](reference.md)
- 사용 예시 및 워크플로우: [examples.md](examples.md)
- 헬퍼 스크립트: [scripts/dev.py](scripts/dev.py)

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 팀원 정보 | `team_members` |
| 멤버 통계 | `member_stats` |
| 할당 이슈 | `jira_issues` |
| 커밋 | `bitbucket_commits` |
| PR | `bitbucket_pullrequests` |
