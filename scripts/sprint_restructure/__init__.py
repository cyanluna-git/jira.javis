"""
Sprint Restructure Module

Provides tools to reorganize Confluence sprint pages by document type
with similarity detection and merge proposals.

Main components:
- DocumentClassifier: Classifies pages by type (sprint-review, design-note, etc.)
- SimilarityAnalyzer: Detects similar documents for merge proposals
- StructureProposer: Generates new folder structure proposals
- OperationPlanner: Creates content_operations for approval workflow
- CLI: Command-line interface

Usage:
    from sprint_restructure import DocumentClassifier, StructureProposer

    classifier = DocumentClassifier()
    doc_type = classifier.classify(title="Sprint 8 Review", content="...")
"""

from .document_classifier import DocumentClassifier, DocumentType
from .similarity_analyzer import SimilarityAnalyzer, SimilarityGroup
from .structure_proposer import StructureProposer, RestructureProposal
from .operation_planner import OperationPlanner
from .name_resolver import NameResolver

__all__ = [
    'DocumentClassifier',
    'DocumentType',
    'SimilarityAnalyzer',
    'SimilarityGroup',
    'StructureProposer',
    'RestructureProposal',
    'OperationPlanner',
    'NameResolver',
]
