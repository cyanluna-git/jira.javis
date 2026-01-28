#!/usr/bin/env python3
"""
AI-powered analysis of Confluence pages for refactoring suggestions.

This script analyzes Confluence pages to detect:
- Duplicate/similar content (merge candidates)
- Stale/outdated content (update candidates)
- Misplaced pages (restructure candidates)
- Missing labels (label candidates)
- Obsolete pages (archive candidates)

Usage:
    python scripts/analyze_confluence_ai.py --type duplicates [--limit 50]
    python scripts/analyze_confluence_ai.py --type staleness [--days 180]
    python scripts/analyze_confluence_ai.py --type labels [--limit 20]
    python scripts/analyze_confluence_ai.py --type all
"""

import argparse
import json
import sys
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, '.')
from scripts.lib import db, config
from scripts.lib.ai_client import AIClient


class ConfluenceAIAnalyzer:
    """AI analyzer for Confluence content."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.ai_client = None

    def _get_ai_client(self) -> AIClient:
        """Lazy initialization of AI client."""
        if self.ai_client is None:
            self.ai_client = AIClient()
        return self.ai_client

    def _log(self, message: str) -> None:
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(f"  {message}")

    # ============================================
    # Duplicate Detection
    # ============================================

    def analyze_for_duplicates(self, limit: int = 50) -> List[Dict]:
        """
        Find potentially duplicate pages using title similarity and content overlap.

        Uses PostgreSQL pg_trgm for title similarity and AI for content validation.
        """
        print("=== Analyzing for Duplicates ===")

        # Step 1: Find similar titles using trigram similarity
        similar_pairs = self._find_similar_titles(limit)
        print(f"Found {len(similar_pairs)} similar title pairs")

        if not similar_pairs:
            return []

        # Step 2: Validate with AI for high-similarity pairs
        suggestions = []
        for pair in similar_pairs:
            page1_id, page2_id, title_sim = pair['page1_id'], pair['page2_id'], pair['similarity']

            if title_sim >= 0.7:
                self._log(f"Analyzing pair: {pair['title1'][:30]} <-> {pair['title2'][:30]} (sim: {title_sim:.2f})")

                # Get page content
                pages = self._get_pages_by_ids([page1_id, page2_id])
                if len(pages) < 2:
                    continue

                # Use AI to determine if they should be merged
                ai_result = self._ai_validate_merge(pages[0], pages[1])

                if ai_result and ai_result.get('should_merge', False):
                    suggestion = {
                        'suggestion_type': 'merge',
                        'target_page_ids': [page1_id, page2_id],
                        'confidence_score': ai_result.get('confidence', 0.7),
                        'ai_reasoning': ai_result.get('reasoning', ''),
                        'suggested_action': {
                            'primary_page_id': ai_result.get('primary_page_id', page1_id),
                            'secondary_page_ids': [page2_id if ai_result.get('primary_page_id', page1_id) == page1_id else page1_id],
                            'merged_title': ai_result.get('merged_title', pages[0]['title']),
                            'merge_strategy': ai_result.get('merge_strategy', 'append'),
                        }
                    }
                    suggestions.append(suggestion)
                    self._log(f"  -> Merge suggested: {suggestion['ai_reasoning'][:60]}...")

        return suggestions

    def _find_similar_titles(self, limit: int) -> List[Dict]:
        """Find pages with similar titles using PostgreSQL trigram similarity."""
        # First check if pg_trgm extension is available
        try:
            db.fetch_one("SELECT 'test' % 'test'")
        except Exception:
            # Fallback to simple LIKE matching
            return self._find_similar_titles_fallback(limit)

        query = """
            SELECT
                p1.id as page1_id, p1.title as title1,
                p2.id as page2_id, p2.title as title2,
                similarity(p1.title, p2.title) as similarity
            FROM confluence_v2_content p1
            JOIN confluence_v2_content p2 ON p1.id < p2.id
            WHERE p1.type = 'page' AND p2.type = 'page'
              AND similarity(p1.title, p2.title) > 0.5
            ORDER BY similarity DESC
            LIMIT %s
        """
        return db.fetch_all(query, [limit])

    def _find_similar_titles_fallback(self, limit: int) -> List[Dict]:
        """Fallback: Find similar titles using common word matching."""
        query = """
            SELECT id, title FROM confluence_v2_content
            WHERE type = 'page'
            ORDER BY title
            LIMIT 1000
        """
        pages = db.fetch_all(query)

        # Simple word-based similarity
        similar_pairs = []
        for i, p1 in enumerate(pages):
            words1 = set(re.findall(r'\w+', p1['title'].lower()))
            if len(words1) < 2:
                continue

            for p2 in pages[i+1:]:
                words2 = set(re.findall(r'\w+', p2['title'].lower()))
                if len(words2) < 2:
                    continue

                # Jaccard similarity
                intersection = len(words1 & words2)
                union = len(words1 | words2)
                sim = intersection / union if union > 0 else 0

                if sim > 0.5:
                    similar_pairs.append({
                        'page1_id': p1['id'],
                        'title1': p1['title'],
                        'page2_id': p2['id'],
                        'title2': p2['title'],
                        'similarity': sim
                    })

        # Sort by similarity and limit
        similar_pairs.sort(key=lambda x: -x['similarity'])
        return similar_pairs[:limit]

    def _ai_validate_merge(self, page1: Dict, page2: Dict) -> Optional[Dict]:
        """Use AI to validate if two pages should be merged."""
        try:
            ai = self._get_ai_client()
            prompt = f"""Analyze these two Confluence pages and determine if they should be merged.

