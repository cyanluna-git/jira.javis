#!/usr/bin/env python3
"""
Sync Helper - 동기화 상태 확인 스크립트

Usage:
    python3 sync.py status    # 동기화 상태 확인
    python3 sync.py conflicts # 충돌 목록
"""

import sys
from pathlib import Path

# 공통 헬퍼 로드
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_shared"))
from db_helper import print_table, query


def status():
    """동기화 상태 확인"""

    print("\n=== Sync Status ===\n")

    rows = query("""
        SELECT 'Issues' as type, project as scope,
               COUNT(*) as count,
               MAX(last_synced_at)::date as last_sync
        FROM jira_issues
        WHERE last_synced_at IS NOT NULL
        GROUP BY project

        UNION ALL

        SELECT 'Boards' as type, project_key,
               COUNT(*),
               MAX(synced_at)::date
        FROM jira_boards
        WHERE synced_at IS NOT NULL
        GROUP BY project_key

        UNION ALL

        SELECT 'Sprints' as type, '-',
               COUNT(*),
               MAX(synced_at)::date
        FROM jira_sprints
        WHERE synced_at IS NOT NULL

        UNION ALL

        SELECT 'Members' as type, '-',
               COUNT(*),
               MAX(updated_at)::date
        FROM team_members WHERE is_active = true

        UNION ALL

        SELECT 'BB Repos' as type, workspace,
               COUNT(*),
               MAX(last_synced_at)::date
        FROM bitbucket_repositories
        WHERE last_synced_at IS NOT NULL
        GROUP BY workspace

        UNION ALL

        SELECT 'BB Commits (30d)' as type, '-',
               COUNT(*),
               MAX(synced_at)::date
        FROM bitbucket_commits
        WHERE committed_at > NOW() - INTERVAL '30 days'

        UNION ALL

        SELECT 'BB PRs' as type, state,
               COUNT(*),
               MAX(synced_at)::date
        FROM bitbucket_pullrequests
        GROUP BY state

        ORDER BY type, scope
    """)

    if rows:
        print_table(rows, ["type", "scope", "count", "last_sync"])
    else:
        print("No sync data found")

    # 최근 동기화 시간
    latest = query("""
        SELECT MAX(last_synced_at) as last_sync
        FROM jira_issues
        WHERE last_synced_at IS NOT NULL
    """)

    if latest and latest[0]["last_sync"]:
        print(f"\n=== Summary ===")
        print(f"Last issue sync: {latest[0]['last_sync']}")


def conflicts():
    """충돌 목록"""

    print("\n=== Sync Conflicts ===\n")

    rows = query("""
        SELECT id, issue_key, field_name,
               local_value, remote_value,
               detected_at::date
        FROM sync_conflicts
        WHERE resolved_at IS NULL
        ORDER BY detected_at DESC
        LIMIT 20
    """)

    if rows:
        print_table(
            rows,
            [
                "id",
                "issue_key",
                "field_name",
                "local_value",
                "remote_value",
                "detected_at",
            ],
        )
        print(f"\nTotal: {len(rows)} unresolved conflicts")
        print("\nResolution options:")
        print("  python3 scripts/sync_bidirectional.py --force-local")
        print("  python3 scripts/sync_bidirectional.py --force-remote")
    else:
        print("No unresolved conflicts")


def main():
    if len(sys.argv) < 2:
        status()
        return

    cmd = sys.argv[1]

    if cmd == "status":
        status()
    elif cmd == "conflicts":
        conflicts()
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
