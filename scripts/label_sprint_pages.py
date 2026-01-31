#!/usr/bin/env python3
"""
Label Sprint Confluence Pages

This script adds sprint labels to all pages under Sprint-Tumalo sprint folders.
Each page will get a label based on its parent folder name:
- [Scaled-Sprint08]... → scaled-sprint08
- [Sprint27]... → scaled-sprint27

Usage:
    python scripts/label_sprint_pages.py --preview    # Show what would be done
    python scripts/label_sprint_pages.py --apply      # Actually apply labels
"""

import argparse
import re
import sys
from typing import Dict, List, Tuple

sys.path.insert(0, '.')
from scripts.lib import db
from scripts.lib.confluence_write import ConfluenceWriter


# Sprint-Tumalo page ID
SPRINT_TUMALO_ID = '164462762'


def extract_sprint_label(folder_title: str) -> str:
    """
    Extract sprint label from folder title.

    Examples:
        [Scaled-Sprint08]2025.10.28~11.10 → scaled-sprint08
        [Scaled-sprint10]2025.11.24~12.8 → scaled-sprint10
        [Sprint27] 2025.7.22~8.5 → sprint27 (no 'scaled-' prefix)
    """
    # Match [Scaled-SprintXX] - has "Scaled-" prefix
    match = re.search(r'\[Scaled-[Ss]print\s*(\d+)\]', folder_title)
    if match:
        sprint_num = match.group(1)
        return f"scaled-sprint{sprint_num}"

    # Match [SprintXX] without "Scaled-" prefix
    match = re.search(r'\[[Ss]print\s*(\d+)\]', folder_title)
    if match:
        sprint_num = match.group(1)
        return f"sprint{sprint_num}"

    return None


def get_sprint_folders() -> List[Dict]:
    """Get all sprint folders under Sprint-Tumalo."""
    query = """
        SELECT id, title
        FROM confluence_v2_content
        WHERE parent_id = %s
          AND type = 'folder'
          AND title ~ '\\[.*[Ss]print.*\\]'
        ORDER BY title
    """
    return db.fetch_all(query, [SPRINT_TUMALO_ID])


def get_folder_pages(folder_id: str) -> List[Dict]:
    """Get all pages under a folder (recursive)."""
    query = """
        WITH RECURSIVE descendants AS (
            SELECT id, title, labels, parent_id
            FROM confluence_v2_content
            WHERE parent_id = %s

            UNION ALL

            SELECT c.id, c.title, c.labels, c.parent_id
            FROM confluence_v2_content c
            JOIN descendants d ON c.parent_id = d.id
        )
        SELECT id, title, labels FROM descendants
    """
    return db.fetch_all(query, [folder_id])


def preview_labels() -> Tuple[int, int]:
    """Preview label assignments."""
    folders = get_sprint_folders()
    total_pages = 0
    pages_needing_label = 0

    print(f"\n{'Folder':<45} {'Label':<20} {'Pages':<8} {'Need Label'}")
    print("-" * 90)

    for folder in folders:
        label = extract_sprint_label(folder['title'])
        if not label:
            print(f"⚠️  Could not extract label from: {folder['title']}")
            continue

        pages = get_folder_pages(folder['id'])
        need_label = 0

        for page in pages:
            current_labels = page.get('labels') or []
            if label not in current_labels:
                need_label += 1

        total_pages += len(pages)
        pages_needing_label += need_label

        status = "✓" if need_label == 0 else f"{need_label}"
        print(f"{folder['title'][:44]:<45} {label:<20} {len(pages):<8} {status}")

    print("-" * 90)
    print(f"Total: {total_pages} pages, {pages_needing_label} need labels")

    return total_pages, pages_needing_label


def apply_labels(dry_run: bool = False) -> Dict:
    """Apply labels to pages."""
    writer = ConfluenceWriter(verbose=True)
    folders = get_sprint_folders()

    results = {
        'total_pages': 0,
        'labeled': 0,
        'skipped': 0,
        'errors': []
    }

    for folder in folders:
        label = extract_sprint_label(folder['title'])
        if not label:
            continue

        print(f"\n📁 {folder['title']}")
        print(f"   Label: {label}")

        pages = get_folder_pages(folder['id'])

        for page in pages:
            results['total_pages'] += 1
            current_labels = page.get('labels') or []

            if label in current_labels:
                print(f"   ⏭️  {page['title'][:50]} (already has label)")
                results['skipped'] += 1
                continue

            if dry_run:
                print(f"   🏷️  [DRY RUN] Would add '{label}' to: {page['title'][:50]}")
                results['labeled'] += 1
            else:
                try:
                    writer.add_labels(page['id'], [label])
                    print(f"   ✅ Added '{label}' to: {page['title'][:50]}")
                    results['labeled'] += 1
                except Exception as e:
                    print(f"   ❌ Error on {page['title'][:50]}: {e}")
                    results['errors'].append({
                        'page_id': page['id'],
                        'title': page['title'],
                        'error': str(e)
                    })

    return results


def main():
    parser = argparse.ArgumentParser(description="Label sprint Confluence pages")
    parser.add_argument('--preview', action='store_true',
                        help='Preview what labels would be applied')
    parser.add_argument('--apply', action='store_true',
                        help='Actually apply labels to Confluence')
    parser.add_argument('--dry-run', action='store_true',
                        help='Dry run (with --apply)')
    args = parser.parse_args()

    if args.preview or (not args.apply):
        print("=== Preview Mode ===")
        preview_labels()
        print("\nRun with --apply to actually add labels to Confluence")

    elif args.apply:
        print("=== Apply Labels ===")
        if args.dry_run:
            print("(DRY RUN - no actual changes)")

        results = apply_labels(dry_run=args.dry_run)

        print(f"\n=== Results ===")
        print(f"Total pages: {results['total_pages']}")
        print(f"Labeled: {results['labeled']}")
        print(f"Skipped (already had label): {results['skipped']}")
        if results['errors']:
            print(f"Errors: {len(results['errors'])}")
            for err in results['errors']:
                print(f"  - {err['title']}: {err['error']}")


if __name__ == '__main__':
    main()
