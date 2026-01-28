#!/usr/bin/env python3
"""
Bitbucket Sync Script

Syncs repositories, commits, and pull requests from Bitbucket to PostgreSQL.
Extracts Jira issue keys from commit messages and PR titles.

Usage:
  python scripts/sync_bitbucket.py                    # Full sync
  python scripts/sync_bitbucket.py --repos-only       # Only sync repositories
  python scripts/sync_bitbucket.py --commits-only     # Only sync commits
  python scripts/sync_bitbucket.py --prs-only         # Only sync PRs
  python scripts/sync_bitbucket.py --days 7           # Last 7 days of commits
  python scripts/sync_bitbucket.py --dry-run          # Show what would happen
"""

import os
import sys
import re
import json
import time
import argparse
import requests
import psycopg2
from psycopg2.extras import Json
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any


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
        print("Warning: .env file not found")
    return config


config = load_env()

# Bitbucket config
BITBUCKET_WORKSPACE = config.get("BITBUCKET_WORKSPACE")
BITBUCKET_REPOS = [r.strip() for r in config.get("BITBUCKET_REPOS", "").split(",") if r.strip()]
BITBUCKET_USERNAME = config.get("BITBUCKET_USERNAME")
BITBUCKET_APP_PASSWORD = config.get("BITBUCKET_APP_PASSWORD")

# DB config
DB_HOST = config.get("DB_HOST", "localhost")
DB_PORT = config.get("DB_PORT", "5432")
DB_NAME = config.get("DB_NAME", "javis_brain")
DB_USER = config.get("DB_USER", "javis")
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

# Jira key pattern
JIRA_KEY_PATTERN = re.compile(r'([A-Z][A-Z0-9]+-\d+)')


def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )


