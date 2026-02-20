# 로드맵 Epic 계층 구조 및 Jira 동기화

## 개요
Vision → Milestone → Epic → Issue 계층 구조를 완성하고, 로컬에서 Epic을 계획한 후 Jira에 동기화하는 워크플로우를 구현했습니다. OQC Digitalization 프로젝트의 첫 번째 마일스톤 "The Walking Skeleton"에 7개 Epic을 생성하고 Jira에 성공적으로 동기화했습니다.

## 주요 변경사항

### 1. DB 테이블 생성
- `roadmap_local_epics` 테이블 신규 생성 (Draft Epic 관리용)
- status: draft → ready → synced 워크플로우

### 2. API 엔드포인트
- `GET/POST /api/roadmap/local-epics` - 목록/생성
- `GET/PUT/DELETE /api/roadmap/local-epics/[id]` - 상세/수정/삭제
- `GET /api/roadmap/visions/[id]/issues` - Vision별 Epic-Issue 계층 조회

### 3. UI 컴포넌트
- `MilestoneCard`: Draft Epics 섹션 추가 (접기/펼치기, 마크다운 렌더링)
- `EpicIssueTree`: Epic-Issue 트리 표시 컴포넌트
- Vision 상세 페이지: Project Issues 섹션 (Linked/Unlinked Epics)

### 4. 동기화 스크립트
- `sync_local_epics_to_jira.py` 신규 생성
  - `--list`: 로컬 Epic 목록 확인
  - `--set-ready`: draft → ready 상태 변경
  - `--dry-run`: 미리보기
  - Component 자동 설정 (Vision의 jql_filter에서 파싱)

### 5. 설계 문서
- `docs/design-roadmap-epic-structure.md` 작성

## 생성된 Epic (EUV 프로젝트)

| Key | Epic | 담당자 |
|-----|------|--------|
| EUV-3299 | Simulation Engine | Dave Kim |
| EUV-3300 | Protocol Abstraction Layer | Dave Kim |
| EUV-3301 | Local Persistence & State | Owen Rim |
| EUV-3302 | Hello World Scenarios | Andrew, Daniel, Jess, Akshay |
| EUV-3303 | The Bridge (Sync API) | Bipin |
| EUV-3304 | Edge FE Enhancement | Owen Rim |
| EUV-3305 | Dashboard Integration | Bipin |

## 결과
- ✅ 빌드 성공
- ✅ 7개 Epic Jira 동기화 완료
- ✅ 양방향 동기화로 Component 수정 반영 확인

## 다음 단계
- Epic 수정/삭제 UI 추가
- Milestone 2, 3, 4 Epic 계획 및 생성
- Story/Task 레벨 계획 기능
- Epic 진행률 자동 계산 (하위 Issue 기반)
