#!/usr/bin/env python3
"""
Content Operations Executor

Processes queued operations from content_operations table and executes them
against Jira/Confluence APIs.

Usage:
  python scripts/execute_operations.py                 # Process all approved operations
  python scripts/execute_operations.py --pending       # Show pending operations
  python scripts/execute_operations.py --approve UUID  # Approve specific operation
  python scripts/execute_operations.py --execute UUID  # Execute specific operation
  python scripts/execute_operations.py --rollback UUID # Rollback a completed operation
  python scripts/execute_operations.py --dry-run       # Show what would happen
"""

import os
import sys
import json
import time
import argparse
import requests
import psycopg2
from psycopg2.extras import Json, RealDictCursor
from datetime import datetime
from typing import Optional, Dict, List, Any
from uuid import UUID


# --- Configuration ---
def load_env(env_path=".env"):
    config = {}
    try:
        if not os.path.exists(env_path):
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
    except FileNotFoundError:
        print(f"Warning: .env file not found")
    return config


config = load_env()

# Jira config
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

# Confluence config
CONFLUENCE_URL = config.get("CONFLUENCE_URL", JIRA_URL)  # Often same base URL
CONFLUENCE_EMAIL = config.get("CONFLUENCE_EMAIL", JIRA_EMAIL)
CONFLUENCE_TOKEN = config.get("CONFLUENCE_TOKEN", JIRA_TOKEN)

# DB config
DB_HOST = config.get("DB_HOST", "localhost")
DB_PORT = config.get("DB_PORT", "5432")
DB_NAME = config.get("DB_NAME", "javis_brain")
DB_USER = config.get("DB_USER", "javis")
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")


def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )


