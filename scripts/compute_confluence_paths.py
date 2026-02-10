#!/usr/bin/env python3
"""
Compute hierarchical tree structure for Confluence pages.

This script calculates:
- materialized_path: Full path from root (e.g., '/root/parent/page')
- depth: Level in the tree hierarchy (0 = root)
- child_count: Number of direct children
- is_orphan: Whether the page has a broken parent chain
- sort_order: Position among siblings

Usage:
    python scripts/compute_confluence_paths.py [--verbose] [--space SPACE_ID]
"""

import argparse
import sys
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

# Add parent directory to path for imports
sys.path.insert(0, '.')
from scripts.lib import db, config


def get_all_pages(space_id: Optional[str] = None) -> List[Dict]:
    """Fetch all Confluence pages with their parent relationships."""
    query = """
        SELECT id, title, parent_id, type, space_id
        FROM confluence_v2_content
    """
    params = []

    if space_id:
        query += " WHERE space_id = %s"
        params.append(space_id)

    query += " ORDER BY title"

    return db.fetch_all(query, params)


def build_parent_lookup(pages: List[Dict]) -> Dict[str, Dict]:
    """Create a lookup map of page_id -> page data."""
    return {page['id']: page for page in pages}


def build_children_lookup(pages: List[Dict]) -> Dict[str, List[Dict]]:
    """Create a lookup map of parent_id -> list of children."""
    children = defaultdict(list)
    for page in pages:
        if page['parent_id']:
            children[page['parent_id']].append(page)
    return children


def find_roots(pages: List[Dict], page_lookup: Dict[str, Dict]) -> List[Dict]:
    """Find root pages (no parent or parent not in dataset)."""
    roots = []
    for page in pages:
        if not page['parent_id']:
            roots.append(page)
        elif page['parent_id'] not in page_lookup:
            # Parent doesn't exist - this is an orphan root
            roots.append(page)
    return roots


def compute_paths_bfs(
    pages: List[Dict],
    page_lookup: Dict[str, Dict],
    children_lookup: Dict[str, List[Dict]],
    verbose: bool = False
) -> Dict[str, Tuple[str, int, bool, str]]:
    """
    Compute materialized paths using BFS traversal.

    Returns dict of page_id -> (materialized_path, depth, is_orphan, orphan_reason)
    """
    results = {}
    visited: Set[str] = set()

    # Find all roots (pages with no parent or missing parent)
    roots = find_roots(pages, page_lookup)

    if verbose:
        print(f"Found {len(roots)} root nodes")

    # BFS queue: (page, parent_path, depth, is_orphan, orphan_reason)
    queue = []

    for root in roots:
        is_orphan = bool(root['parent_id'])  # Has parent but parent not found
        orphan_reason = 'deleted_parent' if is_orphan else None
        queue.append((root, '', 0, is_orphan, orphan_reason))

    while queue:
        page, parent_path, depth, is_orphan, orphan_reason = queue.pop(0)
        page_id = page['id']

        if page_id in visited:
            continue

        visited.add(page_id)

        # Build materialized path
        # Use a safe path segment (ID-based to avoid special chars)
        path_segment = page_id
        current_path = f"{parent_path}/{path_segment}" if parent_path else f"/{path_segment}"

        results[page_id] = (current_path, depth, is_orphan, orphan_reason)

        # Add children to queue
        for child in children_lookup.get(page_id, []):
            if child['id'] not in visited:
                # Children do NOT inherit orphan status - they have a valid parent (this page)
                # A page is only orphan if its immediate parent_id doesn't exist in DB
                queue.append((child, current_path, depth + 1, False, None))

    # Handle any unvisited pages (circular references or disconnected)
    unvisited = set(page_lookup.keys()) - visited
    if unvisited:
        if verbose:
            print(f"Found {len(unvisited)} disconnected pages")

        for page_id in unvisited:
            page = page_lookup[page_id]
            results[page_id] = (f"/orphan/{page_id}", 0, True, 'circular_or_disconnected')

    return results


def compute_child_counts(children_lookup: Dict[str, List[Dict]]) -> Dict[str, int]:
    """Compute direct child count for each page."""
    return {page_id: len(children) for page_id, children in children_lookup.items()}


def compute_sort_orders(
    children_lookup: Dict[str, List[Dict]]
) -> Dict[str, int]:
    """Compute sort order for each page within its siblings."""
    sort_orders = {}

    for parent_id, children in children_lookup.items():
        # Sort children alphabetically by title
        sorted_children = sorted(children, key=lambda p: p['title'].lower())
        for idx, child in enumerate(sorted_children):
            sort_orders[child['id']] = idx

    # Root pages (no parent) get sort order 0
    # This will be handled in the update

    return sort_orders


