Create a new bidirectional sync script for $ARGUMENTS following the Javis pattern:

1. **Sync script** in `scripts/sync_{name}_bidirectional.py`
   - Incremental sync using `last_synced_at` (full-scan forbidden)
   - Support `--pull-only`, `--dry-run`, `--force` flags
   - Conflict detection: compare `local_modified_at` vs remote `updated`
   - Exponential backoff for API rate limits
   - Structured logging (no credentials in logs)

2. **Client** in `scripts/lib/{name}_client.py`
   - Wrap external API calls
   - Handle authentication (from env vars)
   - Implement retry logic with backoff
   - Timeout: 30s default

3. **DB functions** in `scripts/lib/db.py` or new module
   - Use `get_connection()` context manager
   - Parameterized queries only
   - Track `last_synced_at`, `local_modified_at`, `local_modified_fields`

4. **CLI integration** in `scripts/cli/sync.py`
   - Register new sync target in CLI
   - Support `javis_cli.py sync {name}` command

5. **Tests** in `tests/unit/test_sync_{name}.py`
   - Mock external API
   - Test incremental logic
   - Test conflict detection
   - Test dry-run mode
   - Coverage: 90%+

Reference: `scripts/sync_bidirectional.py`, `scripts/lib/jira_client.py`
