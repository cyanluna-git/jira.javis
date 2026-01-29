# Javis Project Skills 사용법

프로젝트 전용 Claude Code Skills 사용 가이드.

## Skills 목록

| Skill | 설명 |
|-------|------|
| `/javis-stories` | Story 관리 (생성, 정제, Jira push) + Bitbucket 개발 현황 |
| `/javis-sprint` | 스프린트 관리 (현황, velocity, 계획, 멤버별 작업) |
| `/javis-dev` | 개발자 대시보드 (내 작업, 커밋/PR, 팀 비교) |
| `/javis-report` | 프로젝트 리포트 (스프린트, 팀, Epic, 주간, velocity) |
| `/javis-risk` | 리스크 감지 및 관리 (자동 감지, 분석, 해결) |
| `/javis-sync` | Jira/Confluence/Bitbucket 전체 데이터 동기화 |

---

## `/javis-stories` - Story 관리

### 명령어

```bash
/javis-stories context [vision]     # Vision 맥락 + Bitbucket 개발 현황 조회
/javis-stories list <epic_key>      # Epic 하위 Story + 관련 커밋/PR 목록
/javis-stories create <epic_key>    # AI Story 초안 생성
/javis-stories refine <epic_key>    # AC/Points 정제
/javis-stories push <epic_key>      # Jira에 직접 생성
```

### 워크플로우

```bash
/javis-stories context OQC          # 1. 맥락 파악 (커밋/PR 현황 포함)
/javis-stories list EUV-3299        # 2. 현재 Story 및 개발 현황 확인
/javis-stories create EUV-3299      # 3. AI가 Story 초안 생성
/javis-stories refine EUV-3299      # 4. AC/Points 정제
/javis-stories push EUV-3299        # 5. Jira에 생성
```

### 특징
- Epic의 Component 자동 상속
- ADF 형식으로 Description 변환
- 생성 후 자동 DB 동기화
- **Bitbucket 연동**: Epic/Story 관련 커밋, PR, 개발자 활동 표시

---

## `/javis-sprint` - 스프린트 관리

### 명령어

```bash
/javis-sprint                       # 현재 활성 스프린트 현황
/javis-sprint list                  # 최근 스프린트 목록
/javis-sprint <sprint_name>         # 특정 스프린트 상세
/javis-sprint velocity              # Velocity 추이 (최근 6개)
/javis-sprint plan [epic_key]       # 다음 스프린트 계획 (백로그)
/javis-sprint burndown              # 번다운 차트 데이터
/javis-sprint member <name>         # 멤버별 작업 현황
```

### 워크플로우

```bash
# 데일리 스크럼
/javis-sprint                       # 현재 스프린트 진행 상황
/javis-sprint member Gerald         # 내 작업 확인

# 스프린트 계획
/javis-sprint velocity              # 예상 capacity 확인
/javis-sprint plan EUV-3299         # Epic별 백로그 확인

# 스프린트 회고
/javis-sprint Scaled Sprint13       # 완료된 스프린트 상세
/javis-sprint velocity              # velocity 변화 분석
```

### 특징
- 담당자별 작업량 분석
- Velocity 추이 및 예측
- Bitbucket 커밋과 연동

---

## `/javis-dev` - 개발자 대시보드

### 명령어

```bash
/javis-dev                          # 내 대시보드 (현재 할당, 커밋, PR)
/javis-dev <name>                   # 특정 개발자 대시보드
/javis-dev commits [--days N]       # 커밋 활동 분석
/javis-dev prs [--state OPEN]       # PR 활동 분석
/javis-dev team                     # 팀 전체 현황 비교
/javis-dev stats <name>             # 개발자 통계 (히스토리)
/javis-dev workload                 # 팀 작업 부하 분석
```

### 워크플로우

```bash
# 아침 내 작업 확인
/javis-dev                          # 내 할당 이슈, 커밋, PR

# 팀원 상황 파악
/javis-dev Tushar                   # 특정 팀원 현황
/javis-dev team                     # 팀 전체 비교

# 주간 활동 리뷰
/javis-dev commits --days 7         # 7일간 커밋 활동
/javis-dev stats Gerald             # 내 통계 추이
```

