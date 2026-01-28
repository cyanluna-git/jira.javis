"""
Suggest command - AI-powered work recommendations.

Usage:
  javis suggest                     # Get 3 work suggestions
  javis suggest --focus blocked     # Focus on blocked items
  javis suggest --focus pr-review   # Focus on PR reviews
  javis suggest --count 5           # Get 5 suggestions
  javis suggest --project ASP       # Filter by project
  javis suggest --analyze ASP-123   # Analyze specific issue
"""

import argparse
import json
import sys

sys.path.insert(0, __file__.rsplit('/', 2)[0])
from lib.context_aggregator import ContextAggregator
from lib import ai_client


def format_suggestions(result: dict) -> str:
    """Format AI suggestions for display."""
    lines = []

    if 'error' in result:
        return f"Error: {result['error']}"

    if 'raw_response' in result:
        return f"Raw AI Response:\n{result['raw_response']}"

    # Summary
    if result.get('summary'):
        lines.append("=" * 60)
        lines.append("SITUATION")
        lines.append("=" * 60)
        lines.append(result['summary'])

    # Suggestions
    suggestions = result.get('suggestions', [])
    if suggestions:
        lines.append("\n" + "=" * 60)
        lines.append("RECOMMENDED NEXT ACTIONS")
        lines.append("=" * 60)

        for i, s in enumerate(suggestions, 1):
            priority = s.get('priority', 'medium').upper()
            effort = s.get('estimated_effort', '')

            lines.append(f"\n{i}. [{priority}] {s.get('title', 'No title')}")
            lines.append(f"   {s.get('description', '')}")

            if s.get('rationale'):
                lines.append(f"   Why: {s['rationale']}")

            related = s.get('related_items', [])
            if related:
                lines.append(f"   Related: {', '.join(related)}")

            if effort:
                lines.append(f"   Effort: {effort}")

    tokens = result.get('tokens_used')
    if tokens:
        lines.append(f"\n[Tokens used: {tokens}]")

    return "\n".join(lines)


def format_analysis(result: dict) -> str:
    """Format issue analysis for display."""
    lines = []

    if 'error' in result:
        return f"Error: {result['error']}"

    lines.append("=" * 60)
    lines.append("ISSUE ANALYSIS")
    lines.append("=" * 60)

    if result.get('status_assessment'):
        lines.append(f"\nStatus: {result['status_assessment']}")

    blockers = result.get('blockers', [])
    if blockers:
        lines.append("\nBlockers:")
        for b in blockers:
            lines.append(f"  - {b}")

    next_steps = result.get('next_steps', [])
    if next_steps:
        lines.append("\nNext Steps:")
        for i, step in enumerate(next_steps, 1):
            lines.append(f"  {i}. {step}")

    related = result.get('related_work', [])
    if related:
        lines.append("\nRelated Work:")
        for r in related:
            lines.append(f"  - {r}")

    risks = result.get('risks', [])
    if risks:
        lines.append("\nRisks:")
        for r in risks:
            lines.append(f"  - {r}")

    return "\n".join(lines)


def run(args):
    """Run suggest command."""
    parser = argparse.ArgumentParser(prog='javis suggest', description='Get AI work suggestions')
    parser.add_argument('--focus', choices=['blocked', 'pr-review', 'stale'],
                        help='Focus area for suggestions')
    parser.add_argument('--count', type=int, default=3,
                        help='Number of suggestions (default: 3)')
    parser.add_argument('--project', type=str,
                        help='Filter by project')
    parser.add_argument('--analyze', type=str, metavar='ISSUE_KEY',
                        help='Analyze specific issue')
    parser.add_argument('--json', action='store_true',
                        help='Output raw JSON')

    parsed = parser.parse_args(args)

    try:
        if parsed.analyze:
            # Analyze specific issue
            print(f"Analyzing {parsed.analyze}...")
            result = ai_client.analyze_issue(parsed.analyze)

            if parsed.json:
                print(json.dumps(result, indent=2, default=str))
            else:
                print(format_analysis(result))
        else:
            # Get work suggestions
            print("Gathering context...")
            aggregator = ContextAggregator(parsed.project)
            context = aggregator.get_full_context()

            print("Generating suggestions...")
            result = ai_client.suggest_work(context, parsed.focus, parsed.count)

            if parsed.json:
                print(json.dumps(result, indent=2, default=str))
            else:
                print(format_suggestions(result))

    except ValueError as e:
        print(f"Configuration error: {e}")
        print("\nMake sure AI provider is configured in .env:")
        print("  AI_PROVIDER=claude")
        print("  ANTHROPIC_API_KEY=sk-ant-...")
        print("or:")
        print("  AI_PROVIDER=openai")
        print("  OPENAI_API_KEY=sk-...")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run(sys.argv[1:])
