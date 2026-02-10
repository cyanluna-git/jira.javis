#!/usr/bin/env python3
"""
Bidirectional Sync: Jira <-> PostgreSQL

Usage:
  python scripts/sync_bidirectional.py                    # Full bidirectional sync
  python scripts/sync_bidirectional.py --pull-only        # Jira -> DB only
  python scripts/sync_bidirectional.py --push-only        # DB -> Jira only
  python scripts/sync_bidirectional.py --force            # Force full re-sync (ignore timestamps)
  python scripts/sync_bidirectional.py --force-local      # Resolve conflicts with local data
  python scripts/sync_bidirectional.py --force-remote     # Resolve conflicts with remote data
  python scripts/sync_bidirectional.py --project ASP      # Sync specific project
  python scripts/sync_bidirectional.py --dry-run          # Show what would happen
"""

import os
import sys
import json
import time
import argparse
import requests
import psycopg2
from psycopg2.extras import Json, RealDictCursor
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any, Tuple


# --- Configuration ---
def load_env(env_path=".env"):
    config = {}
    try:
        if not os.path.exists(env_path):
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")

        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
    except FileNotFoundError:
        print(f"Warning: .env file not found at {env_path}")
    return config


config = load_env()
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

DB_HOST = config.get("DB_HOST", "localhost")
DB_PORT = config.get("DB_PORT", "5432")
DB_NAME = config.get("DB_NAME", "javis_brain")
DB_USER = config.get("DB_USER", "javis")
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

TARGET_PROJECTS = ["EUV", "ASP", "PSSM"]

# Fields that can be pushed to Jira
PUSHABLE_FIELDS = ["summary", "description", "priority", "labels", "components"]


class SyncStats:
    """Track sync statistics."""
    def __init__(self):
        self.pulled = 0
        self.pushed = 0
        self.conflicts = 0
        self.errors = 0
        self.skipped = 0

    def __str__(self):
        return (
            f"Pulled: {self.pulled}, Pushed: {self.pushed}, "
            f"Conflicts: {self.conflicts}, Errors: {self.errors}, Skipped: {self.skipped}"
        )


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )


def api_request(method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
    """Make authenticated Jira API request with retry logic."""
    url = f"{JIRA_URL}{endpoint}"
    auth = (JIRA_EMAIL, JIRA_TOKEN)

    retries = 0
    max_retries = 5

    while retries < max_retries:
        try:
            response = requests.request(method, url, auth=auth, timeout=30, **kwargs)

            if response.status_code == 429:
                wait_time = int(response.headers.get("Retry-After", 5)) + (2 ** retries)
                print(f"  Rate limit hit. Waiting {wait_time}s...")
                time.sleep(wait_time)
                retries += 1
                continue

            return response

        except requests.exceptions.RequestException as e:
            print(f"  API Error: {e}")
            if hasattr(e, 'response') and e.response is not None and e.response.status_code >= 500:
                time.sleep(5)
                retries += 1
                continue
            return None

    return None


def log_sync(conn, issue_key: str, direction: str, status: str, details: Dict = None):
    """Log sync operation to sync_logs table."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sync_logs (issue_key, direction, status, details)
        VALUES (%s, %s, %s, %s)
    """, [issue_key, direction, status, Json(details or {})])


def save_conflict(conn, issue_key: str, local_data: Dict, remote_data: Dict, conflicting_fields: List[str]):
    """Save conflict for later resolution."""
    cur = conn.cursor()

    # Check if conflict already exists
    cur.execute("SELECT id FROM sync_conflicts WHERE issue_key = %s AND resolution IS NULL", [issue_key])
    existing = cur.fetchone()

    if existing:
        # Update existing conflict
        cur.execute("""
            UPDATE sync_conflicts
            SET local_data = %s, remote_data = %s, conflicting_fields = %s, detected_at = NOW()
            WHERE issue_key = %s AND resolution IS NULL
        """, [Json(local_data), Json(remote_data), conflicting_fields, issue_key])
    else:
        # Insert new conflict
        cur.execute("""
            INSERT INTO sync_conflicts (issue_key, local_data, remote_data, conflicting_fields)
            VALUES (%s, %s, %s, %s)
        """, [issue_key, Json(local_data), Json(remote_data), conflicting_fields])


