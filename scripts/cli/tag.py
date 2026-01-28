"""
Tag command - Lightweight tagging system for issues.

Usage:
  javis tag list                    # List all tags
  javis tag create urgent --color red  # Create new tag
  javis tag ASP-123 urgent          # Add tag to issue
  javis tag ASP-123 --remove urgent # Remove tag from issue
  javis tag search urgent           # Find issues with tag
  javis tag show ASP-123            # Show tags for issue
"""

import argparse
import sys

sys.path.insert(0, __file__.rsplit('/', 2)[0])
from lib import db


# Color name to hex mapping
COLOR_MAP = {
    'red': '#EF4444',
    'orange': '#F59E0B',
    'yellow': '#EAB308',
    'green': '#10B981',
    'blue': '#3B82F6',
    'purple': '#8B5CF6',
    'pink': '#EC4899',
    'gray': '#6B7280',
    'grey': '#6B7280',
}


def run(args):
    """Run tag command."""
    parser = argparse.ArgumentParser(prog='javis tag', description='Manage tags')
    parser.add_argument('action', nargs='?',
                        help='Action: list, create, search, show, or ISSUE_KEY')
    parser.add_argument('target', nargs='?',
                        help='Tag name or issue key')
    parser.add_argument('--color', type=str, default='gray',
                        help='Tag color (name or hex)')
    parser.add_argument('--description', type=str,
                        help='Tag description')
    parser.add_argument('--remove', action='store_true',
                        help='Remove tag from issue')

    parsed = parser.parse_args(args)

    if not parsed.action:
        parser.print_help()
        return

    action = parsed.action.lower()

    try:
        if action == 'list':
            # List all tags
            tags = db.get_all_tags()

            if not tags:
                print("No tags defined. Create one with: javis tag create <name>")
                return

            print("=" * 60)
            print("WORK TAGS")
            print("=" * 60)

            for tag in tags:
                desc = f" - {tag['description']}" if tag.get('description') else ""
                print(f"  [{tag['color']}] {tag['name']}{desc}")

            print(f"\nTotal: {len(tags)} tags")

        elif action == 'create':
            # Create new tag
            if not parsed.target:
                print("Usage: javis tag create <name> [--color <color>] [--description <desc>]")
                sys.exit(1)

            name = parsed.target
            color = COLOR_MAP.get(parsed.color.lower(), parsed.color)

            # Validate color format
            if not color.startswith('#'):
                color = '#6B7280'  # Default gray

            tag = db.create_tag(name, color, parsed.description)

            if tag:
                print(f"Created tag: {name} ({color})")
            else:
                print(f"Tag '{name}' already exists")

        elif action == 'search':
            # Search issues by tag
            if not parsed.target:
                print("Usage: javis tag search <tag_name>")
                sys.exit(1)

            tag_name = parsed.target
            issues = db.get_issues_by_tag(tag_name)

            if not issues:
                print(f"No issues found with tag '{tag_name}'")
                return

            print("=" * 60)
            print(f"ISSUES TAGGED: {tag_name}")
            print("=" * 60)

            for issue in issues:
                print(f"  {issue['key']}: {issue['summary'][:50]}... [{issue['status']}]")

            print(f"\nTotal: {len(issues)} issues")

        elif action == 'show':
            # Show tags for an issue
            if not parsed.target:
                print("Usage: javis tag show <ISSUE_KEY>")
                sys.exit(1)

            issue_key = parsed.target.upper()
            tags = db.get_issue_tags(issue_key)

            if not tags:
                print(f"No tags on {issue_key}")
                return

            print(f"Tags on {issue_key}:")
            for tag in tags:
                print(f"  - {tag['name']}")

        else:
            # Assume action is an issue key
            issue_key = parsed.action.upper()

            if not parsed.target:
                # Show tags for issue
                tags = db.get_issue_tags(issue_key)

                if not tags:
                    print(f"No tags on {issue_key}")
                else:
                    print(f"Tags on {issue_key}:")
                    for tag in tags:
                        print(f"  - {tag['name']}")
                return

            tag_name = parsed.target

            if parsed.remove:
                # Remove tag from issue
                if db.remove_issue_tag(issue_key, tag_name):
                    print(f"Removed tag '{tag_name}' from {issue_key}")
                else:
                    print(f"Tag '{tag_name}' not found on {issue_key}")
            else:
                # Add tag to issue
                # First verify the issue exists
                issue = db.fetch_one("SELECT key FROM jira_issues WHERE key = %s", [issue_key])
                if not issue:
                    print(f"Issue {issue_key} not found in database")
                    sys.exit(1)

                if db.add_issue_tag(issue_key, tag_name):
                    print(f"Tagged {issue_key} with '{tag_name}'")
                else:
                    # Tag doesn't exist, offer to create it
                    print(f"Tag '{tag_name}' not found.")
                    create = input("Create it? [y/N]: ").strip().lower()
                    if create == 'y':
                        db.create_tag(tag_name)
                        db.add_issue_tag(issue_key, tag_name)
                        print(f"Created tag and tagged {issue_key}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run(sys.argv[1:])
