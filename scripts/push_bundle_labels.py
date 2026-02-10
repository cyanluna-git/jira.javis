#!/usr/bin/env python3
"""
Push bundle labels from local DB to actual Confluence pages.

This script syncs the 'bundle-X.X.X' labels that were added locally
back to the real Confluence pages via the Confluence Cloud API.

Usage:
    python3 scripts/push_bundle_labels.py [--dry-run]
"""

import os
import sys
import re
import argparse
import requests
import time
import psycopg2
from requests.auth import HTTPBasicAuth

# --- Configuration ---
def load_env(env_path=".env"):
    config = {}
    try:
        if not os.path.exists(env_path):
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    config[k] = v
    except:
        pass
    return config

config = load_env()
CONFLUENCE_BASE = config.get("JIRA_URL", "").rstrip('/')
EMAIL = config.get("JIRA_EMAIL")
TOKEN = config.get("JIRA_TOKEN")
AUTH = HTTPBasicAuth(EMAIL, TOKEN)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', '5439')),
    'database': os.getenv('POSTGRES_DB', 'javis_brain'),
    'user': os.getenv('POSTGRES_USER', 'javis'),
    'password': os.getenv('POSTGRES_PASSWORD', 'javis_password'),
}

# Pattern to match bundle labels (both formats: bundle-3.8.3 or bundle-3-8-3)
BUNDLE_LABEL_PATTERN = re.compile(r'^bundle-\d+[\.\-]\d+[\.\-]\d+$')


def convert_label_format(label):
    """Convert label from dot format to hyphen format for Confluence compatibility.
    e.g., bundle-3.8.3 -> bundle-3-8-3
    """
    return label.replace('.', '-')


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
            print(f"❌ API GET Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None


def api_post(endpoint, data):
    """Make a POST request to Confluence API."""
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
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                retries += 1
                continue
            if res.status_code in [200, 201]:
                return res.json() if res.text else True
            # 409 conflict means label already exists - treat as success
            if res.status_code == 409:
                return True
            res.raise_for_status()
            return res.json() if res.text else True
        except Exception as e:
            print(f"❌ API POST Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None


def get_confluence_labels(page_id):
    """Fetch current labels from Confluence for a page using v1 API."""
    endpoint = f"/rest/api/content/{page_id}/label"
    data = api_get(endpoint)
    if data and 'results' in data:
        return set(l['name'] for l in data['results'])
    return set()


def add_label_to_confluence(page_id, label):
    """Add a label to a Confluence page via v1 API."""
    endpoint = f"/rest/api/content/{page_id}/label"
    # v1 API expects an array of label objects with prefix
    data = [{"prefix": "global", "name": label}]
    return api_post(endpoint, data)


def get_pages_with_bundle_labels(cursor):
    """Find all pages that have bundle labels in local DB."""
    cursor.execute("""
        SELECT id, title, labels
        FROM confluence_v2_content
        WHERE type = 'page'
          AND labels IS NOT NULL
          AND array_length(labels, 1) > 0
        ORDER BY title
    """)
    return cursor.fetchall()


def main():
    parser = argparse.ArgumentParser(description='Push bundle labels to Confluence')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without making changes')
    args = parser.parse_args()

    if not CONFLUENCE_BASE or not EMAIL or not TOKEN:
        print("❌ Error: Missing Confluence configuration (JIRA_URL, JIRA_EMAIL, JIRA_TOKEN)")
        sys.exit(1)

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Get all pages with labels from local DB
        pages = get_pages_with_bundle_labels(cursor)
        print(f"Found {len(pages)} pages with labels in local DB\n")

        total_labels_pushed = 0
        total_pages_updated = 0
        skipped_already_exists = 0

        for page_id, title, local_labels in pages:
            if not local_labels:
                continue

            # Filter to only bundle labels and convert to Confluence-compatible format
            bundle_labels = []
            for l in local_labels:
                if BUNDLE_LABEL_PATTERN.match(l):
                    # Convert to hyphen format (bundle-3.8.3 -> bundle-3-8-3)
                    bundle_labels.append(convert_label_format(l))

            if not bundle_labels:
                continue

            if args.dry_run:
                print(f"Would push to '{title}': {bundle_labels}")
                total_pages_updated += 1
                total_labels_pushed += len(bundle_labels)
                continue

            # Get current labels from Confluence
            confluence_labels = get_confluence_labels(page_id)

            # Find labels that need to be added
            labels_to_add = [l for l in bundle_labels if l not in confluence_labels]

            if not labels_to_add:
                skipped_already_exists += 1
                continue

            # Add each missing label
            print(f"📝 {title}")
            for label in labels_to_add:
                result = add_label_to_confluence(page_id, label)
                if result:
                    print(f"   ✅ Added: {label}")
                    total_labels_pushed += 1
                else:
                    print(f"   ❌ Failed: {label}")

            total_pages_updated += 1

            # Small delay to avoid rate limiting
            time.sleep(0.2)

        print()
        if args.dry_run:
            print(f"🔍 Dry run complete:")
            print(f"   Would update {total_pages_updated} pages")
            print(f"   Would push {total_labels_pushed} labels")
            print("\nRun without --dry-run to apply changes.")
        else:
            print(f"✅ Done!")
            print(f"   Updated: {total_pages_updated} pages")
            print(f"   Labels pushed: {total_labels_pushed}")
            print(f"   Skipped (already exists): {skipped_already_exists}")

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    main()
