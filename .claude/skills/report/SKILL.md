
---
name: javis-report
description: 프로젝트 리포트 생성. 스프린트 리포트, 팀 성과, 프로젝트 현황, Epic 진행률. 사용법: /javis-report sprint, /javis-report team, /javis-report project, /javis-report epic, /javis-report weekly
argument-hint: "[sprint|team|project|epic|weekly|velocity|vision] [name|key]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-report - 프로젝트 리포트

스프린트, 팀, 프로젝트 현황에 대한 리포트를 생성합니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/javis-report sprint [name]` | 스프린트 리포트 |
| `/javis-report team` | 팀 성과 리포트 |
| `/javis-report project [key]` | 프로젝트 현황 |
| `/javis-report epic <key>` | Epic 상세 리포트 |
| `/javis-report weekly` | 주간 리포트 |
| `/javis-report velocity` | Velocity 추이 리포트 |
| `/javis-report vision [title]` | Vision 진행 현황 |

## 빠른 실행

```bash
# 스프린트 리포트
python3 .claude/skills/report/scripts/report.py sprint

# 주간 리포트
python3 .claude/skills/report/scripts/report.py weekly

# Epic 리포트
python3 .claude/skills/report/scripts/report.py epic EUV-3299
```

## 추가 리소스

- 상세 쿼리 및 리포트 포맷: [reference.md](reference.md)
- 사용 예시 및 출력 샘플: [examples.md](examples.md)
- 헬퍼 스크립트: [scripts/report.py](scripts/report.py)

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| 스프린트 | `jira_sprints`, `jira_issue_sprints` |
| 이슈 | `jira_issues` |
| 팀원 | `team_members`, `member_stats` |
| Epic/Vision | `roadmap_visions`, `roadmap_milestones`, `roadmap_epic_links` |
| 커밋/PR | `bitbucket_commits`, `bitbucket_pullrequests` |

## 리포트 형식

모든 리포트는 **마크다운 형식**으로 생성됩니다:
- 제목: `# Report Title`
- 섹션: `## Section`
- 테이블: `| Col | Col |`
- 리스트: `- item`
