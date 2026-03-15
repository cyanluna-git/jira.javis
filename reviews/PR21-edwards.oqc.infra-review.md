## PR #21 Backend/Frontend Code Review: EUV-3401, EUV-3402

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: fixes/auto_code to main
**Author**: Bipin Mishra
**Date**: 2026-03-06
**Domain**: Mixed (Backend + Frontend)

---

### Change Summary

FTCC 카탈로그 저작 시스템의 핵심 인프라를 구현하는 대규모 PR입니다. 백엔드에서는 ftcc_catalogs, server_form_definitions, gherkin_scripts 3개 테이블과 전체 CRUD API를 신규 추가하고, 승인 워크플로우를 위한 catalog_reviews 테이블도 마이그레이션으로 포함했습니다. 프론트엔드에서는 기존 TestDesignerDashboard를 PDP 기반에서 제품 트리 -> 카탈로그 -> Form Definition 구조로 전면 재작성하고, Scenario Catalog 뷰를 신규 추가했습니다.

---

### Must-fix Before Merge

| # | 타입 | 파일 | 설명 |
|---|------|------|------|
| 1 | [Logic] | catalogs.py:update_form_definition | Published 카탈로그의 Form Definition 수정이 차단되지 않음 |
| 2 | [Logic] | catalog.py:CatalogStatus | Python Enum에 DB 마이그레이션의 review 상태값 누락 |

---

#### 1. [Logic] Published 카탈로그의 Form Definition 수정 미차단

PATCH /form-definitions/{fd_id} 엔드포인트에 카탈로그 상태 검사가 없습니다.

문제 위치: apps/server-backend/src/routers/catalogs.py - update_form_definition 함수

| 작업 | Published 카탈로그 보호 |
|------|------------------------|
| POST (form def 추가) | 409 반환 (보호됨) |
| DELETE (form def 삭제) | 409 반환 (보호됨) |
| **PATCH (form def 수정)** | **보호 없음 (버그)** |

Published 카탈로그는 Edge Runner에 배포된 불변 문서여야 합니다. form_schema 나 section_number 가 수정되면 이미 배포된 테스트 시나리오와 정합성이 깨집니다.

수정 방법: update_form_definition 함수에서 fd 조회 직후 아래 코드 추가:
    cat = await db.get(FtccCatalogModel, fd.catalog_id)
    if cat is not None and cat.status == CatalogStatus.PUBLISHED:
        raise HTTPException(status_code=409, detail="Cannot update form definitions in a published catalog")

---

#### 2. [Logic] CatalogStatus Python Enum에 review 값 누락

DB 마이그레이션은 catalogstatus ENUM에 review 값을 포함하지만, Python 모델은 이 값을 정의하지 않았습니다.

문제 위치: apps/server-backend/src/models/catalog.py:576-579

마이그레이션 a1c4f8e2b5d7 DDL: CREATE TYPE catalogstatus AS ENUM (draft, review, published, archived)
Python Enum에는 DRAFT, PUBLISHED, ARCHIVED만 있고 review 가 누락됐습니다.

catalog_reviews 테이블과 함께 승인 워크플로우를 위한 review 상태가 DB에는 존재하지만 ORM에 매핑되지 않았습니다. 향후 DB에서 status=review 행을 읽으면 SQLAlchemy가 LookupError를 발생시킵니다.

수정 방법: CatalogStatus 에 REVIEW = "review" 추가.

---

### Suggested Improvements

| # | 타입 | 파일 | 설명 |
|---|------|------|------|
| 1 | [Security] | main.py:508-514 | 예외 핸들러의 CORS 헤더가 허용 오리진 목록을 무시 |
| 2 | [Security] | catalogs.py:publish_catalog | 카탈로그 Publish 권한 검사 없음 |
| 3 | [DB] | Migration d4e7c2f9a1b8 | 의도적으로 깨진 downgrade 경로 |
| 4 | [DB] | gherkin_scripts 테이블 | (form_definition_id, scenario_tag) 유니크 제약 없음 |
| 5 | [Testing] | test_catalogs.py | SQLite 테스트가 PostgreSQL 특화 타입 검증 불가 |
| 6 | [Observability] | catalogs.py:validate_gherkin_script | validated 상태명이 실제 검증 범위를 과장 |
| 7 | [Component] | TestDesignerDashboard.tsx | 550줄 컴포넌트 - 상태 로직 커스텀 훅 분리 필요 |

---

#### 1. [Security] 예외 핸들러 CORS 오리진 무제한 에코

위치: apps/server-backend/src/main.py:508-514

CORS 미들웨어에 설정된 허용 오리진 목록을 무시하고, 500 에러 응답 시 모든 오리진을 허용합니다. 개발 환경의 traceback 정보가 의도하지 않은 오리진으로 유출될 수 있습니다.

개선안: settings 의 허용 오리진 목록과 대조 후 에코
    if origin in settings.BACKEND_CORS_ORIGINS:
        extra_headers["Access-Control-Allow-Origin"] = origin
        extra_headers["Access-Control-Allow-Credentials"] = "true"

