## PR #12 Code Review: EUV-3312 TestSetManagement v2

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: EUV-3312_TestSetManagement_v2 → main
**Author**: Bipin Mishra
**Date**: 2026-02-13

---

### 변경 요약

Test Set Management 기능의 전체 스택 구현 PR입니다. Backend(FastAPI) CRUD API, DB 마이그레이션(feature_files, feature_versions 테이블), Edge Runner 실행 로직, Server Frontend(Admin/Manager TestSetComposer), Edge Frontend(TestSetSelector) 컴포넌트를 포함합니다. Feature 파일을 DB 기반으로 관리하고 Test Set으로 묶어 순차 실행하는 구조입니다.

---

### 머지 전 확인 필요

| # | 유형 | 파일 | 내용 |
|---|------|------|------|
| 1 | [Security] | `.env.production.template:17,35` | 프로덕션 비밀번호/JWT 시크릿이 템플릿에 평문 포함 |
| 2 | [Bug] | `edge-runner/src/api_server.py:1029` | 백엔드 호출 시 하드코딩된 localhost URL |
| 3 | [Security] | `edge-runner/src/api_server.py:1010` | execute-test-set 엔드포인트에 인증 없음 |
| 4 | [Bug] | `edge-runner/src/api_server.py:1170` | abort 시 remaining features 슬라이싱 오류 |
| 5 | [Breaking] | `server-backend/src/routers/test_sets.py:2168` | Pydantic v2 deprecated `.dict()` 사용 |
| 6 | [Redundancy] | `server-frontend/src/components/` | TestSetComposer가 admin/과 manager/ 두 곳에 중복 존재 |

**상세 설명:**

**#1 [Security] `.env.production.template`**
`POSTGRES_PASSWORD=oqc_password_CHANGE_THIS`와 `JWT_SECRET=your_jwt_secret_here_CHANGE_THIS`가 평문으로 포함되어 있습니다. 실수로 이 파일을 그대로 사용하면 프로덕션에 취약한 credential이 배포됩니다.
→ **제안**: 값을 비워두거나 `<REQUIRED>` 등 명시적 플레이스홀더로 변경하고, 백엔드 시작 시 환경변수 미설정이면 에러를 throw하도록 검증 로직 추가.

**#2 [Bug] Edge Runner → Backend 통신 URL**
```python
response = await client.get(
    f"http://localhost:8006/api/test-sets/{request.test_set_id}"
)
# ...
response = await client.get(
    f"http://localhost:8006/api/features/{feature_id}"
)
```
`localhost:8006`이 하드코딩되어 있어 Docker/Production 환경에서 백엔드에 연결할 수 없습니다. `SERVER_BACKEND_URL`과 같은 환경변수로 설정해야 합니다.
→ **제안**: 환경변수 `SERVER_BACKEND_URL`을 도입하고, 기본값으로 `http://localhost:8006`을 사용.

**#3 [Security] execute-test-set 인증 없음**
`@app.post("/execute-test-set")` 엔드포인트에 어떤 인증/인가도 없습니다. 네트워크 접근 가능한 누구나 임의의 test set을 실행할 수 있으며, `subprocess.run`으로 `behave` 명령어를 실행하므로 보안 위험이 큽니다.
→ **제안**: API 토큰 검증 또는 최소한 내부 네트워크 접근 제한 미들웨어 추가.

**#4 [Bug] abort 시 remaining features 슬라이싱 오류**
```python
for remaining_feature in features[feature['order']:]:
    if remaining_feature['order'] > feature['order']:
```
`features[feature['order']:]`는 order 값으로 슬라이싱하지만, `features`는 이미 sorted된 리스트이므로 **인덱스**가 아닌 **order 값**으로 슬라이싱합니다. order가 1부터 시작하면 첫 번째 요소가 누락됩니다. 또한 내부 `if` 조건이 슬라이싱과 중복 검사하여 혼란스럽습니다.
→ **제안**: `features` 리스트의 현재 인덱스 기반으로 슬라이싱:
```python
current_idx = features.index(feature)
for remaining_feature in features[current_idx + 1:]:
    results.append(...)
    skipped_count += 1
```

**#5 [Breaking] `.dict()` deprecated**
```python
features_data = [f.dict() for f in payload.features]  # test_sets.py
update_data = payload.dict(exclude_unset=True)          # test_sets.py
```
Pydantic v2에서 `.dict()`는 deprecated이며 `.model_dump()`를 사용해야 합니다. Pydantic v2 strict 모드에서 warning/error가 발생할 수 있습니다.
→ **제안**: `.dict()` → `.model_dump()`, `.dict(exclude_unset=True)` → `.model_dump(exclude_unset=True)`

**#6 [Redundancy] TestSetComposer 중복**
`admin/TestSetComposer.tsx` (764줄)와 `manager/TestSetComposer.tsx` (727줄)가 거의 동일한 코드로 중복 존재합니다. Admin 버전은 `feature_id` 기반, Manager 버전은 `path` 기반으로 Feature를 참조하여 **데이터 모델이 서로 다릅니다** — 이는 하나의 백엔드 API에 두 가지 다른 포맷을 보내게 되어 버그 원인이 됩니다.
→ **제안**: 하나의 컴포넌트로 통합하고, 역할 기반으로 기능 제한. Manager 버전의 path 기반 Feature 참조는 feature_id 기반으로 통일.