def jira_request(method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
    """Make authenticated Jira API request."""
    url = f"{JIRA_URL}{endpoint}"
    auth = (JIRA_EMAIL, JIRA_TOKEN)

    try:
        response = requests.request(method, url, auth=auth, timeout=30, **kwargs)
        return response
    except requests.exceptions.RequestException as e:
        print(f"  Jira API Error: {e}")
        return None


def confluence_request(method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
    """Make authenticated Confluence API request."""
    url = f"{CONFLUENCE_URL}{endpoint}"
    auth = (CONFLUENCE_EMAIL, CONFLUENCE_TOKEN)

    try:
        response = requests.request(method, url, auth=auth, timeout=30, **kwargs)
        return response
    except requests.exceptions.RequestException as e:
        print(f"  Confluence API Error: {e}")
        return None


# --- Operation Handlers ---

class OperationHandler:
    """Base class for operation handlers."""

    def __init__(self, conn, operation: Dict, dry_run: bool = False):
        self.conn = conn
        self.operation = operation
        self.dry_run = dry_run
        self.history_records = []

    def save_history(self, target_type: str, target_id: str, before_data: Dict, after_data: Dict, changed_fields: List[str]):
        """Save history record for rollback."""
        if self.dry_run:
            return

        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO content_history (operation_id, target_type, target_id, before_data, after_data, changed_fields)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, [
            self.operation['id'],
            target_type,
            target_id,
            Json(before_data),
            Json(after_data),
            changed_fields
        ])
        history_id = cur.fetchone()[0]
        self.history_records.append(history_id)

    def execute(self) -> bool:
        """Execute the operation. Returns True on success."""
        raise NotImplementedError


class JiraUpdateFieldHandler(OperationHandler):
    """Handle Jira field update operations."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']
        target_ids = self.operation['target_ids']

        field = op_data.get('field')
        new_value = op_data.get('new_value')

        if not field or not target_ids:
            print("  Error: Missing field or target_ids")
            return False

        success_count = 0

        for issue_key in target_ids:
            print(f"  Updating {issue_key}.{field}...")

            # Get current value for history
            response = jira_request('GET', f'/rest/api/3/issue/{issue_key}', params={'fields': field})
            if not response or not response.ok:
                print(f"    Error fetching {issue_key}")
                continue

            before_data = response.json()

            if self.dry_run:
                print(f"    [DRY-RUN] Would update {field} = {new_value}")
                success_count += 1
                continue

            # Build update payload
            payload = {'fields': {field: new_value}}

            # Special handling for certain fields
            if field == 'priority' and isinstance(new_value, str):
                payload = {'fields': {'priority': {'name': new_value}}}
            elif field == 'assignee' and isinstance(new_value, str):
                payload = {'fields': {'assignee': {'accountId': new_value}}}

            # Execute update
            response = jira_request('PUT', f'/rest/api/3/issue/{issue_key}', json=payload)

            if response and response.ok:
                # Get after state
                after_response = jira_request('GET', f'/rest/api/3/issue/{issue_key}', params={'fields': field})
                after_data = after_response.json() if after_response and after_response.ok else {}

                self.save_history('jira', issue_key, before_data, after_data, [field])
                print(f"    Updated successfully")
                success_count += 1
            else:
                print(f"    Error: {response.text if response else 'No response'}")

            time.sleep(0.3)

        return success_count == len(target_ids)


class JiraBulkTransitionHandler(OperationHandler):
    """Handle bulk status transitions."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']
        target_ids = self.operation['target_ids']

        transition_id = op_data.get('transition_id')
        transition_name = op_data.get('transition_name')

        if not transition_id and not transition_name:
            print("  Error: Need transition_id or transition_name")
            return False

        success_count = 0

        for issue_key in target_ids:
            print(f"  Transitioning {issue_key}...")

            # Get current status for history
            response = jira_request('GET', f'/rest/api/3/issue/{issue_key}', params={'fields': 'status'})
            if not response or not response.ok:
                print(f"    Error fetching {issue_key}")
                continue

            before_data = response.json()

            # If we have transition_name but not id, find it
            actual_transition_id = transition_id
            if not actual_transition_id:
                trans_response = jira_request('GET', f'/rest/api/3/issue/{issue_key}/transitions')
                if trans_response and trans_response.ok:
                    transitions = trans_response.json().get('transitions', [])
                    for t in transitions:
                        if t['name'].lower() == transition_name.lower():
                            actual_transition_id = t['id']
                            break

            if not actual_transition_id:
                print(f"    Error: Could not find transition '{transition_name}'")
                continue

            if self.dry_run:
                print(f"    [DRY-RUN] Would transition with id={actual_transition_id}")
                success_count += 1
                continue

            # Execute transition
            payload = {'transition': {'id': actual_transition_id}}
            response = jira_request('POST', f'/rest/api/3/issue/{issue_key}/transitions', json=payload)

            if response and response.ok:
                after_response = jira_request('GET', f'/rest/api/3/issue/{issue_key}', params={'fields': 'status'})
                after_data = after_response.json() if after_response and after_response.ok else {}

                self.save_history('jira', issue_key, before_data, after_data, ['status'])
                print(f"    Transitioned successfully")
                success_count += 1
            else:
                print(f"    Error: {response.text if response else 'No response'}")

            time.sleep(0.3)

        return success_count == len(target_ids)


class JiraLinkIssuesHandler(OperationHandler):
    """Handle issue linking."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']

        link_type = op_data.get('link_type', 'Relates')
        outward_issue = op_data.get('outward_issue')
        inward_issue = op_data.get('inward_issue')

        if not outward_issue or not inward_issue:
            print("  Error: Need both outward_issue and inward_issue")
            return False

        print(f"  Linking {outward_issue} -> {inward_issue} ({link_type})...")

        if self.dry_run:
            print(f"    [DRY-RUN] Would create link")
            return True

        payload = {
            'type': {'name': link_type},
            'outwardIssue': {'key': outward_issue},
            'inwardIssue': {'key': inward_issue}
        }

        response = jira_request('POST', '/rest/api/3/issueLink', json=payload)

        if response and response.ok:
            self.save_history('jira', outward_issue, {}, {'link': payload}, ['issuelinks'])
            print(f"    Link created successfully")
            return True
        else:
            print(f"    Error: {response.text if response else 'No response'}")
            return False


class ConfluenceMergeHandler(OperationHandler):
    """Handle Confluence page merge operations."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']
        preview_data = self.operation.get('preview_data', {})

        destination_id = op_data.get('destination_id') or op_data.get('primary_page_id')
        source_ids = op_data.get('source_ids') or op_data.get('secondary_page_ids', [])
        merged_content = preview_data.get('merged_content')

        if not destination_id:
            print("  Error: Need destination_id or primary_page_id")
            return False

        print(f"  Merging {len(source_ids)} pages into {destination_id}...")

        # Get current content of destination for history
        response = confluence_request('GET', f'/wiki/api/v2/pages/{destination_id}', params={
            'body-format': 'storage'
        })

        if not response or not response.ok:
            print(f"    Error fetching destination page")
            return False

        before_data = response.json()
        current_version = before_data.get('version', {}).get('number', 1)

        # Build merged content if not provided
        if not merged_content:
            merged_content = before_data.get('body', {}).get('storage', {}).get('value', '')
            for source_id in source_ids:
                src_response = confluence_request('GET', f'/wiki/api/v2/pages/{source_id}', params={
                    'body-format': 'storage'
                })
                if src_response and src_response.ok:
                    src_data = src_response.json()
                    src_body = src_data.get('body', {}).get('storage', {}).get('value', '')
                    src_title = src_data.get('title', 'Unknown')
                    merged_content += f'\n<hr/>\n<h2>Merged from: {src_title}</h2>\n{src_body}'

        if self.dry_run:
            print(f"    [DRY-RUN] Would merge {len(source_ids)} pages")
            return True

        # Update destination page with merged content
        new_title = op_data.get('merged_title', before_data.get('title'))
        payload = {
            'id': destination_id,
            'status': 'current',
            'title': new_title,
            'body': {
                'representation': 'storage',
                'value': merged_content
            },
            'version': {
                'number': current_version + 1,
                'message': f'Merged from pages: {", ".join(source_ids)}'
            }
        }

        response = confluence_request('PUT', f'/wiki/api/v2/pages/{destination_id}', json=payload)

        if response and response.ok:
            after_data = response.json()
            self.save_history('confluence', destination_id, before_data, after_data, ['body'])

            # Archive source pages
            for source_id in source_ids:
                self._archive_page(source_id)

            print(f"    Merge completed successfully")
            return True
        else:
            print(f"    Error: {response.text if response else 'No response'}")
            return False

    def _archive_page(self, page_id: str):
        """Archive a Confluence page by adding [ARCHIVED] prefix."""
        response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}')
        if not response or not response.ok:
            return

        page = response.json()
        current_title = page.get('title', '')

        if not current_title.startswith('[ARCHIVED]'):
            payload = {
                'id': page_id,
                'status': 'current',
                'title': f'[ARCHIVED] {current_title}',
                'version': {
                    'number': page.get('version', {}).get('number', 1) + 1,
                    'message': 'Archived after merge'
                }
            }
            confluence_request('PUT', f'/wiki/api/v2/pages/{page_id}', json=payload)


