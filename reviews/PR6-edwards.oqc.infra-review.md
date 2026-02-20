## PR #6 Code Review: Feature/userRoleView : WIP

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: feature/userRoleView → main
**Author**: Bipin Mishra
**Date**: 2026-02-09

---

### Change Summary

A large-scale PR that migrates the authentication system to Azure AD (MSAL) and implements role-based UI views. The backend replaces username/password auth with MSAL token-based authentication, while the frontend introduces role-specific dashboards (Admin, Manager, TestDesigner, Tester, SwDevEngineer, ScenarioEngineer). A total of 107 files were changed, including Docker/Nginx infrastructure updates.

---

### Must Fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Bug] | `server-backend/src/routers/releases.py` | `current_user.user_id` AttributeError — should be `.id` |
| 2 | [Bug] | `server-backend/src/routers/scenarios.py` | Same `current_user.user_id` → `.id` error (3 occurrences) |
| 3 | [Security] | `server-backend/src/services/azure_ad_auth.py` | PyJWT `issuer` param receives a list instead of string — may bypass validation |
| 4 | [Security] | `nginx/conf.d/oqc.conf` | CORS `Access-Control-Allow-Origin *` wildcard allows any origin |
| 5 | [Security] | `server-backend/src/routers/users.py` | LIKE search wildcards (`%`, `_`) not escaped in user input |
| 6 | [Bug] | `server-backend/src/routers/auth.py` | Auto-provisioned username uniqueness not guaranteed |
| 7 | [Breaking] | `db/init.sql` + `types/auth.ts` | Role enum changed (SW_DEV_ENGINEER, SCENARIO_ENGINEER removed) but no data migration provided |
| 8 | [Breaking] | `server-backend/src/routers/auth.py` | Complete auth API replacement (username/password → MSAL only) — breaks existing clients |
| 9 | [Bug] | `server-frontend/src/lib/apiClient.ts` | `isRedirecting` flag is set but never reset — blocks logout recovery |
| 10 | [Breaking] | Multiple files | Port mismatch across configs: run.py(5173), .env.example(3006), Dockerfile(4000), config.py(8006) |

---

#### #1 [Bug] `current_user.user_id` AttributeError — `releases.py`

`UserModel` has no `user_id` attribute — only `id`. This will cause a runtime AttributeError.

```python
# Current (broken)
release.released_by = current_user.user_id if current_user else None

# Fix
release.released_by = current_user.id if current_user else None
```

#### #2 [Bug] `current_user.user_id` AttributeError — `scenarios.py` (3 locations)

Same issue repeated in 3 places in scenarios.py:
- `ScenarioModel.created_by == current_user.user_id`
- `created_by=current_user.user_id`
- `scenario.approved_by = current_user.user_id`

All should use `current_user.id`.

#### #3 [Security] Azure AD Issuer Validation Bypass

PyJWT's `issuer` parameter expects a single string, but `settings.azure_issuers` returns `List[str]`. This may cause issuer validation to silently fail or behave unexpectedly.

```python
# Fix: disable auto-validation and verify manually
payload = jwt.decode(
    token, signing_key.key, algorithms=["RS256"],
    audience=settings.azure_audiences,
    options={"verify_iss": False}
)
if payload.get("iss") not in settings.azure_issuers:
    raise TokenValidationError("Invalid token issuer")
```

#### #4 [Security] Nginx CORS Wildcard

Production nginx config sets `Access-Control-Allow-Origin *`, allowing any external site to make API requests. This exposes the API to CSRF attacks.

```nginx
# Current (vulnerable)
add_header Access-Control-Allow-Origin *;

# Fix: restrict to specific domains
add_header Access-Control-Allow-Origin "https://oqc.your-domain.com";
```

#### #5 [Security] Unescaped LIKE Search Wildcards — `users.py`

User input containing `%` or `_` is inserted directly into LIKE patterns without escaping. This could trigger unintended full table scans or data exposure.

```python
# Fix
def escape_like(s: str) -> str:
    return s.replace('%', '\\%').replace('_', '\\_')

escaped = escape_like(search)
UserModel.username.ilike(f"%{escaped}%", escape='\\')
```

#### #6 [Bug] Auto-Provisioning Username Collision

