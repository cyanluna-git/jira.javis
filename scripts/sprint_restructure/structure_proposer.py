"""
Structure Proposer

Generates new folder structure proposals for Confluence page reorganization.

Creates a complete restructuring plan including:
1. New folder creation
2. Page moves with name resolution
3. Archive folder for original sprint folders
4. Link suggestions for similar documents
"""

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any

from .document_classifier import DocumentClassifier, DocumentType, FOLDER_NAMES
from .name_resolver import NameResolver, NameResolution
from .similarity_analyzer import SimilarityAnalyzer, SimilarityGroup


@dataclass
class FolderCreation:
    """Folder to be created."""
    folder_name: str
    parent_id: str
    doc_type: Optional[DocumentType] = None
    order: int = 0


@dataclass
class PageMove:
    """Page move operation."""
    page_id: str
    original_title: str
    resolved_title: str
    source_parent_id: str
    source_parent_title: str
    target_folder_name: str
    target_folder_id: Optional[str] = None  # Set after folder creation
    doc_type: DocumentType = DocumentType.UNCATEGORIZED
    confidence: float = 0.0
    name_changed: bool = False


@dataclass
class LinkSuggestion:
    """Suggestion to link related pages."""
    page_ids: List[str]
    page_titles: List[str]
    similarity: float
    reason: str = "Similar content detected"


@dataclass
class ArchiveMove:
    """Original folder to archive."""
    folder_id: str
    folder_title: str
    new_title: str  # e.g., "[ARCHIVED] Sprint08"
    target_archive_id: Optional[str] = None


@dataclass
class RestructureProposal:
    """Complete restructuring proposal."""
    # Parent page info
    parent_id: str
    parent_title: str
    space_id: str

    # Operations
    folders_to_create: List[FolderCreation] = field(default_factory=list)
    pages_to_move: List[PageMove] = field(default_factory=list)
    folders_to_archive: List[ArchiveMove] = field(default_factory=list)
    link_suggestions: List[LinkSuggestion] = field(default_factory=list)

    # Summary
    total_pages: int = 0
    pages_by_type: Dict[str, int] = field(default_factory=dict)
    collision_resolutions: int = 0
    context_preservations: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'parent_id': self.parent_id,
            'parent_title': self.parent_title,
            'space_id': self.space_id,
            'folders_to_create': [
                {'name': f.folder_name, 'parent_id': f.parent_id, 'order': f.order}
                for f in self.folders_to_create
            ],
            'pages_to_move': [
                {
                    'page_id': p.page_id,
                    'original_title': p.original_title,
                    'resolved_title': p.resolved_title,
                    'source_parent_id': p.source_parent_id,
                    'source_parent_title': p.source_parent_title,
                    'target_folder_name': p.target_folder_name,
                    'doc_type': p.doc_type.value,
                    'confidence': p.confidence,
                    'name_changed': p.name_changed,
                }
                for p in self.pages_to_move
            ],
            'folders_to_archive': [
                {
                    'folder_id': f.folder_id,
                    'folder_title': f.folder_title,
                    'new_title': f.new_title,
                }
                for f in self.folders_to_archive
            ],
            'link_suggestions': [
                {
                    'page_ids': s.page_ids,
                    'page_titles': s.page_titles,
                    'similarity': s.similarity,
                    'reason': s.reason,
                }
                for s in self.link_suggestions
            ],
            'summary': {
                'total_pages': self.total_pages,
                'pages_by_type': self.pages_by_type,
                'collision_resolutions': self.collision_resolutions,
                'context_preservations': self.context_preservations,
            }
        }