class ConfluenceUpdateHandler(OperationHandler):
    """Handle Confluence page update operations."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']
        target_ids = self.operation['target_ids']

        if not target_ids:
            print("  Error: No target pages specified")
            return False

        success_count = 0

        for page_id in target_ids:
            print(f"  Updating page {page_id}...")

            # Get current page
            response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}', params={
                'body-format': 'storage'
            })

            if not response or not response.ok:
                print(f"    Error fetching page")
                continue

            before_data = response.json()
            current_version = before_data.get('version', {}).get('number', 1)

            # Determine what to update
            new_title = op_data.get('title', before_data.get('title'))
            new_body = op_data.get('body')

            if self.dry_run:
                print(f"    [DRY-RUN] Would update page")
                success_count += 1
                continue

            payload = {
                'id': page_id,
                'status': 'current',
                'title': new_title,
                'version': {
                    'number': current_version + 1,
                    'message': op_data.get('message', 'Updated via Javis')
                }
            }

            if new_body:
                payload['body'] = {
                    'representation': 'storage',
                    'value': new_body
                }

            response = confluence_request('PUT', f'/wiki/api/v2/pages/{page_id}', json=payload)

            if response and response.ok:
                after_data = response.json()
                self.save_history('confluence', page_id, before_data, after_data, ['title', 'body'])
                print(f"    Updated successfully")
                success_count += 1
            else:
                print(f"    Error: {response.text if response else 'No response'}")

            time.sleep(0.3)

        return success_count == len(target_ids)


class ConfluenceMoveHandler(OperationHandler):
    """Handle Confluence page move operations."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']
        target_ids = self.operation['target_ids']

        new_parent_id = op_data.get('new_parent_id')

        if not new_parent_id:
            print("  Error: new_parent_id required")
            return False

        success_count = 0

        for page_id in target_ids:
            print(f"  Moving page {page_id} to parent {new_parent_id}...")

            # Get current page
            response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}')

            if not response or not response.ok:
                print(f"    Error fetching page")
                continue

            before_data = response.json()
            current_version = before_data.get('version', {}).get('number', 1)

            if self.dry_run:
                print(f"    [DRY-RUN] Would move page")
                success_count += 1
                continue

            payload = {
                'id': page_id,
                'status': 'current',
                'title': before_data.get('title'),
                'parentId': new_parent_id,
                'version': {
                    'number': current_version + 1,
                    'message': f'Moved to new parent via Javis'
                }
            }

            response = confluence_request('PUT', f'/wiki/api/v2/pages/{page_id}', json=payload)

            if response and response.ok:
                after_data = response.json()
                self.save_history('confluence', page_id, before_data, after_data, ['parentId'])
                print(f"    Moved successfully")
                success_count += 1
            else:
                print(f"    Error: {response.text if response else 'No response'}")

            time.sleep(0.3)

        return success_count == len(target_ids)


