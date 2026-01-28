"""
Confluence Write API wrapper.

Provides functions to update, move, label, and archive Confluence pages.
"""

import json
import time
from typing import Dict, List, Optional, Tuple
import requests
from requests.auth import HTTPBasicAuth

from . import config, db


# Confluence API setup
CONFLUENCE_BASE = config.JIRA_URL.rstrip('/') if config.JIRA_URL else ''
AUTH = HTTPBasicAuth(config.JIRA_EMAIL or '', config.JIRA_TOKEN or '')


class ConfluenceAPIError(Exception):
    """Exception for Confluence API errors."""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class ConflictError(ConfluenceAPIError):
    """Exception for version conflicts."""
    def __init__(self, message: str, current_version: int, response: dict = None):
        super().__init__(message, 409, response)
        self.current_version = current_version


def api_request(
    method: str,
    endpoint: str,
    data: dict = None,
    retries: int = 3
) -> Optional[Dict]:
    """
    Make authenticated request to Confluence API.

    Args:
        method: HTTP method (GET, POST, PUT, DELETE)
        endpoint: API endpoint (e.g., /api/v2/pages/123)
        data: Request body for POST/PUT
        retries: Number of retries for rate limiting

    Returns:
        Response JSON or None for 204/404

    Raises:
        ConfluenceAPIError: For API errors
        ConflictError: For version conflicts
    """
    if not CONFLUENCE_BASE:
        raise ConfluenceAPIError("JIRA_URL not configured")

    if endpoint.startswith('http'):
        url = endpoint
    elif endpoint.startswith('/wiki'):
        url = f"{CONFLUENCE_BASE}{endpoint}"
    else:
        url = f"{CONFLUENCE_BASE}/wiki{endpoint}"

    headers = {'Content-Type': 'application/json'}

    attempt = 0
    while attempt < retries:
        try:
            response = requests.request(
                method=method,
                url=url,
                auth=AUTH,
                headers=headers,
                json=data,
                timeout=60
            )

            # Handle rate limiting
            if response.status_code == 429:
                wait = int(response.headers.get("Retry-After", 5)) + (2 ** attempt)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                attempt += 1
                continue

            # Handle success
            if response.status_code in [200, 201]:
                return response.json()
            elif response.status_code == 204:
                return None

            # Handle version conflict
            if response.status_code == 409:
                try:
                    resp_data = response.json()
                    current_version = resp_data.get('data', {}).get('currentVersion')
                    raise ConflictError(
                        f"Version conflict: {resp_data.get('message', 'Unknown')}",
                        current_version=current_version,
                        response=resp_data
                    )
                except (json.JSONDecodeError, KeyError):
                    raise ConfluenceAPIError(
                        f"Version conflict",
                        status_code=409,
                        response=response.text
                    )

            # Handle not found
            if response.status_code == 404:
                return None

            # Handle other errors
            try:
                error_data = response.json()
                message = error_data.get('message', response.text)
            except json.JSONDecodeError:
                message = response.text

            raise ConfluenceAPIError(
                f"API error: {message}",
                status_code=response.status_code,
                response=error_data if 'error_data' in locals() else response.text
            )

        except requests.exceptions.RequestException as e:
            print(f"  Request error: {e}")
            time.sleep(5)
            attempt += 1

    raise ConfluenceAPIError(f"Max retries ({retries}) exceeded")