def update_database(
    path_results: Dict[str, Tuple[str, int, bool, str]],
    child_counts: Dict[str, int],
    sort_orders: Dict[str, int],
    verbose: bool = False
) -> Tuple[int, int]:
    """Update database with computed tree data."""
    updates = []
    orphan_count = 0

    for page_id, (path, depth, is_orphan, orphan_reason) in path_results.items():
        child_count = child_counts.get(page_id, 0)
        sort_order = sort_orders.get(page_id, 0)

        if is_orphan:
            orphan_count += 1

        updates.append((path, depth, child_count, is_orphan, orphan_reason, sort_order, page_id))

    if verbose:
        print(f"Updating {len(updates)} pages ({orphan_count} orphans)...")

    query = """
        UPDATE confluence_v2_content
        SET materialized_path = %s,
            depth = %s,
            child_count = %s,
            is_orphan = %s,
            orphan_reason = %s,
            sort_order = %s
        WHERE id = %s
    """

    with db.connection() as conn:
        with db.cursor(conn) as cur:
            for update in updates:
                cur.execute(query, update)

    return len(updates), orphan_count


def print_tree_sample(
    path_results: Dict[str, Tuple[str, int, bool, str]],
    page_lookup: Dict[str, Dict],
    limit: int = 20
) -> None:
    """Print a sample of the tree structure."""
    print("\n=== Tree Structure Sample ===")

    # Sort by path for readable output
    sorted_items = sorted(path_results.items(), key=lambda x: x[1][0])

    for page_id, (path, depth, is_orphan, orphan_reason) in sorted_items[:limit]:
        page = page_lookup.get(page_id, {})
        title = page.get('title', 'Unknown')[:40]
        indent = "  " * depth
        orphan_marker = " [ORPHAN]" if is_orphan else ""

        print(f"{indent}{title}{orphan_marker}")

    if len(sorted_items) > limit:
        print(f"\n... and {len(sorted_items) - limit} more pages")


def print_statistics(
    path_results: Dict[str, Tuple[str, int, bool, str]],
    child_counts: Dict[str, int]
) -> None:
    """Print tree statistics."""
    depths = [r[1] for r in path_results.values()]
    orphans = sum(1 for r in path_results.values() if r[2])
    pages_with_children = sum(1 for c in child_counts.values() if c > 0)

    print("\n=== Tree Statistics ===")
    print(f"Total pages: {len(path_results)}")
    print(f"Orphan pages: {orphans}")
    print(f"Max depth: {max(depths) if depths else 0}")
    print(f"Avg depth: {sum(depths) / len(depths):.1f}" if depths else "N/A")
    print(f"Pages with children: {pages_with_children}")

    # Depth distribution
    depth_dist = defaultdict(int)
    for d in depths:
        depth_dist[d] += 1

    print("\nDepth distribution:")
    for d in sorted(depth_dist.keys()):
        bar = "=" * min(depth_dist[d] // 10, 50)
        print(f"  Level {d}: {depth_dist[d]:4d} {bar}")


def main():
    parser = argparse.ArgumentParser(description="Compute Confluence tree structure")
    parser.add_argument('--space', type=str, help='Filter by space ID')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--dry-run', action='store_true', help='Show results without updating DB')
    args = parser.parse_args()

    print("=== Confluence Path Computation ===")

    # Step 1: Fetch all pages
    print("\nFetching pages...")
    pages = get_all_pages(args.space)
    print(f"Found {len(pages)} pages")

    if not pages:
        print("No pages found. Exiting.")
        return

    # Step 2: Build lookup structures
    print("Building lookup structures...")
    page_lookup = build_parent_lookup(pages)
    children_lookup = build_children_lookup(pages)

    # Step 3: Compute paths using BFS
    print("Computing paths...")
    path_results = compute_paths_bfs(pages, page_lookup, children_lookup, args.verbose)

    # Step 4: Compute child counts
    print("Computing child counts...")
    child_counts = compute_child_counts(children_lookup)

    # Step 5: Compute sort orders
    print("Computing sort orders...")
    sort_orders = compute_sort_orders(children_lookup)

    # Print statistics
    print_statistics(path_results, child_counts)

    if args.verbose:
        print_tree_sample(path_results, page_lookup)

    # Step 6: Update database
    if args.dry_run:
        print("\n[DRY RUN] Skipping database update")
    else:
        print("\nUpdating database...")
        updated, orphans = update_database(path_results, child_counts, sort_orders, args.verbose)
        print(f"Updated {updated} pages ({orphans} marked as orphans)")

    print("\nDone!")


if __name__ == '__main__':
    main()