def resolve_conflict(conn, issue_key: str, resolution: str):
    """Mark conflict as resolved."""
    cur = conn.cursor()
    cur.execute("""
        UPDATE sync_conflicts
        SET resolution = %s, resolved_at = NOW()
        WHERE issue_key = %s AND resolution IS NULL
    """, [resolution, issue_key])


def fetch_remote_issue(issue_key: str) -> Optional[Dict]:
    """Fetch single issue from Jira."""
    response = api_request('GET', f'/rest/api/3/issue/{issue_key}', params={
        'fields': 'summary,status,description,priority,assignee,creator,reporter,issuetype,components,versions,fixVersions,labels,updated,attachment,comment'
    })

    if response and response.ok:
        return response.json()
    return None


def fetch_updated_issues(project: str, since: Optional[datetime]) -> List[Dict]:
    """Fetch issues updated since a given timestamp."""
    jql = f"project = {project}"
    if since:
        # Format for JQL: "2024-01-01 12:00"
        since_str = since.strftime("%Y-%m-%d %H:%M")
        jql += f" AND updated >= '{since_str}'"

    jql += " ORDER BY updated ASC"

    issues = []
    next_token = None

    while True:
        payload = {
            "jql": jql,
            "maxResults": 50,
            "fields": [
                "key", "summary", "status", "created", "updated",
                "description", "project", "priority", "assignee",
                "creator", "reporter", "issuetype", "components",
                "versions", "fixVersions", "labels", "attachment", "comment"
            ]
        }

        if next_token:
            payload["nextPageToken"] = next_token

        response = api_request('POST', '/rest/api/3/search/jql', json=payload)

        if not response or not response.ok:
            break

        data = response.json()
        issues.extend(data.get('issues', []))

        next_token = data.get('nextPageToken')
        if not next_token:
            break

        time.sleep(0.5)  # Rate limiting

    return issues


def get_locally_modified_issues(conn, project: str = None) -> List[Dict]:
    """Get issues that have been modified locally."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT key, project, summary, status, raw_data,
               local_modified_at, local_modified_fields, last_synced_at
        FROM jira_issues
        WHERE local_modified_at IS NOT NULL
          AND local_modified_at > COALESCE(last_synced_at, '1970-01-01'::timestamp)
    """
    params = []

    if project:
        query += " AND project = %s"
        params.append(project)

    query += " ORDER BY local_modified_at ASC"

    cur.execute(query, params)
    return cur.fetchall()


def get_unresolved_conflicts(conn, project: str = None) -> List[Dict]:
    """Get unresolved sync conflicts."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT sc.*, ji.project
        FROM sync_conflicts sc
        JOIN jira_issues ji ON ji.key = sc.issue_key
        WHERE sc.resolution IS NULL
    """
    params = []

    if project:
        query += " AND ji.project = %s"
        params.append(project)

    query += " ORDER BY sc.detected_at DESC"

    cur.execute(query, params)
    return cur.fetchall()


def detect_conflict(local_issue: Dict, remote_issue: Dict) -> Tuple[bool, List[str]]:
    """Detect if there's a conflict between local and remote versions."""
    local_fields = local_issue.get('local_modified_fields') or []
    conflicting = []

    remote_fields = remote_issue.get('fields', {})
    local_raw = local_issue.get('raw_data', {}).get('fields', {})

    for field in local_fields:
        local_val = local_raw.get(field)
        remote_val = remote_fields.get(field)

        # Normalize for comparison
        if isinstance(local_val, dict):
            local_val = json.dumps(local_val, sort_keys=True)
        if isinstance(remote_val, dict):
            remote_val = json.dumps(remote_val, sort_keys=True)

        if local_val != remote_val:
            conflicting.append(field)

    return len(conflicting) > 0, conflicting


