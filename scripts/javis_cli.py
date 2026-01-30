#!/usr/bin/env python3
"""
Javis CLI - Work-First Planning System

A bottom-up approach to work planning:
"What should I do next?" -> AI analyzes context -> Specific recommendations

Usage:
  javis suggest                     # Get AI work suggestions
  javis suggest --focus blocked     # Focus on blocked items
  javis suggest --analyze ASP-123   # Analyze specific issue

  javis context                     # View current work context
  javis context --active            # Only in-progress items
  javis context --attention         # Items needing attention

  javis tag list                    # List all tags
  javis tag create urgent           # Create new tag
  javis tag ASP-123 urgent          # Add tag to issue
  javis tag search urgent           # Find issues with tag

  javis sync all                    # Sync all data sources
  javis sync jira                   # Sync Jira issues
  javis sync bitbucket              # Sync Bitbucket data
"""

import sys
import os

# Add scripts directory to path for imports
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)


COMMANDS = {
    'suggest': 'cli.suggest',
    'context': 'cli.context',
    'tag': 'cli.tag',
    'sync': 'cli.sync',
    'slack': 'cli.slack',
    'restructure': 'sprint_restructure.cli',
}

HELP_TEXT = """
Javis CLI - Work-First Planning System

Commands:
  suggest     Get AI-powered work recommendations
  context     View current work context
  tag         Manage lightweight issue tags
  sync        Sync data from external sources
  slack       Slack integration (test, alerts, notifications)
  restructure Reorganize Confluence pages by document type

Examples:
  javis suggest                     Get 3 work suggestions
  javis suggest --focus blocked     Focus on blocked items
  javis context --attention         Show items needing attention
  javis tag ASP-123 urgent          Tag an issue
  javis sync all                    Sync all data sources
  javis slack test                  Send test message to Slack
  javis slack risk                  Send risk alerts to Slack
  javis restructure analyze -p "Sprint-Tumalo"    Analyze pages
  javis restructure propose -p "Sprint-Tumalo"    Generate proposal
  javis restructure plan -p "Sprint-Tumalo"       Create operations

Use 'javis <command> --help' for detailed help on each command.
"""


def main():
    if len(sys.argv) < 2:
        print(HELP_TEXT)
        sys.exit(0)

    command = sys.argv[1].lower()

    if command in ('--help', '-h', 'help'):
        print(HELP_TEXT)
        sys.exit(0)

    if command == '--version':
        print("javis-cli 1.0.0")
        sys.exit(0)

    if command not in COMMANDS:
        print(f"Unknown command: {command}")
        print(f"Available commands: {', '.join(COMMANDS.keys())}")
        print("\nUse 'javis --help' for usage information.")
        sys.exit(1)

    # Import and run the command module
    module_name = COMMANDS[command]

    try:
        module = __import__(module_name, fromlist=['run'])
        module.run(sys.argv[2:])
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(130)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
