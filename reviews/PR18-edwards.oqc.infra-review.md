## PR #18 Code Review: Feature/EUV-3365: adding products to admin dashboard

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: feature/EUV3365_ProductAdd → main
**Author**: Bipin Mishra
**Date**: 2026-02-25

---

### Summary of Changes

Implements a three-level product catalog hierarchy (Business Unit → Generation → Product Line) across the full stack. Includes PostgreSQL tables + Alembic migration, FastAPI CRUD router, React admin page (tree UI + modal forms), Edge-runner cache sync endpoints, and full i18n (EN/KO) translations.

---

### Must Fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Security] | `apps/edge-runner/src/api_server.py:2013` | Internal error details exposed in sync error response |
| 2 | [Bug] | `apps/server-backend/src/routers/products.py` | Router mounted without prefix — inconsistent with existing pattern |

**#1 — [Security] Internal server details exposed in error response**

```python
raise HTTPException(
    status_code=502,
    detail=f"Failed to sync product hierarchy: {e}",
)
```

The raw exception `{e}` is passed directly to the client. `httpx` errors can contain the server-backend URL, authentication error messages, internal network topology, etc.

**Suggested fix:**
```python
logger.error(f"Failed to sync product hierarchy from server-backend: {e}")
raise HTTPException(
    status_code=502,
    detail="Failed to sync product hierarchy from server-backend",
)
```

**#2 — [Bug] Router mounted without prefix — inconsistent with existing pattern**

In `main.py`, all other routers use the `prefix="/api/..."` pattern, but the products router is mounted without a prefix:

```python
# Existing pattern
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["Scenarios"])
app.include_router(pdps.router, prefix="/api/pdps", tags=["PDPs"])

# products — no prefix, full paths hardcoded inside the router
app.include_router(products.router)  # router internally: "/api/v2/business-units"
```

This works currently, but if URL prefixes are ever changed globally, the products router will be missed. Also, the v2 path is hardcoded in the router, making version management difficult.

**Suggested fix:** Mount with `prefix="/api/v2"` and remove the prefix from internal route paths.

---

### Suggestions for Improvement

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Redundancy] | `apps/server-frontend/src/components/admin/ProductManagement.tsx` | Duplicate `NodeFormData` interface definition |
| 2 | [Design] | `apps/server-frontend/src/components/admin/ProductManagement.tsx` | 708-line single file — consider splitting components |
| 3 | [Logic] | `apps/edge-runner/src/api_server.py` | In-memory cache is lost on restart |
| 4 | [Logic] | `apps/server-frontend/src/components/admin/ProductManagement.tsx` | Empty PATCH request sent when no fields are changed |
| 5 | [Design] | `apps/server-frontend/src/components/admin/ProductManagement.tsx` | Use toast notification instead of `alert()` |
| 6 | [Design] | `apps/server-backend/src/models/product_hierarchy.py` | `datetime.utcnow` — deprecated in Python 3.12+ |
| 7 | [Perf] | `apps/server-backend/src/routers/products.py` | Tree endpoint loads full hierarchy — consider pagination as catalog grows |

**#1 — [Redundancy] Duplicate `NodeFormData` interface**

In `ProductManagement.tsx`, `NodeFormData` is defined twice — once near the top (~line 110) and again at the bottom of the file. TypeScript merges same-scope interfaces so it's not an error, but it's redundant code.

**Suggested fix:** Keep only the top definition and remove the bottom one.

**#2 — [Design] 708-line single file**

`ProductManagement.tsx` contains Modal, NodeForm, ProductLineRow, GenerationRow, BusinessUnitRow, and the main component all in one file. It works, but splitting would improve maintainability.

**Suggested fix:**
- `Modal` → `components/ui/Modal.tsx` (shared component)
- `NodeForm` → `components/admin/product/NodeForm.tsx`
- `*Row` components → `components/admin/product/` subdirectory

**#3 — [Logic] Volatile in-memory cache**

The edge-runner's `_product_hierarchy_cache` is a global variable that resets to `None` on process restart. The frontend must manually trigger a sync after each restart.

**Suggested fix:** Consider auto-syncing on startup event, or adding local file (JSON) persistence as a fallback.

**#4 — [Logic] Empty PATCH request on no changes**

When the user opens the edit modal and saves without making changes, `toUpdatePayload()` returns an empty object `{}`. This triggers an unnecessary PATCH request that only updates `updated_at` in the database.

**Suggested fix:**
```typescript
const payload = toUpdatePayload(data, modal.bu);
if (Object.keys(payload).length === 0) { closeModal(); return; }
```

**#5 — [Design] `alert()` usage**

The `withSubmit` function uses `alert()` for error handling. Browser alerts block the thread and provide a poor UX.

**Suggested fix:** Use the project's existing toast/notification system if available.

**#6 — [Design] `datetime.utcnow` deprecation**

```python
created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
```

`datetime.utcnow()` has been deprecated since Python 3.12. The project targets Python 3.10+ so it's not immediately broken, but deprecation warnings may appear.

**Suggested fix:** `from datetime import datetime, timezone` → `default=lambda: datetime.now(timezone.utc)`

**#7 — [Perf] Full hierarchy loading on tree endpoint**

`GET /api/v2/products/tree` uses `selectinload` to eagerly load the entire hierarchy on every call. At the current scale (3 BUs, ~10 Generations, ~10 Product Lines) this is perfectly fine. Just something to keep in mind if the catalog grows significantly — pagination or lazy loading could be considered later.

---

### What's Done Well

- **Safe delete guards**: 409 responses when child entities exist, combined with DB-level `ondelete="RESTRICT"` for defense in depth
- **Proper `model_fields_set` usage in PATCH**: Correctly handles explicit `null` to clear the `description` field
- **Complete i18n**: EN/KO translations are comprehensive with no hardcoded strings
- **Scoped uniqueness constraints**: `uq_generation_bu_code`, `uq_product_line_gen_code` — well-designed parent-scoped unique constraints
- **Idempotent seed data**: `ON CONFLICT DO NOTHING` ensures migration re-runnability
- **Consistent admin authorization**: `_require_admin()` guard applied on all mutation endpoints

---

### Verdict

**CHANGES REQUESTED**

The security issue (#1: internal error details exposed in response) could leak internal network topology in production and should be fixed before merge. The router prefix inconsistency (#2) should also be addressed for codebase consistency and maintainability. The remaining items are suggestions for improvement. Overall, this is a well-structured full-stack implementation.
