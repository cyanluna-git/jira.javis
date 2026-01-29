# Javis Project Skills 사용법

프로젝트 전용 Claude Code Skills 사용 가이드.

## Skills 목록

| Skill | 설명 |
|-------|------|
| `/stories` | Story 관리 (생성, 정제, Jira push) + Bitbucket 개발 현황 |
| `/sync` | Jira/Confluence/Bitbucket 전체 데이터 동기화 |

---

## `/stories` - Story 관리

### 명령어

```bash
/stories context [vision]     # Vision 맥락 + Bitbucket 개발 현황 조회
/stories list <epic_key>      # Epic 하위 Story + 관련 커밋/PR 목록
/stories create <epic_key>    # AI Story 초안 생성
/stories refine <epic_key>    # AC/Points 정제
/stories push <epic_key>      # Jira에 직접 생성
```

### 워크플로우

```bash
/stories context OQC          # 1. 맥락 파악 (커밋/PR 현황 포함)
/stories list EUV-3299        # 2. 현재 Story 및 개발 현황 확인
/stories create EUV-3299      # 3. AI가 Story 초안 생성
/stories refine EUV-3299      # 4. AC/Points 정제
/stories push EUV-3299        # 5. Jira에 생성
```

### 특징
- Epic의 Component 자동 상속
- ADF 형식으로 Description 변환
- 생성 후 자동 DB 동기화
- **Bitbucket 연동**: Epic/Story 관련 커밋, PR, 개발자 활동 표시

---

## `/sync` - 데이터 동기화

### 명령어

```bash
/sync all                     # 전체 동기화
/sync issues [pull|push]      # Jira Issues
/sync boards                  # Boards/Sprints
/sync members                 # Member 통계
/sync confluence              # Confluence Pages
/sync bitbucket [--days N]    # Bitbucket Repos/Commits/PRs
/sync status                  # 동기화 상태 (Bitbucket 포함)
/sync conflicts               # 충돌 확인/해결
```

### 워크플로우

```bash
# 아침 동기화
/sync all

# 작업 후 Push
/sync issues push --dry-run
/sync issues push

# 스프린트 시작
/sync boards
/sync members --init
```

### 스크립트 매핑

| 명령어 | 스크립트 |
|--------|----------|
| `/sync issues` | `sync_bidirectional.py` |
| `/sync boards` | `sync_boards.py` |
| `/sync members` | `sync_member_stats.py` |
| `/sync confluence` | `sync_confluence_bidirectional.py` |
| `/sync bitbucket` | `sync_bitbucket.py` |

---

## 파일 위치

```
.claude/skills/
├── stories/SKILL.md    # Story 관리
└── sync/SKILL.md       # 동기화
```

## 참고
- Skills는 프로젝트 레벨 (`.claude/skills/`)
- 새 세션에서 자동 인식
- 글로벌 skills는 `~/.claude/skills/`
