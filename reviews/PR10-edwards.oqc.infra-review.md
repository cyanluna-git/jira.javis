## PR #10 Code Review: EUV-3312 TestSetManagement

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: EUV-3312_TestSetManagement → main
**Author**: Owen Rim
**Date**: 2026-02-13

---

### Change Summary

This PR implements a full Test Set Management feature across the entire stack: backend CRUD APIs for test sets and features, edge-runner execution endpoint, server-frontend admin/manager UIs, and edge-frontend test set selector. It also modifies deployment configuration (docker-compose, nginx, deploy scripts) and replaces the MSAL/Azure AD authentication with a Zustand-based username/password auth store.

---

### Must-fix before merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Security] | `deploy-onprem.ps1` | SSH password hardcoded in plaintext |
| 2 | [Security] | `deploy-simple.ps1` | SSH password displayed in console output on multiple lines |
| 3 | [Security] | `docker-compose.server.yml` | Database credentials hardcoded instead of using env variables |
| 4 | [Security] | `stores/authStore.ts` | Access and refresh tokens stored in localStorage |
| 5 | [Breaking] | `docker-compose.server.yml` | Azure AD env vars, SECRET_KEY, CORS_ORIGINS removed |
| 6 | [Breaking] | `App.tsx`, `Login.tsx` | Auth system downgraded from Azure AD/MSAL to basic username/password |
| 7 | [Bug] | `manager/TestSetComposer.tsx` | Hardcoded `http://localhost:8007/test-catalog` — will fail in any non-local deployment |
| 8 | [Bug] | `edge-runner/src/api_server.py` | Calls server-backend with no auth token — will get 401 in production |
| 9 | [Design] | `nginx/conf.d/oqc.conf` | New server block prepended to existing config — duplicate server blocks on port 80 |
| 10 | [Design] | `server-backend/src/main.py` | Alembic migrations replaced with `Base.metadata.create_all` |

**#1, #2 — Hardcoded SSH password in deploy scripts**

`deploy-onprem.ps1` contains the SSH password `edwards@!` in plaintext (line ~4441). `deploy-simple.ps1` displays it in console output on multiple lines. These must be removed before merge. Use SSH key-based authentication or prompt for the password at runtime.

**#3 — Hardcoded database credentials in docker-compose**

```yaml
DATABASE_URL=postgresql://oqc_user:oqc_password@db:5432/oqc_db
```

Previously this used `${DB_USER}` and `${DB_PASSWORD}` env variable substitution. Please make sure to use environment variables — hardcoded credentials in a committed file are a security risk. As Bipin noted, these are required env variables that should be configurable per environment.

**#4 — Tokens in localStorage (XSS vulnerable)**

The Zustand auth store persists both access and refresh tokens to `localStorage`. If the app has any XSS vulnerability, an attacker can steal both tokens. The refresh token is especially dangerous — it allows generating new access tokens indefinitely. Consider using `httpOnly` cookies instead, or at minimum, don't persist the refresh token in localStorage.

**#5 — Production env vars removed from docker-compose**

`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_API_SCOPE`, `SECRET_KEY`, and `CORS_ORIGINS` are all removed. This will break the existing prod deployment. As Bipin mentioned, please don't change these configurations as they can break existing prod deployment settings.

**#6 — Auth architecture downgrade**

The entire Azure AD/MSAL authentication flow is replaced with basic username/password auth using a Zustand store. As Bipin suggested in his comment, it's better to use an Auth Context (the existing MSAL approach) rather than creating a separate Zustand auth store. The existing MSAL integration provides enterprise SSO, which is significantly more secure than username/password with JWT stored in localStorage. If a local dev auth bypass is needed, it should be behind a feature flag — not a replacement.

Additionally, `Login.tsx` displays demo credentials (`admin/admin`, `manager/manager`, `tester/tester`) in the UI, which suggests default weak passwords exist in the backend.

**#7 — Hardcoded localhost URL in manager TestSetComposer**

```tsx
const response = await fetch('http://localhost:8007/test-catalog');
```

This will fail in any environment where the frontend is not on the same machine as the edge-runner. Use a configurable base URL from environment variables (e.g., `VITE_EDGE_RUNNER_URL`).

**#8 — Edge-runner calls backend without auth**

The `/execute-test-set` endpoint fetches test set definitions from `http://localhost:8006/api/test-sets/{id}` with no authentication headers. Since the backend requires `get_current_user` for all test-set endpoints, this will return 401. A service-to-service auth mechanism (API key or internal token) is needed.

**#9 — Duplicate nginx server blocks**

A new production server block is prepended to `nginx/conf.d/oqc.conf`, but the existing server block below still remains. Two server blocks on port 80 will cause unpredictable routing. As Bipin noted, the existing nginx config should not be altered — if a new config is needed, coordinate with the existing `oqc.conf` setup. Also, Bipin requested to remove `nginx/nginx.conf` since the config already exists in `nginx/conf.d/oqc.conf`.

