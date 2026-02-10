#!/usr/bin/env python3
"""
Sync Jira sprints and sprint-issue mappings to local database.

Usage:
  python scripts/sync_sprints.py                    # Sync all sprints
  python scripts/sync_sprints.py --project EUV      # Sync sprints for specific project
  python scripts/sync_sprints.py --active-only       # Sync active sprints only
  python scripts/sync_sprints.py --force             # Full re-sync (ignore timestamps)
  python scripts/sync_sprints.py --list              # List sprints in DB
"""

import os
import sys
import time
import argparse
import requests
import psycopg2
from psycopg2.extras import Json
from typing import Optional, List, Dict


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
    """Make authenticated Jira API request."""
    url = f"{JIRA_URL}{endpoint}"
    auth = (JIRA_EMAIL, JIRA_TOKEN)

    retries = 0
    max_retries = 3

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
            retries += 1
            time.sleep(2)

    return None


def get_boards_from_db(conn, project_key: str = None) -> List[Dict]:
    """Fetch boards from local DB (synced by sync_boards.py)."""
    cur = conn.cursor()

    query = "SELECT id, name, project_key FROM jira_boards"
    params = []

    if project_key:
        query += " WHERE project_key = %s"
        params.append(project_key)

    query += " ORDER BY project_key, name"

    cur.execute(query, params)
    rows = cur.fetchall()

    return [{"id": r[0], "name": r[1], "project_key": r[2]} for r in rows]


def fetch_sprints_for_board(board_id: int, state_filter: str = None) -> List[Dict]:
    """Fetch all sprints for a board from Jira Agile API."""
    sprints = []
    start_at = 0
    max_results = 50

    while True:
        params = {
            "startAt": start_at,
            "maxResults": max_results
        }
        if state_filter:
            params["state"] = state_filter

        response = api_request('GET', f'/rest/agile/1.0/board/{board_id}/sprint', params=params)

        if not response:
            break

        if response.status_code == 404:
            # Board may not support sprints (e.g., Kanban boards)
            break

        if not response.ok:
            print(f"  Error fetching sprints for board {board_id}: {response.status_code}")
            break

        data = response.json()
        values = data.get('values', [])
        sprints.extend(values)

        if data.get('isLast', True) or len(values) == 0:
            break

        start_at += max_results
        time.sleep(0.3)

    return sprints


def fetch_sprint_issues(sprint_id: int) -> List[str]:
    """Fetch all issue keys for a sprint from Jira Agile API."""
    issue_keys = []
    start_at = 0
    max_results = 100

    while True:
        params = {
            "startAt": start_at,
            "maxResults": max_results,
            "fields": "key"
        }

        response = api_request('GET', f'/rest/agile/1.0/sprint/{sprint_id}/issue', params=params)

        if not response or not response.ok:
            print(f"  Error fetching issues for sprint {sprint_id}: {response.status_code if response else 'No response'}")
            break

        data = response.json()
        issues = data.get('issues', [])
        issue_keys.extend([issue['key'] for issue in issues])

        total = data.get('total', 0)
        if start_at + max_results >= total or len(issues) == 0:
            break

        start_at += max_results
        time.sleep(0.3)

    return issue_keys