---

### 개선 권장

| # | 유형 | 파일 | 내용 |
|---|------|------|------|
| 1 | [Perf] | `edge-runner/src/api_server.py:1064` | Feature별 httpx.AsyncClient 재생성 |
| 2 | [Design] | `server-backend/src/routers/test_sets.py` | 스키마가 routers 파일 내 인라인 정의 |
| 3 | [Testing] | 전체 | 테스트 코드 없음 |
| 4 | [Design] | `server-backend/src/main.py:1451-1452` | test_sets, features 라우터만 prefix/tags 누락 |
| 5 | [Logic] | `edge-runner/src/api_server.py:1017-1020` | 함수 내부 import문 |
| 6 | [Redundancy] | `TEST_SET_IMPLEMENTATION_COMPLETE.md` | 구현 완료 보고서가 리포에 포함 |
| 7 | [Design] | `server-backend/src/models/feature.py:1505-1506` | `datetime.utcnow` deprecated |
| 8 | [Bug] | `testsets.json:2401,2411` | JSON에 `loadFailed` 키 중복 |

**상세 설명:**

**#1 [Perf] httpx.AsyncClient 반복 생성**
Feature를 순회할 때마다 `async with httpx.AsyncClient()` 새 클라이언트를 생성합니다. Feature가 20개면 20번 TCP 연결을 맺습니다.
→ **제안**: 루프 바깥에서 클라이언트를 한 번 생성하여 재사용.

**#2 [Design] 인라인 Pydantic 스키마**
`test_sets.py` 라우터 파일에 `TestSetCreate`, `TestSetUpdate`, `TestSetResponse` 등 스키마가 직접 정의되어 있습니다. 반면 `features.py`는 `schemas.py`를 사용합니다. 일관성이 부족합니다.
→ **제안**: `models/schemas.py`로 통합.

**#3 [Testing] 테스트 없음**
새로운 CRUD API 5개, Feature API 5개, execute-test-set 엔드포인트 등 상당한 양의 비즈니스 로직이 추가되었으나 테스트가 없습니다.
→ **제안**: 최소한 핵심 API의 happy path + error case 테스트 추가.

**#4 [Design] 라우터 등록 불일치**
```python
app.include_router(test_sets.router)    # prefix/tags 없음
app.include_router(features.router)     # prefix/tags 없음
```
다른 라우터들은 `prefix="/api/..."`, `tags=[...]`를 main.py에서 지정하는데, test_sets와 features만 라우터 내부에서 직접 지정합니다. 패턴 통일이 필요합니다.

**#5 [Logic] 함수 내부 import**
```python
async def execute_test_set(request):
    import httpx
    import subprocess
    import time
    import tempfile
```
함수 실행 시마다 import가 평가됩니다(캐시되긴 하지만). 모듈 상단으로 이동하는 것이 Python 관례입니다.

**#6 [Redundancy] TEST_SET_IMPLEMENTATION_COMPLETE.md**
397줄짜리 구현 완료 보고서가 리포에 커밋되어 있습니다. PR description이나 Wiki에 들어갈 내용이지 코드 리포에 포함될 문서는 아닙니다.
→ **제안**: 리포에서 제거하고 Confluence/PR description으로 이동.

**#7 [Design] `datetime.utcnow` deprecated**
Python 3.12+에서 `datetime.utcnow()`은 deprecated입니다. `datetime.now(timezone.utc)`를 사용해야 합니다.

**#8 [Bug] JSON 키 중복**
`testsets.json`에 `"loadFailed"` 키가 두 번 정의되어 있습니다 (line 2402, 2411). 두 번째가 첫 번째를 덮어쓰므로 의도와 다를 수 있습니다.

---

### 잘 된 부분

- Feature 버전 관리 시스템(`feature_versions` 테이블)이 잘 설계되어 있어, 변경 이력 추적이 가능합니다.
- Alembic 마이그레이션이 upgrade/downgrade 모두 깔끔하게 구현되었고, unique constraint와 인덱스가 적절합니다.
- Required feature 실패 시 abort 로직의 설계 의도가 명확합니다.
- FeatureCombobox 컴포넌트의 키보드 네비게이션, 카테고리 그룹핑, disabled 상태 처리가 잘 구현되었습니다.
- i18n(en/ko) 지원이 처음부터 적용된 점이 좋습니다.

---

### 최종 판정

**CHANGES REQUESTED**

보안 이슈(인증 없는 subprocess 실행 엔드포인트, 하드코딩된 credential), 프로덕션 환경 호환성 문제(하드코딩된 localhost URL), 데이터 모델 불일치(admin/manager 컴포넌트의 feature_id vs path)가 머지 전 해결되어야 합니다.