### 특징
- Jira 할당 이슈 + Bitbucket 커밋/PR 통합
- 팀원별 작업 부하 분석
- 스프린트 기여도 비교

---

## `/javis-report` - 프로젝트 리포트

### 명령어

```bash
/javis-report sprint [name]         # 스프린트 리포트 (기본: 현재)
/javis-report team                  # 팀 성과 리포트
/javis-report project [key]         # 프로젝트 현황 리포트
/javis-report epic <epic_key>       # Epic 상세 리포트
/javis-report weekly                # 주간 리포트
/javis-report velocity              # Velocity 추이 리포트
/javis-report vision [title]        # Vision 진행 현황 리포트
```

### 워크플로우

```bash
# 데일리 스탠드업
/javis-report sprint                # 현재 스프린트 현황

# 스프린트 회고
/javis-report sprint "Sprint13"     # 완료 스프린트 분석
/javis-report velocity              # velocity 추이

# 주간 보고
/javis-report weekly                # 주간 활동 요약
/javis-report team                  # 팀 성과
```

### 특징
- 마크다운 형식 리포트 생성
- Jira + Bitbucket 통합 데이터
- 자동 계산 (완료율, velocity, 기여도)

---

## `/javis-risk` - 리스크 관리

### 명령어

```bash
/javis-risk                         # 현재 오픈 리스크 요약
/javis-risk detect                  # 자동 리스크 감지 실행
/javis-risk list [--type TYPE]      # 리스크 목록
/javis-risk analyze <epic|sprint>   # 특정 대상 리스크 분석
/javis-risk create                  # 수동 리스크 등록
/javis-risk resolve <id>            # 리스크 해결 처리
/javis-risk report                  # 리스크 현황 리포트
```

### 리스크 유형

| Type | 감지 기준 |
|------|----------|
| `delay` | 스프린트 종료 임박 + 낮은 완료율 |
| `blocker` | Blocker priority 이슈 |
| `velocity_drop` | 이전 평균 대비 20%+ 하락 |
| `resource_conflict` | 한 명에게 과다 할당 (8+) |
| `stale_issue` | In Progress 14일+ 방치 |

### 워크플로우

```bash
# 데일리 리스크 체크
/javis-risk detect                  # 자동 감지
/javis-risk                         # 요약 확인

# Epic 리스크 분석
/javis-risk analyze EUV-3299

# 주간 리포트
/javis-risk report
```

### 특징
- 자동 리스크 감지 (7가지 유형)
- Severity 자동 판정 (critical/high/medium/low)
- AI 기반 대응 제안

---

## `/javis-sync` - 데이터 동기화

### 명령어

```bash
/javis-sync all                     # 전체 동기화
/javis-sync issues [pull|push]      # Jira Issues
/javis-sync boards                  # Boards/Sprints
/javis-sync members                 # Member 통계
/javis-sync confluence              # Confluence Pages
/javis-sync bitbucket [--days N]    # Bitbucket Repos/Commits/PRs
/javis-sync status                  # 동기화 상태 (Bitbucket 포함)
/javis-sync conflicts               # 충돌 확인/해결
```

### 워크플로우

```bash
# 아침 동기화
/javis-sync all

# 작업 후 Push
/javis-sync issues push --dry-run
/javis-sync issues push

# 스프린트 시작
/javis-sync boards
/javis-sync members --init
```

### 스크립트 매핑

| 명령어 | 스크립트 |
|--------|----------|
| `/javis-sync issues` | `sync_bidirectional.py` |
| `/javis-sync boards` | `sync_boards.py` |
| `/javis-sync members` | `sync_member_stats.py` |
| `/javis-sync confluence` | `sync_confluence_bidirectional.py` |
| `/javis-sync bitbucket` | `sync_bitbucket.py` |

---

## 파일 위치

```
.claude/skills/
├── stories/SKILL.md    # javis-stories
├── sprint/SKILL.md     # javis-sprint
├── dev/SKILL.md        # javis-dev
├── report/SKILL.md     # javis-report
├── risk/SKILL.md       # javis-risk
└── sync/SKILL.md       # javis-sync
```

## 참고
- Skills는 프로젝트 레벨 (`.claude/skills/`)
- 새 세션에서 자동 인식
- 글로벌 skills는 `~/.claude/skills/`
