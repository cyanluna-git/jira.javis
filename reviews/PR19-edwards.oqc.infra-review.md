## PR #19 Code Review: Adding type checking and unit tests

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: feature/AddUnitTests → main
**Author**: Bipin Mishra
**Date**: 2026-02-25

---

### Summary of Changes

Introduces static type checking (mypy), linting (ruff), and unit testing (pytest) infrastructure for the server-backend. Modernizes SQLAlchemy models to use `Mapped`/`mapped_column` style, adds explicit return type annotations to router functions, simplifies response construction with `model_validate()`, and includes a comprehensive 427-line test suite for the Users API. CI pipeline is updated to run all checks in sequence with JUnit test reporting.

---

### Must Fix Before Merge

No must-fix issues found. The code is well-structured and follows good practices.

---

### Suggestions for Improvement

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Design] | `apps/server-backend/tests/conftest.py` | Module-level `_state` dict for sharing between fixtures is fragile |
| 2 | [Testing] | `apps/server-backend/tests/conftest.py` | SQLite-in-memory vs PostgreSQL dialect differences |
| 3 | [Design] | `apps/server-backend/pyproject.toml` | Coverage threshold at 30% — consider a roadmap to raise it |
| 4 | [Redundancy] | `apps/server-backend/src/models/feature.py` | Mixed Column typing style — inconsistent with modernized models |

**#1 — [Design] Module-level `_state` dict**

```python
_state: dict[str, object] = {}
```

The conftest uses a module-level mutable dict to pass the engine and session_factory between `setup_database` (autouse) and `db_session` fixtures. This works correctly for sequential test execution but is fragile — if `pytest-xdist` parallel execution is ever introduced, tests will interfere with each other.

**Suggested improvement:** Consider using a session-scoped fixture that yields the engine/factory tuple, and have `setup_database` depend on it:

```python
@pytest_asyncio.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    yield engine
    await engine.dispose()
```

Low priority — current approach works fine for sequential runs.

**#2 — [Testing] SQLite vs PostgreSQL dialect differences**

The test suite uses SQLite in-memory (`sqlite+aiosqlite:///:memory:`), while production uses PostgreSQL. Some behavioral differences to be aware of:

- `ILIKE` (case-insensitive) is PostgreSQL-specific; SQLite's `LIKE` is case-insensitive by default for ASCII
- `ARRAY` columns, `UUID` type, and `Enum` handling differ between dialects
- The manual DDL in `_CREATE_USERS_TABLE` uses `CHAR(32)` for UUID instead of the actual `UUID` type

The `test_list_users_search_escapes_like_wildcards` test is a good edge case, but its pass/fail behavior may differ between SQLite and PostgreSQL depending on how LIKE escaping is implemented.

This is acceptable for unit tests — the tests correctly validate API logic and response codes. Integration tests against a real PostgreSQL instance would complement these well in the future.

**#3 — [Design] Coverage threshold at 30%**

```toml
"--cov-fail-under=30",
```

Understood this is an initial starting point. Consider documenting a target roadmap (e.g., 50% by next sprint, 70% by Q2) in a TODO comment or ticket.

**#4 — [Redundancy] Mixed Column typing in feature.py**

```python
status: Column[FeatureStatus] = Column(SQLEnum(FeatureStatus), ...)
tags: Column[List[Any]] = Column(ARRAY(String), default=list)
```

This uses the legacy `Column` with generic parameterization, while `product_hierarchy.py` and `user.py` have been fully modernized to `Mapped`/`mapped_column`. Since `feature.py` is in the legacy `ignore_errors = true` group, this won't cause mypy issues, but the inconsistency may confuse contributors.

Low priority — can be addressed when the feature module is modernized.

---

### What's Done Well

- **Gradual mypy adoption**: Strict typing for new modules + `ignore_errors` for legacy code is the right approach for incremental adoption without blocking the pipeline
- **Comprehensive test coverage**: The test_users.py covers all CRUD operations including edge cases (duplicate detection, self-modification guards, LIKE wildcard escaping, idempotent soft-delete)
- **Clean test infrastructure**: conftest.py with async SQLite, dependency overrides for auth and DB, and factory helpers — well-organized and reusable
- **Model modernization**: Correct migration to SQLAlchemy 2.0 `Mapped`/`mapped_column` style with proper `Optional` typing
- **Response simplification**: Replacing manual field-by-field construction with `model_validate()` eliminates a class of bugs where new fields could be missed
- **CI integration**: JUnit XML reporting via `after-script` enables test results in the Bitbucket Tests tab
- **Return type annotations**: All products router endpoints now have explicit return types, improving IDE support and mypy coverage

---

### Verdict

**APPROVED**

This is a solid infrastructure PR that establishes type checking, linting, and testing foundations for the backend. No must-fix issues found. The gradual adoption strategy (strict for new code, permissive for legacy) is pragmatic and well-executed. The test suite is thorough with good edge case coverage. The suggestions above are all low-priority improvements for future iterations.
