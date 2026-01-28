"""
Context command - View current work context.

Usage:
  javis context                 # Full context summary
  javis context --active        # Only in-progress items
  javis context --attention     # Items needing attention
  javis context --issue ASP-123 # Context for specific issue
  javis context --json          # Output as JSON
"""

import argparse
import json
import sys

sys.path.insert(0, __file__.rsplit('/', 2)[0])
from lib.context_aggregator import ContextAggregator
from lib import db


def format_issue_context(ctx: dict) -> str:
    """Format issue context for display."""
    lines = []

    if 'error' in ctx:
        return f"Error: {ctx['error']}"

    issue = ctx.get('issue', {})

    lines.append("=" * 60)
    lines.append(f"ISSUE: {issue.get('key')}")
    lines.append("=" * 60)

    lines.append(f"\nSummary: {issue.get('summary')}")
    lines.append(f"Status: {issue.get('status')}")
    lines.append(f"Priority: {issue.get('priority', 'None')}")
    lines.append(f"Assignee: {issue.get('assignee', 'Unassigned')}")
    lines.append(f"Project: {issue.get('project')}")

    labels = issue.get('labels', [])
    if labels:
        lines.append(f"Labels: {', '.join(labels)}")

    tags = ctx.get('tags', [])
    if tags:
        lines.append(f"Tags: {', '.join(tags)}")

    # Linked issues
    linked = ctx.get('linked_issues', [])
    if linked:
        lines.append("\nLinked Issues:")
        for link in linked:
            lines.append(f"  {link['relation']}: {link['key']}")

    # Commits
    commits = ctx.get('commits', [])
    if commits:
        lines.append(f"\nRecent Commits ({len(commits)}):")
        for c in commits[:5]:
            msg = c['message'].split('\n')[0][:50] if c.get('message') else ''
            lines.append(f"  {c['hash']}: {msg}...")

    # PRs
    prs = ctx.get('pull_requests', [])
    if prs:
        lines.append(f"\nPull Requests ({len(prs)}):")
        for pr in prs:
            lines.append(f"  #{pr['number']} [{pr['state']}]: {pr['title'][:40]}...")

    return "\n".join(lines)


def run(args):
    """Run context command."""
    parser = argparse.ArgumentParser(prog='javis context', description='View work context')
    parser.add_argument('--active', action='store_true',
                        help='Show only in-progress items')
    parser.add_argument('--attention', action='store_true',
                        help='Show items needing attention')
    parser.add_argument('--issue', type=str, metavar='KEY',
                        help='Show context for specific issue')
    parser.add_argument('--project', type=str,
                        help='Filter by project')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')

    parsed = parser.parse_args(args)

    try:
        aggregator = ContextAggregator(parsed.project)

        if parsed.issue:
            # Specific issue context
            ctx = aggregator.get_issue_context(parsed.issue)

            if parsed.json:
                print(json.dumps(ctx, indent=2, default=str))
            else:
                print(format_issue_context(ctx))

        elif parsed.active:
            # Only in-progress items
            items = aggregator.get_in_progress()

            if parsed.json:
                print(json.dumps(items, indent=2, default=str))
            else:
                print("=" * 60)
                print(f"IN PROGRESS ({len(items)} items)")
                print("=" * 60)
                for item in items:
                    assignee = item.get('assignee') or 'Unassigned'
                    print(f"  {item['key']}: {item['summary'][:50]}... ({assignee})")

        elif parsed.attention:
            # Items needing attention
            items = aggregator.get_attention_items()

            if parsed.json:
                print(json.dumps(items, indent=2, default=str))
            else:
                print("=" * 60)
                print(f"NEEDS ATTENTION ({len(items)} items)")
                print("=" * 60)

                blocked = [i for i in items if i['type'] == 'blocked']
                stale = [i for i in items if i['type'] == 'stale']
                reviews = [i for i in items if i['type'] == 'review']

                if blocked:
                    print("\n[BLOCKED]")
                    for item in blocked:
                        print(f"  {item['key']}: {item['summary'][:50]}...")

                if stale:
                    print("\n[STALE - No updates for 7+ days]")
                    for item in stale:
                        print(f"  {item['key']}: {item['summary'][:50]}...")

                if reviews:
                    print("\n[NEEDS REVIEW]")
                    for item in reviews:
                        print(f"  PR #{item.get('pr_number')} in {item.get('repo')}: {item.get('title', '')[:40]}...")

        else:
            # Full context
            if parsed.json:
                ctx = aggregator.get_full_context()
                print(json.dumps(ctx, indent=2, default=str))
            else:
                print(aggregator.format_for_display())

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run(sys.argv[1:])
