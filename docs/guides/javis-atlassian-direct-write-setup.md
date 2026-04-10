# Javis Atlassian Direct Write Setup

This guide covers the production setup for user-scoped Jira and Confluence writes in Javis.

## Architecture

- App login and user identity are resolved by the existing session flow.
- Jira and Confluence write permission is granted separately through Atlassian OAuth 2.0 3LO.
- Users without a connected Atlassian account stay readonly.
- Legacy service-account sync is still available, but only when sync scripts are explicitly run with `--write-mode legacy`.

## Required Database Changes

Apply these migrations before enabling direct write in production:

```bash
psql -d javis_brain -f scripts/migrations/20260406_add_atlassian_oauth_connections.sql
psql -d javis_brain -f scripts/migrations/20260406_add_external_write_audit_log.sql
```

## Required Environment Variables

Core app/session:

- `JAVIS_SESSION_SECRET`
- `JAVIS_CAPABILITY_MODE`

Per-user write allowlists:

- `JAVIS_GENERAL_WRITE_USERS`
- `JAVIS_JIRA_WRITE_USERS`
- `JAVIS_CONFLUENCE_WRITE_USERS`

Atlassian OAuth:

- `ATLASSIAN_OAUTH_CLIENT_ID`
- `ATLASSIAN_OAUTH_CLIENT_SECRET`
- `ATLASSIAN_OAUTH_TOKEN_SECRET` or reuse `JAVIS_SESSION_SECRET`
- `ATLASSIAN_OAUTH_STATE_SECRET` or reuse `JAVIS_SESSION_SECRET`
- `ATLASSIAN_OAUTH_REDIRECT_URI`
- `ATLASSIAN_SITE_URL`

Sync mode safety defaults:

- `JAVIS_JIRA_WRITE_MODE=direct`
- `JAVIS_CONFLUENCE_WRITE_MODE=direct`

## Atlassian OAuth App Configuration

Register an Atlassian OAuth 2.0 3LO app and configure the callback URL:

- `${APP_ORIGIN}/api/auth/atlassian/callback`

Recommended scopes for the current implementation:

- `offline_access`
- `read:me`
- `read:jira-user`
- `read:jira-work`
- `write:jira-work`
- `read:confluence-content.all`
- `write:confluence-content`

## Current Direct Write Coverage

Jira:

- issue field updates
- status transitions

Confluence:

- label suggestion apply
- restructure suggestion apply
- archive suggestion apply

Still not direct-applied yet:

- merge suggestions
- update suggestions that require generated replacement content
- split suggestions

## Rollout Checklist

1. Apply DB migrations.
2. Set `JAVIS_SESSION_SECRET`.
3. Configure Atlassian OAuth client and callback URL.
4. Set `ATLASSIAN_*` variables in the deployment target.
5. Set `JAVIS_JIRA_WRITE_MODE=direct` and `JAVIS_CONFLUENCE_WRITE_MODE=direct`.
6. Populate `JAVIS_*_WRITE_USERS` with the app users allowed to write.
7. Connect a test user through `/api/auth/atlassian/connect`.
8. Verify `/api/auth/atlassian/status` returns `connected: true`.
9. Test Jira edit, Confluence label apply, Confluence restructure apply, and Confluence archive apply.
10. Check `external_write_audit_log` for recorded user-scoped write events.

## Legacy Fallback

If emergency service-account write-back is needed:

```bash
python3 scripts/sync_bidirectional.py --push-only --write-mode legacy
python3 scripts/sync_confluence_bidirectional.py --push-only --write-mode legacy
```

Do not run those modes as the default cron once user-scoped direct write is enabled.
