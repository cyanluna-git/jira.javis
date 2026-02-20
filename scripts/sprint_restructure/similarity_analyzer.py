"""
Similarity Analyzer

Detects similar documents for merge/link proposals.

Uses:
1. Jaccard similarity for title comparison
2. Keyword overlap for content similarity
3. Union-Find for grouping similar pages
"""

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class SimilarityResult:
    """Similarity comparison result between two pages."""
    page1_id: str
    page2_id: str
    page1_title: str
    page2_title: str
    title_similarity: float
    content_similarity: float
    combined_similarity: float


@dataclass
class SimilarityGroup:
    """Group of similar pages."""
    group_id: int
    page_ids: List[str]
    page_titles: List[str]
    avg_similarity: float
    primary_page_id: Optional[str] = None  # Suggested primary page for merge
    recommendation: str = "link"  # "link" or "merge"


class UnionFind:
    """Union-Find data structure for grouping similar items."""

    def __init__(self):
        self.parent: Dict[str, str] = {}
        self.rank: Dict[str, int] = {}

    def find(self, x: str) -> str:
        """Find root with path compression."""
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: str, y: str) -> None:
        """Union by rank."""
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

    def get_groups(self) -> Dict[str, List[str]]:
        """Get all groups as dict of root -> members."""
        groups: Dict[str, List[str]] = {}
        for x in self.parent:
            root = self.find(x)
            if root not in groups:
                groups[root] = []
            groups[root].append(x)
        return groups


