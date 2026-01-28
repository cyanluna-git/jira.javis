"""
Operation Planner

Creates content_operations entries for the restructuring workflow.

Workflow:
1. Generate operations from proposal
2. Insert into content_operations table (status: pending)
3. Support dry-run mode for preview
4. Track dependencies between operations
"""

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from .structure_proposer import RestructureProposal, PageMove, FolderCreation, ArchiveMove


@dataclass
class PlannedOperation:
    """A planned operation ready for content_operations table."""
    operation_type: str  # 'move', 'restructure', 'archive', 'create_folder', 'add_link'
    target_type: str  # 'confluence'
    target_ids: List[str]
    operation_data: Dict[str, Any]
    preview_data: Optional[Dict[str, Any]] = None
    depends_on: List[str] = field(default_factory=list)  # Operation IDs this depends on
    operation_id: Optional[str] = None


@dataclass
class OperationPlan:
    """Complete plan of operations."""
    proposal: RestructureProposal
    operations: List[PlannedOperation] = field(default_factory=list)
    folder_operations: List[PlannedOperation] = field(default_factory=list)
    move_operations: List[PlannedOperation] = field(default_factory=list)
    archive_operations: List[PlannedOperation] = field(default_factory=list)
    link_operations: List[PlannedOperation] = field(default_factory=list)

    @property
    def total_operations(self) -> int:
        return len(self.operations)