Page 1:
- Title: {page1['title']}
- Content preview: {page1['body_storage'][:1500] if page1['body_storage'] else '(empty)'}

Page 2:
- Title: {page2['title']}
- Content preview: {page2['body_storage'][:1500] if page2['body_storage'] else '(empty)'}

Respond with JSON:
{{
    "should_merge": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation",
    "primary_page_id": "{page1['id']}" or "{page2['id']}" (which one to keep as primary),
    "merged_title": "Suggested merged title",
    "merge_strategy": "append" | "interleave" | "summarize"
}}"""

            response = ai._call_api(prompt)
            return response if isinstance(response, dict) else None
        except Exception as e:
            self._log(f"AI validation error: {e}")
            return None

    # ============================================
    # Staleness Detection
    # ============================================

    def analyze_for_staleness(self, days_threshold: int = 180) -> List[Dict]:
        """
        Find pages that haven't been updated in a long time and may be outdated.
        """
        print(f"=== Analyzing for Staleness (>{days_threshold} days) ===")

        cutoff_date = datetime.now() - timedelta(days=days_threshold)

        query = """
            SELECT id, title, body_storage, labels, last_synced_at,
                   raw_data->'version'->>'createdAt' as last_updated
            FROM confluence_v2_content
            WHERE type = 'page'
              AND (raw_data->'version'->>'createdAt')::timestamp < %s
            ORDER BY (raw_data->'version'->>'createdAt')::timestamp ASC
            LIMIT 50
        """
        stale_pages = db.fetch_all(query, [cutoff_date.isoformat()])
        print(f"Found {len(stale_pages)} stale pages")

        suggestions = []
        for page in stale_pages:
            # Check if page has content that typically becomes outdated
            content = page['body_storage'] or ''
            has_version_refs = bool(re.search(r'v\d+\.\d+|version\s+\d+', content, re.I))
            has_date_refs = bool(re.search(r'202[0-4]|Q[1-4]\s+202[0-4]', content, re.I))
            has_api_refs = bool(re.search(r'/api/|endpoint|API', content, re.I))

            # Higher confidence if content has version/date references
            confidence = 0.5
            if has_version_refs:
                confidence += 0.2
            if has_date_refs:
                confidence += 0.2
            if has_api_refs:
                confidence += 0.1

            stale_sections = []
            if has_version_refs:
                stale_sections.append('Version references')
            if has_date_refs:
                stale_sections.append('Date references')
            if has_api_refs:
                stale_sections.append('API documentation')

            if stale_sections:
                suggestion = {
                    'suggestion_type': 'update',
                    'target_page_ids': [page['id']],
                    'confidence_score': min(confidence, 0.95),
                    'ai_reasoning': f"Page not updated since {page.get('last_updated', 'unknown')}. Contains potentially outdated: {', '.join(stale_sections)}",
                    'suggested_action': {
                        'page_id': page['id'],
                        'stale_sections': stale_sections,
                        'suggested_updates': [
                            {'section': s, 'reason': 'May be outdated'} for s in stale_sections
                        ]
                    }
                }
                suggestions.append(suggestion)
                self._log(f"Stale: {page['title'][:40]} - {', '.join(stale_sections)}")

        return suggestions

    # ============================================
    # Label Analysis
    # ============================================

    def analyze_for_labels(self, limit: int = 20) -> List[Dict]:
        """
        Find pages that are missing labels and suggest appropriate labels.
        """
        print("=== Analyzing for Missing Labels ===")

        # Get pages with no labels
        query = """
            SELECT id, title, body_storage
            FROM confluence_v2_content
            WHERE type = 'page'
              AND (labels IS NULL OR array_length(labels, 1) = 0 OR labels = '{}')
            ORDER BY last_synced_at DESC
            LIMIT %s
        """
        unlabeled_pages = db.fetch_all(query, [limit])
        print(f"Found {len(unlabeled_pages)} unlabeled pages")

        # Get label taxonomy
        taxonomy = self._get_label_taxonomy()

        suggestions = []
        for page in unlabeled_pages:
            suggested_labels = self._suggest_labels_for_page(page, taxonomy)

            if suggested_labels:
                suggestion = {
                    'suggestion_type': 'label',
                    'target_page_ids': [page['id']],
                    'confidence_score': 0.7,
                    'ai_reasoning': f"Page has no labels. Suggested based on content analysis.",
                    'suggested_action': {
                        'page_id': page['id'],
                        'add_labels': suggested_labels,
                        'remove_labels': [],
                        'reasoning': 'Auto-suggested based on content patterns'
                    }
                }
                suggestions.append(suggestion)
                self._log(f"Labels for {page['title'][:30]}: {suggested_labels}")

        return suggestions

    def _get_label_taxonomy(self) -> Dict[str, Dict]:
        """Get label taxonomy from database."""
        query = """
            SELECT label_name, category, keyword_patterns, synonyms
            FROM confluence_label_taxonomy
            WHERE is_auto_suggested = TRUE
        """
        rows = db.fetch_all(query)

        taxonomy = {}
        for row in rows:
            taxonomy[row['label_name']] = {
                'category': row['category'],
                'patterns': row['keyword_patterns'] or [],
                'synonyms': row['synonyms'] or []
            }
        return taxonomy

    def _suggest_labels_for_page(self, page: Dict, taxonomy: Dict) -> List[str]:
        """Suggest labels for a page based on content patterns."""
        content = (page['title'] + ' ' + (page['body_storage'] or '')).lower()
        suggested = []

        for label, info in taxonomy.items():
            # Check patterns
            for pattern in info['patterns']:
                try:
                    if re.search(pattern, content, re.I):
                        suggested.append(label)
                        break
                except re.error:
                    pass

            # Check synonyms
            if label not in suggested:
                for synonym in info['synonyms']:
                    if synonym.lower() in content:
                        suggested.append(label)
                        break

        return list(set(suggested))[:5]  # Max 5 labels

    # ============================================
    # Archive Analysis
    # ============================================

    def analyze_for_archive(self, days_threshold: int = 365) -> List[Dict]:
        """
        Find pages that should be archived (very old, no views, etc.)
        """
        print(f"=== Analyzing for Archive Candidates (>{days_threshold} days) ===")

        cutoff_date = datetime.now() - timedelta(days=days_threshold)

        query = """
            SELECT id, title, labels, last_synced_at,
                   raw_data->'version'->>'createdAt' as last_updated
            FROM confluence_v2_content
            WHERE type = 'page'
              AND (raw_data->'version'->>'createdAt')::timestamp < %s
              AND (labels IS NULL OR NOT labels && ARRAY['archive', 'archived'])
            ORDER BY (raw_data->'version'->>'createdAt')::timestamp ASC
            LIMIT 30
        """
        old_pages = db.fetch_all(query, [cutoff_date.isoformat()])
        print(f"Found {len(old_pages)} very old pages")

        suggestions = []
        for page in old_pages:
            suggestion = {
                'suggestion_type': 'archive',
                'target_page_ids': [page['id']],
                'confidence_score': 0.6,
                'ai_reasoning': f"Page not updated since {page.get('last_updated', 'unknown')}. May be obsolete.",
                'suggested_action': {
                    'page_id': page['id'],
                    'archive_reason': 'outdated',
                    'last_modified': page.get('last_updated'),
                    'no_recent_views': True
                }
            }
            suggestions.append(suggestion)
            self._log(f"Archive candidate: {page['title'][:40]}")

        return suggestions

    # ============================================
    # Utilities
    # ============================================

    def _get_pages_by_ids(self, page_ids: List[str]) -> List[Dict]:
        """Fetch pages by their IDs."""
        query = """
            SELECT id, title, body_storage, labels, parent_id
            FROM confluence_v2_content
            WHERE id = ANY(%s)
        """
        return db.fetch_all(query, [page_ids])

    def save_suggestions(self, suggestions: List[Dict]) -> int:
        """Save suggestions to database."""
        if not suggestions:
            return 0

        query = """
            INSERT INTO confluence_ai_suggestions
            (suggestion_type, target_page_ids, confidence_score, ai_reasoning, suggested_action)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """

        count = 0
        for s in suggestions:
            try:
                db.execute(query, [
                    s['suggestion_type'],
                    s['target_page_ids'],
                    s.get('confidence_score'),
                    s.get('ai_reasoning'),
                    json.dumps(s['suggested_action'])
                ])
                count += 1
            except Exception as e:
                print(f"Error saving suggestion: {e}")

        return count


def main():
    parser = argparse.ArgumentParser(description="AI analysis of Confluence pages")
    parser.add_argument('--type', choices=['duplicates', 'staleness', 'labels', 'archive', 'all'],
                        default='all', help='Type of analysis to run')
    parser.add_argument('--limit', type=int, default=50, help='Max pages to analyze')
    parser.add_argument('--days', type=int, default=180, help='Days threshold for staleness')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--dry-run', action='store_true', help='Show results without saving')
    args = parser.parse_args()

    analyzer = ConfluenceAIAnalyzer(verbose=args.verbose)
    all_suggestions = []

    if args.type in ['duplicates', 'all']:
        suggestions = analyzer.analyze_for_duplicates(args.limit)
        all_suggestions.extend(suggestions)
        print(f"Duplicate suggestions: {len(suggestions)}")

    if args.type in ['staleness', 'all']:
        suggestions = analyzer.analyze_for_staleness(args.days)
        all_suggestions.extend(suggestions)
        print(f"Staleness suggestions: {len(suggestions)}")

    if args.type in ['labels', 'all']:
        suggestions = analyzer.analyze_for_labels(args.limit)
        all_suggestions.extend(suggestions)
        print(f"Label suggestions: {len(suggestions)}")

    if args.type in ['archive', 'all']:
        suggestions = analyzer.analyze_for_archive(args.days * 2)  # Double for archive
        all_suggestions.extend(suggestions)
        print(f"Archive suggestions: {len(suggestions)}")

    print(f"\n=== Total Suggestions: {len(all_suggestions)} ===")

    # Group by type
    by_type = defaultdict(int)
    for s in all_suggestions:
        by_type[s['suggestion_type']] += 1

    for t, c in sorted(by_type.items()):
        print(f"  {t}: {c}")

    if args.dry_run:
        print("\n[DRY RUN] Suggestions not saved")
    else:
        saved = analyzer.save_suggestions(all_suggestions)
        print(f"\nSaved {saved} suggestions to database")


if __name__ == '__main__':
    main()