class StructureProposer:
    """
    Generates restructuring proposals for Confluence pages.

    Workflow:
    1. Scan all pages under parent
    2. Classify each page by type
    3. Detect similar pages for linking
    4. Resolve name collisions
    5. Generate complete proposal
    """

    # Target folder structure
    TARGET_FOLDERS = [
        ("01-Sprint-Reviews", DocumentType.SPRINT_REVIEW, 1),
        ("02-Design-Notes", DocumentType.DESIGN_NOTE, 2),
        ("03-Story-Notes", DocumentType.STORY_NOTE, 3),
        ("04-Meeting-Notes", DocumentType.MEETING_NOTES, 4),
        ("05-Retrospectives", DocumentType.RETROSPECTIVE, 5),
        ("06-Technical-Docs", DocumentType.TECHNICAL_DOC, 6),
        ("99-Archive", None, 99),
        ("99-Uncategorized", DocumentType.UNCATEGORIZED, 100),
    ]

    def __init__(
        self,
        classifier: DocumentClassifier = None,
        name_resolver: NameResolver = None,
        similarity_analyzer: SimilarityAnalyzer = None,
        context_strategy: str = "append-parent-name"
    ):
        """
        Initialize proposer.

        Args:
            classifier: DocumentClassifier instance
            name_resolver: NameResolver instance
            similarity_analyzer: SimilarityAnalyzer instance
            context_strategy: Strategy for name resolution
        """
        self.classifier = classifier or DocumentClassifier()
        self.name_resolver = name_resolver or NameResolver(strategy=context_strategy)
        self.similarity_analyzer = similarity_analyzer or SimilarityAnalyzer()

        # Map doc type to folder name
        self.type_to_folder = {
            dt: fn for fn, dt, _ in self.TARGET_FOLDERS if dt
        }

    def propose(
        self,
        parent_id: str,
        parent_title: str,
        space_id: str,
        pages: List[Dict],
        existing_folders: List[Dict] = None
    ) -> RestructureProposal:
        """
        Generate a complete restructuring proposal.

        Args:
            parent_id: Root parent page ID (e.g., Sprint-Tumalo)
            parent_title: Parent page title
            space_id: Confluence space ID
            pages: List of all pages under parent with:
                   - id, title, body_storage, parent_id, parent_title
            existing_folders: List of existing folder pages under parent

        Returns:
            RestructureProposal
        """
        proposal = RestructureProposal(
            parent_id=parent_id,
            parent_title=parent_title,
            space_id=space_id,
        )

        existing_folders = existing_folders or []

        # Track which folders need to be created
        existing_folder_names = {f.get('title', '') for f in existing_folders}

        # 1. Determine folders to create
        for folder_name, doc_type, order in self.TARGET_FOLDERS:
            if folder_name not in existing_folder_names:
                proposal.folders_to_create.append(FolderCreation(
                    folder_name=folder_name,
                    parent_id=parent_id,
                    doc_type=doc_type,
                    order=order,
                ))

        # 2. Classify all pages
        classified = self.classifier.classify_batch(pages)

        # 3. Build page lookup for name resolution
        page_lookup = {p.get('id', ''): p for p in pages}

        # Register existing pages for collision detection
        self.name_resolver.register_existing_pages(pages)
        self.name_resolver.reset_planned()

        # 4. Group pages by target folder and resolve names
        folder_pages: Dict[str, List[Tuple[Dict, Any]]] = {}

        for page, classification in classified:
            folder_name = self.type_to_folder.get(
                classification.doc_type,
                "99-Uncategorized"
            )

            if folder_name not in folder_pages:
                folder_pages[folder_name] = []

            folder_pages[folder_name].append((page, classification))

        # 5. Process each folder group
        for folder_name, page_list in folder_pages.items():
            # Get or create target folder ID placeholder
            target_folder_id = None
            for f in existing_folders:
                if f.get('title') == folder_name:
                    target_folder_id = f.get('id')
                    break

            # If folder doesn't exist, use placeholder
            if not target_folder_id:
                target_folder_id = f"NEW:{folder_name}"

            # Resolve names for this folder
            for page, classification in page_list:
                # Extract context from source parent
                source_context = classification.source_sprint

                resolution = self.name_resolver.resolve(
                    page_id=page.get('id', ''),
                    original_title=page.get('title', ''),
                    target_folder_id=target_folder_id,
                    source_context=source_context,
                )

                move = PageMove(
                    page_id=page.get('id', ''),
                    original_title=page.get('title', ''),
                    resolved_title=resolution.resolved_title,
                    source_parent_id=page.get('parent_id', ''),
                    source_parent_title=page.get('parent_title', ''),
                    target_folder_name=folder_name,
                    target_folder_id=target_folder_id if not target_folder_id.startswith("NEW:") else None,
                    doc_type=classification.doc_type,
                    confidence=classification.confidence,
                    name_changed=resolution.original_title != resolution.resolved_title,
                )

                proposal.pages_to_move.append(move)

                # Track statistics
                if resolution.collision_avoided:
                    proposal.collision_resolutions += 1
                if resolution.context_preserved:
                    proposal.context_preservations += 1

        # 6. Identify original sprint folders to archive
        for folder in existing_folders:
            folder_title = folder.get('title', '')
            # Check if it's a sprint folder (not our target folders)
            if self._is_sprint_folder(folder_title):
                proposal.folders_to_archive.append(ArchiveMove(
                    folder_id=folder.get('id', ''),
                    folder_title=folder_title,
                    new_title=f"[ARCHIVED] {folder_title}",
                ))

        # 7. Find similar pages for linking
        similar_groups = self.similarity_analyzer.group_similar(pages)
        for group in similar_groups:
            if group.recommendation == "link":
                proposal.link_suggestions.append(LinkSuggestion(
                    page_ids=group.page_ids,
                    page_titles=group.page_titles,
                    similarity=group.avg_similarity,
                ))

        # 8. Calculate summary
        proposal.total_pages = len(pages)
        proposal.pages_by_type = self.classifier.get_classification_summary(classified)

        return proposal

    def _is_sprint_folder(self, title: str) -> bool:
        """Check if a folder title is a sprint folder."""
        import re
        patterns = [
            r'^\[?Scaled[-\s]*Sprint',
            r'^\[?Sprint[-\s]*\d+\]?$',
        ]
        for pattern in patterns:
            if re.search(pattern, title, re.IGNORECASE):
                return True
        return False

    def generate_preview(self, proposal: RestructureProposal) -> str:
        """
        Generate a human-readable preview of the proposal.

        Args:
            proposal: RestructureProposal to preview

        Returns:
            Formatted preview string
        """
        lines = []
        lines.append("=" * 70)
        lines.append("CONFLUENCE RESTRUCTURE PROPOSAL")
        lines.append("=" * 70)
        lines.append(f"\nParent: {proposal.parent_title} ({proposal.parent_id})")
        lines.append(f"Total Pages: {proposal.total_pages}")

        # Classification summary
        lines.append("\n--- Classification Summary ---")
        for doc_type, count in sorted(proposal.pages_by_type.items()):
            lines.append(f"  {doc_type}: {count}")

        # Folders to create
        if proposal.folders_to_create:
            lines.append(f"\n--- Folders to Create ({len(proposal.folders_to_create)}) ---")
            for folder in proposal.folders_to_create:
                lines.append(f"  + {folder.folder_name}")

        # Pages to move (grouped by target folder)
        lines.append(f"\n--- Pages to Move ({len(proposal.pages_to_move)}) ---")

        by_folder: Dict[str, List[PageMove]] = {}
        for move in proposal.pages_to_move:
            if move.target_folder_name not in by_folder:
                by_folder[move.target_folder_name] = []
            by_folder[move.target_folder_name].append(move)

        for folder_name, moves in sorted(by_folder.items()):
            lines.append(f"\n  To {folder_name}/ ({len(moves)} pages):")
            for move in moves[:10]:  # Limit preview
                if move.name_changed:
                    lines.append(f"    '{move.original_title}'")
                    lines.append(f"      -> '{move.resolved_title}'")
                else:
                    lines.append(f"    '{move.original_title}'")
            if len(moves) > 10:
                lines.append(f"    ... and {len(moves) - 10} more")

        # Folders to archive
        if proposal.folders_to_archive:
            lines.append(f"\n--- Folders to Archive ({len(proposal.folders_to_archive)}) ---")
            for archive in proposal.folders_to_archive:
                lines.append(f"  {archive.folder_title} -> {archive.new_title}")

        # Link suggestions
        if proposal.link_suggestions:
            lines.append(f"\n--- Link Suggestions ({len(proposal.link_suggestions)} groups) ---")
            for suggestion in proposal.link_suggestions[:5]:
                lines.append(f"  Similar pages (similarity: {suggestion.similarity:.1%}):")
                for title in suggestion.page_titles:
                    lines.append(f"    - {title}")
            if len(proposal.link_suggestions) > 5:
                lines.append(f"  ... and {len(proposal.link_suggestions) - 5} more groups")

        # Statistics
        lines.append("\n--- Resolution Statistics ---")
        lines.append(f"  Name collisions resolved: {proposal.collision_resolutions}")
        lines.append(f"  Context preserved (renamed): {proposal.context_preservations}")

        lines.append("\n" + "=" * 70)

        return "\n".join(lines)

    def save_preview(self, proposal: RestructureProposal, output_path: str) -> None:
        """
        Save proposal preview to a file.

        Args:
            proposal: RestructureProposal
            output_path: Output file path
        """
        preview = self.generate_preview(proposal)

        with open(output_path, 'w') as f:
            f.write(preview)

        # Also save JSON version
        json_path = output_path.replace('.md', '.json').replace('.txt', '.json')
        if json_path == output_path:
            json_path = output_path + '.json'

        with open(json_path, 'w') as f:
            json.dump(proposal.to_dict(), f, indent=2)
