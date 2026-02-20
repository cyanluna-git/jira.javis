"""
Document Classifier

Classifies Confluence pages into document types based on title patterns
and content keywords.

Document Types:
- sprint-review: Sprint reviews, burndown charts
- design-note: Design notes, architecture docs, RFCs
- story-note: Story notes, JIRA issue documentation
- meeting-notes: Meeting notes, standups, syncs
- retrospective: Retrospectives, team retros
- technical-doc: API docs, guides, setup instructions
- uncategorized: Cannot determine type
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple


class DocumentType(str, Enum):
    """Document type classification."""
    SPRINT_REVIEW = "sprint-review"
    DESIGN_NOTE = "design-note"
    STORY_NOTE = "story-note"
    MEETING_NOTES = "meeting-notes"
    RETROSPECTIVE = "retrospective"
    TECHNICAL_DOC = "technical-doc"
    UNCATEGORIZED = "uncategorized"


# Folder name mapping for each document type
FOLDER_NAMES = {
    DocumentType.SPRINT_REVIEW: "01-Sprint-Reviews",
    DocumentType.DESIGN_NOTE: "02-Design-Notes",
    DocumentType.STORY_NOTE: "03-Story-Notes",
    DocumentType.MEETING_NOTES: "04-Meeting-Notes",
    DocumentType.RETROSPECTIVE: "05-Retrospectives",
    DocumentType.TECHNICAL_DOC: "06-Technical-Docs",
    DocumentType.UNCATEGORIZED: "99-Uncategorized",
}


@dataclass
class ClassificationResult:
    """Result of document classification."""
    doc_type: DocumentType
    confidence: float  # 0.0 - 1.0
    matched_patterns: List[str]
    matched_keywords: List[str]
    source_sprint: Optional[str] = None  # Extracted sprint identifier


class DocumentClassifier:
    """
    Classifies documents based on title patterns and content keywords.

    Uses regex patterns for title matching and keyword frequency
    for content analysis.
    """

    # Title patterns (case-insensitive)
    TITLE_PATTERNS = {
        DocumentType.SPRINT_REVIEW: [
            r'sprint\s*\d*\s*review',
            r'review\s+of\s+sprint',
            r'burndown',
            r'sprint\s*\d*\s*summary',
            r'velocity\s+report',
            r'sprint\s+report',
        ],
        DocumentType.DESIGN_NOTE: [
            r'design\s*note',
            r'architecture',
            r'rfc\b',
            r'technical\s*design',
            r'system\s*design',
            r'design\s*doc',
            r'hld\b',  # High-Level Design
            r'lld\b',  # Low-Level Design
        ],
        DocumentType.STORY_NOTE: [
            r'story[-\s]*\d+',
            r'[A-Z]{2,10}-\d+',  # JIRA key pattern (e.g., ASP-123)
            r'user\s*story',
            r'feature\s*spec',
            r'requirements?\s+doc',
        ],
        DocumentType.MEETING_NOTES: [
            r'meeting\s*note',
            r'standup',
            r'stand-up',
            r'sync\s*meeting',
            r'weekly\s*sync',
            r'daily\s*sync',
            r'scrum\s*meeting',
            r'planning\s*meeting',
            r'grooming',
            r'refinement',
        ],
        DocumentType.RETROSPECTIVE: [
            r'retro(spective)?',
            r'sprint\s*\d*\s*retro',
            r'lessons?\s*learned',
            r'post[\s-]*mortem',
            r'what\s+went\s+well',
        ],
        DocumentType.TECHNICAL_DOC: [
            r'api\s*doc',
            r'guide',
            r'setup\s*instruction',
            r'how[\s-]*to',
            r'tutorial',
            r'reference\s*doc',
            r'developer\s*guide',
            r'user\s*manual',
            r'onboarding',
            r'installation',
        ],
    }

    # Content keywords for each type
    CONTENT_KEYWORDS = {
        DocumentType.SPRINT_REVIEW: [
            'velocity', 'burndown', 'story points', 'completed', 'carried over',
            'sprint goal', 'done', 'in progress', 'demo', 'showcase',
            'achievements', 'delivered', 'sprint metrics',
        ],
        DocumentType.DESIGN_NOTE: [
            'architecture', 'component', 'interface', 'module', 'diagram',
            'sequence', 'class diagram', 'flow chart', 'design decision',
            'tradeoff', 'alternative', 'proposed solution', 'technical approach',
        ],
        DocumentType.STORY_NOTE: [
            'acceptance criteria', 'user story', 'as a user', 'given when then',
            'scenario', 'requirement', 'feature', 'epic', 'subtask',
            'definition of done', 'dod', 'acceptance test',
        ],
        DocumentType.MEETING_NOTES: [
            'attendees', 'agenda', 'action items', 'decisions', 'discussion',
            'follow up', 'next steps', 'minutes', 'blockers', 'updates',
            'participants', 'notes from',
        ],
        DocumentType.RETROSPECTIVE: [
            'went well', 'improve', 'action items', 'kudos', 'keep doing',
            'stop doing', 'start doing', 'feedback', 'team health',
            'mad sad glad', 'lessons learned',
        ],
        DocumentType.TECHNICAL_DOC: [
            'installation', 'prerequisites', 'configuration', 'api', 'endpoint',
            'parameters', 'response', 'example', 'usage', 'command',
            'step by step', 'getting started', 'troubleshooting',
        ],
    }

    # Sprint identifier patterns
    SPRINT_PATTERNS = [
        r'\[?Scaled[-\s]*Sprint[-\s]*(\d+)\]?',
        r'\[?Sprint[-\s]*(\d+)\]?',
        r'Sprint\s+(\d+)',
        r'S(\d+)',
    ]

    def __init__(self, min_confidence: float = 0.3):
        """
        Initialize classifier.

        Args:
            min_confidence: Minimum confidence to assign a type (default 0.3)
        """
        self.min_confidence = min_confidence

        # Compile regex patterns
        self._compiled_title_patterns: Dict[DocumentType, List[re.Pattern]] = {}
        for doc_type, patterns in self.TITLE_PATTERNS.items():
            self._compiled_title_patterns[doc_type] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

        self._compiled_sprint_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.SPRINT_PATTERNS
        ]

    def classify(
        self,
        title: str,
        content: str = "",
        parent_title: str = ""
    ) -> ClassificationResult:
        """
        Classify a document by its title and content.

        Args:
            title: Document title
            content: Document body content (optional)
            parent_title: Parent page title for context (optional)

        Returns:
            ClassificationResult with type, confidence, and matched patterns
        """
        scores: Dict[DocumentType, float] = {t: 0.0 for t in DocumentType}
        matched_patterns: Dict[DocumentType, List[str]] = {t: [] for t in DocumentType}
        matched_keywords: Dict[DocumentType, List[str]] = {t: [] for t in DocumentType}

        # Extract sprint identifier from title or parent
        source_sprint = self._extract_sprint(title) or self._extract_sprint(parent_title)

        # Title pattern matching (weight: 0.6)
        for doc_type, patterns in self._compiled_title_patterns.items():
            for pattern in patterns:
                if pattern.search(title):
                    scores[doc_type] += 0.6
                    matched_patterns[doc_type].append(pattern.pattern)
                    break  # Only count first match per type

        # Content keyword matching (weight: 0.4)
        if content:
            content_lower = content.lower()
            for doc_type, keywords in self.CONTENT_KEYWORDS.items():
                keyword_count = 0
                for keyword in keywords:
                    if keyword.lower() in content_lower:
                        keyword_count += 1
                        if keyword not in matched_keywords[doc_type]:
                            matched_keywords[doc_type].append(keyword)

                # Normalize keyword score (max 0.4)
                if keyword_count > 0:
                    keyword_score = min(keyword_count / 5.0, 1.0) * 0.4
                    scores[doc_type] += keyword_score

        # Find best match
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]

        # Apply minimum confidence threshold
        if best_score < self.min_confidence:
            best_type = DocumentType.UNCATEGORIZED
            best_score = 0.0

        return ClassificationResult(
            doc_type=best_type,
            confidence=min(best_score, 1.0),
            matched_patterns=matched_patterns.get(best_type, []),
            matched_keywords=matched_keywords.get(best_type, []),
            source_sprint=source_sprint,
        )

    def _extract_sprint(self, text: str) -> Optional[str]:
        """Extract sprint number from text."""
        if not text:
            return None

        for pattern in self._compiled_sprint_patterns:
            match = pattern.search(text)
            if match:
                return f"Sprint {match.group(1)}"

        return None

    def get_folder_name(self, doc_type: DocumentType) -> str:
        """Get the target folder name for a document type."""
        return FOLDER_NAMES.get(doc_type, FOLDER_NAMES[DocumentType.UNCATEGORIZED])

    def classify_batch(
        self,
        pages: List[Dict]
    ) -> List[Tuple[Dict, ClassificationResult]]:
        """
        Classify multiple pages.

        Args:
            pages: List of page dicts with 'title', 'body_storage' or 'content',
                   and optionally 'parent_title' keys

        Returns:
            List of (page, ClassificationResult) tuples
        """
        results = []

        for page in pages:
            title = page.get('title', '')
            content = page.get('body_storage', '') or page.get('content', '')
            parent_title = page.get('parent_title', '')

            result = self.classify(title, content, parent_title)
            results.append((page, result))

        return results

    def get_classification_summary(
        self,
        results: List[Tuple[Dict, ClassificationResult]]
    ) -> Dict[str, int]:
        """
        Get summary counts by document type.

        Args:
            results: List of (page, ClassificationResult) tuples

        Returns:
            Dict mapping document type to count
        """
        summary = {t.value: 0 for t in DocumentType}

        for _, result in results:
            summary[result.doc_type.value] += 1

        return summary
