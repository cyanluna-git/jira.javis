#!/usr/bin/env python3
"""
Sync Local Epics to Jira

Creates Epic issues in Jira from roadmap_local_epics table.

Usage:
  python scripts/sync_local_epics_to_jira.py                           # Sync all 'ready' epics
  python scripts/sync_local_epics_to_jira.py --milestone "The Walking Skeleton"  # Specific milestone
  python scripts/sync_local_epics_to_jira.py --all                     # Include 'draft' status
  python scripts/sync_local_epics_to_jira.py --dry-run                 # Preview without creating
  python scripts/sync_local_epics_to_jira.py --list                    # List local epics
"""

import os
import sys
import json
import argparse
import requests
import psycopg2
from psycopg2.extras import Json, RealDictCursor
from datetime import datetime
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
        print(f"Warning: .env file not found at {env_path}")
    return config


config = load_env()
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

DB_HOST = config.get("DB_HOST", "localhost")
DB_PORT = config.get("DB_PORT", "5439")
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

    headers = kwargs.pop('headers', {})
    headers['Content-Type'] = 'application/json'

    try:
        response = requests.request(method, url, auth=auth, headers=headers, timeout=30, **kwargs)
        return response
    except requests.exceptions.RequestException as e:
        print(f"  API Error: {e}")
        return None


def get_epic_name_field() -> Optional[str]:
    """Get the custom field ID for Epic Name."""
    # Try common Epic Name field IDs
    # This may vary by Jira instance
    response = api_request('GET', '/rest/api/3/field')
    if response and response.status_code == 200:
        fields = response.json()
        for field in fields:
            # Look for Epic Name or Epic Link field
            if field.get('name') in ['Epic Name', 'Epic name']:
                return field['id']

    # Default fallback (common in Jira Cloud)
    return 'customfield_10011'


def markdown_to_adf(markdown_text: str) -> Dict:
    """Convert markdown to Atlassian Document Format (simplified)."""
    if not markdown_text:
        return {
            "type": "doc",
            "version": 1,
            "content": []
        }

    content = []
    lines = markdown_text.split('\n')

    for line in lines:
        line = line.rstrip()

        # Skip empty lines
        if not line:
            content.append({
                "type": "paragraph",
                "content": []
            })
            continue

        # Headers
        if line.startswith('## '):
            content.append({
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": line[3:]}]
            })
        elif line.startswith('### '):
            content.append({
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": line[4:]}]
            })
        elif line.startswith('# '):
            content.append({
                "type": "heading",
                "attrs": {"level": 1},
                "content": [{"type": "text", "text": line[2:]}]
            })
        # Bullet points
        elif line.startswith('- ') or line.startswith('* '):
            # For simplicity, convert to paragraph with bullet
            content.append({
                "type": "bulletList",
                "content": [{
                    "type": "listItem",
                    "content": [{
                        "type": "paragraph",
                        "content": [{"type": "text", "text": line[2:]}]
                    }]
                }]
            })
        # Code blocks (simplified - just make it a code block)
        elif line.startswith('```'):
            continue  # Skip code fence markers
        # Regular paragraph
        else:
            # Handle bold **text**
            text = line
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": text}]
            })

    return {
        "type": "doc",
        "version": 1,
        "content": content if content else [{"type": "paragraph", "content": []}]
    }


