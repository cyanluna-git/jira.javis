#!/usr/bin/env python3
"""
Javis DB Helper - 공통 데이터베이스 유틸리티

모든 스킬에서 공유하는 DB 연결 및 쿼리 헬퍼.
프로젝트 루트의 .env 파일에서 DB 설정을 자동으로 로드합니다.

Usage:
    from db_helper import get_connection, query, query_one, execute

    # 단순 쿼리
    rows = query("SELECT * FROM jira_issues WHERE project = %s", ['EUV'])

    # 단일 결과
    row = query_one("SELECT COUNT(*) as cnt FROM jira_issues")

    # INSERT/UPDATE
    execute("UPDATE roadmap_risks SET status = 'resolved' WHERE id = %s", [123])
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# .env 파일 로드
def load_env() -> Dict[str, str]:
    """프로젝트 루트의 .env 파일을 로드합니다."""
    env = {}

    # 프로젝트 루트 찾기 (여러 경로 시도)
    possible_roots = [
        Path(__file__).resolve().parents[3],  # .claude/skills/_shared -> 프로젝트 루트
        Path.cwd(),
        Path.home() / 'dev' / 'jira.javis',
    ]

    env_file = None
    for root in possible_roots:
        candidate = root / '.env'
        if candidate.exists():
            env_file = candidate
            break

    if not env_file:
        print("Warning: .env file not found, using defaults", file=sys.stderr)
        return env

    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip()

    return env

# 환경변수 캐시
_env_cache: Optional[Dict[str, str]] = None

def get_env() -> Dict[str, str]:
    """환경변수를 가져옵니다 (캐시됨)."""
    global _env_cache
    if _env_cache is None:
        _env_cache = load_env()
    return _env_cache

def get_db_config() -> Dict[str, Any]:
    """DB 연결 설정을 반환합니다."""
    env = get_env()
    return {
        'host': env.get('DATABASE_HOST', 'localhost'),
        'port': int(env.get('DATABASE_PORT', '5439')),
        'dbname': env.get('DATABASE_NAME', 'javis_brain'),
        'user': env.get('DATABASE_USER', 'javis'),
        'password': env.get('DATABASE_PASSWORD', 'javis_password'),
    }

def get_jira_config() -> Dict[str, str]:
    """Jira API 설정을 반환합니다."""
    env = get_env()
    return {
        'url': env.get('JIRA_URL', ''),
        'email': env.get('JIRA_EMAIL', ''),
        'token': env.get('JIRA_TOKEN', ''),
    }

def get_connection():
    """PostgreSQL 연결을 반환합니다."""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("Error: psycopg2 not installed. Run: pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    config = get_db_config()
    return psycopg2.connect(**config)

def query(sql: str, params: Optional[List] = None, as_dict: bool = True) -> List[Any]:
    """
    SELECT 쿼리를 실행하고 결과를 반환합니다.

    Args:
        sql: SQL 쿼리문
        params: 쿼리 파라미터
        as_dict: True면 dict 리스트, False면 tuple 리스트 반환

    Returns:
        쿼리 결과 리스트
    """
    import psycopg2.extras

    conn = get_connection()
    try:
        if as_dict:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            cur = conn.cursor()

        cur.execute(sql, params or [])
        rows = cur.fetchall()

        if as_dict:
            return [dict(row) for row in rows]
        return rows
    finally:
        conn.close()

def query_one(sql: str, params: Optional[List] = None, as_dict: bool = True) -> Optional[Any]:
    """
    단일 결과를 반환하는 쿼리를 실행합니다.

    Args:
        sql: SQL 쿼리문
        params: 쿼리 파라미터
        as_dict: True면 dict, False면 tuple 반환

    Returns:
        단일 결과 또는 None
    """
    rows = query(sql, params, as_dict)
    return rows[0] if rows else None

def execute(sql: str, params: Optional[List] = None) -> int:
    """
    INSERT/UPDATE/DELETE 쿼리를 실행합니다.

    Args:
        sql: SQL 쿼리문
        params: 쿼리 파라미터

    Returns:
        영향받은 행 수
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or [])
        rowcount = cur.rowcount
        conn.commit()
        return rowcount
    finally:
        conn.close()

def execute_returning(sql: str, params: Optional[List] = None) -> Optional[Any]:
    """
    RETURNING 절이 있는 쿼리를 실행하고 결과를 반환합니다.

    Args:
        sql: SQL 쿼리문 (RETURNING 절 포함)
        params: 쿼리 파라미터

    Returns:
        RETURNING 결과 (dict)
    """
    import psycopg2.extras

    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params or [])
        result = cur.fetchone()
        conn.commit()
        return dict(result) if result else None
    finally:
        conn.close()

# 유틸리티 함수들
def format_size(bytes_val: int) -> str:
    """바이트를 읽기 쉬운 형식으로 변환합니다."""
    if bytes_val < 1024:
        return f"{bytes_val} B"
    elif bytes_val < 1024 * 1024:
        return f"{bytes_val / 1024:.1f} KB"
    else:
        return f"{bytes_val / (1024 * 1024):.1f} MB"

def format_date(dt) -> str:
    """datetime을 YYYY-MM-DD 형식으로 변환합니다."""
    if dt is None:
        return '-'
    if hasattr(dt, 'strftime'):
        return dt.strftime('%Y-%m-%d')
    return str(dt)

def print_table(rows: List[Dict], columns: Optional[List[str]] = None):
    """결과를 테이블 형식으로 출력합니다."""
    if not rows:
        print("(No results)")
        return

    if columns is None:
        columns = list(rows[0].keys())

    # 컬럼 너비 계산
    widths = {col: len(col) for col in columns}
    for row in rows:
        for col in columns:
            val = str(row.get(col, ''))
            widths[col] = max(widths[col], len(val))

    # 헤더 출력
    header = ' | '.join(col.ljust(widths[col]) for col in columns)
    print(header)
    print('-' * len(header))

    # 데이터 출력
    for row in rows:
        line = ' | '.join(str(row.get(col, '')).ljust(widths[col]) for col in columns)
        print(line)

if __name__ == '__main__':
    # 테스트
    print("DB Config:", get_db_config())
    print("\nTesting connection...")
    try:
        result = query_one("SELECT 1 as test")
        print("Connection OK:", result)
    except Exception as e:
        print("Connection failed:", e)
