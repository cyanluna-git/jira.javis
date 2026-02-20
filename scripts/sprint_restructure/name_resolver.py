"""
Name Resolver

Handles naming conflicts and context preservation when moving pages.

Key responsibilities:
1. Detect name collisions before moving
2. Generate unique names by appending sprint/parent context
3. Preserve temporal context in page titles
"""

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class NameResolution:
    """Result of name resolution."""
    original_title: str
    resolved_title: str
    collision_avoided: bool
    context_preserved: bool
    source_context: Optional[str] = None  # e.g., "Sprint 08"


@dataclass
class CollisionCheck:
    """Result of collision detection."""
    has_collision: bool
    conflicting_page_id: Optional[str] = None
    conflicting_page_title: Optional[str] = None


class NameResolver:
    """
    Resolves naming conflicts and preserves context when restructuring pages.

    Strategies:
    1. append-parent-name: Add source parent name to title
       "Sprint Review" -> "Sprint 08 - Sprint Review"

    2. append-suffix: Add numeric suffix
       "Design Note" -> "Design Note (2)"

    3. preserve-context: Always add context even without collision
       Ensures temporal information is never lost
    """

    # Patterns to detect existing context in titles
    CONTEXT_PATTERNS = [
        r'^Sprint\s*\d+\s*[-:]\s*',  # "Sprint 08 - ..."
        r'^\[Sprint\s*\d+\]\s*',      # "[Sprint 08] ..."
        r'\(Sprint\s*\d+\)$',         # "... (Sprint 08)"
    ]

    def __init__(
        self,
        strategy: str = "append-parent-name",
        always_preserve_context: bool = True
    ):
        """
        Initialize resolver.

        Args:
            strategy: Naming strategy (append-parent-name, append-suffix, preserve-context)
            always_preserve_context: If True, always add context even without collision
        """
        self.strategy = strategy
        self.always_preserve_context = always_preserve_context

        # Track existing titles in target folders for collision detection
        self._existing_titles: Dict[str, Set[str]] = {}  # folder_id -> set of titles

        # Track resolved names in current operation
        self._planned_titles: Dict[str, Set[str]] = {}

        self._compiled_context_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.CONTEXT_PATTERNS
        ]

    def register_existing_titles(
        self,
        folder_id: str,
        titles: List[str]
    ) -> None:
        """
        Register existing page titles in a target folder.

        Args:
            folder_id: Target folder page ID
            titles: List of existing page titles in that folder
        """
        self._existing_titles[folder_id] = set(titles)

    def register_existing_pages(
        self,
        pages: List[Dict]
    ) -> None:
        """
        Register existing pages from a list of page dicts.

        Args:
            pages: List of page dicts with 'parent_id' and 'title' keys
        """
        for page in pages:
            parent_id = page.get('parent_id', '')
            title = page.get('title', '')
            if parent_id and title:
                if parent_id not in self._existing_titles:
                    self._existing_titles[parent_id] = set()
                self._existing_titles[parent_id].add(title)

    def reset_planned(self) -> None:
        """Reset planned titles for a new operation batch."""
        self._planned_titles = {}

    def check_collision(
        self,
        title: str,
        target_folder_id: str
    ) -> CollisionCheck:
        """
        Check if a title would collide in the target folder.

        Args:
            title: Proposed page title
            target_folder_id: Target folder page ID

        Returns:
            CollisionCheck result
        """
        existing = self._existing_titles.get(target_folder_id, set())
        planned = self._planned_titles.get(target_folder_id, set())

        all_titles = existing | planned

        if title in all_titles:
            return CollisionCheck(
                has_collision=True,
                conflicting_page_title=title
            )

        return CollisionCheck(has_collision=False)

    def has_context(self, title: str) -> bool:
        """Check if title already has context information."""
        for pattern in self._compiled_context_patterns:
            if pattern.search(title):
                return True
        return False

    def resolve(
        self,
        page_id: str,
        original_title: str,
        target_folder_id: str,
        source_context: Optional[str] = None,
        force_context: bool = False
    ) -> NameResolution:
        """
        Resolve a page name for the target folder.

        Args:
            page_id: Page ID being moved
            original_title: Original page title
            target_folder_id: Target folder page ID
            source_context: Context to add (e.g., "Sprint 08")
            force_context: Force adding context even if no collision

        Returns:
            NameResolution with resolved title
        """
        collision = self.check_collision(original_title, target_folder_id)

        # Check if context preservation is needed
        needs_context = (
            force_context or
            self.always_preserve_context or
            collision.has_collision
        )

        # Skip if already has context
        if self.has_context(original_title):
            needs_context = False

        resolved_title = original_title
        collision_avoided = False
        context_preserved = False

        if needs_context and source_context:
            if self.strategy == "append-parent-name":
                resolved_title = f"{source_context} - {original_title}"
                context_preserved = True
            elif self.strategy == "preserve-context":
                resolved_title = f"[{source_context}] {original_title}"
                context_preserved = True

            # Check if resolved title still collides
            collision = self.check_collision(resolved_title, target_folder_id)

        # Handle remaining collisions with suffix
        if collision.has_collision:
            resolved_title = self._add_suffix(resolved_title, target_folder_id)
            collision_avoided = True

        # Register the planned title
        if target_folder_id not in self._planned_titles:
            self._planned_titles[target_folder_id] = set()
        self._planned_titles[target_folder_id].add(resolved_title)

        return NameResolution(
            original_title=original_title,
            resolved_title=resolved_title,
            collision_avoided=collision_avoided,
            context_preserved=context_preserved,
            source_context=source_context,
        )

    def _add_suffix(self, title: str, target_folder_id: str) -> str:
        """Add numeric suffix to make title unique."""
        existing = self._existing_titles.get(target_folder_id, set())
        planned = self._planned_titles.get(target_folder_id, set())
        all_titles = existing | planned

        # Try suffixes (2), (3), etc.
        suffix = 2
        while True:
            candidate = f"{title} ({suffix})"
            if candidate not in all_titles:
                return candidate
            suffix += 1
            if suffix > 100:  # Safety limit
                raise ValueError(f"Cannot resolve name collision for: {title}")

    def resolve_batch(
        self,
        pages: List[Dict],
        target_folder_id: str,
        context_extractor=None
    ) -> List[Tuple[Dict, NameResolution]]:
        """
        Resolve names for a batch of pages.

        Args:
            pages: List of page dicts with 'id', 'title', and optionally 'parent_title'
            target_folder_id: Target folder for all pages
            context_extractor: Optional function to extract context from page

        Returns:
            List of (page, NameResolution) tuples
        """
        results = []

        for page in pages:
            page_id = page.get('id', '')
            title = page.get('title', '')
            parent_title = page.get('parent_title', '')

            # Extract context
            source_context = None
            if context_extractor:
                source_context = context_extractor(page)
            elif parent_title:
                source_context = self._extract_sprint_context(parent_title)

            resolution = self.resolve(
                page_id=page_id,
                original_title=title,
                target_folder_id=target_folder_id,
                source_context=source_context,
            )

            results.append((page, resolution))

        return results

    def _extract_sprint_context(self, text: str) -> Optional[str]:
        """Extract sprint context from text."""
        patterns = [
            r'\[?Scaled[-\s]*Sprint[-\s]*(\d+)\]?',
            r'\[?Sprint[-\s]*(\d+)\]?',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return f"Sprint {match.group(1)}"

        return None

    def preview_resolutions(
        self,
        resolutions: List[Tuple[Dict, NameResolution]]
    ) -> str:
        """
        Generate a preview of name resolutions.

        Args:
            resolutions: List of (page, NameResolution) tuples

        Returns:
            Formatted preview string
        """
        lines = []
        lines.append("Name Resolution Preview")
        lines.append("=" * 60)

        changes = [(p, r) for p, r in resolutions if r.original_title != r.resolved_title]
        unchanged = [(p, r) for p, r in resolutions if r.original_title == r.resolved_title]

        if changes:
            lines.append(f"\nTitle Changes ({len(changes)}):")
            lines.append("-" * 40)
            for page, resolution in changes:
                lines.append(f"  '{resolution.original_title}'")
                lines.append(f"    -> '{resolution.resolved_title}'")
                if resolution.context_preserved:
                    lines.append(f"       (context: {resolution.source_context})")
                if resolution.collision_avoided:
                    lines.append("       (collision avoided)")
                lines.append("")

        lines.append(f"\nUnchanged: {len(unchanged)} pages")

        return "\n".join(lines)