def sync_sprints(conn, project_key: str = None, active_only: bool = False, force: bool = False):
    """Sync sprints and sprint-issue mappings from Jira to local DB."""
    print(f"\n{'='*60}")
    print("SYNCING JIRA SPRINTS")
    print(f"{'='*60}")

    # Get boards from DB
    boards = get_boards_from_db(conn, project_key)

    if not boards:
        print("No boards found in DB. Run sync_boards.py first.")
        return 0

    if project_key:
        print(f"Project: {project_key}")
    print(f"Boards: {len(boards)}")
    if active_only:
        print("Filter: active sprints only")

    state_filter = "active" if active_only else None

    cur = conn.cursor()
    total_sprints = 0
    total_mappings = 0

    for board in boards:
        board_id = board['id']
        board_name = board['name']
        proj = board['project_key']

        print(f"\n--- Board: {board_name} ({proj}, id={board_id}) ---")

        sprints = fetch_sprints_for_board(board_id, state_filter)

        if not sprints:
            print("  No sprints found (may be a Kanban board)")
            continue

        print(f"  Found {len(sprints)} sprints")

        for sprint in sprints:
            sprint_id = sprint['id']
            name = sprint.get('name', '')
            state = sprint.get('state', '')
            goal = sprint.get('goal', '')
            start_date = sprint.get('startDate')
            end_date = sprint.get('endDate')

            # Upsert sprint (preserve confluence_labels)
            cur.execute("""
                INSERT INTO jira_sprints (id, board_id, name, state, goal, start_date, end_date, raw_data, last_synced_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    board_id = EXCLUDED.board_id,
                    name = EXCLUDED.name,
                    state = EXCLUDED.state,
                    goal = EXCLUDED.goal,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date,
                    raw_data = EXCLUDED.raw_data,
                    last_synced_at = NOW()
            """, [sprint_id, board_id, name, state, goal, start_date, end_date, Json(sprint)])
            total_sprints += 1

            # Fetch and sync issue mappings for active/closed sprints
            if state in ('active', 'closed'):
                issue_keys = fetch_sprint_issues(sprint_id)

                if issue_keys:
                    # Clear existing mappings for this sprint and re-populate
                    cur.execute("DELETE FROM jira_issue_sprints WHERE sprint_id = %s", [sprint_id])

                    for key in issue_keys:
                        # Only insert if issue exists in our DB
                        cur.execute("""
                            INSERT INTO jira_issue_sprints (issue_key, sprint_id)
                            SELECT %s, %s
                            WHERE EXISTS (SELECT 1 FROM jira_issues WHERE key = %s)
                            ON CONFLICT DO NOTHING
                        """, [key, sprint_id, key])
                        total_mappings += 1

                    print(f"  Sprint {sprint_id} ({name}): {state}, {len(issue_keys)} issues")
                else:
                    print(f"  Sprint {sprint_id} ({name}): {state}, 0 issues")
            else:
                print(f"  Sprint {sprint_id} ({name}): {state}")

        conn.commit()
        time.sleep(0.5)

    print(f"\n{'='*60}")
    print(f"SYNC COMPLETE: {total_sprints} sprints, {total_mappings} issue mappings")
    print(f"{'='*60}")

    return total_sprints


def list_sprints(conn, project_key: str = None):
    """List all sprints in DB."""
    cur = conn.cursor()

    query = """
        SELECT s.id, s.board_id, b.project_key, s.name, s.state,
               s.start_date, s.end_date, s.last_synced_at,
               (SELECT COUNT(*) FROM jira_issue_sprints WHERE sprint_id = s.id) as issue_count
        FROM jira_sprints s
        LEFT JOIN jira_boards b ON s.board_id = b.id
    """
    params = []

    if project_key:
        query += " WHERE b.project_key = %s"
        params.append(project_key)

    query += " ORDER BY b.project_key, s.state DESC, s.start_date DESC"

    cur.execute(query, params)
    sprints = cur.fetchall()

    print(f"\n{'='*60}")
    print(f"SPRINTS IN DATABASE: {len(sprints)}")
    print(f"{'='*60}")
    print(f"{'ID':>6} | {'Project':>7} | {'State':>7} | {'Issues':>6} | {'Name'}")
    print(f"{'-'*6}-+-{'-'*7}-+-{'-'*7}-+-{'-'*6}-+-{'-'*30}")

    for s in sprints:
        sprint_id, board_id, proj, name, state, start, end, synced, issues = s
        print(f"{sprint_id:>6} | {proj or '':>7} | {state or '':>7} | {issues:>6} | {name}")


def main():
    parser = argparse.ArgumentParser(description='Sync Jira Sprints')
    parser.add_argument('--project', type=str, help='Sync sprints for specific project')
    parser.add_argument('--active-only', action='store_true', help='Sync active sprints only')
    parser.add_argument('--force', action='store_true', help='Full re-sync')
    parser.add_argument('--list', action='store_true', help='List sprints in DB without syncing')
    args = parser.parse_args()

    if not JIRA_URL or not JIRA_TOKEN:
        print("Error: JIRA_URL or JIRA_TOKEN missing in .env")
        sys.exit(1)

    conn = get_db_connection()

    try:
        if args.list:
            list_sprints(conn, args.project)
        else:
            sync_sprints(conn, args.project, args.active_only, args.force)
            list_sprints(conn, args.project)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
