"""
Sync command - Wrapper for synchronization scripts.

Usage:
  javis sync all                    # Run all sync operations
  javis sync jira                   # Sync Jira issues
  javis sync bitbucket              # Sync Bitbucket data
  javis sync sprints                # Sync Jira sprints
  javis sync roadmap                # Sync roadmap epics
  javis sync --status               # Show sync status
"""

import argparse
import subprocess
import sys
import os

# Get scripts directory
SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Sync script mapping
SYNC_SCRIPTS = {
    'jira': 'mirror_jira.py',
    'bidirectional': 'sync_bidirectional.py',
    'bitbucket': 'sync_bitbucket.py',
    'sprints': 'mirror_jira_sprints.py',
    'roadmap': 'sync_roadmap_epics.py',
    'members': 'sync_member_stats.py',
}


def run_script(script_name: str, extra_args: list = None, dry_run: bool = False):
    """Run a Python script."""
    script_path = os.path.join(SCRIPTS_DIR, script_name)

    if not os.path.exists(script_path):
        print(f"  Script not found: {script_name}")
        return False

    cmd = [sys.executable, script_path]
    if extra_args:
        cmd.extend(extra_args)
    if dry_run:
        cmd.append('--dry-run')

    print(f"  Running: {script_name}")

    try:
        result = subprocess.run(
            cmd,
            cwd=SCRIPTS_DIR,
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        print(f"  Error: {e}")
        return False


def show_sync_status():
    """Show last sync times."""
    sys.path.insert(0, SCRIPTS_DIR)
    from lib import db

    print("=" * 60)
    print("SYNC STATUS")
    print("=" * 60)

    # Jira issues
    result = db.fetch_one("""
        SELECT MAX(last_synced_at) as last_sync, COUNT(*) as count
        FROM jira_issues
    """)
    if result:
        print(f"\nJira Issues:")
        print(f"  Last sync: {result['last_sync'] or 'Never'}")
        print(f"  Total issues: {result['count']}")

    # Sprints
    try:
        result = db.fetch_one("""
            SELECT MAX(synced_at) as last_sync, COUNT(*) as count
            FROM jira_sprints
        """)
        if result:
            print(f"\nJira Sprints:")
            print(f"  Last sync: {result['last_sync'] or 'Never'}")
            print(f"  Total sprints: {result['count']}")
    except:
        pass

    # Bitbucket repos
    try:
        result = db.fetch_one("""
            SELECT MAX(last_synced_at) as last_sync, COUNT(*) as count
            FROM bitbucket_repositories
        """)
        if result and result['count']:
            print(f"\nBitbucket Repos:")
            print(f"  Last sync: {result['last_sync'] or 'Never'}")
            print(f"  Total repos: {result['count']}")

        result = db.fetch_one("""
            SELECT MAX(synced_at) as last_sync, COUNT(*) as count
            FROM bitbucket_commits
        """)
        if result and result['count']:
            print(f"\nBitbucket Commits:")
            print(f"  Last sync: {result['last_sync'] or 'Never'}")
            print(f"  Total commits: {result['count']}")

        result = db.fetch_one("""
            SELECT MAX(synced_at) as last_sync, COUNT(*) as count
            FROM bitbucket_pullrequests
        """)
        if result and result['count']:
            print(f"\nBitbucket PRs:")
            print(f"  Last sync: {result['last_sync'] or 'Never'}")
            print(f"  Total PRs: {result['count']}")
    except:
        pass


def run(args):
    """Run sync command."""
    parser = argparse.ArgumentParser(prog='javis sync', description='Sync data from external sources')
    parser.add_argument('target', nargs='?', default='status',
                        choices=['all', 'jira', 'bitbucket', 'sprints', 'roadmap', 'members', 'status'],
                        help='What to sync')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would happen')
    parser.add_argument('--status', action='store_true',
                        help='Show sync status')

    parsed = parser.parse_args(args)

    if parsed.status or parsed.target == 'status':
        show_sync_status()
        return

    print("=" * 60)
    print("JAVIS SYNC")
    print("=" * 60)

    if parsed.target == 'all':
        print("\nRunning all sync operations...")
        success = 0
        total = 0

        for name, script in SYNC_SCRIPTS.items():
            total += 1
            print(f"\n--- {name.upper()} ---")
            if run_script(script, dry_run=parsed.dry_run):
                success += 1

        print(f"\n{'=' * 60}")
        print(f"Completed: {success}/{total} sync operations")

    else:
        script = SYNC_SCRIPTS.get(parsed.target)
        if script:
            run_script(script, dry_run=parsed.dry_run)
        else:
            print(f"Unknown sync target: {parsed.target}")
            print(f"Available: {', '.join(SYNC_SCRIPTS.keys())}")
            sys.exit(1)


if __name__ == "__main__":
    run(sys.argv[1:])