def parse_component_from_jql(jql: str) -> Optional[str]:
    """Parse component name from JQL filter."""
    if not jql:
        return None

    import re
    # Match: component = "Name" or component = 'Name'
    match = re.search(r'component\s*=\s*["\']([^"\']+)["\']', jql, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def get_local_epics(conn, milestone_title: str = None, include_draft: bool = False) -> List[Dict]:
    """Get local epics to sync."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            le.*,
            m.title as milestone_title,
            v.project_key,
            v.title as vision_title,
            v.jql_filter
        FROM roadmap_local_epics le
        JOIN roadmap_milestones m ON m.id = le.milestone_id
        JOIN roadmap_visions v ON v.id = m.vision_id
        WHERE le.status != 'synced'
    """
    params = []

    if not include_draft:
        query += " AND le.status = 'ready'"

    if milestone_title:
        query += " AND m.title ILIKE %s"
        params.append(f"%{milestone_title}%")

    query += " ORDER BY le.sort_order, le.created_at"

    cur.execute(query, params)
    return cur.fetchall()


def create_jira_epic(epic: Dict, dry_run: bool = False) -> Optional[str]:
    """Create an Epic in Jira."""
    project_key = epic['project_key']

    # Build the issue payload
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": epic['title'],
            "issuetype": {"name": "Epic"},
        }
    }

    # Add description if present
    if epic.get('description'):
        payload["fields"]["description"] = markdown_to_adf(epic['description'])

    # Add priority if present
    if epic.get('priority'):
        priority_map = {
            'High': 'High',
            'Medium': 'Medium',
            'Low': 'Low',
            'Critical': 'Highest'
        }
        payload["fields"]["priority"] = {"name": priority_map.get(epic['priority'], 'Medium')}

    # Add component from Vision's jql_filter
    component = parse_component_from_jql(epic.get('jql_filter'))
    if component:
        payload["fields"]["components"] = [{"name": component}]

    # Add Epic Name field (required for Epics in most Jira configs)
    epic_name_field = get_epic_name_field()
    if epic_name_field:
        payload["fields"][epic_name_field] = epic['title']

    if dry_run:
        print(f"  [DRY-RUN] Would create Epic in {project_key}:")
        print(f"    Summary: {epic['title']}")
        print(f"    Priority: {epic.get('priority', 'Medium')}")
        print(f"    Component: {component}")
        return "DRY-RUN-KEY"

    # Create the issue
    response = api_request('POST', '/rest/api/3/issue', json=payload)

    if response is None:
        print(f"  Error: No response from Jira API")
        return None

    if response.status_code == 201:
        result = response.json()
        return result.get('key')
    else:
        try:
            error_msg = response.json()
        except:
            error_msg = response.text
        print(f"  Error ({response.status_code}): {error_msg}")
        return None


def update_local_epic_status(conn, epic_id: str, jira_key: str, status: str = 'synced'):
    """Update local epic with Jira key and status."""
    cur = conn.cursor()
    cur.execute("""
        UPDATE roadmap_local_epics
        SET jira_key = %s, status = %s, updated_at = NOW()
        WHERE id = %s
    """, [jira_key, status, epic_id])


def create_epic_link(conn, milestone_id: str, epic_key: str):
    """Create roadmap_epic_links entry."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO roadmap_epic_links (milestone_id, epic_key)
        VALUES (%s, %s)
        ON CONFLICT (milestone_id, epic_key) DO NOTHING
    """, [milestone_id, epic_key])


def insert_jira_issue(conn, epic_key: str, epic: Dict, raw_data: Dict):
    """Insert the created Epic into jira_issues table."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO jira_issues (key, project, summary, status, raw_data)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (key) DO UPDATE SET
            summary = EXCLUDED.summary,
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
    """, [
        epic_key,
        epic['project_key'],
        epic['title'],
        'To Do',  # New epics start as To Do
        Json(raw_data)
    ])


def list_local_epics(conn, milestone_title: str = None):
    """List all local epics."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            le.id,
            le.title,
            le.status,
            le.priority,
            le.assignee,
            le.jira_key,
            m.title as milestone_title,
            v.project_key
        FROM roadmap_local_epics le
        JOIN roadmap_milestones m ON m.id = le.milestone_id
        JOIN roadmap_visions v ON v.id = m.vision_id
    """
    params = []

    if milestone_title:
        query += " WHERE m.title ILIKE %s"
        params.append(f"%{milestone_title}%")

    query += " ORDER BY m.title, le.sort_order"

    cur.execute(query, params)
    epics = cur.fetchall()

    print(f"\n{'='*80}")
    print(f"Local Epics ({len(epics)} total)")
    print(f"{'='*80}\n")

    current_milestone = None
    for epic in epics:
        if epic['milestone_title'] != current_milestone:
            current_milestone = epic['milestone_title']
            print(f"\n📍 {current_milestone}")
            print("-" * 60)

        status_icon = {
            'draft': '📝',
            'ready': '✅',
            'synced': '🔗'
        }.get(epic['status'], '❓')

        jira_info = f" -> {epic['jira_key']}" if epic['jira_key'] else ""
        print(f"  {status_icon} [{epic['status']:6}] [{epic['priority']:6}] {epic['title']}{jira_info}")
        if epic['assignee']:
            print(f"                         담당: {epic['assignee']}")

    print(f"\n{'='*80}")
    print("Status Legend: 📝 draft | ✅ ready | 🔗 synced")
    print(f"{'='*80}\n")