def bitbucket_request(method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
    """Make authenticated Bitbucket API request."""
    url = f"https://api.bitbucket.org/2.0{endpoint}"
    auth = (BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD) if BITBUCKET_USERNAME else None

    try:
        response = requests.request(method, url, auth=auth, timeout=30, **kwargs)
        return response
    except requests.exceptions.RequestException as e:
        print(f"  Bitbucket API Error: {e}")
        return None


def extract_jira_keys(text: str) -> List[str]:
    """Extract Jira issue keys from text."""
    if not text:
        return []
    matches = JIRA_KEY_PATTERN.findall(text)
    return list(set(matches))


# --- Sync Functions ---

def sync_repositories(conn, workspace: str, repos: List[str], dry_run: bool = False):
    """Sync repository information."""
    print(f"\n[REPOS] Syncing repositories for workspace: {workspace}")

    cur = conn.cursor()
    synced = 0

    for repo_slug in repos:
        print(f"  Fetching {repo_slug}...")

        response = bitbucket_request('GET', f'/repositories/{workspace}/{repo_slug}')

        if not response or not response.ok:
            print(f"    Error: {response.text if response else 'No response'}")
            continue

        repo = response.json()

        uuid = repo.get('uuid', '').strip('{}')
        name = repo.get('name', repo_slug)
        web_url = repo.get('links', {}).get('html', {}).get('href', '')

        if dry_run:
            print(f"    [DRY-RUN] Would sync: {name} ({uuid})")
            synced += 1
            continue

        cur.execute("""
            INSERT INTO bitbucket_repositories (uuid, workspace, slug, name, web_url, raw_data, last_synced_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (uuid) DO UPDATE SET
                name = EXCLUDED.name,
                web_url = EXCLUDED.web_url,
                raw_data = EXCLUDED.raw_data,
                last_synced_at = NOW()
        """, [uuid, workspace, repo_slug, name, web_url, Json(repo)])

        print(f"    Synced: {name}")
        synced += 1

    if not dry_run:
        conn.commit()

    print(f"  Total: {synced} repositories synced")
    return synced


def sync_commits(conn, workspace: str, repos: List[str], days: int = 30, dry_run: bool = False):
    """Sync recent commits from repositories."""
    print(f"\n[COMMITS] Syncing commits (last {days} days)")

    cur = conn.cursor()
    since_date = datetime.utcnow() - timedelta(days=days)
    total_synced = 0

    for repo_slug in repos:
        print(f"  Processing {repo_slug}...")

        # Get repo UUID from DB
        cur.execute("SELECT uuid FROM bitbucket_repositories WHERE slug = %s AND workspace = %s",
                    [repo_slug, workspace])
        result = cur.fetchone()

        if not result:
            print(f"    Repository not found in DB. Run with repos sync first.")
            continue

        repo_uuid = result[0]
        page_url = f'/repositories/{workspace}/{repo_slug}/commits'
        synced = 0

        while page_url:
            response = bitbucket_request('GET', page_url)

            if not response or not response.ok:
                print(f"    Error fetching commits: {response.text if response else 'No response'}")
                break

            data = response.json()
            commits = data.get('values', [])

            for commit in commits:
                commit_hash = commit.get('hash')
                if not commit_hash:
                    continue

                # Parse commit date
                date_str = commit.get('date', '')
                try:
                    committed_at = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                except:
                    committed_at = None

                # Stop if commit is older than since_date
                if committed_at and committed_at.replace(tzinfo=None) < since_date:
                    page_url = None  # Stop pagination
                    break

                author = commit.get('author', {})
                author_name = author.get('user', {}).get('display_name') or author.get('raw', '')
                author_email = ''

                # Extract email from raw author string
                raw_author = author.get('raw', '')
                email_match = re.search(r'<(.+?)>', raw_author)
                if email_match:
                    author_email = email_match.group(1)

                message = commit.get('message', '')
                jira_keys = extract_jira_keys(message)

                if dry_run:
                    if jira_keys:
                        print(f"    [DRY-RUN] {commit_hash[:8]}: {jira_keys}")
                    synced += 1
                    continue

                cur.execute("""
                    INSERT INTO bitbucket_commits
                    (hash, repo_uuid, author_email, author_name, message, committed_at, jira_keys, raw_data, synced_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (hash) DO UPDATE SET
                        jira_keys = EXCLUDED.jira_keys,
                        raw_data = EXCLUDED.raw_data,
                        synced_at = NOW()
                """, [
                    commit_hash, repo_uuid, author_email, author_name,
                    message, committed_at, jira_keys, Json(commit)
                ])

                synced += 1

            # Next page
            if page_url:
                page_url = data.get('next')
                if page_url:
                    # Extract relative path from full URL
                    page_url = page_url.replace('https://api.bitbucket.org/2.0', '')
                time.sleep(0.2)

        if not dry_run:
            conn.commit()

        print(f"    Synced: {synced} commits")
        total_synced += synced

    print(f"  Total: {total_synced} commits synced")
    return total_synced


def sync_pullrequests(conn, workspace: str, repos: List[str], dry_run: bool = False):
    """Sync open and recently merged pull requests."""
    print(f"\n[PRs] Syncing pull requests")

    cur = conn.cursor()
    total_synced = 0

    for repo_slug in repos:
        print(f"  Processing {repo_slug}...")

        # Get repo UUID
        cur.execute("SELECT uuid FROM bitbucket_repositories WHERE slug = %s AND workspace = %s",
                    [repo_slug, workspace])
        result = cur.fetchone()

        if not result:
            print(f"    Repository not found in DB")
            continue

        repo_uuid = result[0]

        # Fetch OPEN and MERGED PRs
        for state in ['OPEN', 'MERGED']:
            page_url = f'/repositories/{workspace}/{repo_slug}/pullrequests?state={state}'
            synced = 0
            max_pages = 5 if state == 'MERGED' else 10  # Limit merged PRs
            pages = 0

            while page_url and pages < max_pages:
                response = bitbucket_request('GET', page_url)

                if not response or not response.ok:
                    break

                data = response.json()
                prs = data.get('values', [])

                for pr in prs:
                    pr_id = str(pr.get('id'))
                    pr_number = pr.get('id')
                    title = pr.get('title', '')
                    pr_state = pr.get('state', state)

                    source = pr.get('source', {}).get('branch', {})
                    source_branch = source.get('name', '')

                    dest = pr.get('destination', {}).get('branch', {})
                    destination_branch = dest.get('name', '')

                    author_name = pr.get('author', {}).get('display_name', '')

                    created_at = pr.get('created_on')
                    updated_at = pr.get('updated_on')
                    merged_at = None

                    if pr_state == 'MERGED':
                        # Merged date is in updated_on for merged PRs
                        merged_at = updated_at

                    # Extract Jira keys from title and branch name
                    jira_keys = extract_jira_keys(title + ' ' + source_branch)

                    composite_id = f"{repo_uuid}:{pr_id}"

                    if dry_run:
                        print(f"    [DRY-RUN] PR #{pr_number}: {title[:40]}... [{pr_state}]")
                        synced += 1
                        continue

                    cur.execute("""
                        INSERT INTO bitbucket_pullrequests
                        (id, repo_uuid, pr_number, title, state, source_branch, destination_branch,
                         author_name, jira_keys, created_at, updated_at, merged_at, raw_data, synced_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            state = EXCLUDED.state,
                            title = EXCLUDED.title,
                            jira_keys = EXCLUDED.jira_keys,
                            updated_at = EXCLUDED.updated_at,
                            merged_at = EXCLUDED.merged_at,
                            raw_data = EXCLUDED.raw_data,
                            synced_at = NOW()
                    """, [
                        composite_id, repo_uuid, pr_number, title, pr_state,
                        source_branch, destination_branch, author_name, jira_keys,
                        created_at, updated_at, merged_at, Json(pr)
                    ])

                    synced += 1

                page_url = data.get('next')
                if page_url:
                    page_url = page_url.replace('https://api.bitbucket.org/2.0', '')
                pages += 1
                time.sleep(0.2)

            if not dry_run:
                conn.commit()

            if synced > 0:
                print(f"    {state}: {synced} PRs synced")
            total_synced += synced

    print(f"  Total: {total_synced} PRs synced")
    return total_synced


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description='Sync Bitbucket data to PostgreSQL')
    parser.add_argument('--repos-only', action='store_true', help='Only sync repositories')
    parser.add_argument('--commits-only', action='store_true', help='Only sync commits')
    parser.add_argument('--prs-only', action='store_true', help='Only sync pull requests')
    parser.add_argument('--days', type=int, default=30, help='Days of commit history (default: 30)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would happen')
    args = parser.parse_args()

    if not BITBUCKET_WORKSPACE:
        print("Error: BITBUCKET_WORKSPACE not set in .env")
        print("\nRequired environment variables:")
        print("  BITBUCKET_WORKSPACE=<your-workspace>")
        print("  BITBUCKET_REPOS=repo1,repo2,repo3")
        print("  BITBUCKET_USERNAME=<your-username>")
        print("  BITBUCKET_APP_PASSWORD=<app-password>")
        sys.exit(1)

    if not BITBUCKET_REPOS:
        print("Error: BITBUCKET_REPOS not set in .env")
        sys.exit(1)

    conn = get_db_connection()

    try:
        print("=" * 60)
        print("BITBUCKET SYNC")
        print("=" * 60)
        print(f"Workspace: {BITBUCKET_WORKSPACE}")
        print(f"Repositories: {', '.join(BITBUCKET_REPOS)}")
        print(f"Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}")

        sync_all = not (args.repos_only or args.commits_only or args.prs_only)

        if sync_all or args.repos_only:
            sync_repositories(conn, BITBUCKET_WORKSPACE, BITBUCKET_REPOS, args.dry_run)

        if sync_all or args.commits_only:
            sync_commits(conn, BITBUCKET_WORKSPACE, BITBUCKET_REPOS, args.days, args.dry_run)

        if sync_all or args.prs_only:
            sync_pullrequests(conn, BITBUCKET_WORKSPACE, BITBUCKET_REPOS, args.dry_run)

        print("\n" + "=" * 60)
        print("SYNC COMPLETE")
        print("=" * 60)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
