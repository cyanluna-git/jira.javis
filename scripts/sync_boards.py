#!/usr/bin/env python3
"""
Sync Jira boards to local database.

Usage:
  python scripts/sync_boards.py              # Sync all boards
  python scripts/sync_boards.py --project EUV  # Sync boards for specific project
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

TARGET_PROJECTS = ["EUV", "ASP", "PSSM"]


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


def fetch_all_boards(project_key: str = None) -> List[Dict]:
    """Fetch all boards from Jira Agile API."""
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

        response = api_request('GET', '/rest/agile/1.0/board', params=params)

        if not response or not response.ok:
            print(f"  Error fetching boards: {response.status_code if response else 'No response'}")
            break

        data = response.json()
        values = data.get('values', [])
        boards.extend(values)

        if data.get('isLast', True) or len(values) == 0:
            break

        start_at += max_results
        time.sleep(0.3)

    return boards


def sync_boards(conn, project_key: str = None):
    """Sync boards from Jira to local DB."""
    print(f"\n{'='*60}")
    print("SYNCING JIRA BOARDS")
    print(f"{'='*60}")

    if project_key:
        print(f"Project: {project_key}")
    else:
        print(f"Projects: {', '.join(TARGET_PROJECTS)}")

    # Fetch boards from Jira
    if project_key:
        boards = fetch_all_boards(project_key)
    else:
        # Fetch boards for all target projects
        boards = []
        for proj in TARGET_PROJECTS:
            print(f"\nFetching boards for {proj}...")
            proj_boards = fetch_all_boards(proj)
            boards.extend(proj_boards)
            print(f"  Found {len(proj_boards)} boards")

    # Deduplicate by board ID
    seen_ids = set()
    unique_boards = []
    for board in boards:
        if board['id'] not in seen_ids:
            seen_ids.add(board['id'])
            unique_boards.append(board)

    boards = unique_boards
    print(f"\nTotal unique boards: {len(boards)}")

    # Upsert boards to DB
    cur = conn.cursor()
    synced = 0

    for board in boards:
        board_id = board['id']
        name = board['name']
        board_type = board.get('type', 'unknown')

        # Extract project key from location
        location = board.get('location', {})
        proj_key = location.get('projectKey', '')

        print(f"  {board_id}: {name} ({board_type}) - {proj_key}")

        cur.execute("""
            INSERT INTO jira_boards (id, name, type, project_key, raw_data, last_synced_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                project_key = EXCLUDED.project_key,
                raw_data = EXCLUDED.raw_data,
                last_synced_at = NOW()
        """, [board_id, name, board_type, proj_key, Json(board)])
        synced += 1

    conn.commit()

    print(f"\n{'='*60}")
    print(f"SYNC COMPLETE: {synced} boards synced")
    print(f"{'='*60}")

    return synced


def list_boards(conn, project_key: str = None):
    """List all boards in DB."""
    cur = conn.cursor()

    query = "SELECT id, name, type, project_key, last_synced_at FROM jira_boards"
    params = []

    if project_key:
        query += " WHERE project_key = %s"
        params.append(project_key)

    query += " ORDER BY project_key, name"

    cur.execute(query, params)
    boards = cur.fetchall()

    print(f"\n{'='*60}")
    print(f"BOARDS IN DATABASE: {len(boards)}")
    print(f"{'='*60}")

    for board in boards:
        print(f"  {board[0]:4d} | {board[3]:5s} | {board[2]:6s} | {board[1]}")


def main():
    parser = argparse.ArgumentParser(description='Sync Jira Boards')
    parser.add_argument('--project', type=str, help='Sync boards for specific project')
    parser.add_argument('--list', action='store_true', help='List boards in DB without syncing')
    args = parser.parse_args()

    if not JIRA_URL or not JIRA_TOKEN:
        print("Error: JIRA_URL or JIRA_TOKEN missing in .env")
        sys.exit(1)

    conn = get_db_connection()

    try:
        if args.list:
            list_boards(conn, args.project)
        else:
            sync_boards(conn, args.project)
            list_boards(conn, args.project)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