def build_update_payload(issue: Dict) -> Dict:
    """Build Jira API update payload from local issue data."""
    modified_fields = issue.get('local_modified_fields') or []
    raw_data = issue.get('raw_data', {})
    fields = raw_data.get('fields', {})

    update_fields = {}

    for field in modified_fields:
        if field not in PUSHABLE_FIELDS:
            continue

        value = fields.get(field)

        if field == 'summary':
            update_fields['summary'] = value
        elif field == 'description':
            update_fields['description'] = value
        elif field == 'priority':
            if value and 'id' in value:
                update_fields['priority'] = {'id': value['id']}
        elif field == 'labels':
            update_fields['labels'] = value or []
        elif field == 'components':
            if value:
                update_fields['components'] = [{'id': c['id']} for c in value if 'id' in c]

    return {'fields': update_fields} if update_fields else None


# --- Pull Phase ---
def pull_changes(conn, project: str, stats: SyncStats, force_remote: bool = False, dry_run: bool = False, force_full: bool = False):
    """Pull changes from Jira to local DB."""
    print(f"\n[PULL] Fetching updates from Jira for {project}...")

    cur = conn.cursor()

    # Get last sync time for this project (skip if force_full)
    last_sync = None
    if not force_full:
        cur.execute("""
            SELECT MAX(last_synced_at) FROM jira_issues WHERE project = %s
        """, [project])
        result = cur.fetchone()
        last_sync = result[0] if result else None
    else:
        print("  (Force mode: fetching ALL issues)")

    # Fetch updated issues from Jira
    remote_issues = fetch_updated_issues(project, last_sync)
    print(f"  Found {len(remote_issues)} updated issues in Jira")

    for remote_issue in remote_issues:
        key = remote_issue.get('key')
        if not key:
            continue

        # Check if issue exists locally and has local modifications
        cur.execute("""
            SELECT key, summary, status, raw_data, local_modified_at, local_modified_fields, last_synced_at
            FROM jira_issues WHERE key = %s
        """, [key])
        local_issue = cur.fetchone()

        if local_issue and local_issue[4]:  # local_modified_at is not None
            local_data = {
                'key': local_issue[0],
                'summary': local_issue[1],
                'status': local_issue[2],
                'raw_data': local_issue[3],
                'local_modified_at': local_issue[4],
                'local_modified_fields': local_issue[5],
                'last_synced_at': local_issue[6]
            }

            has_conflict, conflicting_fields = detect_conflict(local_data, remote_issue)

            if has_conflict and not force_remote:
                # Save conflict for later resolution
                print(f"  CONFLICT: {key} - fields: {conflicting_fields}")
                if not dry_run:
                    save_conflict(conn, key, local_data['raw_data'], remote_issue, conflicting_fields)
                    log_sync(conn, key, 'pull', 'conflict', {
                        'conflicting_fields': conflicting_fields
                    })
                stats.conflicts += 1
                continue

            if force_remote:
                print(f"  Force overwrite: {key}")
                if not dry_run:
                    resolve_conflict(conn, key, 'remote')

        # Update local DB
        fields = remote_issue.get('fields', {})
        summary = fields.get('summary', '')
        status = fields.get('status', {}).get('name', '')
        created = fields.get('created')
        updated = fields.get('updated')

        if dry_run:
            print(f"  [DRY-RUN] Would update: {key}")
        else:
            cur.execute("""
                INSERT INTO jira_issues (key, project, summary, status, created_at, updated_at, raw_data, last_synced_at, local_modified_at, local_modified_fields)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NULL, NULL)
                ON CONFLICT (key) DO UPDATE SET
                    summary = EXCLUDED.summary,
                    status = EXCLUDED.status,
                    updated_at = EXCLUDED.updated_at,
                    raw_data = EXCLUDED.raw_data,
                    last_synced_at = NOW(),
                    local_modified_at = NULL,
                    local_modified_fields = NULL
            """, [key, project, summary, status, created, updated, Json(remote_issue)])

            log_sync(conn, key, 'pull', 'success', {'updated_at': updated})

        stats.pulled += 1

    if not dry_run:
        conn.commit()


