#!/usr/bin/env python3
"""
Auto-labeling script for Confluence pages.

This script analyzes Confluence pages and suggests/applies labels based on:
- Content pattern matching (regex patterns in label taxonomy)
- AI-based content analysis (using Claude)
- Existing label synonyms

Usage:
    python scripts/auto_label_confluence.py --preview    # Show suggested labels
    python scripts/auto_label_confluence.py --apply      # Apply labels to Confluence
    python scripts/auto_label_confluence.py --ai         # Use AI for analysis
    python scripts/auto_label_confluence.py --page PAGE_ID  # Single page
"""

import argparse
import json
import re
import sys
from typing import Dict, List, Optional, Set
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, '.')
from scripts.lib import db, config
from scripts.lib.ai_client import AIClient


class ConfluenceAutoLabeler:
    """Auto-labeler for Confluence pages."""

    def __init__(self, use_ai: bool = False, verbose: bool = False):
        self.use_ai = use_ai
        self.verbose = verbose
        self.ai_client = None
        self.taxonomy = self._load_taxonomy()

    def _log(self, message: str) -> None:
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(f"  {message}")

    def _get_ai_client(self) -> AIClient:
        """Lazy initialization of AI client."""
        if self.ai_client is None:
            self.ai_client = AIClient()
        return self.ai_client

    def _load_taxonomy(self) -> Dict[str, Dict]:
        """Load label taxonomy from database."""
        query = """
            SELECT label_name, category, color, keyword_patterns, synonyms, is_auto_suggested
            FROM confluence_label_taxonomy
            ORDER BY category, label_name
        """
        rows = db.fetch_all(query)

        taxonomy = {}
        for row in rows:
            taxonomy[row['label_name']] = {
                'category': row['category'],
                'color': row['color'],
                'patterns': row['keyword_patterns'] or [],
                'synonyms': row['synonyms'] or [],
                'is_auto': row['is_auto_suggested']
            }

        print(f"Loaded {len(taxonomy)} labels in taxonomy")
        return taxonomy

    def get_pages_to_label(self, page_id: Optional[str] = None, limit: int = 100) -> List[Dict]:
        """Get pages that need labeling."""
        if page_id:
            query = """
                SELECT id, title, body_storage, labels
                FROM confluence_v2_content
                WHERE id = %s
            """
            return db.fetch_all(query, [page_id])
        else:
            # Get pages with no or few labels
            query = """
                SELECT id, title, body_storage, labels
                FROM confluence_v2_content
                WHERE type = 'page'
                  AND (labels IS NULL OR array_length(labels, 1) < 2)
                ORDER BY last_synced_at DESC
                LIMIT %s
            """
            return db.fetch_all(query, [limit])

    def suggest_labels_for_page(self, page: Dict) -> Dict[str, List[str]]:
        """
        Suggest labels for a page.

        Returns dict with:
        - add: labels to add
        - remove: labels that might be incorrect
        - keep: existing labels that are correct
        """
        current_labels = set(page.get('labels') or [])
        content = (page['title'] + ' ' + (page['body_storage'] or '')).lower()

        suggested_add = set()
        suggested_remove = set()

        # Pattern-based matching
        for label, info in self.taxonomy.items():
            if not info['is_auto']:
                continue

            matched = False

            # Check regex patterns
            for pattern in info['patterns']:
                try:
                    if re.search(pattern, content, re.I):
                        matched = True
                        break
                except re.error:
                    pass

            # Check synonyms
            if not matched:
                for synonym in info['synonyms']:
                    if synonym.lower() in content:
                        matched = True
                        break

            if matched and label not in current_labels:
                suggested_add.add(label)

        # AI-based analysis if enabled
        if self.use_ai and (len(suggested_add) < 2 or len(content) > 500):
            ai_labels = self._ai_suggest_labels(page)
            for label in ai_labels:
                if label in self.taxonomy and label not in current_labels:
                    suggested_add.add(label)

        return {
            'add': list(suggested_add)[:5],  # Max 5 new labels
            'remove': list(suggested_remove),
            'keep': list(current_labels - suggested_remove),
            'all_suggested': list(suggested_add)
        }

    def _ai_suggest_labels(self, page: Dict) -> List[str]:
        """Use AI to suggest labels for a page."""
        try:
            ai = self._get_ai_client()

            # Build available labels list
            available_labels = [
                f"- {name} ({info['category']}): {', '.join(info['synonyms'][:3])}"
                for name, info in self.taxonomy.items()
                if info['is_auto']
            ]

            prompt = f"""Analyze this Confluence page and suggest appropriate labels.

Title: {page['title']}
Content: {(page['body_storage'] or '')[:2000]}

Available labels (format: name (category): synonyms):
{chr(10).join(available_labels[:20])}

Respond with JSON:
{{
    "suggested_labels": ["label1", "label2"],
    "reasoning": "Brief explanation"
}}

Only suggest labels from the available list. Choose 1-5 most relevant labels."""

            response = ai._call_api(prompt)

            if isinstance(response, dict) and 'suggested_labels' in response:
                return response['suggested_labels']
        except Exception as e:
            self._log(f"AI suggestion error: {e}")

        return []

    def preview_labels(self, pages: List[Dict]) -> Dict[str, List[Dict]]:
        """Preview label suggestions for multiple pages."""
        results = []
        stats = defaultdict(int)

        for page in pages:
            suggestions = self.suggest_labels_for_page(page)

            if suggestions['add']:
                results.append({
                    'id': page['id'],
                    'title': page['title'],
                    'current_labels': page.get('labels') or [],
                    'suggested_add': suggestions['add'],
                    'suggested_remove': suggestions['remove'],
                })

                for label in suggestions['add']:
                    stats[label] += 1

                self._log(f"{page['title'][:40]}: +{suggestions['add']}")

        return {
            'pages': results,
            'label_stats': dict(stats),
            'total_pages': len(pages),
            'pages_with_suggestions': len(results)
        }

    def apply_labels(self, pages: List[Dict], dry_run: bool = True) -> Dict[str, int]:
        """Apply suggested labels to pages (updates local DB only)."""
        applied = 0
        skipped = 0

        for page in pages:
            suggestions = self.suggest_labels_for_page(page)

            if not suggestions['add']:
                skipped += 1
                continue

            current = set(page.get('labels') or [])
            new_labels = list(current | set(suggestions['add']))

            if dry_run:
                print(f"[DRY RUN] {page['title'][:40]}: {suggestions['add']}")
            else:
                # Update local database
                query = """
                    UPDATE confluence_v2_content
                    SET labels = %s
                    WHERE id = %s
                """
                db.execute(query, [new_labels, page['id']])
                applied += 1
                self._log(f"Applied labels to {page['title'][:40]}")

        return {
            'applied': applied,
            'skipped': skipped,
            'dry_run': dry_run
        }

    def create_label_suggestions(self, pages: List[Dict]) -> int:
        """Create AI suggestions in the database for label changes."""
        count = 0

        for page in pages:
            suggestions = self.suggest_labels_for_page(page)

            if not suggestions['add']:
                continue

            # Create suggestion record
            query = """
                INSERT INTO confluence_ai_suggestions
                (suggestion_type, target_page_ids, confidence_score, ai_reasoning, suggested_action)
                VALUES (%s, %s, %s, %s, %s)
            """

            try:
                db.execute(query, [
                    'label',
                    [page['id']],
                    0.75,
                    f"Auto-suggested labels based on content analysis: {', '.join(suggestions['add'])}",
                    json.dumps({
                        'page_id': page['id'],
                        'add_labels': suggestions['add'],
                        'remove_labels': suggestions['remove'],
                        'reasoning': 'Pattern matching and AI analysis'
                    })
                ])
                count += 1
            except Exception as e:
                self._log(f"Error creating suggestion: {e}")

        return count


