#!/usr/bin/env python3
"""
Bidirectional Sync: Confluence <-> PostgreSQL

Usage:
  python scripts/sync_confluence_bidirectional.py                    # Full bidirectional sync
  python scripts/sync_confluence_bidirectional.py --pull-only        # Confluence -> DB only
  python scripts/sync_confluence_bidirectional.py --push-only        # DB -> Confluence only
  python scripts/sync_confluence_bidirectional.py --force-local      # Resolve conflicts with local data
  python scripts/sync_confluence_bidirectional.py --force-remote     # Resolve conflicts with remote data
  python scripts/sync_confluence_bidirectional.py --dry-run          # Show what would happen
"""

import os
import sys
import json
import time
import argparse
import requests
import psycopg2
from psycopg2.extras import Json, RealDictCursor
from requests.auth import HTTPBasicAuth
from datetime import datetime, timezone
from typing import Optional, Dict, List, Tuple


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
CONFLUENCE_BASE = config.get("JIRA_URL", "").rstrip('/')
EMAIL = config.get("JIRA_EMAIL")
TOKEN = config.get("JIRA_TOKEN")
AUTH = HTTPBasicAuth(EMAIL, TOKEN)

DB_HOST = config.get("DB_HOST", "localhost")
DB_PORT = config.get("DB_PORT", "5439")
DB_NAME = config.get("DB_NAME", "javis_brain")
DB_USER = config.get("DB_USER", "javis")
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

SPACE_ID = "67043441"  # ISP Space ID

# Fields that can be pushed to Confluence
PUSHABLE_FIELDS = ["title", "body_storage", "labels"]


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


