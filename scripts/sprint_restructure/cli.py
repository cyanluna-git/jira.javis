"""
Sprint Restructure CLI

Command-line interface for Confluence sprint page restructuring.

Commands:
    analyze   - Scan and classify pages under a parent
    propose   - Generate restructure proposal
    plan      - Create operations in content_operations table
    approve   - Approve pending operations
    list      - List pending restructure operations
"""

import argparse
import json
import sys
import os

# Add parent directory to path for imports
SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS_DIR)

from lib import db, config
from sprint_restructure.document_classifier import DocumentClassifier, FOLDER_NAMES
from sprint_restructure.similarity_analyzer import SimilarityAnalyzer
from sprint_restructure.structure_proposer import StructureProposer
from sprint_restructure.operation_planner import OperationPlanner
from sprint_restructure.name_resolver import NameResolver


def get_confluence_pages(parent_title: str, space_key: str = None) -> tuple:
    """
    Fetch pages from database for a given parent.

    Returns:
        Tuple of (parent_info, child_pages, subfolders)
    """
    # Find parent page
    parent_query = """
        SELECT id, title, space_id
        FROM confluence_v2_content
        WHERE title = %s
    """
    params = [parent_title]

    if space_key:
        parent_query += " AND space_id = (SELECT id FROM confluence_v2_spaces WHERE key = %s)"
        params.append(space_key)

    parent = db.fetch_one(parent_query, params)

    if not parent:
        print(f"Parent page not found: {parent_title}")
        return None, [], []

    parent_id = parent['id']
    space_id = parent['space_id']

    # Get direct child folders (sprint folders)
    folders_query = """
        SELECT id, title, parent_id
        FROM confluence_v2_content
        WHERE parent_id = %s
        ORDER BY title
    """
    folders = db.fetch_all(folders_query, [parent_id])

    # Get all descendant pages
    # depth = 1: direct children (sprint folders like [Sprint08])
    # depth > 1: pages inside sprint folders
    # We want pages inside sprint folders (depth > 1), but also need
    # to handle the case where parent IS a sprint folder
    pages_query = """
        WITH RECURSIVE descendants AS (
            SELECT id, title, parent_id, body_storage, 1 as depth
            FROM confluence_v2_content
            WHERE parent_id = %s

            UNION ALL

            SELECT c.id, c.title, c.parent_id, c.body_storage, d.depth + 1
            FROM confluence_v2_content c
            JOIN descendants d ON c.parent_id = d.id
            WHERE d.depth < 10
        )
        SELECT d.id, d.title, d.parent_id, d.body_storage,
               p.title as parent_title
        FROM descendants d
        LEFT JOIN confluence_v2_content p ON d.parent_id = p.id
        WHERE d.depth >= 1
          AND d.id NOT IN (
              -- Exclude sprint folder containers (depth 1)
              SELECT id FROM descendants WHERE depth = 1
              AND (title ~ '^\\[?(Scaled-?)?Sprint' OR title ~ '^\\[Sprint')
          )
        ORDER BY d.title
    """
    pages = db.fetch_all(pages_query, [parent_id])

    return {
        'id': parent_id,
        'title': parent['title'],
        'space_id': space_id,
    }, pages, folders


def cmd_analyze(args):
    """Analyze and classify pages under parent."""
    parent_title = args.parent
    space_key = args.space

    print(f"Analyzing pages under: {parent_title}")

    parent_info, pages, folders = get_confluence_pages(parent_title, space_key)

    if not parent_info:
        return 1

    print(f"\nFound {len(pages)} pages in {len(folders)} folders")

    # Classify pages
    classifier = DocumentClassifier()
    classified = classifier.classify_batch(pages)

    # Summary
    summary = classifier.get_classification_summary(classified)

    print("\n--- Classification Summary ---")
    for doc_type, count in sorted(summary.items(), key=lambda x: -x[1]):
        folder_name = FOLDER_NAMES.get(doc_type, 'Unknown')
        print(f"  {doc_type:20} -> {folder_name:25} ({count} pages)")

    # Show low confidence items
    if args.verbose:
        print("\n--- Low Confidence Classifications ---")
        low_conf = [(p, r) for p, r in classified if r.confidence < 0.5]
        for page, result in low_conf[:20]:
            print(f"  [{result.confidence:.0%}] {page.get('title', '')}")
            print(f"        Type: {result.doc_type.value}")

    # Similarity analysis
    if args.similarity:
        print("\n--- Similarity Analysis ---")
        analyzer = SimilarityAnalyzer()
        groups = analyzer.group_similar(pages)

        if groups:
            print(f"Found {len(groups)} groups of similar pages:")
            for group in groups[:10]:
                print(f"\n  Group (similarity: {group.avg_similarity:.0%}, recommend: {group.recommendation}):")
                for title in group.page_titles:
                    print(f"    - {title}")
        else:
            print("No similar page groups found.")

    return 0


def cmd_propose(args):
    """Generate restructure proposal."""
    parent_title = args.parent
    space_key = args.space

    print(f"Generating proposal for: {parent_title}")

    parent_info, pages, folders = get_confluence_pages(parent_title, space_key)

    if not parent_info:
        return 1

    print(f"Found {len(pages)} pages in {len(folders)} folders")

    # Create proposer with specified strategy
    proposer = StructureProposer(context_strategy=args.context_strategy)

    # Generate proposal
    proposal = proposer.propose(
        parent_id=parent_info['id'],
        parent_title=parent_info['title'],
        space_id=parent_info['space_id'],
        pages=pages,
        existing_folders=folders,
    )

    # Generate preview
    preview = proposer.generate_preview(proposal)
    print(preview)

    # Save to file if requested
    if args.output:
        proposer.save_preview(proposal, args.output)
        print(f"\nProposal saved to: {args.output}")

    return 0


