## PR #17 Code Review: EUV-3356 : fixing pipeline errors

**Repo**: ac-avi/edwards.oqc.infra
**Branch**: fix/pipelinefix → main
**Author**: Bipin Mishra
**Date**: 2026-02-23

---

### Summary of Changes

This PR fixes Bitbucket pipeline errors introduced in the previous CI/CD setup (PR #16). It includes three main areas of change: (1) cleanup of scattered inline `from datetime import timezone` imports across the backend codebase to fix `ruff` linter failures, (2) addition of pre-commit hooks for backend and frontend lint enforcement, and (3) hardening of the `deploy.sh` script with a fixed app directory path and `.env` validation.

---

### Must Fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Bug] | `bitbucket-pipelines.yml` | Deploy step YAML indentation error — `<<: *deploy` is not nested under the `step:` key |
| 2 | [Logic] | `bitbucket-pipelines.yml` | `mypy` and `pytest` are commented out, completely removing type checking and tests from CI |
| 3 | [Logic] | `deploy.sh` | Hardcoded absolute path `/home/geraldpark/edwards-oqc/edwards.oqc.infra` breaks portability |
| 4 | [Bug] | `apps/server-backend/init_db_and_seed.py` | SQLAlchemy model imports removed — models may not register with `Base.metadata` |

---

#### 1. [Bug] `bitbucket-pipelines.yml` — YAML indentation error in deploy step

The new deploy step uses a YAML merge key (`<<: *deploy`) but the indentation is wrong. As written:

```yaml
      - step:
        <<: *deploy       # ← This is at the same level as "step:", not under it
        script:
          - /home/geraldpark/edwards-oqc/edwards.oqc.infra/deploy.sh
```

`<<: *deploy` must be indented one level deeper to be a property of the step:

```yaml
      - step:
          <<: *deploy     # ✅ Properly nested under "step:"
          script:
            - /home/geraldpark/edwards-oqc/edwards.oqc.infra/deploy.sh
```

With the current indentation, Bitbucket will either throw a YAML parse error or silently ignore the anchor merge, causing the deploy step to run without the configuration defined in the `*deploy` anchor (e.g., `runs-on`, `name`, `image`).

---

#### 2. [Logic] `bitbucket-pipelines.yml` — `mypy` and `pytest` are disabled

```yaml
# - mypy apps/server-backend will be part of future implementations
# - pytest -q --cov=apps/server-backend --cov-report=term-missing --cov-fail-under=70 apps/server-backend
```

Both static type checking and the test suite are now commented out. This means:
- Code with type errors can merge to `main` undetected
- Regressions will not be caught by CI

The comment says these will be added "in the future," but there is no tracking issue or deadline. This sets a dangerous precedent — the quality gate that was set at 70% coverage is now gone entirely.

**Recommendation**: Instead of commenting them out, fix the underlying issues (mypy errors, failing tests). If there are too many errors to fix immediately, consider:
- Running mypy with `--ignore-missing-imports` or per-module ignores rather than disabling entirely
- For pytest: lower the coverage threshold temporarily (`--cov-fail-under=50`) rather than removing the step

---

#### 3. [Logic] `deploy.sh` — Hardcoded absolute path

```bash
# Before (portable, correct)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

# After (hardcoded)
APP_DIR="/home/geraldpark/edwards-oqc/edwards.oqc.infra"
```

The original dynamic path resolution was correct — it resolved the directory where `deploy.sh` lives, regardless of where it is called from. The hardcoded path:
- Ties the entire deployment to a single user's home directory (`geraldpark`)
- Will silently use the wrong directory if cloned to a different path or run by a different user
- Makes the script unusable in any other environment (staging, another developer's machine, new server)

The commit message itself acknowledges this: *"need to be change in future"*. This should be fixed now before merging, not deferred.

**Recommendation**: Restore the original portable path resolution:
```bash
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
```

If the pipeline calls `deploy.sh` from a different working directory, pass the path as an environment variable or argument instead.

---

#### 4. [Bug] `apps/server-backend/init_db_and_seed.py` — Model imports removed

```python
# Removed:
from src.models.user import UserModel
from src.models.database import TestRecordModel
```

These imports were not just for using the classes — they were needed to **register** the SQLAlchemy ORM models with `Base.metadata`. SQLAlchemy only knows about a table if its model class has been imported before `Base.metadata.create_all()` is called.

After this change, if `init_db_and_seed.py` is run standalone (e.g., during initial server setup), `UserModel` and `TestRecordModel` tables may not be created.

**Recommendation**: Either restore the model imports with a `# noqa: F401` comment explaining the side-effect intent, or add a dedicated model registry module:

```python
# Explicitly import models to register them with Base.metadata
import src.models.user  # noqa: F401 — registers UserModel
import src.models.database  # noqa: F401 — registers all DB models
```

---

### Improvements Recommended

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Design] | `.pre-commit-config.yaml` | `npx pnpm@9.15.0` in pre-commit hook is fragile and network-dependent |
| 2 | [Design] | `apps/server-frontend/.eslintrc.cjs` | `no-explicit-any: 'off'` globally disables type safety |
| 3 | [Logic] | `apps/server-frontend/package.json` | Removing `--max-warnings 0` allows lint warnings to accumulate |
| 4 | [Logic] | `deploy.sh` | Removing `--no-cache` from docker build may cause stale layer issues |
| 5 | [Design] | `deploy.sh` | Rollback log message removed, making incident debugging harder |

---

#### 1. [Design] `.pre-commit-config.yaml` — Fragile pnpm invocation

```yaml
entry: npx pnpm@9.15.0 -C apps/server-frontend run lint
language: system
```

Using `npx pnpm@9.15.0` requires downloading pnpm from npm every time (if not cached), which:
- Fails in offline/restricted network environments
- Silently uses a different pnpm version if caching is involved
- Is slower than using a locally installed `pnpm`

**Recommendation**: Use `pnpm` directly (assuming it's in `PATH`), or manage it via Corepack:

```yaml
entry: bash -c "cd apps/server-frontend && pnpm run lint"
language: system
```

---

#### 2. [Design] `apps/server-frontend/.eslintrc.cjs` — `any` type globally allowed

```js
'@typescript-eslint/no-explicit-any': 'off',
```

Disabling `no-explicit-any` globally defeats one of the main benefits of TypeScript. If there are specific cases where `any` is unavoidable (e.g., third-party library boundaries), it's better to suppress inline with `// eslint-disable-next-line` rather than allowing it everywhere.

**Recommendation**:
```js
'@typescript-eslint/no-explicit-any': 'warn',  // At minimum, warn
```

---

#### 3. [Logic] `apps/server-frontend/package.json` — `--max-warnings 0` removed

```json
// Before
"lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"

// After
"lint": "eslint . --ext ts,tsx --report-unused-disable-directives"
```

Without `--max-warnings 0`, the lint script exits successfully even with warnings. Combined with adding `eslint-plugin-react` (which may introduce new warnings), lint warnings may silently accumulate. In the pipeline, this means linting is essentially not enforced for warnings.

---

#### 4. [Logic] `deploy.sh` — Docker build cache behavior change

```bash
# Before
docker compose --env-file .env -f docker-compose.server.yml build --no-cache

# After
docker compose --env-file .env -f docker-compose.server.yml build
```

Removing `--no-cache` means Docker may use cached layers even when dependencies have changed (e.g., `requirements.txt` or `package.json` unchanged in content but a new package is needed). If the `COPY` instruction for dependency files hasn't changed, Docker will reuse the cached layer.

This is acceptable if Dockerfiles use proper cache-busting patterns, but worth verifying.

---

#### 5. [Design] `deploy.sh` — Rollback log message removed

```bash
# Removed
log "Resetting to $LAST_COMMIT"
git reset --hard "$LAST_COMMIT"
```

The actual `git reset --hard` command is kept, but the log line explaining *what* commit it's resetting to was removed. During a production incident, knowing which commit the rollback targeted is essential for debugging. Consider restoring the log message.

---

### What's Done Well

- **Timezone import cleanup**: Moving `from datetime import timezone` from inside function/class bodies to module-level is the correct Python pattern. The original code had `from datetime import timezone` scattered inside class bodies (e.g., `UserModel`, `TestSetModel`) which is a code smell that was correctly fixed across 10+ files.
- **`auth_service.py` fix**: The original `create_access_token` had broken, unreachable code (an orphaned `expire = datetime.utcnow() + expires_delta` line without a wrapping `if` block). The rewrite is correct and consistent.
- **`.env` guard in `deploy.sh`**: Adding `if [ ! -f ".env" ]; then exit 1; fi` before starting Docker is a good defensive check that prevents mysterious failures.
- **`cd` error handling**: `cd "$APP_DIR" || { log "App directory not found"; exit 1; }` is proper shell scripting that fails fast instead of silently continuing in the wrong directory.
- **`alembic/env.py` import style**: Using `import models.database  # noqa: F401` with a clear comment is cleaner than importing unused names just for their side effects.

---

### Final Verdict

**CHANGES REQUESTED**

There are 4 must-fix issues: a YAML indentation bug that will break the deploy step, removal of type checking and tests from CI (critical quality regression), a hardcoded deployment path that breaks portability, and a potential SQLAlchemy model registration bug in `init_db_and_seed.py`. Please address these before merging.