**#10 — Alembic replaced with create_all**

`main.py` now uses `Base.metadata.create_all` instead of Alembic migrations. As Bipin specifically noted: "Let's implement these changes using Alembic. First, we'll update/create the SQLAlchemy models, then generate a new Alembic revision, and finally run the migration." `create_all` only creates new tables — it won't alter existing tables when schema changes, leading to silent data issues in production.

---

### Suggestions for improvement

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Redundancy] | `admin/TestSetComposer.tsx` + `manager/TestSetComposer.tsx` | ~90% duplicated code (~1500 lines total) |
| 2 | [Bug] | `features.py` | Gherkin validation rejects valid files starting with `@tags` |
| 3 | [Bug] | `features.py` | Version increment and version history creation happen after first commit — inconsistency risk if second commit fails |
| 4 | [Bug] | `edge-runner/api_server.py` | Feature abort logic uses `order` value as slice index — fragile with non-sequential order values |
| 5 | [Perf] | `edge-runner/api_server.py` | New `httpx.AsyncClient` created per feature instead of reusing one |
| 6 | [Design] | `test_sets.py` | Update endpoint doesn't re-validate feature IDs (unlike create) |
| 7 | [Design] | `feature.py` (model) | No FK between `FeatureVersionModel.feature_id` and `FeatureFileModel.id` — orphaned versions on delete |
| 8 | [Design] | `AdminDashboard.tsx` | Removed `useTranslation` — sidebar labels show raw keys instead of translated text |
| 9 | [Design] | `nginx/conf.d/oqc.conf` | WebSocket timeout of 7 days is excessive — could cause resource exhaustion |
| 10 | [Redundancy] | `TEST_SET_IMPLEMENTATION_COMPLETE.md` | AI-generated implementation report committed to repo — consider removing |

**#1 — Massive code duplication**

`admin/TestSetComposer.tsx` (~769 lines) and `manager/TestSetComposer.tsx` (~725 lines) are ~90% identical. The only real differences are the feature data source (database API vs. filesystem catalog) and the feature reference model (`feature_id` vs. `path`). Refactor into a single shared component with a prop or strategy pattern for the feature source. This also causes a data model mismatch — the manager version references features by `path` while the backend schema expects `feature_id`.

**#2 — Gherkin validation too strict**

```python
if not content.strip().startswith("Feature:"):
    raise HTTPException(400, "Invalid Gherkin format")
```

Valid Gherkin files commonly start with tags like `@smoke @regression` before the `Feature:` keyword. This validation will reject those files. Consider checking for `Feature:` anywhere in the first few lines.

**#3 — Two-phase commit risk in feature update**

The feature content is committed first, then the version number is incremented and a version history record is created in a second commit. If the second commit fails, the feature content is updated but the version metadata is stale.

**#4 — Abort logic uses order as array index**

```python
features[feature['order']:]  # order is 1-based, array is 0-based
```

If order values are non-sequential (e.g., 1, 3, 5), this slice won't capture the correct remaining features. Use the loop index instead of the `order` value.

**#8 — AdminDashboard lost i18n**

The `useTranslation` hook was removed, so sidebar labels now display raw key strings like "users", "permissions", "testsets" instead of translated labels.

---

### What's done well

- **Test Set execution model**: The concept of ordered features with required flags and abort-on-failure is well-thought-out for a test execution system.
- **Feature versioning**: Tracking content changes with version history is a good practice for traceability.
- **Backend role-based access control**: Proper auth guards on all write endpoints with appropriate role restrictions.
- **Nginx security headers**: The new nginx config includes proper security headers (X-Frame-Options, X-Content-Type-Options, etc.) and rate limiting on auth endpoints.
- **Edge-frontend TestSetSelector**: Clean UI design with filtering and detail panel — good UX for testers.

---

### Verdict

**CHANGES REQUESTED**

This PR has significant security issues (hardcoded credentials in deploy scripts and docker-compose, localStorage token storage) and infrastructure changes that will break the existing production deployment (Azure AD removal, nginx config conflicts, Alembic removal). The core Test Set feature is well-designed, but the deployment and auth changes need to be separated out and discussed with the team. I'd recommend:

1. Remove all hardcoded credentials immediately.
2. Keep the existing Azure AD/MSAL auth — don't replace with Zustand auth store.
3. Use Alembic for database schema changes.
4. Don't modify docker-compose and nginx configs that affect existing prod — discuss with Bipin first.
5. Refactor the duplicated TestSetComposer into a single shared component.
6. Split this PR: Test Set feature in one PR, infra/deploy changes in a separate PR.
