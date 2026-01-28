#!/usr/bin/env python3
"""
Jira Agile API Sync Script - Boards, Sprints, Issue-Sprint Mappings

Syncs:
  1. Boards -> jira_boards
  2. Sprints -> jira_sprints
  3. Issue-Sprint mappings -> jira_issue_sprints

Usage:
  python scripts/mirror_jira_sprints.py
"""

import os
import time
import requests
import psycopg2
from psycopg2.extras import Json


# --- Configuration ---
def load_env(env_path=".env"):
    """Load environment variables from .env file"""
    config = {}

    # Try multiple possible locations
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    possible_paths = [
        env_path,
        os.path.join(project_root, ".env"),
        os.path.join(project_root, "src", "javis-viewer", ".env"),
    ]

    for path in possible_paths:
        if os.path.exists(path):
            env_path = path
            break

    try:
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
        print(f"Loaded config from: {env_path}")
    except FileNotFoundError:
        print(f"Warning: .env file not found at {env_path}")
    return config


config = load_env()

# Jira Config
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

# DB Config
DB_HOST = "localhost"
DB_PORT = "5439"
DB_NAME = "javis_brain"
DB_USER = "javis"
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

# Projects to sync (same as mirror_jira.py)
TARGET_PROJECTS = ["ASP", "PSSM"]

if not JIRA_URL or not JIRA_TOKEN:
    print("Error: JIRA_URL or JIRA_TOKEN missing in .env")
    print("Required: JIRA_URL, JIRA_EMAIL, JIRA_TOKEN")
    exit(1)


# --- Database Connection ---
def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )


# --- Jira Agile API Client ---
def api_request(endpoint, params=None):
    """Make a GET request to Jira Agile API with retry logic"""
    url = f"{JIRA_URL}{endpoint}"
    auth = (JIRA_EMAIL, JIRA_TOKEN)

    retries = 0
    max_retries = 5

    while retries < max_retries:
        try:
            res = requests.get(url, auth=auth, params=params, timeout=30)

            if res.status_code == 429:
                wait_time = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                print(f"  Rate limit (429). Waiting {wait_time}s...")
                time.sleep(wait_time)
                retries += 1
                continue

            if res.status_code == 404:
                return None

            res.raise_for_status()
            return res.json()

        except requests.exceptions.RequestException as e:
            print(f"  API Error: {e}")
            if hasattr(e, 'response') and e.response is not None and e.response.status_code >= 500:
                time.sleep(5)
                retries += 1
                continue
            return None

    return None


def fetch_boards(project_key=None):
    """Fetch all boards, optionally filtered by project"""
    boards = []
    start_at = 0
    max_results = 50

    while True:
        params = {
            "startAt": start_at,
            "maxResults": max_results
        }
        if project_key:
            params["projectKeyOrId"] = project_key

        data = api_request("/rest/agile/1.0/board", params)
        if not data or "values" not in data:
            break

        boards.extend(data["values"])

        if data.get("isLast", True):
            break

        start_at += max_results
        time.sleep(0.5)

    return boards


def fetch_sprints(board_id):
    """Fetch all sprints for a board"""
    sprints = []
    start_at = 0
    max_results = 50

    while True:
        params = {
            "startAt": start_at,
            "maxResults": max_results
        }

        data = api_request(f"/rest/agile/1.0/board/{board_id}/sprint", params)
        if not data or "values" not in data:
            break

        sprints.extend(data["values"])

        if data.get("isLast", True):
            break

        start_at += max_results
        time.sleep(0.5)

    return sprints


def fetch_sprint_issues(sprint_id):
    """Fetch all issue keys for a sprint"""
    issues = []
    start_at = 0
    max_results = 100

    while True:
        params = {
            "startAt": start_at,
            "maxResults": max_results,
            "fields": "key"  # Only need the key
        }

        data = api_request(f"/rest/agile/1.0/sprint/{sprint_id}/issue", params)
        if not data or "issues" not in data:
            break

        for issue in data["issues"]:
            issues.append(issue["key"])

        if start_at + max_results >= data.get("total", 0):
            break

        start_at += max_results
        time.sleep(0.5)

    return issues


# --- Database Operations ---
def save_board(conn, board):
    """Upsert a board"""
    cur = conn.cursor()

    board_id = board.get("id")
    name = board.get("name", "")
    board_type = board.get("type", "")

    # Try to get project key from location
    project_key = None
    location = board.get("location", {})
    if location:
        project_key = location.get("projectKey")

    cur.execute("""
        INSERT INTO jira_boards (id, name, type, project_key, raw_data, last_synced_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            project_key = EXCLUDED.project_key,
            raw_data = EXCLUDED.raw_data,
            last_synced_at = NOW()
    """, (board_id, name, board_type, project_key, Json(board)))

    cur.close()


