"""
Database utilities for Javis CLI.
"""

import psycopg2
from psycopg2.extras import RealDictCursor, Json
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

from . import config


def get_connection():
    """Create a new database connection."""
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASS
    )


@contextmanager
def connection():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def cursor(conn=None, dict_cursor=True):
    """Context manager for database cursors."""
    close_conn = conn is None
    if conn is None:
        conn = get_connection()

    cursor_factory = RealDictCursor if dict_cursor else None
    cur = conn.cursor(cursor_factory=cursor_factory)

    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if close_conn:
            conn.close()


def fetch_one(query: str, params: List = None, dict_cursor: bool = True) -> Optional[Dict]:
    """Execute query and fetch one result."""
    with cursor(dict_cursor=dict_cursor) as cur:
        cur.execute(query, params or [])
        return cur.fetchone()


def fetch_all(query: str, params: List = None, dict_cursor: bool = True) -> List[Dict]:
    """Execute query and fetch all results."""
    with cursor(dict_cursor=dict_cursor) as cur:
        cur.execute(query, params or [])
        return cur.fetchall()


def execute(query: str, params: List = None) -> int:
    """Execute query and return row count."""
    with cursor() as cur:
        cur.execute(query, params or [])
        return cur.rowcount


def execute_many(query: str, params_list: List[List]) -> int:
    """Execute query with multiple parameter sets."""
    with cursor() as cur:
        cur.executemany(query, params_list)
        return cur.rowcount


# --- Issue Queries ---

def get_issues_by_status(status: str, project: str = None, limit: int = 50) -> List[Dict]:
    """Get issues by status."""
    query = """
        SELECT key, project, summary, status,
               raw_data->'fields'->'assignee'->>'displayName' as assignee,
               raw_data->'fields'->'priority'->>'name' as priority,
               updated_at
        FROM jira_issues
        WHERE status = %s
    """
    params = [status]

    if project:
        query += " AND project = %s"
        params.append(project)

    query += " ORDER BY updated_at DESC LIMIT %s"
    params.append(limit)

    return fetch_all(query, params)


def get_blocked_issues(project: str = None, limit: int = 50) -> List[Dict]:
    """Get issues that appear to be blocked (have blocking links or blocked label)."""
    # Note: Using @> instead of ? to avoid psycopg2 parameter confusion
    query = """
        SELECT key, project, summary, status,
               raw_data->'fields'->'assignee'->>'displayName' as assignee,
               raw_data->'fields'->'labels' as labels,
               updated_at
        FROM jira_issues
        WHERE (
            raw_data->'fields'->'labels' @> '["blocked"]'::jsonb
            OR raw_data->'fields'->'labels' @> '["blocker"]'::jsonb
            OR status = 'Blocked'
            OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                    COALESCE(raw_data->'fields'->'issuelinks', '[]'::jsonb)
                ) as link
                WHERE link->>'type' LIKE '%%block%%'
            )
        )
    """
    params = []

    if project:
        query += " AND project = %s"
        params.append(project)

    query += " ORDER BY updated_at DESC LIMIT %s"
    params.append(limit)

    return fetch_all(query, params)


def search_issues(query_text: str, limit: int = 20) -> List[Dict]:
    """Full-text search on issues."""
    query = """
        SELECT key, project, summary, status, updated_at
        FROM jira_issues
        WHERE search_vector @@ plainto_tsquery('english', %s)
        ORDER BY ts_rank(search_vector, plainto_tsquery('english', %s)) DESC
        LIMIT %s
    """
    return fetch_all(query, [query_text, query_text, limit])


# --- Tag Queries ---

def get_all_tags() -> List[Dict]:
    """Get all work tags."""
    return fetch_all("SELECT * FROM work_tags ORDER BY name")


def get_tag_by_name(name: str) -> Optional[Dict]:
    """Get tag by name."""
    return fetch_one("SELECT * FROM work_tags WHERE name = %s", [name])


def create_tag(name: str, color: str = '#6B7280', description: str = None) -> Optional[Dict]:
    """Create a new tag."""
    query = """
        INSERT INTO work_tags (name, color, description)
        VALUES (%s, %s, %s)
        ON CONFLICT (name) DO NOTHING
        RETURNING *
    """
    return fetch_one(query, [name, color, description])