When auto-creating new Azure AD users, the fallback `{username}_{oid[:6]}` is tried only once. If that also collides, the operation will fail. A retry loop is needed.

#### #7 [Breaking] Role Enum Change Without Data Migration

The `userrole` DB enum drops `sw_dev_engineer` and `scenario_engineer`, replacing them with `test_designer`. Existing users with old roles will have invalid data. A migration script is required:

```sql
UPDATE users SET role = 'test_designer' WHERE role IN ('sw_dev_engineer', 'scenario_engineer');
```

#### #8 [Breaking] Complete Auth API Replacement

All previous endpoints (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/register`, `/api/auth/me`) have been removed and replaced with MSAL-only endpoints. Any other clients (e.g., edge-frontend) relying on the old API will break.

#### #9 [Bug] `isRedirecting` Flag Never Reset

In `apiClient.ts`, `isRedirecting` is set to `true` but never reset. If a logout attempt fails, all subsequent 401 responses will be silently ignored, preventing the user from being redirected to login.

```typescript
// Fix: add timeout reset
isRedirecting = true;
setTimeout(() => { isRedirecting = false; }, 5000);
```

#### #10 [Breaking] Port Configuration Mismatch

| Component | File | Port |
|-----------|------|------|
| Backend (local) | config.py | 8006 |
| Backend (Docker) | Dockerfile, entrypoint.sh | 4000 |
| Frontend (run.py) | run.py | 5173 |
| Frontend (old) | .env.example | 3006 |
| MSAL Redirect | .env.example | 3006 |

The MSAL redirect URI mismatch will cause Azure AD authentication to fail. Port strategy needs to be unified and `.env.example` updated accordingly.

---

### Suggestions for Improvement

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Security] | `server-backend/src/config.py` | CORS includes `"*"` — should be removed for production |
| 2 | [Security] | `server-frontend/src/auth/msalConfig.ts` | Hard-coded fallback values (`'your-client-id-here'`) — should throw in production |
| 3 | [Security] | `.env.example` | Weak default `SECRET_KEY` — add generation guide |
| 4 | [Design] | `server-backend/src/routers/auth.py` | No protection against demoting the last Admin user |
| 5 | [Redundancy] | `server-backend/src/models/` | Duplicate Enum definitions across `schemas.py` and `database.py` |
| 6 | [Design] | `docker-compose.server.yml` | Backend healthcheck removed — restore for stable deployments |
| 7 | [Perf] | `server-frontend/src/lib/apiClient.ts` | Concurrent API calls trigger duplicate token refresh — needs request queuing |
| 8 | [Design] | `server-frontend/src/components/` | Many components have hard-coded English strings — i18n not fully applied |
| 9 | [Design] | `server-frontend/src/components/admin/UserManagement.tsx` | Error handling relies on string matching — use structured error codes |
| 10 | [Design] | Overall | No DB migration system (e.g., Alembic) — schema changes are hard to track |
| 11 | [Security] | `.deployignore` | Missing entries for `.env`, `*.pem`, `*.key`, `.git` |
| 12 | [Design] | `server-backend/Dockerfile` | `postgresql-client` not installed — `pg_isready` in entrypoint.sh will fail |

---

### What's Done Well

- Azure AD/MSAL integration architecture is well-designed with a clear token flow between Frontend and Backend
- Role-based dashboard separation provides clean, role-specific UIs
- i18n infrastructure (JSON files + i18next) is properly structured for multi-language support
- Auth components (`ProtectedRoute`, `RoleGuard`) are reusable and well-composed
- TypeScript types are consistent throughout — no usage of `dangerouslySetInnerHTML` or `eval()`
- Solid system documentation in `.github/architecture-view.md` and `.github/role-instructions.md`

---

### Verdict

**CHANGES REQUESTED**

There are 10 must-fix items. Among them, the `current_user.user_id` → `.id` bugs (#1, #2) will cause runtime crashes, the CORS wildcard (#4) is a security vulnerability, and the missing role enum migration (#7) will corrupt existing user data. Since this is a WIP PR, this is understandable, but at minimum these items should be resolved before merge. The port mismatch (#10) is particularly critical as it will prevent Azure AD authentication from working at all.
