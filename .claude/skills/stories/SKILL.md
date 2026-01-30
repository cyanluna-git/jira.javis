---
name: javis-stories
description: 로컬 DB 기반 Story 관리. Vision/Epic 맥락 조회, Story 목록, AI 생성/정제, Jira 동기화. 사용법: /javis-stories context, /javis-stories list <epic>, /javis-stories create <epic>, /javis-stories refine <epic>, /javis-stories push <epic>
argument-hint: "[context|list|create|refine|push] [vision_title|epic_key]"
allowed-tools: Bash(python3 *), Read, Grep
---

# /javis-stories - Story 관리

로컬 PostgreSQL DB를 기반으로 Story를 관리하고 Jira와 동기화합니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/javis-stories context [vision]` | Vision의 프로젝트 맥락 조회 |
| `/javis-stories list <epic_key>` | Epic 하위 Story 목록 |
| `/javis-stories create <epic_key>` | AI가 Story 초안 생성 |
| `/javis-stories refine <epic_key>` | 기존 Story AC/Points 정제 |
| `/javis-stories push <epic_key>` | Story를 Jira에 생성 |

## 빠른 실행

```bash
# Vision 맥락 조회
python3 .claude/skills/stories/scripts/stories.py context OQC

# Epic Story 목록
python3 .claude/skills/stories/scripts/stories.py list EUV-3299

# Epic 개발 현황 (커밋/PR)
python3 .claude/skills/stories/scripts/stories.py dev EUV-3299
```

## 추가 리소스

- 상세 쿼리 및 API 문서: [reference.md](reference.md)
- 사용 예시 및 워크플로우: [examples.md](examples.md)
- 헬퍼 스크립트: [scripts/stories.py](scripts/stories.py)

## 데이터 소스

| 정보 | 테이블 |
|------|--------|
| Vision 목표 | `roadmap_visions` |
| Milestone 현황 | `roadmap_milestones` |
| Epic/Story | `jira_issues` |
| 팀 구성 | `roadmap_vision_members` + `team_members` |
| 커밋 이력 | `bitbucket_commits` |
| PR 현황 | `bitbucket_pullrequests` |