class OperationPlanner:
    """
    Creates operation plans from restructure proposals.

    Operations are organized with proper dependencies:
    1. Create folders first
    2. Move pages (depends on folder creation)
    3. Archive original folders (depends on moves)
    4. Add links (can be parallel)
    """

    def __init__(self, db_connection=None):
        """
        Initialize planner.

        Args:
            db_connection: Optional database connection for direct insertion
        """
        self.conn = db_connection

    def create_plan(self, proposal: RestructureProposal) -> OperationPlan:
        """
        Create an operation plan from a proposal.

        Args:
            proposal: RestructureProposal to convert

        Returns:
            OperationPlan with all operations
        """
        plan = OperationPlan(proposal=proposal)

        # Track folder operation IDs for dependencies
        folder_op_ids: Dict[str, str] = {}  # folder_name -> operation_id

        # 1. Folder creation operations
        for folder in proposal.folders_to_create:
            op = PlannedOperation(
                operation_type='create_folder',
                target_type='confluence',
                target_ids=[proposal.parent_id],
                operation_data={
                    'parent_id': folder.parent_id,
                    'folder_name': folder.folder_name,
                    'space_id': proposal.space_id,
                    'order': folder.order,
                },
                preview_data={
                    'action': 'create',
                    'path': f"{proposal.parent_title}/{folder.folder_name}",
                },
                operation_id=str(uuid.uuid4()),
            )
            plan.folder_operations.append(op)
            plan.operations.append(op)
            folder_op_ids[folder.folder_name] = op.operation_id

        # 2. Page move operations (batched by target folder)
        moves_by_folder: Dict[str, List[PageMove]] = {}
        for move in proposal.pages_to_move:
            folder_name = move.target_folder_name
            if folder_name not in moves_by_folder:
                moves_by_folder[folder_name] = []
            moves_by_folder[folder_name].append(move)

        for folder_name, moves in moves_by_folder.items():
            # Build operation data
            move_items = []
            for move in moves:
                move_items.append({
                    'page_id': move.page_id,
                    'original_title': move.original_title,
                    'new_title': move.resolved_title if move.name_changed else None,
                    'source_parent_id': move.source_parent_id,
                    'source_parent_title': move.source_parent_title,
                })

            # Determine dependencies
            depends_on = []
            if folder_name in folder_op_ids:
                depends_on.append(folder_op_ids[folder_name])

            op = PlannedOperation(
                operation_type='restructure',
                target_type='confluence',
                target_ids=[m.page_id for m in moves],
                operation_data={
                    'target_folder_name': folder_name,
                    'target_folder_id': moves[0].target_folder_id,  # May be None if new
                    'moves': move_items,
                    'parent_id': proposal.parent_id,
                },
                preview_data={
                    'action': 'move',
                    'target_folder': folder_name,
                    'page_count': len(moves),
                    'name_changes': sum(1 for m in moves if m.name_changed),
                },
                depends_on=depends_on,
                operation_id=str(uuid.uuid4()),
            )
            plan.move_operations.append(op)
            plan.operations.append(op)

        # 3. Archive operations
        if proposal.folders_to_archive:
            # Archive folder must exist first
            archive_folder_op_id = folder_op_ids.get('99-Archive')

            # All moves must complete before archiving
            move_op_ids = [op.operation_id for op in plan.move_operations]

            for archive in proposal.folders_to_archive:
                depends_on = list(move_op_ids)  # Wait for all moves
                if archive_folder_op_id:
                    depends_on.append(archive_folder_op_id)

                op = PlannedOperation(
                    operation_type='archive',
                    target_type='confluence',
                    target_ids=[archive.folder_id],
                    operation_data={
                        'folder_id': archive.folder_id,
                        'original_title': archive.folder_title,
                        'new_title': archive.new_title,
                        'move_to_archive': True,
                        'archive_folder_name': '99-Archive',
                    },
                    preview_data={
                        'action': 'archive',
                        'from': archive.folder_title,
                        'to': archive.new_title,
                    },
                    depends_on=depends_on,
                    operation_id=str(uuid.uuid4()),
                )
                plan.archive_operations.append(op)
                plan.operations.append(op)

        # 4. Link operations (independent, can run after moves)
        for suggestion in proposal.link_suggestions:
            op = PlannedOperation(
                operation_type='add_link',
                target_type='confluence',
                target_ids=suggestion.page_ids,
                operation_data={
                    'page_ids': suggestion.page_ids,
                    'page_titles': suggestion.page_titles,
                    'link_type': 'related',
                    'reason': suggestion.reason,
                },
                preview_data={
                    'action': 'link',
                    'pages': suggestion.page_titles,
                    'similarity': suggestion.similarity,
                },
                depends_on=[op.operation_id for op in plan.move_operations],
                operation_id=str(uuid.uuid4()),
            )
            plan.link_operations.append(op)
            plan.operations.append(op)

        return plan

    def save_to_db(
        self,
        plan: OperationPlan,
        created_by: str = 'sprint_restructure',
        dry_run: bool = False
    ) -> List[str]:
        """
        Save operations to content_operations table.

        Args:
            plan: OperationPlan to save
            created_by: Creator identifier
            dry_run: If True, don't actually save

        Returns:
            List of created operation IDs
        """
        if not self.conn and not dry_run:
            raise ValueError("Database connection required for save_to_db")

        created_ids = []

        if dry_run:
            print(f"\n[DRY-RUN] Would create {plan.total_operations} operations:")
            for op in plan.operations:
                print(f"  - {op.operation_type}: {len(op.target_ids)} targets")
            return [op.operation_id for op in plan.operations]

        from psycopg2.extras import Json

        cur = self.conn.cursor()

        for op in plan.operations:
            cur.execute("""
                INSERT INTO content_operations (
                    id, operation_type, target_type, target_ids,
                    operation_data, preview_data, status, created_by, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s, NOW())
                RETURNING id
            """, [
                op.operation_id,
                op.operation_type,
                op.target_type,
                op.target_ids,
                Json(op.operation_data),
                Json(op.preview_data) if op.preview_data else None,
                created_by,
            ])

            result = cur.fetchone()
            if result:
                created_ids.append(str(result[0]))

        self.conn.commit()

        return created_ids

    def generate_summary(self, plan: OperationPlan) -> str:
        """
        Generate a summary of the operation plan.

        Args:
            plan: OperationPlan to summarize

        Returns:
            Formatted summary string
        """
        lines = []
        lines.append("=" * 60)
        lines.append("OPERATION PLAN SUMMARY")
        lines.append("=" * 60)

        lines.append(f"\nTotal Operations: {plan.total_operations}")

        if plan.folder_operations:
            lines.append(f"\n1. Folder Creation ({len(plan.folder_operations)}):")
            for op in plan.folder_operations:
                lines.append(f"   - Create: {op.operation_data.get('folder_name')}")

        if plan.move_operations:
            lines.append(f"\n2. Page Moves ({len(plan.move_operations)} batches):")
            for op in plan.move_operations:
                folder = op.operation_data.get('target_folder_name')
                count = len(op.target_ids)
                name_changes = op.preview_data.get('name_changes', 0)
                lines.append(f"   - To {folder}/: {count} pages ({name_changes} renamed)")

        if plan.archive_operations:
            lines.append(f"\n3. Archive Operations ({len(plan.archive_operations)}):")
            for op in plan.archive_operations:
                lines.append(f"   - Archive: {op.operation_data.get('original_title')}")

        if plan.link_operations:
            lines.append(f"\n4. Link Suggestions ({len(plan.link_operations)}):")
            for op in plan.link_operations[:5]:
                pages = op.operation_data.get('page_titles', [])
                lines.append(f"   - Link: {', '.join(pages[:2])}...")
            if len(plan.link_operations) > 5:
                lines.append(f"   ... and {len(plan.link_operations) - 5} more")

        lines.append("\n" + "=" * 60)
        lines.append("Next steps:")
        lines.append("  1. Review operations in web UI or with 'javis restructure list'")
        lines.append("  2. Approve: 'javis restructure approve --all' or approve individually")
        lines.append("  3. Execute: 'python scripts/execute_operations.py'")
        lines.append("=" * 60)

        return "\n".join(lines)

    def approve_all(self, plan: OperationPlan, approved_by: str = 'cli') -> int:
        """
        Approve all operations in a plan.

        Args:
            plan: OperationPlan to approve
            approved_by: Approver identifier

        Returns:
            Number of approved operations
        """
        if not self.conn:
            raise ValueError("Database connection required for approve_all")

        cur = self.conn.cursor()

        op_ids = [op.operation_id for op in plan.operations]

        cur.execute("""
            UPDATE content_operations
            SET status = 'approved', approved_by = %s, approved_at = NOW()
            WHERE id = ANY(%s) AND status = 'pending'
        """, [approved_by, op_ids])

        count = cur.rowcount
        self.conn.commit()

        return count

    def list_pending(self) -> List[Dict]:
        """
        List pending restructure operations.

        Returns:
            List of pending operation dicts
        """
        if not self.conn:
            raise ValueError("Database connection required")

        from psycopg2.extras import RealDictCursor

        cur = self.conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, operation_type, target_type, target_ids, preview_data,
                   status, created_at, created_by
            FROM content_operations
            WHERE target_type = 'confluence'
              AND operation_type IN ('create_folder', 'restructure', 'archive', 'add_link')
              AND status = 'pending'
            ORDER BY created_at DESC
        """)

        return cur.fetchall()