def print_taxonomy_summary(taxonomy: Dict) -> None:
    """Print summary of label taxonomy."""
    by_category = defaultdict(list)
    for name, info in taxonomy.items():
        by_category[info['category']].append(name)

    print("\n=== Label Taxonomy ===")
    for category, labels in sorted(by_category.items()):
        print(f"\n{category}:")
        for label in sorted(labels):
            patterns = taxonomy[label]['patterns'][:2]
            print(f"  - {label} (patterns: {patterns})")


def main():
    parser = argparse.ArgumentParser(description="Auto-label Confluence pages")
    parser.add_argument('--preview', action='store_true', help='Preview suggestions')
    parser.add_argument('--apply', action='store_true', help='Apply labels to local DB')
    parser.add_argument('--create-suggestions', action='store_true',
                        help='Create suggestions in DB for review')
    parser.add_argument('--ai', action='store_true', help='Use AI for analysis')
    parser.add_argument('--page', type=str, help='Single page ID to analyze')
    parser.add_argument('--limit', type=int, default=50, help='Max pages to process')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--show-taxonomy', action='store_true', help='Show label taxonomy')
    parser.add_argument('--dry-run', action='store_true', help='Dry run for apply')
    args = parser.parse_args()

    labeler = ConfluenceAutoLabeler(use_ai=args.ai, verbose=args.verbose)

    if args.show_taxonomy:
        print_taxonomy_summary(labeler.taxonomy)
        return

    # Get pages to process
    print("Fetching pages...")
    pages = labeler.get_pages_to_label(args.page, args.limit)
    print(f"Found {len(pages)} pages to analyze")

    if not pages:
        print("No pages to process.")
        return

    if args.preview or (not args.apply and not args.create_suggestions):
        # Preview mode (default)
        result = labeler.preview_labels(pages)

        print(f"\n=== Preview Results ===")
        print(f"Total pages analyzed: {result['total_pages']}")
        print(f"Pages with suggestions: {result['pages_with_suggestions']}")

        if result['label_stats']:
            print(f"\nLabel frequency:")
            for label, count in sorted(result['label_stats'].items(), key=lambda x: -x[1]):
                print(f"  {label}: {count}")

        if args.verbose and result['pages']:
            print(f"\nDetailed suggestions:")
            for p in result['pages'][:20]:
                print(f"  {p['title'][:50]}")
                print(f"    Current: {p['current_labels']}")
                print(f"    Add: {p['suggested_add']}")

    elif args.apply:
        # Apply labels to local DB
        result = labeler.apply_labels(pages, dry_run=args.dry_run)
        print(f"\n=== Apply Results ===")
        print(f"Applied: {result['applied']}")
        print(f"Skipped: {result['skipped']}")
        if result['dry_run']:
            print("(Dry run - no changes made)")

    elif args.create_suggestions:
        # Create suggestions for review
        count = labeler.create_label_suggestions(pages)
        print(f"\nCreated {count} label suggestions in database")


if __name__ == '__main__':
    main()