def init_db():
    """Initialize database schema for bidirectional sync."""
    conn = get_db_connection()
    cur = conn.cursor()

    # Add local modification tracking columns if not exist
    cur.execute("""
        ALTER TABLE confluence_v2_content
        ADD COLUMN IF NOT EXISTS local_modified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS local_modified_fields TEXT[];
    """)

    # Create sync logs table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS confluence_sync_logs (
            id SERIAL PRIMARY KEY,
            page_id TEXT NOT NULL,
            direction TEXT NOT NULL,  -- 'pull' or 'push'
            status TEXT NOT NULL,     -- 'success', 'error', 'conflict'
            details JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create conflicts table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS confluence_sync_conflicts (
            id SERIAL PRIMARY KEY,
            page_id TEXT NOT NULL,
            local_data JSONB,
            remote_data JSONB,
            conflicting_fields TEXT[],
            resolution TEXT,          -- 'local', 'remote', NULL if unresolved
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_conf_sync_logs_page ON confluence_sync_logs(page_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_conf_conflicts_page ON confluence_sync_conflicts(page_id);")

    conn.commit()
    cur.close()
    conn.close()
    print("Database schema initialized for bidirectional sync.")


# --- API Helpers ---
def api_get(endpoint):
    """Make a GET request to Confluence API."""
    if endpoint.startswith('http'):
        url = endpoint
    elif endpoint.startswith('/wiki'):
        url = f"{CONFLUENCE_BASE}{endpoint}"
    else:
        url = f"{CONFLUENCE_BASE}/wiki{endpoint}"

    retries = 0
    while retries < 3:
        try:
            res = requests.get(url, auth=AUTH, timeout=60)
            if res.status_code == 404:
                return None
            if res.status_code == 429:
                wait = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                retries += 1
                continue
            res.raise_for_status()
            return res.json()
        except Exception as e:
            print(f"  API GET Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None


def api_put(endpoint, data):
    """Make a PUT request to Confluence API."""
    if endpoint.startswith('http'):
        url = endpoint
    elif endpoint.startswith('/wiki'):
        url = f"{CONFLUENCE_BASE}{endpoint}"
    else:
        url = f"{CONFLUENCE_BASE}/wiki{endpoint}"

    headers = {"Content-Type": "application/json"}

    retries = 0
    while retries < 3:
        try:
            res = requests.put(url, auth=AUTH, json=data, headers=headers, timeout=60)
            if res.status_code == 429:
                wait = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                retries += 1
                continue
            if res.status_code == 409:
                # Version conflict
                return {'error': 'version_conflict', 'status': 409}
            if res.ok:
                return res.json() if res.text else {'success': True}
            res.raise_for_status()
        except requests.exceptions.HTTPError as e:
            return {'error': str(e), 'status': res.status_code if res else None}
        except Exception as e:
            print(f"  API PUT Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None


def api_post(endpoint, data):
    """Make a POST request to Confluence API (for labels)."""
    if endpoint.startswith('http'):
        url = endpoint
    elif endpoint.startswith('/wiki'):
        url = f"{CONFLUENCE_BASE}{endpoint}"
    else:
        url = f"{CONFLUENCE_BASE}/wiki{endpoint}"

    headers = {"Content-Type": "application/json"}

    retries = 0
    while retries < 3:
        try:
            res = requests.post(url, auth=AUTH, json=data, headers=headers, timeout=60)
            if res.status_code == 429:
                wait = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                time.sleep(wait)
                retries += 1
                continue
            if res.status_code in [200, 201, 409]:  # 409 = label already exists
                return res.json() if res.text else {'success': True}
            res.raise_for_status()
        except Exception as e:
            print(f"  API POST Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None


def api_delete(endpoint):
    """Make a DELETE request to Confluence API (for labels)."""
    if endpoint.startswith('http'):
        url = endpoint
    elif endpoint.startswith('/wiki'):
        url = f"{CONFLUENCE_BASE}{endpoint}"
    else:
        url = f"{CONFLUENCE_BASE}/wiki{endpoint}"

    retries = 0
    while retries < 3:
        try:
            res = requests.delete(url, auth=AUTH, timeout=60)
            if res.status_code == 429:
                wait = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                time.sleep(wait)
                retries += 1
                continue
            if res.status_code in [200, 204, 404]:  # 404 = already deleted
                return {'success': True}
            res.raise_for_status()
        except Exception as e:
            print(f"  API DELETE Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None


# --- Confluence API Functions ---
def fetch_remote_page(page_id: str) -> Optional[Dict]:
    """Fetch single page from Confluence with body."""
    endpoint = f"/api/v2/pages/{page_id}?body-format=storage"
    return api_get(endpoint)


def fetch_remote_labels(page_id: str) -> List[str]:
    """Fetch labels for a page."""
    endpoint = f"/api/v2/pages/{page_id}/labels"
    data = api_get(endpoint)
    if data and 'results' in data:
        return [l['name'] for l in data['results']]
    return []


def fetch_updated_pages(since: Optional[datetime] = None) -> List[Dict]:
    """Fetch pages from space, optionally filtered by update time."""
    pages = []
    current_url = f"/api/v2/spaces/{SPACE_ID}/pages?limit=50&body-format=storage&sort=-modified-date"

    while current_url:
        data = api_get(current_url)
        if not data or 'results' not in data:
            break

        for page in data['results']:
            # Check if page was modified after our last sync
            if since:
                modified_at = page.get('version', {}).get('createdAt')
                if modified_at:
                    try:
                        page_modified = datetime.fromisoformat(modified_at.replace('Z', '+00:00'))
                        since_aware = since.replace(tzinfo=timezone.utc) if since.tzinfo is None else since
                        if page_modified <= since_aware:
                            # Pages are sorted by modified date desc, so we can stop here
                            return pages
                    except (ValueError, TypeError):
                        pass

            pages.append(page)

        next_link = data.get('_links', {}).get('next')
        current_url = next_link
        time.sleep(0.3)  # Rate limiting

    return pages


def update_page_content(page_id: str, title: str, body: str, version: int) -> Optional[Dict]:
    """Update page title and body in Confluence."""
    endpoint = f"/api/v2/pages/{page_id}"
    data = {
        "id": page_id,
        "status": "current",
        "title": title,
        "body": {
            "representation": "storage",
            "value": body
        },
        "version": {
            "number": version + 1,
            "message": "Updated via Javis sync"
        }
    }
    return api_put(endpoint, data)


def sync_labels_to_confluence(page_id: str, local_labels: List[str], remote_labels: List[str]) -> bool:
    """Sync labels between local and remote."""
    local_set = set(local_labels or [])
    remote_set = set(remote_labels or [])

    # Labels to add
    to_add = local_set - remote_set
    # Labels to remove
    to_remove = remote_set - local_set

    success = True

    # Add new labels (use v1 API)
    for label in to_add:
        endpoint = f"/rest/api/content/{page_id}/label"
        result = api_post(endpoint, [{"prefix": "global", "name": label}])
        if not result:
            success = False

    # Remove labels (use v1 API)
    for label in to_remove:
        endpoint = f"/rest/api/content/{page_id}/label/{label}"
        result = api_delete(endpoint)
        if not result:
            success = False

    return success


# --- Sync Logging ---
def log_sync(conn, page_id: str, direction: str, status: str, details: Dict = None):
    """Log sync operation."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO confluence_sync_logs (page_id, direction, status, details)
        VALUES (%s, %s, %s, %s)
    """, [page_id, direction, status, Json(details or {})])


def save_conflict(conn, page_id: str, local_data: Dict, remote_data: Dict, conflicting_fields: List[str]):
    """Save conflict for later resolution."""
    cur = conn.cursor()

    # Check if conflict already exists
    cur.execute("SELECT id FROM confluence_sync_conflicts WHERE page_id = %s AND resolution IS NULL", [page_id])
    existing = cur.fetchone()

    if existing:
        cur.execute("""
            UPDATE confluence_sync_conflicts
            SET local_data = %s, remote_data = %s, conflicting_fields = %s, detected_at = NOW()
            WHERE page_id = %s AND resolution IS NULL
        """, [Json(local_data), Json(remote_data), conflicting_fields, page_id])
    else:
        cur.execute("""
            INSERT INTO confluence_sync_conflicts (page_id, local_data, remote_data, conflicting_fields)
            VALUES (%s, %s, %s, %s)
        """, [page_id, Json(local_data), Json(remote_data), conflicting_fields])


def resolve_conflict(conn, page_id: str, resolution: str):
    """Mark conflict as resolved."""
    cur = conn.cursor()
    cur.execute("""
        UPDATE confluence_sync_conflicts
        SET resolution = %s, resolved_at = NOW()
        WHERE page_id = %s AND resolution IS NULL
    """, [resolution, page_id])


# --- Conflict Detection ---
def detect_conflict(local_page: Dict, remote_page: Dict) -> Tuple[bool, List[str]]:
    """Detect if there's a conflict between local and remote versions."""
    local_fields = local_page.get('local_modified_fields') or []
    conflicting = []

    for field in local_fields:
        if field == 'title':
            local_val = local_page.get('title', '')
            remote_val = remote_page.get('title', '')
        elif field == 'body_storage':
            local_val = local_page.get('body_storage', '')
            remote_val = remote_page.get('body', {}).get('storage', {}).get('value', '')
        elif field == 'labels':
            local_val = sorted(local_page.get('labels') or [])
            remote_val = sorted(fetch_remote_labels(local_page['id']))
        else:
            continue

        if local_val != remote_val:
            conflicting.append(field)

    return len(conflicting) > 0, conflicting


def get_locally_modified_pages(conn) -> List[Dict]:
    """Get pages that have been modified locally."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, type, title, parent_id, space_id, labels, body_storage, version,
               web_url, raw_data, local_modified_at, local_modified_fields, last_synced_at
        FROM confluence_v2_content
        WHERE local_modified_at IS NOT NULL
          AND local_modified_at > COALESCE(last_synced_at, '1970-01-01'::timestamp)
          AND type = 'page'
        ORDER BY local_modified_at ASC
    """)
    return cur.fetchall()


def get_unresolved_conflicts(conn) -> List[Dict]:
    """Get unresolved sync conflicts."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT * FROM confluence_sync_conflicts
        WHERE resolution IS NULL
        ORDER BY detected_at DESC
    """)
    return cur.fetchall()


# --- Pull Phase ---
def pull_changes(conn, stats: SyncStats, force_remote: bool = False, dry_run: bool = False):
    """Pull changes from Confluence to local DB."""
    print("\n[PULL] Fetching updates from Confluence...")

    # Get last sync time
    cur = conn.cursor()
    cur.execute("SELECT MAX(last_synced_at) FROM confluence_v2_content WHERE type = 'page'")
    result = cur.fetchone()
    last_sync = result[0] if result else None

    # Fetch updated pages
    remote_pages = fetch_updated_pages(last_sync)
    print(f"  Found {len(remote_pages)} updated pages in Confluence")

    for remote_page in remote_pages:
        page_id = remote_page.get('id')
        if not page_id:
            continue

        # Check if page exists locally and has local modifications
        cur.execute("""
            SELECT id, title, body_storage, labels, version, local_modified_at, local_modified_fields, last_synced_at
            FROM confluence_v2_content WHERE id = %s
        """, [page_id])
        local_row = cur.fetchone()

        if local_row and local_row[5]:  # local_modified_at is not None
            local_page = {
                'id': local_row[0],
                'title': local_row[1],
                'body_storage': local_row[2],
                'labels': local_row[3],
                'version': local_row[4],
                'local_modified_at': local_row[5],
                'local_modified_fields': local_row[6],
                'last_synced_at': local_row[7]
            }

            has_conflict, conflicting_fields = detect_conflict(local_page, remote_page)

            if has_conflict and not force_remote:
                print(f"  CONFLICT: {page_id} ({remote_page.get('title', '')[:30]}) - fields: {conflicting_fields}")
                if not dry_run:
                    save_conflict(conn, page_id, local_page, remote_page, conflicting_fields)
                    log_sync(conn, page_id, 'pull', 'conflict', {'conflicting_fields': conflicting_fields})
                stats.conflicts += 1
                continue

            if force_remote:
                print(f"  Force overwrite: {page_id}")
                if not dry_run:
                    resolve_conflict(conn, page_id, 'remote')

        # Update local DB
        title = remote_page.get('title', '')
        parent_id = remote_page.get('parentId')
        space_id = remote_page.get('spaceId')
        version = remote_page.get('version', {}).get('number', 1)
        created_at = remote_page.get('createdAt')
        body = remote_page.get('body', {}).get('storage', {}).get('value', '')
        web_url = f"{CONFLUENCE_BASE}/wiki{remote_page.get('_links', {}).get('webui', '')}"
        labels = fetch_remote_labels(page_id)

        if dry_run:
            print(f"  [DRY-RUN] Would update: {page_id} - {title[:40]}")
        else:
            cur.execute("""
                INSERT INTO confluence_v2_content (
                    id, type, title, parent_id, space_id, labels, body_storage, version,
                    web_url, raw_data, created_at, last_synced_at, local_modified_at, local_modified_fields
                ) VALUES (%s, 'page', %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NULL, NULL)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    parent_id = EXCLUDED.parent_id,
                    labels = EXCLUDED.labels,
                    body_storage = EXCLUDED.body_storage,
                    version = EXCLUDED.version,
                    web_url = EXCLUDED.web_url,
                    raw_data = EXCLUDED.raw_data,
                    last_synced_at = NOW(),
                    local_modified_at = NULL,
                    local_modified_fields = NULL
            """, [page_id, title, parent_id, space_id, labels, body, version, web_url, Json(remote_page), created_at])

            log_sync(conn, page_id, 'pull', 'success', {'version': version})

        stats.pulled += 1
        time.sleep(0.2)  # Rate limiting

    if not dry_run:
        conn.commit()


# --- Push Phase ---
def push_changes(conn, stats: SyncStats, force_local: bool = False, dry_run: bool = False):
    """Push local changes to Confluence."""
    print("\n[PUSH] Pushing local changes to Confluence...")

    modified_pages = get_locally_modified_pages(conn)
    print(f"  Found {len(modified_pages)} locally modified pages")

    for page in modified_pages:
        page_id = page['id']
        modified_fields = page.get('local_modified_fields') or []

        if not modified_fields:
            stats.skipped += 1
            continue

        # Check for conflict first
        if not force_local:
            remote = fetch_remote_page(page_id)
            if remote:
                has_conflict, conflicting_fields = detect_conflict(page, remote)
                if has_conflict:
                    print(f"  CONFLICT: {page_id} ({page.get('title', '')[:30]}) - fields: {conflicting_fields}")
                    if not dry_run:
                        save_conflict(conn, page_id, dict(page), remote, conflicting_fields)
                        log_sync(conn, page_id, 'push', 'conflict', {'conflicting_fields': conflicting_fields})
                    stats.conflicts += 1
                    continue

        if dry_run:
            print(f"  [DRY-RUN] Would push: {page_id} - {modified_fields}")
            stats.pushed += 1
            continue

        # Push changes
        success = True
        pushed_fields = []

        # Update title and body if modified
        if 'title' in modified_fields or 'body_storage' in modified_fields:
            result = update_page_content(
                page_id,
                page['title'],
                page['body_storage'] or '',
                page['version']
            )
            if result and 'error' not in result:
                pushed_fields.extend([f for f in ['title', 'body_storage'] if f in modified_fields])
            else:
                print(f"  ERROR pushing content for {page_id}: {result}")
                success = False

        # Update labels if modified
        if 'labels' in modified_fields:
            remote_labels = fetch_remote_labels(page_id)
            if sync_labels_to_confluence(page_id, page['labels'] or [], remote_labels):
                pushed_fields.append('labels')
            else:
                success = False

        if success and pushed_fields:
            print(f"  Pushed: {page_id} - {pushed_fields}")

            # Clear local modification tracking
            cur = conn.cursor()
            cur.execute("""
                UPDATE confluence_v2_content
                SET local_modified_at = NULL,
                    local_modified_fields = NULL,
                    last_synced_at = NOW()
                WHERE id = %s
            """, [page_id])

            log_sync(conn, page_id, 'push', 'success', {'pushed_fields': pushed_fields})

            if not force_local:
                resolve_conflict(conn, page_id, 'local')

            stats.pushed += 1
        else:
            log_sync(conn, page_id, 'push', 'error', {'error': 'push failed'})
            stats.errors += 1

        time.sleep(0.5)  # Rate limiting

    if not dry_run:
        conn.commit()


# --- Conflict Resolution ---
def show_conflicts(conn):
    """Display unresolved conflicts."""
    conflicts = get_unresolved_conflicts(conn)

    if not conflicts:
        print("\nNo unresolved conflicts.")
        return

    print(f"\n{'='*60}")
    print(f"UNRESOLVED CONFLICTS: {len(conflicts)}")
    print(f"{'='*60}")

    for c in conflicts:
        print(f"\nPage: {c['page_id']}")
        print(f"Conflicting fields: {c['conflicting_fields']}")
        print(f"Detected: {c['detected_at']}")

        local = c['local_data'] or {}
        remote = c['remote_data'] or {}

        for field in (c['conflicting_fields'] or []):
            if field == 'title':
                local_val = local.get('title', '<not set>')
                remote_val = remote.get('title', '<not set>')
            elif field == 'body_storage':
                local_val = (local.get('body_storage', '') or '')[:50] + '...'
                remote_body = remote.get('body', {}).get('storage', {}).get('value', '') or ''
                remote_val = remote_body[:50] + '...'
            elif field == 'labels':
                local_val = local.get('labels', [])
                remote_val = '<fetch required>'
            else:
                local_val = '<unknown>'
                remote_val = '<unknown>'

            print(f"  {field}:")
            print(f"    Local:  {local_val}")
            print(f"    Remote: {remote_val}")


def resolve_all_conflicts(conn, resolution: str, dry_run: bool = False):
    """Resolve all conflicts with given resolution."""
    conflicts = get_unresolved_conflicts(conn)

    if not conflicts:
        print("No conflicts to resolve.")
        return

    print(f"\nResolving {len(conflicts)} conflicts with '{resolution}' preference...")

    for c in conflicts:
        page_id = c['page_id']

        if dry_run:
            print(f"  [DRY-RUN] Would resolve {page_id} -> {resolution}")
            continue

        if resolution == 'local':
            # Re-push local changes
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM confluence_v2_content WHERE id = %s", [page_id])
            page = cur.fetchone()

            if page:
                modified_fields = page.get('local_modified_fields') or []
                success = True

                if 'title' in modified_fields or 'body_storage' in modified_fields:
                    result = update_page_content(
                        page_id,
                        page['title'],
                        page['body_storage'] or '',
                        page['version']
                    )
                    if not result or 'error' in result:
                        success = False

                if 'labels' in modified_fields:
                    remote_labels = fetch_remote_labels(page_id)
                    sync_labels_to_confluence(page_id, page['labels'] or [], remote_labels)

                if success:
                    cur.execute("""
                        UPDATE confluence_v2_content
                        SET local_modified_at = NULL, local_modified_fields = NULL, last_synced_at = NOW()
                        WHERE id = %s
                    """, [page_id])
                    print(f"  Resolved {page_id} -> pushed local")

        elif resolution == 'remote':
            # Re-pull remote changes
            remote = fetch_remote_page(page_id)
            if remote:
                cur = conn.cursor()
                labels = fetch_remote_labels(page_id)
                body = remote.get('body', {}).get('storage', {}).get('value', '')
                version = remote.get('version', {}).get('number', 1)

                cur.execute("""
                    UPDATE confluence_v2_content
                    SET title = %s,
                        body_storage = %s,
                        labels = %s,
                        version = %s,
                        raw_data = %s,
                        last_synced_at = NOW(),
                        local_modified_at = NULL,
                        local_modified_fields = NULL
                    WHERE id = %s
                """, [
                    remote.get('title', ''),
                    body,
                    labels,
                    version,
                    Json(remote),
                    page_id
                ])
                print(f"  Resolved {page_id} -> pulled remote")

        resolve_conflict(conn, page_id, resolution)

    if not dry_run:
        conn.commit()


# --- Main ---
def main():
    parser = argparse.ArgumentParser(description='Bidirectional Confluence <-> DB Sync')
    parser.add_argument('--pull-only', action='store_true', help='Only pull from Confluence')
    parser.add_argument('--push-only', action='store_true', help='Only push to Confluence')
    parser.add_argument('--force-local', action='store_true', help='Force local changes on conflicts')
    parser.add_argument('--force-remote', action='store_true', help='Force remote changes on conflicts')
    parser.add_argument('--dry-run', action='store_true', help='Show what would happen without making changes')
    parser.add_argument('--show-conflicts', action='store_true', help='Show unresolved conflicts and exit')
    parser.add_argument('--init-db', action='store_true', help='Initialize database schema and exit')
    args = parser.parse_args()

    if not CONFLUENCE_BASE or not TOKEN:
        print("Error: JIRA_URL or JIRA_TOKEN missing in .env")
        sys.exit(1)

    if args.force_local and args.force_remote:
        print("Error: Cannot use both --force-local and --force-remote")
        sys.exit(1)

    conn = get_db_connection()

    try:
        if args.init_db:
            init_db()
            return

        # Ensure schema is ready
        init_db()

        stats = SyncStats()

        if args.show_conflicts:
            show_conflicts(conn)
            return

        print("=" * 60)
        print("CONFLUENCE BIDIRECTIONAL SYNC")
        print("=" * 60)
        print(f"Space ID: {SPACE_ID}")
        print(f"Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}")
        if args.force_local:
            print("Conflict resolution: FORCE LOCAL")
        elif args.force_remote:
            print("Conflict resolution: FORCE REMOTE")

        # Pull phase
        if not args.push_only:
            pull_changes(conn, stats, args.force_remote, args.dry_run)

        # Push phase
        if not args.pull_only:
            push_changes(conn, stats, args.force_local, args.dry_run)

        # Resolve conflicts if force flag is set
        if args.force_local:
            resolve_all_conflicts(conn, 'local', args.dry_run)
        elif args.force_remote:
            resolve_all_conflicts(conn, 'remote', args.dry_run)

        print("\n" + "=" * 60)
        print("SYNC COMPLETE")
        print("=" * 60)
        print(stats)

        # Show remaining conflicts if any
        conflicts = get_unresolved_conflicts(conn)
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