class ConfluenceWriter:
    """Writer class for Confluence operations."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    def _log(self, message: str) -> None:
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(f"  {message}")

    def get_page(self, page_id: str) -> Optional[Dict]:
        """Get current page data from Confluence."""
        return api_request('GET', f'/api/v2/pages/{page_id}?body-format=storage')

    def get_page_version(self, page_id: str) -> int:
        """Get current page version number."""
        page = self.get_page(page_id)
        if page:
            return page.get('version', {}).get('number', 1)
        return 1

    def update_page(
        self,
        page_id: str,
        title: str = None,
        body: str = None,
        version: int = None,
        message: str = None
    ) -> Dict:
        """
        Update a Confluence page.

        Args:
            page_id: Page ID to update
            title: New title (optional, uses current if not provided)
            body: New body content in storage format
            version: Expected version (fetched if not provided)
            message: Version message

        Returns:
            Updated page data

        Raises:
            ConflictError: If version conflict
            ConfluenceAPIError: For other errors
        """
        # Get current page if we need title or version
        if title is None or version is None:
            current = self.get_page(page_id)
            if current is None:
                raise ConfluenceAPIError(f"Page {page_id} not found")

            if title is None:
                title = current['title']
            if version is None:
                version = current['version']['number']

        data = {
            'id': page_id,
            'status': 'current',
            'title': title,
            'version': {
                'number': version + 1,
                'message': message or 'Updated via Javis'
            }
        }

        if body is not None:
            data['body'] = {
                'representation': 'storage',
                'value': body
            }

        self._log(f"Updating page {page_id} to version {version + 1}")

        result = api_request('PUT', f'/api/v2/pages/{page_id}', data)

        # Update local DB
        self._update_local_page(page_id, title, body)

        return result

    def move_page(
        self,
        page_id: str,
        new_parent_id: str,
        new_space_id: str = None
    ) -> Dict:
        """
        Move a page to a new parent.

        Args:
            page_id: Page ID to move
            new_parent_id: New parent page ID
            new_space_id: New space ID (optional)

        Returns:
            Updated page data
        """
        # Get current page
        current = self.get_page(page_id)
        if current is None:
            raise ConfluenceAPIError(f"Page {page_id} not found")

        data = {
            'id': page_id,
            'status': 'current',
            'title': current['title'],
            'parentId': new_parent_id,
            'version': {
                'number': current['version']['number'] + 1,
                'message': f'Moved to new parent via Javis'
            }
        }

        if new_space_id:
            data['spaceId'] = new_space_id

        self._log(f"Moving page {page_id} to parent {new_parent_id}")

        result = api_request('PUT', f'/api/v2/pages/{page_id}', data)

        # Update local DB
        db.execute(
            "UPDATE confluence_v2_content SET parent_id = %s WHERE id = %s",
            [new_parent_id, page_id]
        )

        return result

    def add_labels(self, page_id: str, labels: List[str]) -> List[Dict]:
        """
        Add labels to a page.

        Args:
            page_id: Page ID
            labels: List of label names to add

        Returns:
            List of added label data
        """
        results = []

        for label in labels:
            data = {'name': label}

            self._log(f"Adding label '{label}' to page {page_id}")

            try:
                result = api_request('POST', f'/api/v2/pages/{page_id}/labels', data)
                if result:
                    results.append(result)
            except ConfluenceAPIError as e:
                # Label might already exist
                if e.status_code != 400:
                    raise

        # Update local DB
        db.execute("""
            UPDATE confluence_v2_content
            SET labels = (
                SELECT array_agg(DISTINCT label)
                FROM unnest(labels || %s::text[]) as label
            )
            WHERE id = %s
        """, [labels, page_id])

        return results

    def remove_labels(self, page_id: str, labels: List[str]) -> int:
        """
        Remove labels from a page.

        Args:
            page_id: Page ID
            labels: List of label names to remove

        Returns:
            Number of labels removed
        """
        removed = 0

        # Get current labels
        current_labels = api_request('GET', f'/api/v2/pages/{page_id}/labels')
        if not current_labels or 'results' not in current_labels:
            return 0

        label_ids = {l['name']: l['id'] for l in current_labels['results']}

        for label in labels:
            if label in label_ids:
                label_id = label_ids[label]
                self._log(f"Removing label '{label}' from page {page_id}")

                try:
                    api_request('DELETE', f'/api/v2/pages/{page_id}/labels/{label_id}')
                    removed += 1
                except ConfluenceAPIError:
                    pass

        # Update local DB
        db.execute("""
            UPDATE confluence_v2_content
            SET labels = array_remove(labels, ANY(%s::text[]))
            WHERE id = %s
        """, [labels, page_id])

        return removed

    def archive_page(self, page_id: str) -> Dict:
        """
        Archive a page (move to archive folder and add 'archived' label).

        Args:
            page_id: Page ID to archive

        Returns:
            Updated page data
        """
        self._log(f"Archiving page {page_id}")

        # Add archived label
        self.add_labels(page_id, ['archived'])

        # Get current page
        current = self.get_page(page_id)
        if current is None:
            raise ConfluenceAPIError(f"Page {page_id} not found")

        # Update title to indicate archived
        new_title = f"[ARCHIVED] {current['title']}"
        if not current['title'].startswith('[ARCHIVED]'):
            result = self.update_page(
                page_id,
                title=new_title,
                message='Archived via Javis'
            )
        else:
            result = current

        return result

    def merge_pages(
        self,
        primary_page_id: str,
        secondary_page_ids: List[str],
        new_title: str = None,
        strategy: str = 'append'
    ) -> Dict:
        """
        Merge multiple pages into one.

        Args:
            primary_page_id: Page to keep and merge into
            secondary_page_ids: Pages to merge from (will be archived)
            new_title: New title for merged page (optional)
            strategy: 'append', 'interleave', or 'summarize'

        Returns:
            Updated primary page data
        """
        # Get primary page
        primary = self.get_page(primary_page_id)
        if primary is None:
            raise ConfluenceAPIError(f"Primary page {primary_page_id} not found")

        primary_body = primary.get('body', {}).get('storage', {}).get('value', '')

        # Get secondary pages
        merged_content = [primary_body]

        for sec_id in secondary_page_ids:
            secondary = self.get_page(sec_id)
            if secondary:
                sec_body = secondary.get('body', {}).get('storage', {}).get('value', '')
                sec_title = secondary['title']

                if strategy == 'append':
                    # Append with separator
                    merged_content.append(
                        f'<h2>Merged from: {sec_title}</h2>\n{sec_body}'
                    )
                elif strategy == 'interleave':
                    # TODO: Implement intelligent interleaving
                    merged_content.append(
                        f'<h2>Merged from: {sec_title}</h2>\n{sec_body}'
                    )

        # Update primary page
        new_body = '\n<hr/>\n'.join(merged_content)
        result = self.update_page(
            primary_page_id,
            title=new_title or primary['title'],
            body=new_body,
            message=f'Merged {len(secondary_page_ids)} pages via Javis'
        )

        # Archive secondary pages
        for sec_id in secondary_page_ids:
            try:
                self.archive_page(sec_id)
            except ConfluenceAPIError as e:
                self._log(f"Warning: Could not archive {sec_id}: {e}")

        return result

    def _update_local_page(
        self,
        page_id: str,
        title: str = None,
        body: str = None
    ) -> None:
        """Update local database copy of page."""
        updates = ["last_synced_at = NOW()"]
        params = []

        if title:
            updates.append("title = %s")
            params.append(title)

        if body:
            updates.append("body_storage = %s")
            params.append(body)

        params.append(page_id)

        db.execute(
            f"UPDATE confluence_v2_content SET {', '.join(updates)} WHERE id = %s",
            params
        )


# Convenience functions

def get_writer(verbose: bool = False) -> ConfluenceWriter:
    """Get a ConfluenceWriter instance."""
    return ConfluenceWriter(verbose=verbose)


def update_page(page_id: str, **kwargs) -> Dict:
    """Update a page."""
    return ConfluenceWriter().update_page(page_id, **kwargs)


def move_page(page_id: str, new_parent_id: str, **kwargs) -> Dict:
    """Move a page."""
    return ConfluenceWriter().move_page(page_id, new_parent_id, **kwargs)


def add_labels(page_id: str, labels: List[str]) -> List[Dict]:
    """Add labels to a page."""
    return ConfluenceWriter().add_labels(page_id, labels)


def remove_labels(page_id: str, labels: List[str]) -> int:
    """Remove labels from a page."""
    return ConfluenceWriter().remove_labels(page_id, labels)


def archive_page(page_id: str) -> Dict:
    """Archive a page."""
    return ConfluenceWriter().archive_page(page_id)


def merge_pages(primary_id: str, secondary_ids: List[str], **kwargs) -> Dict:
    """Merge pages."""
    return ConfluenceWriter().merge_pages(primary_id, secondary_ids, **kwargs)
