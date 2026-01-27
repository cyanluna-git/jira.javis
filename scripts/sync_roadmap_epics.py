#!/usr/bin/env python3
"""
Roadmap Epic Sync Script
Syncs Epic progress from Jira to roadmap milestones.

Usage:
    python scripts/sync_roadmap_epics.py [--dry-run] [--milestone-id UUID]
"""

import os
import sys
import argparse
import json
from datetime import datetime
from typing import Optional
import requests
from requests.auth import HTTPBasicAuth
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment from .env file
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'javis-viewer', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key, value)

load_env()

# Configuration
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5439)),
    'user': os.getenv('POSTGRES_USER', 'javis'),
    'password': os.getenv('POSTGRES_PASSWORD', 'javis_password'),
    'database': os.getenv('POSTGRES_DB', 'javis_brain'),
}

JIRA_CONFIG = {
    'url': os.getenv('JIRA_URL', ''),
    'email': os.getenv('JIRA_EMAIL', ''),
    'token': os.getenv('JIRA_TOKEN', ''),
}

# Status categories for progress calculation
DONE_STATUSES = {'Done', 'Closed', 'Resolved', 'Complete', 'Completed'}
IN_PROGRESS_STATUSES = {'In Progress', 'In Review', 'Testing', 'In Development'}
TODO_STATUSES = {'To Do', 'Backlog', 'Open', 'New', 'Deferred'}


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


def get_jira_auth():
    """Get Jira authentication."""
    return HTTPBasicAuth(JIRA_CONFIG['email'], JIRA_CONFIG['token'])


def fetch_epic_children(epic_key: str) -> list[dict]:
    """Fetch all child issues of an Epic from Jira API."""
    if not all(JIRA_CONFIG.values()):
        print(f"  ⚠️  Jira credentials not configured, skipping API call")
        return []

    url = f"{JIRA_CONFIG['url']}/rest/api/3/search"

    # JQL to find issues under this Epic (Next-gen project style)
    jql = f'parent = {epic_key}'

    params = {
        'jql': jql,
        'fields': 'key,summary,status,issuetype,assignee,created,updated',
        'maxResults': 100,
    }

    try:
        response = requests.get(url, auth=get_jira_auth(), params=params)
        response.raise_for_status()
        data = response.json()
        return data.get('issues', [])
    except requests.RequestException as e:
        print(f"  ⚠️  Error fetching Epic children: {e}")
        return []


def calculate_progress(issues: list[dict]) -> dict:
    """Calculate progress metrics from issues."""
    if not issues:
        return {
            'total': 0,
            'done': 0,
            'in_progress': 0,
            'todo': 0,
            'progress_percent': 0,
            'issues': [],
        }

    total = len(issues)
    done = 0
    in_progress = 0
    todo = 0

    issue_summary = []

    for issue in issues:
        key = issue.get('key', '')
        fields = issue.get('fields', {})
        status_name = fields.get('status', {}).get('name', 'Unknown')
        summary = fields.get('summary', '')

        issue_summary.append({
            'key': key,
            'summary': summary,
            'status': status_name,
        })

        if status_name in DONE_STATUSES:
            done += 1
        elif status_name in IN_PROGRESS_STATUSES:
            in_progress += 1
        else:
            todo += 1

    # Calculate progress: done issues contribute 100%, in_progress contribute 50%
    progress_percent = ((done * 100) + (in_progress * 50)) / total if total > 0 else 0

    return {
        'total': total,
        'done': done,
        'in_progress': in_progress,
        'todo': todo,
        'progress_percent': round(progress_percent, 2),
        'issues': issue_summary,
    }


def get_linked_epics(conn, milestone_id: Optional[str] = None) -> list[dict]:
    """Get all epic links from roadmap, optionally filtered by milestone."""
    with conn.cursor() as cur:
        if milestone_id:
            cur.execute("""
                SELECT
                    el.id, el.milestone_id, el.stream_id, el.epic_key,
                    m.title as milestone_title,
                    s.name as stream_name, s.category as stream_category
                FROM roadmap_epic_links el
                JOIN roadmap_milestones m ON m.id = el.milestone_id
                LEFT JOIN roadmap_streams s ON s.id = el.stream_id
                WHERE el.milestone_id = %s
                ORDER BY el.milestone_id, el.stream_id
            """, (milestone_id,))
        else:
            cur.execute("""
                SELECT
                    el.id, el.milestone_id, el.stream_id, el.epic_key,
                    m.title as milestone_title,
                    s.name as stream_name, s.category as stream_category
                FROM roadmap_epic_links el
                JOIN roadmap_milestones m ON m.id = el.milestone_id
                LEFT JOIN roadmap_streams s ON s.id = el.stream_id
                ORDER BY el.milestone_id, el.stream_id
            """)
        return cur.fetchall()


