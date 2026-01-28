#!/usr/bin/env python3
"""
Add labels to Sprint-Tumalo pages.

Labels added:
- type: sprint-review, story-note, sprint-board
- sprint: sprint-01, sprint-02, ... sprint-33

Usage:
    python scripts/add_sprint_labels.py --dry-run    # Preview only
    python scripts/add_sprint_labels.py              # Execute
"""

import os
import sys
import time
import argparse

# Add scripts directory to path
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)

from lib import db
from lib.confluence_write import add_labels, ConfluenceAPIError


def get_pages_to_label():
    """Get all pages that need labels."""
    query = """
    WITH RECURSIVE descendants AS (
        SELECT id, title, parent_id, 1 as depth
        FROM confluence_v2_content
        WHERE parent_id = '164462762'  -- Sprint-Tumalo
        UNION ALL
        SELECT c.id, c.title, c.parent_id, d.depth + 1
        FROM confluence_v2_content c
        JOIN descendants d ON c.parent_id = d.id
        WHERE d.depth < 5
    )
    SELECT
        d.id,
        d.title,
        p.title as parent_title,
        -- Document type label
        CASE
            WHEN d.title ~* 'sprint.?review' THEN 'sprint-review'
            WHEN d.title ~ '^EUV-[0-9]+' OR d.title ~ '^ASP-[0-9]+' THEN 'story-note'
            WHEN d.title ~* '(sprint|standup).?board' THEN 'sprint-board'
            ELSE NULL
        END as type_label,
        -- Sprint number label (from parent folder)
        CASE
            WHEN p.title ~ 'Scaled-[Ss]print([0-9]+)' THEN 'sprint-' || (regexp_match(p.title, 'Scaled-[Ss]print([0-9]+)'))[1]
            WHEN p.title ~ '\\[Sprint([0-9]+)\\]' THEN 'sprint-' || (regexp_match(p.title, '\\[Sprint([0-9]+)\\]'))[1]
            ELSE NULL
        END as sprint_label
    FROM descendants d
    LEFT JOIN confluence_v2_content p ON d.parent_id = p.id
    WHERE d.depth >= 2
    ORDER BY sprint_label, type_label, d.title
    """
    return db.fetch_all(query)


def main():
    parser = argparse.ArgumentParser(description='Add labels to Sprint-Tumalo pages')
    parser.add_argument('--dry-run', action='store_true', help='Preview only, no changes')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of pages to process')
    args = parser.parse_args()

    print("Fetching pages from Sprint-Tumalo...")
    pages = get_pages_to_label()

    # Filter pages that need labels
    pages_to_label = [p for p in pages if p['type_label'] or p['sprint_label']]

    print(f"\nFound {len(pages_to_label)} pages to label")

    # Summary
    type_counts = {}
    sprint_counts = {}

    for page in pages_to_label:
        if page['type_label']:
            type_counts[page['type_label']] = type_counts.get(page['type_label'], 0) + 1
        if page['sprint_label']:
            sprint_counts[page['sprint_label']] = sprint_counts.get(page['sprint_label'], 0) + 1

    print("\n--- Type Labels ---")
    for label, count in sorted(type_counts.items()):
        print(f"  {label}: {count}")

    print(f"\n--- Sprint Labels ({len(sprint_counts)} sprints) ---")

    if args.dry_run:
        print("\n[DRY-RUN] Would add labels to pages:")
        for i, page in enumerate(pages_to_label[:20]):
            labels = []
            if page['type_label']:
                labels.append(page['type_label'])
            if page['sprint_label']:
                labels.append(page['sprint_label'])
            print(f"  {page['id']}: {page['title'][:50]}...")
            print(f"         Labels: {labels}")
        if len(pages_to_label) > 20:
            print(f"  ... and {len(pages_to_label) - 20} more pages")
        return

    # Execute
    print("\n--- Adding Labels ---")

    if args.limit:
        pages_to_label = pages_to_label[:args.limit]

    success_count = 0
    error_count = 0

    for i, page in enumerate(pages_to_label):
        page_id = page['id']
        labels = []

        if page['type_label']:
            labels.append(page['type_label'])
        if page['sprint_label']:
            labels.append(page['sprint_label'])

        if not labels:
            continue

        print(f"[{i+1}/{len(pages_to_label)}] {page['title'][:50]}... -> {labels}")

        try:
            add_labels(page_id, labels)
            success_count += 1
        except ConfluenceAPIError as e:
            print(f"  ERROR: {e}")
            error_count += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            error_count += 1

        # Rate limiting
        time.sleep(0.3)

    print(f"\n--- Complete ---")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")


if __name__ == '__main__':
    main()
