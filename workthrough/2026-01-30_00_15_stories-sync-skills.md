# Stories & Sync Skills 구현

## 개요
로컬 DB 기반 Story 관리와 전체 동기화를 위한 Claude Code Skills를 구현했다. `/stories`로 Epic 하위 Story를 AI로 생성하고 Jira에 직접 push하며, `/sync`로 Issues/Boards/Members/Confluence 전체 동기화를 관리한다.

## 주요 변경사항

### 1. `/stories` Skill (`.claude/skills/stories/SKILL.md`)
- **context**: Vision 맥락 조회 (목표, Milestone, Epic, 팀 구성)
- **list**: Epic 하위 Story 목록
- **create**: AI가 Epic 기반 Story 초안 생성
- **refine**: AC/Points 정제
- **push**: Jira API로 직접 생성 (Epic의 Component 자동 상속)

### 2. `/sync` Skill (`.claude/skills/sync/SKILL.md`)
- **all**: 전체 동기화 (Issues + Boards + Members)
- **issues**: Jira Issues 양방향 동기화
- **boards**: Boards/Sprints 동기화
- **members**: Member 통계 동기화
- **confluence**: Confluence 양방향 동기화
- **status/conflicts**: 상태 확인 및 충돌 해결

### 3. Jira Story 생성 결과
EUV-3299 (Simulation Engine) Epic 하위 6개 Story 생성:
- EUV-3306 ~ EUV-3311 (Total 15 pts)
- Component: OQCDigitalization 자동 설정

## 결과
- ✅ `/stories` skill 동작 확인
- ✅ 6개 Story Jira 생성 완료
- ✅ Component 자동 상속 구현

## 다음 단계
- `/sync` skill 세션 재시작 후 테스트
- 다른 Epic에 Story 생성 테스트
- Sprint 할당 자동화 검토
