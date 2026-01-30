# /javis-stories 스킬 사용 및 Story 생성

**일시**: 2026-01-30 21:00
**작업 유형**: 스킬 활용, Story 초안 생성

## 작업 내용

### 1. /javis-stories 스킬 분석
- 스킬 구조 및 동작 방식 확인
- `create` 명령어: AI가 마크다운으로 Story 초안 생성
- `push` 명령어: JSON으로 변환하여 Jira API 호출

### 2. EUV-3299 Epic Story 생성
- Epic: Simulation Engine (장비 없이 개발/테스트 가능한 Mock 환경 구축)
- Epic description에 정의된 6개 Story + 추가 제안 2개 = 총 8개 Story 초안 생성

**생성된 Story 목록**:
| # | Story | Points |
|---|-------|--------|
| 1 | Simulator 공통 인터페이스 정의 | 3 |
| 2 | Simulation Config Schema 정의 | 2 |
| 3 | EUV Simulator 구현 | 5 |
| 4 | Abatement Simulator 구현 | 5 |
| 5 | Vacuum Pump Simulator 구현 | 5 |
| 6 | Mode Switcher API 구현 | 3 |
| 7 | (추가) 통합 테스트 환경 구축 | 3 |
| 8 | (추가) 개발 문서화 | 2 |

**Total**: 28 Points

### 3. 버그 수정
- `stories.py` 스크립트 중복 `if __name__` 구문 오류 수정

## 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `.claude/skills/stories/scripts/stories.py` | 중복 if문 제거 |
| `.gitignore` | `docs/stories/` 추가 (로컬 전용) |
| `docs/stories/EUV-3299-stories.md` | Story 초안 (gitignore) |

## 향후 작업

- Story 검토 후 필요시 수정
- 확정되면 `/javis-stories push EUV-3299`로 Jira 생성
- 다른 Epic들도 동일 방식으로 Story 생성 가능