class SimilarityAnalyzer:
    """
    Analyzes similarity between documents for merge/link proposals.

    Similarity thresholds:
    - >= 0.7: High similarity, recommend linking (not auto-merge)
    - >= 0.85: Very high similarity, suggest merge review
    """

    # Words to ignore in title comparison
    STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
        'sprint', 'note', 'notes', 'doc', 'document', 'page',
    }

    def __init__(
        self,
        title_weight: float = 0.4,
        content_weight: float = 0.6,
        link_threshold: float = 0.7,
        merge_threshold: float = 0.85
    ):
        """
        Initialize analyzer.

        Args:
            title_weight: Weight for title similarity (0-1)
            content_weight: Weight for content similarity (0-1)
            link_threshold: Minimum similarity to suggest linking
            merge_threshold: Minimum similarity to suggest merge review
        """
        self.title_weight = title_weight
        self.content_weight = content_weight
        self.link_threshold = link_threshold
        self.merge_threshold = merge_threshold

    def tokenize(self, text: str, remove_stopwords: bool = True) -> Set[str]:
        """
        Tokenize text into word set.

        Args:
            text: Input text
            remove_stopwords: Whether to remove common words

        Returns:
            Set of lowercase tokens
        """
        # Extract words, lowercased
        words = set(re.findall(r'\b[a-z0-9]+\b', text.lower()))

        if remove_stopwords:
            words -= self.STOP_WORDS

        return words

    def jaccard_similarity(self, set1: Set[str], set2: Set[str]) -> float:
        """
        Calculate Jaccard similarity between two sets.

        Args:
            set1: First set
            set2: Second set

        Returns:
            Similarity score (0-1)
        """
        if not set1 and not set2:
            return 0.0

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        return intersection / union if union > 0 else 0.0

    def extract_keywords(self, content: str, max_keywords: int = 50) -> Set[str]:
        """
        Extract significant keywords from content.

        Args:
            content: Document content
            max_keywords: Maximum keywords to extract

        Returns:
            Set of keywords
        """
        # Tokenize
        tokens = self.tokenize(content, remove_stopwords=True)

        # Filter short words
        tokens = {t for t in tokens if len(t) > 2}

        # Limit to max
        if len(tokens) > max_keywords:
            # Simple approach: take longest words (often more meaningful)
            tokens = set(sorted(tokens, key=len, reverse=True)[:max_keywords])

        return tokens

    def compare(
        self,
        page1: Dict,
        page2: Dict
    ) -> SimilarityResult:
        """
        Compare two pages for similarity.

        Args:
            page1: First page dict with 'id', 'title', and 'content' or 'body_storage'
            page2: Second page dict

        Returns:
            SimilarityResult
        """
        # Get titles
        title1 = page1.get('title', '')
        title2 = page2.get('title', '')

        # Get content
        content1 = page1.get('body_storage', '') or page1.get('content', '')
        content2 = page2.get('body_storage', '') or page2.get('content', '')

        # Title similarity
        title_tokens1 = self.tokenize(title1)
        title_tokens2 = self.tokenize(title2)
        title_sim = self.jaccard_similarity(title_tokens1, title_tokens2)

        # Content similarity
        content_sim = 0.0
        if content1 and content2:
            keywords1 = self.extract_keywords(content1)
            keywords2 = self.extract_keywords(content2)
            content_sim = self.jaccard_similarity(keywords1, keywords2)

        # Combined similarity
        combined = (
            title_sim * self.title_weight +
            content_sim * self.content_weight
        )

        return SimilarityResult(
            page1_id=page1.get('id', ''),
            page2_id=page2.get('id', ''),
            page1_title=title1,
            page2_title=title2,
            title_similarity=title_sim,
            content_similarity=content_sim,
            combined_similarity=combined,
        )

    def find_similar_pairs(
        self,
        pages: List[Dict],
        threshold: float = None
    ) -> List[SimilarityResult]:
        """
        Find all pairs of similar pages above threshold.

        Args:
            pages: List of page dicts
            threshold: Minimum similarity (defaults to link_threshold)

        Returns:
            List of SimilarityResult for similar pairs
        """
        if threshold is None:
            threshold = self.link_threshold

        similar_pairs = []

        # Compare all pairs (O(n^2))
        for i in range(len(pages)):
            for j in range(i + 1, len(pages)):
                result = self.compare(pages[i], pages[j])

                if result.combined_similarity >= threshold:
                    similar_pairs.append(result)

        # Sort by similarity descending
        similar_pairs.sort(key=lambda x: x.combined_similarity, reverse=True)

        return similar_pairs

    def group_similar(
        self,
        pages: List[Dict],
        threshold: float = None
    ) -> List[SimilarityGroup]:
        """
        Group similar pages using Union-Find.

        Args:
            pages: List of page dicts
            threshold: Minimum similarity to group together

        Returns:
            List of SimilarityGroup
        """
        if threshold is None:
            threshold = self.link_threshold

        # Build page lookup
        page_lookup = {p.get('id', ''): p for p in pages}

        # Find similar pairs
        similar_pairs = self.find_similar_pairs(pages, threshold)

        # Union-Find grouping
        uf = UnionFind()

        # Initialize all pages
        for page in pages:
            uf.find(page.get('id', ''))

        # Union similar pages
        pair_similarities: Dict[Tuple[str, str], float] = {}
        for result in similar_pairs:
            uf.union(result.page1_id, result.page2_id)
            pair_key = tuple(sorted([result.page1_id, result.page2_id]))
            pair_similarities[pair_key] = result.combined_similarity

        # Build groups
        raw_groups = uf.get_groups()
        groups = []
        group_id = 0

        for root, member_ids in raw_groups.items():
            if len(member_ids) < 2:
                continue  # Skip singletons

            # Calculate average similarity within group
            total_sim = 0.0
            pair_count = 0
            for i in range(len(member_ids)):
                for j in range(i + 1, len(member_ids)):
                    pair_key = tuple(sorted([member_ids[i], member_ids[j]]))
                    if pair_key in pair_similarities:
                        total_sim += pair_similarities[pair_key]
                        pair_count += 1

            avg_sim = total_sim / pair_count if pair_count > 0 else threshold

            # Get titles
            titles = [page_lookup.get(pid, {}).get('title', '') for pid in member_ids]

            # Determine recommendation
            recommendation = "merge" if avg_sim >= self.merge_threshold else "link"

            # Select primary page (oldest or longest content)
            primary_id = self._select_primary(member_ids, page_lookup)

            groups.append(SimilarityGroup(
                group_id=group_id,
                page_ids=member_ids,
                page_titles=titles,
                avg_similarity=avg_sim,
                primary_page_id=primary_id,
                recommendation=recommendation,
            ))

            group_id += 1

        # Sort by similarity descending
        groups.sort(key=lambda g: g.avg_similarity, reverse=True)

        return groups

    def _select_primary(
        self,
        page_ids: List[str],
        page_lookup: Dict[str, Dict]
    ) -> str:
        """
        Select primary page for a group.

        Criteria: prefer longer content (more comprehensive)
        """
        best_id = page_ids[0]
        best_length = 0

        for pid in page_ids:
            page = page_lookup.get(pid, {})
            content = page.get('body_storage', '') or page.get('content', '')
            if len(content) > best_length:
                best_length = len(content)
                best_id = pid

        return best_id

    def generate_report(
        self,
        groups: List[SimilarityGroup],
        page_lookup: Dict[str, Dict] = None
    ) -> str:
        """
        Generate a human-readable report of similar page groups.

        Args:
            groups: List of SimilarityGroup
            page_lookup: Optional dict of page_id -> page data

        Returns:
            Formatted report string
        """
        lines = []
        lines.append("Similar Document Groups Report")
        lines.append("=" * 60)

        if not groups:
            lines.append("\nNo similar document groups found.")
            return "\n".join(lines)

        merge_groups = [g for g in groups if g.recommendation == "merge"]
        link_groups = [g for g in groups if g.recommendation == "link"]

        if merge_groups:
            lines.append(f"\nMerge Candidates ({len(merge_groups)} groups):")
            lines.append("-" * 40)
            lines.append("Note: Review before merging - automated merge not recommended")
            lines.append("")

            for group in merge_groups:
                lines.append(f"Group {group.group_id + 1} (similarity: {group.avg_similarity:.1%})")
                for title in group.page_titles:
                    primary = " [PRIMARY]" if group.primary_page_id and title == page_lookup.get(group.primary_page_id, {}).get('title') else ""
                    lines.append(f"  - {title}{primary}")
                lines.append("")

        if link_groups:
            lines.append(f"\nLink Candidates ({len(link_groups)} groups):")
            lines.append("-" * 40)
            lines.append("Recommendation: Add 'Related Documents' links between pages")
            lines.append("")

            for group in link_groups:
                lines.append(f"Group {group.group_id + 1} (similarity: {group.avg_similarity:.1%})")
                for title in group.page_titles:
                    lines.append(f"  - {title}")
                lines.append("")

        return "\n".join(lines)