# --- Push Phase ---
def push_changes(conn, project: str, stats: SyncStats, force_local: bool = False, dry_run: bool = False):
    """Push local changes to Jira."""
    print(f"\n[PUSH] Pushing local changes to Jira for {project}...")

    modified_issues = get_locally_modified_issues(conn, project)
    print(f"  Found {len(modified_issues)} locally modified issues")

    for issue in modified_issues:
        key = issue['key']

        # Check for conflict first
        if not force_local:
            remote = fetch_remote_issue(key)
            if remote:
                has_conflict, conflicting_fields = detect_conflict(issue, remote)
                if has_conflict:
                    print(f"  CONFLICT: {key} - fields: {conflicting_fields}")
                    if not dry_run:
                        save_conflict(conn, key, issue['raw_data'], remote, conflicting_fields)
                        log_sync(conn, key, 'push', 'conflict', {
                            'conflicting_fields': conflicting_fields
                        })
                    stats.conflicts += 1
                    continue

        # Build update payload
        payload = build_update_payload(issue)
        if not payload:
            print(f"  Skipping {key}: no pushable fields modified")
            stats.skipped += 1
            continue

        if dry_run:
            print(f"  [DRY-RUN] Would push: {key} - {list(payload['fields'].keys())}")
            stats.pushed += 1
            continue

        # Push to Jira
        response = api_request('PUT', f'/rest/api/3/issue/{key}', json=payload)

        if response and response.ok:
            print(f"  Pushed: {key}")

            # Clear local modification tracking
            cur = conn.cursor()
            cur.execute("""
                UPDATE jira_issues
                SET local_modified_at = NULL,
                    local_modified_fields = NULL,
                    last_synced_at = NOW()
                WHERE key = %s
            """, [key])

            log_sync(conn, key, 'push', 'success', {
                'pushed_fields': list(payload['fields'].keys())
            })

            if not force_local:
                resolve_conflict(conn, key, 'local')

            stats.pushed += 1
        else:
            error_msg = response.text if response else "No response"
            print(f"  ERROR pushing {key}: {error_msg[:100]}")
            log_sync(conn, key, 'push', 'error', {'error': error_msg})
            stats.errors += 1

        time.sleep(0.5)  # Rate limiting

    if not dry_run:
        conn.commit()


# --- Conflict Resolution ---
def show_conflicts(conn, project: str = None):
    """Display unresolved conflicts."""
    conflicts = get_unresolved_conflicts(conn, project)

    if not conflicts:
        print("\nNo unresolved conflicts.")
        return

    print(f"\n{'='*60}")
    print(f"UNRESOLVED CONFLICTS: {len(conflicts)}")
    print(f"{'='*60}")

    for c in conflicts:
        print(f"\nIssue: {c['issue_key']} ({c['project']})")
        print(f"Conflicting fields: {c['conflicting_fields']}")
        print(f"Detected: {c['detected_at']}")

        # Show differences
        local = c['local_data'].get('fields', {}) if c['local_data'] else {}
        remote = c['remote_data'].get('fields', {}) if c['remote_data'] else {}

        for field in (c['conflicting_fields'] or []):
            local_val = local.get(field, '<not set>')
            remote_val = remote.get(field, '<not set>')

            # Truncate long values
            if isinstance(local_val, str) and len(local_val) > 50:
                local_val = local_val[:50] + '...'
            if isinstance(remote_val, str) and len(remote_val) > 50:
                remote_val = remote_val[:50] + '...'

            print(f"  {field}:")
            print(f"    Local:  {local_val}")
            print(f"    Remote: {remote_val}")


