## PR #20 Backend + Frontend Code Review: fixing code field to make it readonly unique field

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: fixes/auto_code → main
**Author**: Bipin Mishra
**Date**: 2026-03-03
**Domain**: Backend (Python/FastAPI) + Frontend (React/TypeScript)

---

### Change Summary

이 PR은 Business Unit / Generation / Product Line의 `code` 필드를 수동 입력에서 **자동 생성 + 불변(read-only) 필드**로 전환합니다. 백엔드에서는 `entity_code.py` 서비스를 신규 추가하여 계층형 코드(`OQC-<SEQ>`, `OQC-<BU_KEY>-<BU_SEQ>-<GEN_SEQ>` 등)를 트랜잭션-안전하게 생성하며, 프론트엔드에서는 코드 입력 필드를 read-only로 변환하고 생성 모달에서 미리보기 API를 호출합니다. 또한 누락된 Alembic 마이그레이션 브릿지(`add_test_execution`)와 entity_code 컬럼 추가/삭제 마이그레이션 쌍도 함께 포함됩니다.

---

### Must-fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Logic] | `src/services/entity_code.py:779-781` | 기존 BU 코드 형식 불일치로 Generation 생성 전체 불가 |
| 2 | [Error] | `src/routers/products.py:419` | update_generation 불변성 오류 메시지가 "Business Unit"으로 잘못 표기 |
| 3 | [Error] | `src/routers/products.py:519` | Generation 중복 에러 메시지에 BU 이름 대신 Generation 자신의 이름 출력 |
| 4 | [DB] | `alembic/versions/5d8f3a1b6c4e_...py` + `9d2b7f4c1c8d_...py` | entity_code 컬럼 추가 직후 삭제하는 마이그레이션 쌍 — code 컬럼 backfill 부재 |

---

#### 1. [Logic] 기존 BU code 형식 불일치 -> Generation/PL 생성 불가능

**파일**: `apps/server-backend/src/services/entity_code.py:779-781`

```python
bu_seq = _extract_bu_sequence(bu.code)
if bu_seq is None:
    raise ValueError(f"Business Unit code not in numeric format: {bu.code}")
```

`_extract_bu_sequence`는 `OQC-(\d+)` 정규식만 인식합니다. 그런데 이 PR의 마이그레이션(`5d8f3a1b6c4e`)은 기존 BU의 `entity_code` 컬럼만 백필하고, **`code` 컬럼은 건드리지 않습니다**. 만약 기존 BU의 `code` 값이 수동으로 입력된 형태(예: `"EUV"`, `"SEMI"`, `"OQC-EUV"`)라면, `generate_gen_entity_code` 호출 시 `ValueError` -> HTTP 409가 발생하여 해당 BU 하위에 **Generation을 생성할 수 없게 됩니다**.

`generate_pl_entity_code`는 Generation의 `code`를 prefix로 사용(`gen_prefix = gen.code`)하므로, 마찬가지로 구형 형식의 Gen code가 존재하면 PL도 오동작합니다.

**수정 방안**: 기존 `code` 컬럼을 신규 포맷(`OQC-<SEQ>`)으로 마이그레이션하는 Alembic revision을 추가하거나, `generate_gen_entity_code` / `generate_pl_entity_code`에서 구형 포맷 fallback 처리를 추가해야 합니다.

---

#### 2. [Error] update_generation의 불변성 오류 메시지 잘못됨

**파일**: `apps/server-backend/src/routers/products.py:419`

```python
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Business Unit code is auto-generated and immutable"  # <- 잘못된 메시지
)
```

이 코드는 `update_generation` 핸들러 내부에 있지만, 오류 메시지는 "Business Unit"을 언급합니다. 클라이언트 입장에서 혼란스러운 응답이며, Generation 코드를 수정하려 할 때 BU 관련 에러가 반환됩니다.

**수정**: `"Generation code is auto-generated and immutable"`

---

#### 3. [Error] Generation 중복 에러 메시지에 BU 이름 대신 Gen 이름 노출

**파일**: `apps/server-backend/src/routers/products.py:519`

`gen`은 `GenerationModel` 인스턴스입니다. `gen.name`은 해당 Generation 자신의 이름이며, 부모 Business Unit의 이름이 아닙니다. 이로 인해 에러 메시지가 의미 없는 정보를 노출합니다.

```python
# 현재 (잘못됨)
detail=f"Generation with name '{payload.name}' already exists under Business Unit '{gen.name or gen.code}'"

# 수정 예시
bu = await db.get(BusinessUnitModel, gen.business_unit_id)
detail=f"Generation with name '{payload.name}' already exists under Business Unit '{bu.name or bu.code}'"
```

---

#### 4. [DB] entity_code 컬럼 추가->즉시삭제 마이그레이션 쌍 + code 컬럼 백필 부재

마이그레이션 체인:
```
4c7e1a2d9b5f -> add_test_execution (no-op) -> 5d8f3a1b6c4e (entity_code 추가+백필) -> 9d2b7f4c1c8d (entity_code 삭제)
```