def add_issue_tag(issue_key: str, tag_name: str, tagged_by: str = None) -> bool:
    """Add tag to an issue."""
    tag = get_tag_by_name(tag_name)
    if not tag:
        return False

    query = """
        INSERT INTO issue_tags (issue_key, tag_id, tagged_by)
        VALUES (%s, %s, %s)
        ON CONFLICT (issue_key, tag_id) DO NOTHING
    """
    execute(query, [issue_key, tag['id'], tagged_by])
    return True


def remove_issue_tag(issue_key: str, tag_name: str) -> bool:
    """Remove tag from an issue."""
    tag = get_tag_by_name(tag_name)
    if not tag:
        return False

    query = "DELETE FROM issue_tags WHERE issue_key = %s AND tag_id = %s"
    return execute(query, [issue_key, tag['id']]) > 0


def get_issue_tags(issue_key: str) -> List[Dict]:
    """Get all tags for an issue."""
    query = """
        SELECT t.* FROM work_tags t
        JOIN issue_tags it ON it.tag_id = t.id
        WHERE it.issue_key = %s
        ORDER BY t.name
    """
    return fetch_all(query, [issue_key])


def get_issues_by_tag(tag_name: str, limit: int = 50) -> List[Dict]:
    """Get issues with a specific tag."""
    query = """
        SELECT j.key, j.project, j.summary, j.status, j.updated_at
        FROM jira_issues j
        JOIN issue_tags it ON it.issue_key = j.key
        JOIN work_tags t ON t.id = it.tag_id
        WHERE t.name = %s
        ORDER BY j.updated_at DESC
        LIMIT %s
    """
    return fetch_all(query, [tag_name, limit])


# --- Bitbucket Queries ---

def get_open_prs(limit: int = 20) -> List[Dict]:
    """Get open pull requests."""
    query = """
        SELECT p.*, r.name as repo_name, r.slug as repo_slug
        FROM bitbucket_pullrequests p
        JOIN bitbucket_repositories r ON r.uuid = p.repo_uuid
        WHERE p.state = 'OPEN'
        ORDER BY p.updated_at DESC
        LIMIT %s
    """
    return fetch_all(query, [limit])


def get_recent_commits(days: int = 7, limit: int = 50) -> List[Dict]:
    """Get recent commits."""
    query = """
        SELECT c.*, r.name as repo_name, r.slug as repo_slug
        FROM bitbucket_commits c
        JOIN bitbucket_repositories r ON r.uuid = c.repo_uuid
        WHERE c.committed_at > NOW() - INTERVAL '%s days'
        ORDER BY c.committed_at DESC
        LIMIT %s
    """
    return fetch_all(query, [days, limit])


def get_commits_for_issue(issue_key: str) -> List[Dict]:
    """Get commits related to an issue key."""
    query = """
        SELECT c.*, r.name as repo_name
        FROM bitbucket_commits c
        JOIN bitbucket_repositories r ON r.uuid = c.repo_uuid
        WHERE %s = ANY(c.jira_keys)
        ORDER BY c.committed_at DESC
    """
    return fetch_all(query, [issue_key])


def get_prs_for_issue(issue_key: str) -> List[Dict]:
    """Get PRs related to an issue key."""
    query = """
        SELECT p.*, r.name as repo_name
        FROM bitbucket_pullrequests p
        JOIN bitbucket_repositories r ON r.uuid = p.repo_uuid
        WHERE %s = ANY(p.jira_keys)
        ORDER BY p.updated_at DESC
    """
    return fetch_all(query, [issue_key])


# --- AI Suggestions ---

def save_suggestion(context: Dict, prompt: str, response: Dict,
                    provider: str, model: str, tokens: int = None) -> str:
    """Save AI suggestion to history."""
    query = """
        INSERT INTO ai_suggestions (context_snapshot, prompt, response, provider, model, tokens_used)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """
    result = fetch_one(query, [Json(context), prompt, Json(response), provider, model, tokens])
    return str(result['id']) if result else None


def get_recent_suggestions(limit: int = 10) -> List[Dict]:
    """Get recent AI suggestions."""
    query = """
        SELECT * FROM ai_suggestions
        ORDER BY created_at DESC
        LIMIT %s
    """
    return fetch_all(query, [limit])
