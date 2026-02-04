# 도메인별 코드 리뷰 스킬 3종 구현

## 개요
기존 `/review-pr` 범용 리뷰 스킬을 PLC, Backend, Frontend 3개 도메인 전문 리뷰 스킬로 분리 구현. Edwards Unify Plasma 프로젝트의 설계 문서 6개를 분석하여 PLC 전용 아키텍처 가이드를 통합 요약 문서로 작성.

## 주요 변경사항

### 새로 생성한 파일 (7개)
- **`/review-plc`** — CODESYS ST 코드 리뷰
  - `SKILL.md` — 스킬 정의 + 워크플로우
  - `reference.md` — 10가지 PLC 전문 관점 (Naming, Architecture, StateMachine, Memory, Registration, Execution, Config, Valve, Alert, Testing)
  - `plc-architecture-guide.md` — 프로젝트 설계 문서 6개를 통합 요약한 리뷰 기준 문서
- **`/review-backend`** — Backend 코드 리뷰
  - `SKILL.md` + `reference.md` — 10가지 관점 (API, Security, DB, Error, Perf, Concurrency, Logic, Config, Observability, Testing)
- **`/review-frontend`** — Frontend 코드 리뷰
  - `SKILL.md` + `reference.md` — 10가지 관점 (Component, State, Hooks, Perf, TypeSafety, UX, Security, Style, DataFetching, Testing)

### 아키텍처 결정
- 공통 `review_pr.py` 스크립트는 `review-pr/scripts/`에 유지, 3개 스킬이 모두 참조
- PLC 참조 문서는 개별 링크 대신 `plc-architecture-guide.md` 통합 요약 문서 하나로 집약
- 각 도메인별 10개 리뷰 관점, 분류 기준, 출력 포맷을 독립적으로 정의

## 결과
- `/review-plc`, `/review-backend`, `/review-frontend` 3개 스킬 등록 확인
- 기존 `/review-pr` 범용 스킬은 그대로 유지 (하위 호환)

## 다음 단계
- 실제 PLC PR로 `/review-plc` 테스트 실행
- Backend/Frontend PR로 각 스킬 테스트
- 필요시 `plc-architecture-guide.md`에 프로젝트 업데이트 반영