def save_sprint(conn, sprint, board_id):
    """Upsert a sprint"""
    cur = conn.cursor()

    sprint_id = sprint.get("id")
    name = sprint.get("name", "")
    state = sprint.get("state", "")
    goal = sprint.get("goal")
    start_date = sprint.get("startDate")
    end_date = sprint.get("endDate")

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
    """, (sprint_id, board_id, name, state, goal, start_date, end_date, Json(sprint)))

    cur.close()


def save_issue_sprint_mappings(conn, sprint_id, issue_keys):
    """
    Save issue-sprint mappings (replace existing).
    Uses transaction to safely delete old and insert new mappings.
    Only maps issues that exist in jira_issues (FK constraint).
    """
    cur = conn.cursor()

    if not issue_keys:
        # Delete any existing mappings for empty sprint
        cur.execute("DELETE FROM jira_issue_sprints WHERE sprint_id = %s", (sprint_id,))
        cur.close()
        return 0, 0

    # First, get existing issue keys from jira_issues table (FK requirement)
    cur.execute("SELECT key FROM jira_issues WHERE key = ANY(%s)", (issue_keys,))
    existing_issues = {row[0] for row in cur.fetchall()}

    valid_keys = [k for k in issue_keys if k in existing_issues]
    skipped = len(issue_keys) - len(valid_keys)

    try:
        # Transaction: Delete old mappings -> Insert new ones
        cur.execute("DELETE FROM jira_issue_sprints WHERE sprint_id = %s", (sprint_id,))

        if valid_keys:
            # Use executemany for better performance
            args_list = [(k, sprint_id) for k in valid_keys]
            cur.executemany("""
                INSERT INTO jira_issue_sprints (issue_key, sprint_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, args_list)

    except Exception as e:
        print(f"  Error updating mappings for sprint {sprint_id}: {e}")
        conn.rollback()
        cur.close()
        raise e

    cur.close()
    return len(valid_keys), skipped


# --- Main Sync Functions ---
def sync_boards():
    """Sync boards for target projects"""
    print("\n[1/3] Syncing Boards...")
    conn = get_db_connection()

    all_boards = []
    for project in TARGET_PROJECTS:
        print(f"  Fetching boards for project: {project}")
        boards = fetch_boards(project)
        all_boards.extend(boards)
        print(f"    Found {len(boards)} boards")

    # Remove duplicates (a board might appear in multiple projects)
    seen_ids = set()
    unique_boards = []
    for board in all_boards:
        if board["id"] not in seen_ids:
            seen_ids.add(board["id"])
            unique_boards.append(board)

    for board in unique_boards:
        save_board(conn, board)

    conn.commit()
    conn.close()

    print(f"  Saved {len(unique_boards)} unique boards")
    return unique_boards


def sync_sprints(boards):
    """Sync sprints for all boards"""
    print("\n[2/3] Syncing Sprints...")
    conn = get_db_connection()

    total_sprints = 0
    for board in boards:
        board_id = board["id"]
        board_name = board.get("name", "Unknown")

        sprints = fetch_sprints(board_id)
        print(f"  Board '{board_name}' (ID: {board_id}): {len(sprints)} sprints")

        for sprint in sprints:
            save_sprint(conn, sprint, board_id)
            total_sprints += 1

        conn.commit()
        time.sleep(0.5)

    conn.close()
    print(f"  Total sprints saved: {total_sprints}")

    # Return all sprints for next step
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM jira_sprints")
    sprints = cur.fetchall()
    cur.close()
    conn.close()

    return sprints


def sync_issue_mappings(sprints):
    """Sync issue-sprint mappings"""
    print("\n[3/3] Syncing Issue-Sprint Mappings...")
    conn = get_db_connection()

    total_mapped = 0
    total_skipped = 0

    for sprint_id, sprint_name in sprints:
        issue_keys = fetch_sprint_issues(sprint_id)
        mapped, skipped = save_issue_sprint_mappings(conn, sprint_id, issue_keys)

        if issue_keys:
            print(f"  Sprint '{sprint_name}': {mapped} mapped, {skipped} skipped (not in jira_issues)")

        total_mapped += mapped
        total_skipped += skipped
        conn.commit()
        time.sleep(0.3)

    conn.close()
    print(f"  Total mappings: {total_mapped} (skipped {total_skipped} issues not in local DB)")


def main():
    print("=" * 60)
    print("Jira Sprint Sync - Boards, Sprints, Issue Mappings")
    print("=" * 60)
    print(f"Target Projects: {', '.join(TARGET_PROJECTS)}")
    print(f"Jira URL: {JIRA_URL}")

    try:
        # Test DB connection
        conn = get_db_connection()
        conn.close()
        print("Database connection OK")
    except Exception as e:
        print(f"Database connection failed: {e}")
        exit(1)

    # Sync in order
    boards = sync_boards()

    if not boards:
        print("\nNo boards found. Exiting.")
        return

    sprints = sync_sprints(boards)

    if not sprints:
        print("\nNo sprints found. Exiting.")
        return

    sync_issue_mappings(sprints)

    print("\n" + "=" * 60)
    print("Sync completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