---

#### 2. [Security] Publish 권한 검사 없음

위치: apps/server-backend/src/routers/catalogs.py:publish_catalog

catalog_reviews 테이블이 존재하고 승인 워크플로우가 설계되어 있음에도 불구하고, Publish는 인증된 모든 사용자가 직접 실행할 수 있습니다. 시나리오 엔지니어 본인이 작성·게시를 모두 할 수 있어 4-eye 원칙이 적용되지 않습니다. 역할 기반 권한 검사 또는 catalog_reviews 승인 레코드 확인 로직 추가를 권장합니다.

---

#### 3. [DB] 의도적으로 깨진 Downgrade 경로

위치: apps/server-backend/alembic/versions/d4e7c2f9a1b8_*.py:286-298

Alembic downgrade가 불가능한 마이그레이션은 긴급 롤백 옵션을 제거합니다. d4e7c2f9a1b8과 e5f2a8c3d6b1을 단일 마이그레이션으로 통합하거나, downgrade()에서 raise NotImplementedError를 명시적으로 던져 의도를 명확히 하는 것을 권장합니다.

---

#### 4. [DB] gherkin_scripts 중복 시나리오 허용

위치: apps/server-backend/alembic/versions/a1c4f8e2b5d7_*.py:153-194

gherkin_scripts 테이블에 (form_definition_id, scenario_tag) 복합 유니크 제약이 없습니다. 동일한 Form Definition에 같은 scenario_tag를 가진 스크립트가 중복 생성될 수 있으며, Edge Runner가 어느 스크립트를 실행할지 모호해집니다.

수정 방법: 마이그레이션에 sa.UniqueConstraint("form_definition_id", "scenario_tag", name="uq_gs_fd_tag") 추가

---

#### 5. [Testing] SQLite 기반 테스트의 PostgreSQL 커버리지 한계

위치: apps/server-backend/tests/unit/test_catalogs.py:1818-1884

TEXT로 매핑한 SQLite DDL을 사용하여 PostgreSQL의 JSONB, UUID, ENUM 타입을 우회합니다. form_schema JSONB 쿼리, UUID FK 무결성, automationtype ENUM 범위 검사 등이 테스트되지 않습니다. pytest-postgresql 또는 Docker Compose 기반 PostgreSQL 픽스처 도입을 추천합니다.

---

#### 6. [Observability] validate_gherkin_script의 오해 소지 있는 상태명

위치: apps/server-backend/src/routers/catalogs.py:1695-1747

Feature: 키워드 존재 여부 등 기본 문자열 검사만 수행하지만, 성공 시 status = GherkinScriptStatus.VALIDATED로 설정합니다. 코드 내 TODO(EUV-3403)가 한계를 인정하고 있으나, UI에서 validated를 보는 사용자는 Edge Runner 단계 바인딩까지 검증됐다고 오인할 수 있습니다. API 응답에 validation_level: syntax_only 필드 추가를 검토하세요.

---

#### 7. [Component] TestDesignerDashboard 단일 책임 원칙 위반

위치: apps/server-frontend/src/components/dashboards/TestDesignerDashboard.tsx

550줄에 걸쳐 제품 트리 로딩, 카탈로그 CRUD, Form Definition 편집, Publish 흐름, 삭제 확인 모달까지 모두 관리합니다. useCatalogDesigner() 같은 커스텀 훅으로 데이터 페칭/상태 로직을 분리하면 컴포넌트는 순수 UI 레이어로 유지되고 테스트도 용이해집니다.

---

### Well Done

- 마이그레이션 품질: 4개 마이그레이션이 순차적으로 체계적으로 작성됨. IF NOT EXISTS 가드, 인덱스 명명 규칙, FK 참조 일관성이 모두 양호합니다.
- 엔드포인트 일관성: 카탈로그/Form Definition/Gherkin Script 전 계층에 걸쳐 GET, POST, PATCH, DELETE가 누락 없이 구현됐고, 네이밍 규칙도 일관됩니다.
- Eager loading 처리: selectinload 사용으로 N+1 문제를 의식적으로 회피했고, create 이후 재쿼리(scalar_one())로 관계 로딩 문제를 올바르게 처리했습니다.
- AbortController 적용: 프론트엔드에서 loadAbortRef, editAbortRef를 통해 요청 경합을 방지하는 패턴을 적용한 것이 인상적입니다.
- 단위 테스트 커버리지: Published 카탈로그 불변성, 이중 Publish 방지 등 핵심 비즈니스 규칙에 대한 테스트가 체계적으로 작성되어 있습니다.

---

### Final Verdict

**CHANGES REQUESTED**

update_form_definition에서 Published 카탈로그 불변성이 깨지는 로직 버그와 DB 스키마와 불일치하는 CatalogStatus Enum 문제가 확인됩니다. 두 항목 모두 데이터 무결성에 직결되므로 수정 후 재검토가 필요합니다.