class ConfluenceLabelHandler(OperationHandler):
    """Handle Confluence label operations."""

    def execute(self) -> bool:
        op_data = self.operation['operation_data']
        target_ids = self.operation['target_ids']

        add_labels = op_data.get('add_labels', [])
        remove_labels = op_data.get('remove_labels', [])

        if not add_labels and not remove_labels:
            print("  Error: No labels to add or remove")
            return False

        success_count = 0

        for page_id in target_ids:
            print(f"  Updating labels on page {page_id}...")

            # Get current labels for history
            response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}/labels')
            before_labels = []
            if response and response.ok:
                before_labels = [l['name'] for l in response.json().get('results', [])]

            if self.dry_run:
                print(f"    [DRY-RUN] Would add {add_labels}, remove {remove_labels}")
                success_count += 1
                continue

            # Add labels
            for label in add_labels:
                response = confluence_request('POST', f'/wiki/api/v2/pages/{page_id}/labels', json={
                    'name': label
                })
                if response and response.ok:
                    print(f"    Added label: {label}")
                elif response and response.status_code != 400:  # 400 = already exists
                    print(f"    Error adding {label}: {response.text}")

            # Remove labels
            if remove_labels:
                response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}/labels')
                if response and response.ok:
                    label_map = {l['name']: l['id'] for l in response.json().get('results', [])}
                    for label in remove_labels:
                        if label in label_map:
                            del_response = confluence_request(
                                'DELETE',
                                f'/wiki/api/v2/pages/{page_id}/labels/{label_map[label]}'
                            )
                            if del_response and del_response.ok:
                                print(f"    Removed label: {label}")

            # Get after labels for history
            response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}/labels')
            after_labels = []
            if response and response.ok:
                after_labels = [l['name'] for l in response.json().get('results', [])]

            self.save_history(
                'confluence', page_id,
                {'labels': before_labels},
                {'labels': after_labels},
                ['labels']
            )

            success_count += 1
            time.sleep(0.3)

        return success_count == len(target_ids)


class ConfluenceArchiveHandler(OperationHandler):
    """Handle Confluence page archive operations."""

    def execute(self) -> bool:
        target_ids = self.operation['target_ids']

        success_count = 0

        for page_id in target_ids:
            print(f"  Archiving page {page_id}...")

            # Get current page
            response = confluence_request('GET', f'/wiki/api/v2/pages/{page_id}')

            if not response or not response.ok:
                print(f"    Error fetching page")
                continue

            before_data = response.json()
            current_title = before_data.get('title', '')
            current_version = before_data.get('version', {}).get('number', 1)

            if current_title.startswith('[ARCHIVED]'):
                print(f"    Page already archived")
                success_count += 1
                continue

            if self.dry_run:
                print(f"    [DRY-RUN] Would archive page")
                success_count += 1
                continue

            # Add archived label
            confluence_request('POST', f'/wiki/api/v2/pages/{page_id}/labels', json={
                'name': 'archived'
            })

            # Update title with [ARCHIVED] prefix
            payload = {
                'id': page_id,
                'status': 'current',
                'title': f'[ARCHIVED] {current_title}',
                'version': {
                    'number': current_version + 1,
                    'message': 'Archived via Javis'
                }
            }

            response = confluence_request('PUT', f'/wiki/api/v2/pages/{page_id}', json=payload)

            if response and response.ok:
                after_data = response.json()
                self.save_history('confluence', page_id, before_data, after_data, ['title', 'labels'])
                print(f"    Archived successfully")
                success_count += 1
            else:
                print(f"    Error: {response.text if response else 'No response'}")

            time.sleep(0.3)

        return success_count == len(target_ids)


