#!/usr/bin/env python3
"""
Migrate bundle labels from dot format to hyphen format.

Confluence doesn't allow periods in labels, so we need to update:
  bundle-3.8.3 -> bundle-3-8-3

This script updates all labels in the local database to use the hyphen format.

Usage:
    python3 scripts/migrate_bundle_labels.py [--dry-run]
"""

import os
import sys
import re
import argparse
import psycopg2

# Database configuration
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', '5439')),
    'database': os.getenv('POSTGRES_DB', 'javis_brain'),
    'user': os.getenv('POSTGRES_USER', 'javis'),
    'password': os.getenv('POSTGRES_PASSWORD', 'javis_password'),
}

# Pattern to match dot-format bundle labels (bundle-3.8.3)
DOT_LABEL_PATTERN = re.compile(r'^bundle-(\d+)\.(\d+)\.(\d+)$')


def convert_label(label):
    """Convert label from dot format to hyphen format."""
    match = DOT_LABEL_PATTERN.match(label)
    if match:
        return f"bundle-{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return label


def main():
    parser = argparse.ArgumentParser(description='Migrate bundle labels to hyphen format')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without making changes')
    args = parser.parse_args()

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # Find all pages with dot-format bundle labels
        cursor.execute("""
            SELECT id, title, labels
            FROM confluence_v2_content
            WHERE type = 'page'
              AND labels IS NOT NULL
              AND array_length(labels, 1) > 0
        """)

        pages = cursor.fetchall()
        total_pages = 0
        total_labels = 0

        for page_id, title, labels in pages:
            if not labels:
                continue

            # Find labels that need migration
            new_labels = []
            changed = False

            for label in labels:
                new_label = convert_label(label)
                new_labels.append(new_label)
                if new_label != label:
                    changed = True
                    total_labels += 1

            if changed:
                total_pages += 1
                if args.dry_run:
                    print(f"Would update '{title}':")
                    for old, new in zip(labels, new_labels):
                        if old != new:
                            print(f"  {old} -> {new}")
                else:
                    cursor.execute("""
                        UPDATE confluence_v2_content
                        SET labels = %s
                        WHERE id = %s
                    """, (new_labels, page_id))

        if not args.dry_run:
            conn.commit()

        print()
        if args.dry_run:
            print(f"Dry run complete:")
            print(f"  Would update {total_pages} pages")
            print(f"  Would migrate {total_labels} labels")
            print("\nRun without --dry-run to apply changes.")
        else:
            print(f"Done!")
            print(f"  Updated: {total_pages} pages")
            print(f"  Migrated: {total_labels} labels")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    main()