def update_epic_link_sync(conn, link_id: str, dry_run: bool = False):
    """Update last_synced_at for an epic link."""
    if dry_run:
        return

    with conn.cursor() as cur:
        cur.execute("""
            UPDATE roadmap_epic_links
            SET last_synced_at = NOW()
            WHERE id = %s
        """, (link_id,))


def update_stream_progress(conn, stream_id: str, progress: float, dry_run: bool = False):
    """Update stream progress."""
    if dry_run:
        print(f"    [DRY-RUN] Would update stream {stream_id} to {progress}%")
        return

    with conn.cursor() as cur:
        cur.execute("""
            UPDATE roadmap_streams
            SET progress_percent = %s
            WHERE id = %s
        """, (progress, stream_id))


def update_milestone_progress(conn, milestone_id: str, dry_run: bool = False):
    """Recalculate and update milestone progress based on its streams and epics."""
    with conn.cursor() as cur:
        # Get average progress from streams
        cur.execute("""
            SELECT COALESCE(AVG(progress_percent), 0) as avg_progress
            FROM roadmap_streams
            WHERE milestone_id = %s
        """, (milestone_id,))
        stream_result = cur.fetchone()
        stream_progress = float(stream_result['avg_progress']) if stream_result else 0

        # If no streams, calculate directly from epic links
        if stream_progress == 0:
            cur.execute("""
                SELECT COUNT(*) as total FROM roadmap_epic_links WHERE milestone_id = %s
            """, (milestone_id,))
            # For milestones without streams, we'll use the calculated progress directly

        if dry_run:
            print(f"    [DRY-RUN] Would update milestone {milestone_id} to {stream_progress:.2f}%")
            return stream_progress

        cur.execute("""
            UPDATE roadmap_milestones
            SET progress_percent = %s
            WHERE id = %s
        """, (stream_progress, milestone_id))

        return stream_progress


def sync_epic(epic_key: str, link: dict, conn, dry_run: bool = False) -> dict:
    """Sync a single Epic and return progress info."""
    print(f"\n  📦 Epic: {epic_key}")
    print(f"     Milestone: {link['milestone_title']}")
    if link.get('stream_name'):
        print(f"     Stream: {link['stream_name']} ({link['stream_category']})")

    # Fetch children from Jira
    children = fetch_epic_children(epic_key)

    # Calculate progress
    progress = calculate_progress(children)

    print(f"     Issues: {progress['total']} total ({progress['done']} done, {progress['in_progress']} in progress, {progress['todo']} todo)")
    print(f"     Progress: {progress['progress_percent']}%")

    # Update stream if linked to one
    if link.get('stream_id'):
        update_stream_progress(conn, link['stream_id'], progress['progress_percent'], dry_run)

    # Update sync timestamp
    update_epic_link_sync(conn, link['id'], dry_run)

    return progress


def main():
    parser = argparse.ArgumentParser(description='Sync Epic progress to roadmap')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    parser.add_argument('--milestone-id', type=str, help='Sync only specific milestone')
    args = parser.parse_args()

    print("=" * 60)
    print("🗺️  Roadmap Epic Sync")
    print("=" * 60)

    if args.dry_run:
        print("🔍 DRY-RUN MODE - No changes will be made\n")

    conn = get_db_connection()

    try:
        # Get linked epics
        epic_links = get_linked_epics(conn, args.milestone_id)

        if not epic_links:
            print("\n⚠️  No Epic links found in roadmap")
            print("   Add epics to milestones first via the UI or API")
            return

        print(f"\n📋 Found {len(epic_links)} Epic link(s)")

        # Group by milestone for progress calculation
        milestones_to_update = set()

        for link in epic_links:
            progress = sync_epic(link['epic_key'], link, conn, args.dry_run)
            milestones_to_update.add(link['milestone_id'])

        # Update milestone progress
        print("\n" + "-" * 40)
        print("📊 Updating milestone progress...")

        for milestone_id in milestones_to_update:
            new_progress = update_milestone_progress(conn, milestone_id, args.dry_run)
            print(f"   Milestone {milestone_id[:8]}... → {new_progress:.2f}%")

        if not args.dry_run:
            conn.commit()
            print("\n✅ Sync completed successfully!")
        else:
            print("\n✅ Dry-run completed. No changes made.")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