def set_epic_status(conn, epic_id: str = None, milestone_title: str = None, new_status: str = 'ready'):
    """Set status of local epics."""
    cur = conn.cursor()

    if epic_id:
        cur.execute("""
            UPDATE roadmap_local_epics SET status = %s, updated_at = NOW()
            WHERE id = %s AND status = 'draft'
        """, [new_status, epic_id])
        print(f"Updated epic {epic_id} to '{new_status}'")
    elif milestone_title:
        cur.execute("""
            UPDATE roadmap_local_epics SET status = %s, updated_at = NOW()
            WHERE milestone_id IN (
                SELECT id FROM roadmap_milestones WHERE title ILIKE %s
            ) AND status = 'draft'
        """, [new_status, f"%{milestone_title}%"])
        print(f"Updated {cur.rowcount} epics to '{new_status}'")


def main():
    parser = argparse.ArgumentParser(description='Sync local epics to Jira')
    parser.add_argument('--milestone', '-m', help='Filter by milestone title')
    parser.add_argument('--all', '-a', action='store_true', help='Include draft status epics')
    parser.add_argument('--dry-run', '-n', action='store_true', help='Preview without creating')
    parser.add_argument('--list', '-l', action='store_true', help='List local epics')
    parser.add_argument('--set-ready', action='store_true', help='Set draft epics to ready status')
    parser.add_argument('--epic-id', help='Specific epic ID to update')

    args = parser.parse_args()

    # Validate Jira config
    if not all([JIRA_URL, JIRA_EMAIL, JIRA_TOKEN]):
        print("Error: JIRA_URL, JIRA_EMAIL, JIRA_TOKEN must be set in .env")
        sys.exit(1)

    conn = get_db_connection()

    try:
        # List mode
        if args.list:
            list_local_epics(conn, args.milestone)
            return

        # Set ready mode
        if args.set_ready:
            set_epic_status(conn, args.epic_id, args.milestone, 'ready')
            conn.commit()
            return

        # Sync mode
        epics = get_local_epics(conn, args.milestone, args.all)

        if not epics:
            print("No epics to sync. Use --all to include draft status, or --set-ready to mark as ready.")
            return

        print(f"\n{'='*60}")
        print(f"Syncing {len(epics)} epic(s) to Jira")
        if args.dry_run:
            print("[DRY-RUN MODE - No changes will be made]")
        print(f"{'='*60}\n")

        success_count = 0
        error_count = 0

        for epic in epics:
            print(f"\n📋 {epic['title']}")
            print(f"   Project: {epic['project_key']}")
            print(f"   Milestone: {epic['milestone_title']}")

            jira_key = create_jira_epic(epic, args.dry_run)

            if jira_key:
                if not args.dry_run:
                    # Update local epic
                    update_local_epic_status(conn, epic['id'], jira_key)

                    # Create epic link to milestone
                    create_epic_link(conn, epic['milestone_id'], jira_key)

                    # Insert into jira_issues (simplified raw_data)
                    raw_data = {
                        "key": jira_key,
                        "fields": {
                            "summary": epic['title'],
                            "description": epic.get('description'),
                            "issuetype": {"name": "Epic"},
                            "status": {"name": "To Do"},
                            "priority": {"name": epic.get('priority', 'Medium')}
                        }
                    }
                    insert_jira_issue(conn, jira_key, epic, raw_data)

                    conn.commit()

                print(f"   ✅ Created: {jira_key}")
                success_count += 1
            else:
                print(f"   ❌ Failed to create")
                error_count += 1

        print(f"\n{'='*60}")
        print(f"Summary: {success_count} created, {error_count} failed")
        print(f"{'='*60}\n")

    finally:
        conn.close()


if __name__ == '__main__':
    main()
