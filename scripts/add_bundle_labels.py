#!/usr/bin/env python3
"""
Add bundle labels to Confluence pages based on parent page hierarchy.

Finds parent pages like "EUV B4.2.6" and adds "bundle-4.2.6" label to
the parent and all descendant pages.

Usage:
    python3 scripts/add_bundle_labels.py [--dry-run]
"""

import os
import sys
import re
import argparse
import psycopg2
from psycopg2.extras import execute_values

# Database configuration
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', '5439')),
    'database': os.getenv('POSTGRES_DB', 'javis_brain'),
    'user': os.getenv('POSTGRES_USER', 'javis'),
    'password': os.getenv('POSTGRES_PASSWORD', 'javis_password'),
}

# Pattern to match bundle parent pages like "EUV B4.2.6" or "EUV B3.10.0"
BUNDLE_PAGE_PATTERN = re.compile(r'^EUV B(\d+\.\d+\.\d+)$')


def get_bundle_parent_pages(cursor):
    """Find all pages that match the bundle parent pattern."""
    cursor.execute(r"""
        SELECT id, title
        FROM confluence_v2_content
        WHERE title ~ '^EUV B[0-9]+\.[0-9]+\.[0-9]+$'
          AND type = 'page'
        ORDER BY title
    """)
    return cursor.fetchall()


def get_descendants(cursor, parent_id, max_depth=10):
    """Get all descendant pages of a parent page."""
    cursor.execute("""
        WITH RECURSIVE descendants AS (
            SELECT id, title, parent_id, 0 as level
            FROM confluence_v2_content
            WHERE id = %s

            UNION ALL

            SELECT c.id, c.title, c.parent_id, d.level + 1
            FROM confluence_v2_content c
            JOIN descendants d ON c.parent_id = d.id
            WHERE d.level < %s
        )
        SELECT id, title, level FROM descendants ORDER BY level, title
    """, (parent_id, max_depth))
    return cursor.fetchall()


def add_label_to_pages(cursor, page_ids, label, dry_run=False):
    """Add a label to multiple pages if not already present."""
    if dry_run:
        return len(page_ids)

    # Update labels array, adding the new label if not present
    cursor.execute("""
        UPDATE confluence_v2_content
        SET labels = CASE
            WHEN labels IS NULL THEN ARRAY[%s]
            WHEN %s = ANY(labels) THEN labels
            ELSE array_append(labels, %s)
        END
        WHERE id = ANY(%s)
          AND (labels IS NULL OR NOT %s = ANY(labels))
    """, (label, label, label, page_ids, label))

    return cursor.rowcount


def main():
    parser = argparse.ArgumentParser(description='Add bundle labels to Confluence pages')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without making changes')
    args = parser.parse_args()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Find all bundle parent pages
        parent_pages = get_bundle_parent_pages(cursor)
        print(f"Found {len(parent_pages)} bundle parent pages\n")

        total_pages_updated = 0
        total_labels_added = 0

        for parent_id, parent_title in parent_pages:
            # Extract version from title
            match = BUNDLE_PAGE_PATTERN.match(parent_title)
            if not match:
                continue

            version = match.group(1)
            # Confluence doesn't allow periods in labels, use hyphens
            label = f"bundle-{version.replace('.', '-')}"

            # Get all descendants including the parent
            descendants = get_descendants(cursor, parent_id)
            page_ids = [row[0] for row in descendants]

            if not page_ids:
                continue

            # Add label to all pages
            updated = add_label_to_pages(cursor, page_ids, label, args.dry_run)

            if updated > 0 or args.dry_run:
                action = "Would add" if args.dry_run else "Added"
                print(f"{action} '{label}' to {len(page_ids)} pages:")
                for page_id, title, level in descendants:
                    indent = "  " * level
                    print(f"  {indent}- {title}")
                print()

                total_pages_updated += len(page_ids)
                total_labels_added += 1

        if not args.dry_run:
            conn.commit()
            print(f"\n✅ Done! Added {total_labels_added} different bundle labels to {total_pages_updated} pages total.")
        else:
            print(f"\n🔍 Dry run complete. Would add {total_labels_added} different bundle labels to {total_pages_updated} pages total.")
            print("Run without --dry-run to apply changes.")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    main()