# --- Handler Registry ---

HANDLERS = {
    # Jira handlers
    ('jira', 'update_field'): JiraUpdateFieldHandler,
    ('jira', 'bulk_transition'): JiraBulkTransitionHandler,
    ('jira', 'link_issues'): JiraLinkIssuesHandler,
    # Confluence handlers
    ('confluence', 'merge'): ConfluenceMergeHandler,
    ('confluence', 'update'): ConfluenceUpdateHandler,
    ('confluence', 'restructure'): ConfluenceMoveHandler,
    ('confluence', 'move'): ConfluenceMoveHandler,
    ('confluence', 'label'): ConfluenceLabelHandler,
    ('confluence', 'archive'): ConfluenceArchiveHandler,
}


def get_handler(operation: Dict, conn, dry_run: bool = False) -> Optional[OperationHandler]:
    """Get appropriate handler for operation."""
    key = (operation['target_type'], operation['operation_type'])
    handler_class = HANDLERS.get(key)

    if handler_class:
        return handler_class(conn, operation, dry_run)
    return None


# --- Operations Management ---

def list_operations(conn, status: str = None):
    """List operations by status."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, operation_type, target_type, target_ids, status, created_at, approved_at, executed_at
        FROM content_operations
    """
    params = []

    if status:
        query += " WHERE status = %s"
        params.append(status)

    query += " ORDER BY created_at DESC LIMIT 50"

    cur.execute(query, params)
    operations = cur.fetchall()

    if not operations:
        print(f"No operations found{' with status=' + status if status else ''}")
        return

    print(f"\n{'ID':<36} {'Type':<15} {'Target':<10} {'Status':<12} {'Created'}")
    print("-" * 100)

    for op in operations:
        op_id = str(op['id'])[:8] + '...'
        targets = f"{len(op['target_ids'])} items"
        created = op['created_at'].strftime('%Y-%m-%d %H:%M') if op['created_at'] else '-'
        print(f"{op_id:<36} {op['operation_type']:<15} {op['target_type']:<10} {op['status']:<12} {created}")


def approve_operation(conn, operation_id: str, approved_by: str = 'cli'):
    """Approve a pending operation."""
    cur = conn.cursor()

    cur.execute("""
        UPDATE content_operations
        SET status = 'approved', approved_at = NOW(), approved_by = %s
        WHERE id = %s AND status = 'pending'
        RETURNING id
    """, [approved_by, operation_id])

    if cur.fetchone():
        conn.commit()
        print(f"Operation {operation_id} approved")
        return True
    else:
        print(f"Operation {operation_id} not found or not pending")
        return False


def execute_operation(conn, operation_id: str, dry_run: bool = False):
    """Execute a single operation."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT * FROM content_operations WHERE id = %s
    """, [operation_id])

    operation = cur.fetchone()
    if not operation:
        print(f"Operation {operation_id} not found")
        return False

    if operation['status'] not in ('approved', 'pending'):
        print(f"Operation status is '{operation['status']}', cannot execute")
        return False

    print(f"\nExecuting operation: {operation['operation_type']} on {operation['target_type']}")
    print(f"Targets: {operation['target_ids']}")

    handler = get_handler(operation, conn, dry_run)
    if not handler:
        print(f"No handler found for {operation['target_type']}/{operation['operation_type']}")
        return False

    # Mark as executing
    if not dry_run:
        cur.execute("""
            UPDATE content_operations SET status = 'executing' WHERE id = %s
        """, [operation_id])
        conn.commit()

    try:
        success = handler.execute()

        if not dry_run:
            if success:
                cur.execute("""
                    UPDATE content_operations
                    SET status = 'completed', executed_at = NOW()
                    WHERE id = %s
                """, [operation_id])
            else:
                cur.execute("""
                    UPDATE content_operations
                    SET status = 'failed', error_message = 'Execution failed'
                    WHERE id = %s
                """, [operation_id])

            conn.commit()

        return success

    except Exception as e:
        if not dry_run:
            cur.execute("""
                UPDATE content_operations
                SET status = 'failed', error_message = %s
                WHERE id = %s
            """, [str(e), operation_id])
            conn.commit()
        raise