def resolve_all_conflicts(conn, resolution: str, project: str = None, dry_run: bool = False):
    """Resolve all conflicts with given resolution."""
    conflicts = get_unresolved_conflicts(conn, project)

    if not conflicts:
        print("No conflicts to resolve.")
        return

    print(f"\nResolving {len(conflicts)} conflicts with '{resolution}' preference...")

    for c in conflicts:
        key = c['issue_key']

        if dry_run:
            print(f"  [DRY-RUN] Would resolve {key} -> {resolution}")
            continue

        if resolution == 'local':
            # Re-push local changes
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT * FROM jira_issues WHERE key = %s
            """, [key])
            issue = cur.fetchone()

            if issue:
                payload = build_update_payload(issue)
                if payload:
                    response = api_request('PUT', f'/rest/api/3/issue/{key}', json=payload)
                    if response and response.ok:
                        cur.execute("""
                            UPDATE jira_issues
                            SET local_modified_at = NULL, local_modified_fields = NULL, last_synced_at = NOW()
                            WHERE key = %s
                        """, [key])
                        print(f"  Resolved {key} -> pushed local")

        elif resolution == 'remote':
            # Re-pull remote changes
            remote = fetch_remote_issue(key)
            if remote:
                fields = remote.get('fields', {})
                cur = conn.cursor()
                cur.execute("""
                    UPDATE jira_issues
                    SET summary = %s,
                        status = %s,
                        raw_data = %s,
                        last_synced_at = NOW(),
                        local_modified_at = NULL,
                        local_modified_fields = NULL
                    WHERE key = %s
                """, [
                    fields.get('summary', ''),
                    fields.get('status', {}).get('name', ''),
                    Json(remote),
                    key
                ])
                print(f"  Resolved {key} -> pulled remote")

        resolve_conflict(conn, key, resolution)

    if not dry_run:
        conn.commit()


# --- Main ---
def main():
    parser = argparse.ArgumentParser(description='Bidirectional Jira <-> DB Sync')
    parser.add_argument('--pull-only', action='store_true', help='Only pull from Jira')
    parser.add_argument('--push-only', action='store_true', help='Only push to Jira')
    parser.add_argument('--force', action='store_true', help='Force full re-sync (ignore timestamps, fetch all issues)')
    parser.add_argument('--force-local', action='store_true', help='Force local changes on conflicts')
    parser.add_argument('--force-remote', action='store_true', help='Force remote changes on conflicts')
    parser.add_argument('--project', type=str, help='Sync specific project only')
    parser.add_argument('--dry-run', action='store_true', help='Show what would happen without making changes')
    parser.add_argument('--show-conflicts', action='store_true', help='Show unresolved conflicts and exit')
    args = parser.parse_args()

    if not JIRA_URL or not JIRA_TOKEN:
        print("Error: JIRA_URL or JIRA_TOKEN missing in .env")
        sys.exit(1)

    if args.force_local and args.force_remote:
        print("Error: Cannot use both --force-local and --force-remote")
        sys.exit(1)

    conn = get_db_connection()
    stats = SyncStats()

    projects = [args.project] if args.project else TARGET_PROJECTS

    try:
        if args.show_conflicts:
            show_conflicts(conn, args.project)
            return

        print("=" * 60)
        print("BIDIRECTIONAL SYNC")
        print("=" * 60)
        print(f"Projects: {', '.join(projects)}")
        print(f"Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}")
        if args.force:
            print("Force: FULL RE-SYNC (ignoring timestamps)")
        if args.force_local:
            print("Conflict resolution: FORCE LOCAL")
        elif args.force_remote:
            print("Conflict resolution: FORCE REMOTE")

        for project in projects:
            # Pull phase
            if not args.push_only:
                pull_changes(conn, project, stats, args.force_remote, args.dry_run, args.force)

            # Push phase
            if not args.pull_only:
                push_changes(conn, project, stats, args.force_local, args.dry_run)

        # Resolve conflicts if force flag is set
        if args.force_local:
            resolve_all_conflicts(conn, 'local', args.project, args.dry_run)
        elif args.force_remote:
            resolve_all_conflicts(conn, 'remote', args.project, args.dry_run)

        print("\n" + "=" * 60)
        print("SYNC COMPLETE")
        print("=" * 60)
        print(stats)

        # Show remaining conflicts if any
        conflicts = get_unresolved_conflicts(conn, args.project)
        if conflicts:
            print(f"\nWarning: {len(conflicts)} unresolved conflicts remain.")
            print("Run with --show-conflicts to see details.")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