`entity_code` 컬럼은 추가된 지 1 revision만에 삭제됩니다. 이 패턴은 이전 환경에서 이미 `5d8f3a1b6c4e`가 적용된 상태를 정리하기 위한 것으로 추정되나, 아무 주석도 없어 다음 사람이 마이그레이션 히스토리를 파악하기 매우 어렵습니다.

더 중요한 문제는, 이 마이그레이션이 `entity_code` 컬럼만 백필하고 **실제 서비스에서 사용하는 `code` 컬럼을 새 포맷으로 변환하지 않는다**는 점입니다. 이것이 Issue #1의 근본 원인입니다.

**수정 방안**: 기존 `code` 컬럼을 `OQC-<SEQ>` 포맷으로 백필하는 migration을 추가하세요.

---

### Suggested Improvements

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Concurrency] | `src/services/entity_code.py:717` | 빈 테이블에서 FOR UPDATE lock 없음 -> 동시 첫 생성 시 race condition |
| 2 | [DataFetching] | `src/components/admin/ProductManagement.tsx:1056-1064` | BU 코드 미리보기가 name과 무관 -> 실제 배정 코드와 다를 수 있음을 UI에 안내 필요 |
| 3 | [Testing] | `src/services/entity_code.py` | 핵심 비즈니스 로직 테스트 전무 |
| 4 | [API] | `src/services/productService.ts:1176` | Preview 엔드포인트 /api/v2/ 버전 prefix 일관성 확인 필요 |

---

#### 1. [Concurrency] 빈 테이블 edge case - lock 없이 동시 BU 생성

`SELECT ... FOR UPDATE`는 결과 집합의 행에만 잠금을 겁니다. BU 테이블이 비어 있을 경우 잠금할 행이 없으므로, 두 트랜잭션이 동시에 `max_seq = 0`을 읽어 둘 다 `"OQC-1"`을 시도합니다. 한 쪽은 UNIQUE constraint 위반으로 실패합니다.

**제안**: DB 레벨 sequence(`CREATE SEQUENCE`) 또는 재시도 패턴 도입을 권장합니다.

---

#### 2. [DataFetching] BU 미리보기 - 실제 배정 코드와 다를 수 있음

`generate_bu_entity_code`는 `name` 인자를 무시하고 전역 sequence만 사용합니다. 미리보기가 항상 "현재 다음 시퀀스"를 보여주므로, 실제 생성 시 다른 사용자가 먼저 생성했다면 미리보기와 다른 코드가 배정됩니다.

미리보기 UI에 "(예상, 변경될 수 있음)" 등의 안내 문구 추가를 권장합니다.

---

#### 3. [Testing] entity_code 서비스 핵심 로직 테스트 없음

274줄의 핵심 비즈니스 로직(코드 생성, 시퀀스 파싱, 충돌 방지)을 담고 있으나 테스트가 전혀 없습니다.

권장 테스트 케이스:
- `_derive_bu_key`: 단어 수, 특수문자, 짧은/긴 이름 edge cases
- `_extract_bu_sequence`: 정상/비정상 형식 처리
- 동시 생성 시나리오 (통합 테스트)
- 기존 codes가 신규 형식이 아닐 때의 동작

---

#### 4. [API] Preview 엔드포인트 /api/v2/ 버전 prefix 일관성

프론트엔드는 `/api/v2/entity-code/...`로 호출하지만, 백엔드 라우터에 등록된 prefix가 일치하는지 확인이 필요합니다. 기존 Products API가 다른 버전 경로를 사용한다면 404가 발생합니다.

---

### Well Done

- **트랜잭션-안전 설계**: `SELECT ... FOR UPDATE`를 활용한 시퀀스 할당 방식으로 단순 MAX + 1 패턴보다 안전합니다.
- **불변 코드 강제**: API 레벨(400 즉시 거부)과 UI 레벨(read-only 입력 필드) 양쪽에서 코드 불변성을 계층적으로 방어하는 설계가 좋습니다.
- **취소 가능한 미리보기 요청**: `useDebouncedValue` + `cancelled` 플래그 패턴으로 stale 응답을 올바르게 무시합니다.
- **downgrade 구현**: 모든 마이그레이션에 `downgrade()` 함수가 구현되어 롤백이 가능합니다.
- **Preview rollback**: Preview 엔드포인트에서 `await db.rollback()`을 명시적으로 호출하여 부작용 없이 read-only 미리보기를 구현한 점이 좋습니다.

---

### Final Verdict

**CHANGES REQUESTED**

기존 BU `code` 컬럼이 구형 포맷(비`OQC-\d+` 형식)인 경우 Generation/Product Line 생성이 전면 불가능해지는 Critical Logic 버그(Issue #1, #4)와, 오해를 유발하는 오류 메시지 2건(Issue #2, #3)을 반드시 수정 후 머지해야 합니다. 특히 기존 데이터 마이그레이션 전략이 명확하지 않으므로, `code` 컬럼 백필 또는 구형 포맷 fallback 처리가 필요합니다.