def cmd_plan(args):
    """Create operations in content_operations table."""
    parent_title = args.parent
    space_key = args.space
    dry_run = args.dry_run

    print(f"Creating operation plan for: {parent_title}")

    parent_info, pages, folders = get_confluence_pages(parent_title, space_key)

    if not parent_info:
        return 1

    # Generate proposal
    proposer = StructureProposer(context_strategy=args.context_strategy)
    proposal = proposer.propose(
        parent_id=parent_info['id'],
        parent_title=parent_info['title'],
        space_id=parent_info['space_id'],
        pages=pages,
        existing_folders=folders,
    )

    # Create plan
    with db.connection() as conn:
        planner = OperationPlanner(db_connection=conn)
        plan = planner.create_plan(proposal)

        # Show summary
        summary = planner.generate_summary(plan)
        print(summary)

        # Save to database
        if dry_run:
            print("\n[DRY-RUN] No operations saved.")
            op_ids = planner.save_to_db(plan, created_by='cli', dry_run=True)
        else:
            op_ids = planner.save_to_db(plan, created_by='cli')
            print(f"\nCreated {len(op_ids)} operations (status: pending)")

    return 0


def cmd_approve(args):
    """Approve pending operations."""
    with db.connection() as conn:
        planner = OperationPlanner(db_connection=conn)

        if args.all:
            # Approve all pending restructure operations
            cur = conn.cursor()
            cur.execute("""
                UPDATE content_operations
                SET status = 'approved', approved_by = %s, approved_at = NOW()
                WHERE target_type = 'confluence'
                  AND operation_type IN ('create_folder', 'restructure', 'archive', 'add_link')
                  AND status = 'pending'
            """, ['cli'])
            count = cur.rowcount
            conn.commit()
            print(f"Approved {count} operations")

        elif args.operation_id:
            cur = conn.cursor()
            cur.execute("""
                UPDATE content_operations
                SET status = 'approved', approved_by = %s, approved_at = NOW()
                WHERE id = %s AND status = 'pending'
            """, ['cli', args.operation_id])
            if cur.rowcount > 0:
                conn.commit()
                print(f"Approved operation: {args.operation_id}")
            else:
                print(f"Operation not found or not pending: {args.operation_id}")
                return 1

        else:
            print("Specify --all or provide an operation ID")
            return 1

    return 0


def cmd_list(args):
    """List pending restructure operations."""
    with db.connection() as conn:
        planner = OperationPlanner(db_connection=conn)
        pending = planner.list_pending()

        if not pending:
            print("No pending restructure operations")
            return 0

        print(f"\nPending Restructure Operations ({len(pending)}):")
        print("-" * 80)

        for op in pending:
            op_id = str(op['id'])[:8]
            op_type = op['operation_type']
            targets = len(op['target_ids'])
            created = op['created_at'].strftime('%Y-%m-%d %H:%M')

            preview = op.get('preview_data') or {}
            action = preview.get('action', '')

            print(f"{op_id}...  {op_type:15} {targets:3} targets  {created}  [{action}]")

    return 0


def run(args):
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        prog='javis restructure',
        description='Confluence Sprint Page Restructuring Tool'
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # analyze command
    p_analyze = subparsers.add_parser('analyze', help='Analyze and classify pages')
    p_analyze.add_argument('--parent', '-p', required=True, help='Parent page title')
    p_analyze.add_argument('--space', '-s', help='Space key')
    p_analyze.add_argument('--verbose', '-v', action='store_true', help='Show details')
    p_analyze.add_argument('--similarity', action='store_true', help='Run similarity analysis')

    # propose command
    p_propose = subparsers.add_parser('propose', help='Generate restructure proposal')
    p_propose.add_argument('--parent', '-p', required=True, help='Parent page title')
    p_propose.add_argument('--space', '-s', help='Space key')
    p_propose.add_argument('--output', '-o', help='Output file path')
    p_propose.add_argument('--context-strategy', default='append-parent-name',
                          choices=['append-parent-name', 'preserve-context', 'append-suffix'],
                          help='Naming strategy for context preservation')

    # plan command
    p_plan = subparsers.add_parser('plan', help='Create operation plan')
    p_plan.add_argument('--parent', '-p', required=True, help='Parent page title')
    p_plan.add_argument('--space', '-s', help='Space key')
    p_plan.add_argument('--dry-run', action='store_true', help='Preview only')
    p_plan.add_argument('--context-strategy', default='append-parent-name',
                       choices=['append-parent-name', 'preserve-context', 'append-suffix'],
                       help='Naming strategy for context preservation')

    # approve command
    p_approve = subparsers.add_parser('approve', help='Approve pending operations')
    p_approve.add_argument('--all', action='store_true', help='Approve all pending')
    p_approve.add_argument('operation_id', nargs='?', help='Specific operation ID')

    # list command
    p_list = subparsers.add_parser('list', help='List pending operations')

    # Parse args
    parsed = parser.parse_args(args)

    if not parsed.command:
        parser.print_help()
        return 0

    # Dispatch to command handler
    handlers = {
        'analyze': cmd_analyze,
        'propose': cmd_propose,
        'plan': cmd_plan,
        'approve': cmd_approve,
        'list': cmd_list,
    }

    handler = handlers.get(parsed.command)
    if handler:
        return handler(parsed)
    else:
        parser.print_help()
        return 1


if __name__ == '__main__':
    sys.exit(run(sys.argv[1:]))