def execute_approved_operations(conn, dry_run: bool = False):
    """Execute all approved operations."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id FROM content_operations
        WHERE status = 'approved'
        ORDER BY approved_at ASC
    """)

    operations = cur.fetchall()

    if not operations:
        print("No approved operations to execute")
        return

    print(f"Found {len(operations)} approved operations")

    for op in operations:
        try:
            execute_operation(conn, str(op['id']), dry_run)
        except Exception as e:
            print(f"Error executing {op['id']}: {e}")
            continue

        time.sleep(0.5)


def rollback_operation(conn, operation_id: str, dry_run: bool = False):
    """Rollback a completed operation."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get history records for this operation
    cur.execute("""
        SELECT * FROM content_history
        WHERE operation_id = %s AND rolled_back = FALSE
        ORDER BY created_at DESC
    """, [operation_id])

    history_records = cur.fetchall()

    if not history_records:
        print(f"No history records found for operation {operation_id}")
        return False

    print(f"Rolling back {len(history_records)} changes...")

    for record in history_records:
        target_type = record['target_type']
        target_id = record['target_id']
        before_data = record['before_data']

        print(f"  Restoring {target_type}/{target_id}...")

        if dry_run:
            print(f"    [DRY-RUN] Would restore to before state")
            continue

        if target_type == 'jira':
            # Restore Jira issue
            fields = before_data.get('fields', {})
            changed = record.get('changed_fields', [])

            payload = {'fields': {}}
            for field in changed:
                if field in fields:
                    payload['fields'][field] = fields[field]

            if payload['fields']:
                response = jira_request('PUT', f'/rest/api/3/issue/{target_id}', json=payload)
                if response and response.ok:
                    print(f"    Restored")
                else:
                    print(f"    Error: {response.text if response else 'No response'}")
                    continue

        elif target_type == 'confluence':
            # Restore Confluence page
            body = before_data.get('body', {})

            # Get current version
            response = confluence_request('GET', f'/wiki/api/v2/pages/{target_id}')
            if not response or not response.ok:
                print(f"    Error fetching page")
                continue

            current = response.json()
            current_version = current.get('version', {}).get('number', 1)

            payload = {
                'id': target_id,
                'status': 'current',
                'title': before_data.get('title', current.get('title')),
                'body': body,
                'version': {
                    'number': current_version + 1,
                    'message': 'Rolled back'
                }
            }

            response = confluence_request('PUT', f'/wiki/api/v2/pages/{target_id}', json=payload)
            if response and response.ok:
                print(f"    Restored")
            else:
                print(f"    Error: {response.text if response else 'No response'}")
                continue

        # Mark history as rolled back
        cur.execute("""
            UPDATE content_history
            SET rolled_back = TRUE, rolled_back_at = NOW()
            WHERE id = %s
        """, [record['id']])

    if not dry_run:
        conn.commit()

    print("Rollback complete")
    return True


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description='Execute Content Operations')
    parser.add_argument('--pending', action='store_true', help='List pending operations')
    parser.add_argument('--approved', action='store_true', help='List approved operations')
    parser.add_argument('--all', action='store_true', help='List all operations')
    parser.add_argument('--approve', type=str, metavar='UUID', help='Approve an operation')
    parser.add_argument('--execute', type=str, metavar='UUID', help='Execute specific operation')
    parser.add_argument('--rollback', type=str, metavar='UUID', help='Rollback an operation')
    parser.add_argument('--dry-run', action='store_true', help='Show what would happen')
    args = parser.parse_args()

    conn = get_db_connection()

    try:
        if args.pending:
            list_operations(conn, 'pending')
        elif args.approved:
            list_operations(conn, 'approved')
        elif args.all:
            list_operations(conn)
        elif args.approve:
            approve_operation(conn, args.approve)
        elif args.execute:
            execute_operation(conn, args.execute, args.dry_run)
        elif args.rollback:
            rollback_operation(conn, args.rollback, args.dry_run)
        else:
            # Default: execute all approved operations
            execute_approved_operations(conn, args.dry_run)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
