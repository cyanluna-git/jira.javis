#!/usr/bin/env python3
"""
Dev Helper - 개발자 대시보드 스크립트

Usage:
    python3 dev.py me                    # 내 대시보드 (Gerald)
    python3 dev.py show <name>           # 특정 개발자 대시보드
    python3 dev.py team                  # 팀 현황
    python3 dev.py commits [--days N]    # 커밋 활동
    python3 dev.py prs                   # PR 현황
    python3 dev.py workload              # 작업 부하
"""

import sys
from pathlib import Path

# 공통 헬퍼 로드
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_shared"))
from db_helper import query, query_one, print_table, get_env

DEFAULT_USER = "Gerald"


def me():
    """내 대시보드"""
    show(DEFAULT_USER)


def show(name: str):
    """특정 개발자 대시보드"""

    print(f"\n=== 대시보드: {name} ===")

    # 현재 스프린트 할당 이슈
    sprint = query_one(
        "SELECT id, name FROM jira_sprints WHERE state = 'active' LIMIT 1"
    )

    if sprint:
        issues = query(
            """
            SELECT
                ji.key,
                LEFT(ji.summary, 35) as summary,
                ji.status,
                (ji.raw_data->'fields'->>'customfield_10016')::numeric as points,
                ji.raw_data->'fields'->'parent'->>'key' as epic
            FROM jira_issue_sprints jis
            JOIN jira_issues ji ON ji.key = jis.issue_key
            WHERE jis.sprint_id = %s
              AND ji.raw_data->'fields'->'assignee'->>'displayName' ILIKE %s
            ORDER BY
                CASE ji.status WHEN 'In Progress' THEN 1 WHEN 'To Do' THEN 2 ELSE 3 END,
                ji.key
        """,
            [sprint["id"], f"%{name}%"],
        )

        if issues:
            print(f"\n=== 현재 스프린트: {sprint['name']} ({len(issues)} issues) ===")
            print_table(issues, ["key", "summary", "status", "points", "epic"])

            done = sum(1 for i in issues if i["status"] == "Done")
            total_pts = sum(i["points"] or 0 for i in issues)
            print(f"\nProgress: {done}/{len(issues)} done | Points: {total_pts} total")

    # 최근 커밋
    commits = query(
        """
        SELECT
            bc.committed_at::date as date,
            br.slug as repo,
            LEFT(bc.message, 45) as message
        FROM bitbucket_commits bc
        JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
        WHERE bc.author_name ILIKE %s
          AND bc.committed_at > NOW() - INTERVAL '7 days'
        ORDER BY bc.committed_at DESC
        LIMIT 5
    """,
        [f"%{name}%"],
    )

    if commits:
        print(f"\n=== 최근 커밋 (7일) ===")
        print_table(commits, ["date", "repo", "message"])

    # 오픈 PR
    prs = query(
        """
        SELECT
            bp.pr_number as pr,
            LEFT(bp.title, 35) as title,
            br.slug as repo,
            bp.state
        FROM bitbucket_pullrequests bp
        JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
        WHERE bp.author_name ILIKE %s
          AND bp.state = 'OPEN'
        ORDER BY bp.created_at DESC
        LIMIT 5
    """,
        [f"%{name}%"],
    )

    if prs:
        print(f"\n=== 오픈 PR ===")
        print_table(prs, ["pr", "title", "repo", "state"])


def team():
    """팀 현황"""

    sprint = query_one(
        "SELECT id, name FROM jira_sprints WHERE state = 'active' LIMIT 1"
    )
    if not sprint:
        print("No active sprint found")
        return

    print(f"\n=== Team Dashboard: {sprint['name']} ===")

    rows = query(
        """
        WITH member_stats AS (
            SELECT
                COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as member,
                COUNT(*) as assigned,
                COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
                COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
                COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as points
            FROM jira_issue_sprints jis
            JOIN jira_issues ji ON ji.key = jis.issue_key
            WHERE jis.sprint_id = %s
            GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
        ),
        commit_stats AS (
            SELECT author_name, COUNT(*) as commits
            FROM bitbucket_commits
            WHERE committed_at > NOW() - INTERVAL '7 days'
            GROUP BY author_name
        )
        SELECT
            m.member,
            m.assigned,
            m.done,
            m.in_progress,
            ROUND(m.done::numeric / NULLIF(m.assigned, 0) * 100, 0) as completion_pct,
            m.points,
            COALESCE(c.commits, 0) as commits_7d
        FROM member_stats m
        LEFT JOIN commit_stats c
            ON LOWER(c.author_name) LIKE '%%' || LOWER(SPLIT_PART(m.member, ' ', 1)) || '%%'
        ORDER BY m.assigned DESC
    """,
        [sprint["id"]],
    )

    print_table(
        rows,
        [
            "member",
            "assigned",
            "done",
            "in_progress",
            "completion_pct",
            "points",
            "commits_7d",
        ],
    )


def commits(days: int = 7):
    """커밋 활동"""

    print(f"\n=== Commit Activity (Last {days} Days) ===")

    rows = query(
        """
        SELECT
            bc.author_name as author,
            COUNT(*) as commits,
            COUNT(DISTINCT br.slug) as repos,
            COUNT(DISTINCT bc.committed_at::date) as active_days
        FROM bitbucket_commits bc
        JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
        WHERE bc.committed_at > NOW() - INTERVAL '%s days'
        GROUP BY bc.author_name
        ORDER BY commits DESC
        LIMIT 15
    """,
        [days],
    )

    print_table(rows, ["author", "commits", "repos", "active_days"])


def prs():
    """PR 현황"""

    print("\n=== Open PRs ===")

    rows = query("""
        SELECT
            bp.pr_number as pr,
            bp.author_name as author,
            LEFT(bp.title, 40) as title,
            br.slug as repo,
            bp.created_at::date as created
        FROM bitbucket_pullrequests bp
        JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
        WHERE bp.state = 'OPEN'
        ORDER BY bp.created_at DESC
        LIMIT 20
    """)

    print_table(rows, ["pr", "author", "title", "repo", "created"])


def workload():
    """작업 부하"""

    print("\n=== Workload Analysis ===")

    rows = query("""
        SELECT
            COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as member,
            COUNT(CASE WHEN ji.status = 'To Do' THEN 1 END) as todo,
            COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN ji.status NOT IN ('Done', 'Closed', 'Resolved') THEN 1 END) as open_total,
            COALESCE(SUM(CASE WHEN ji.status NOT IN ('Done', 'Closed', 'Resolved')
                THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as open_points
        FROM jira_issues ji
        WHERE ji.raw_data->'fields'->'assignee' IS NOT NULL
          AND ji.status NOT IN ('Done', 'Closed', 'Resolved')
        GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
        ORDER BY open_total DESC
    """)

    print_table(rows, ["member", "todo", "in_progress", "open_total", "open_points"])

    # 경고
    for r in rows:
        if r["open_total"] > 6:
            print(
                f"\nWarning: {r['member']} has high workload ({r['open_total']} open issues)"
            )


def main():
    if len(sys.argv) < 2:
        me()
        return

    cmd = sys.argv[1]

    if cmd == "me":
        me()
    elif cmd == "show":
        if len(sys.argv) < 3:
            print("Usage: dev.py show <name>")
            return
        show(sys.argv[2])
    elif cmd == "team":
        team()
    elif cmd == "commits":
        days = 7
        if "--days" in sys.argv:
            idx = sys.argv.index("--days")
            if idx + 1 < len(sys.argv):
                days = int(sys.argv[idx + 1])
        commits(days)
    elif cmd == "prs":
        prs()
    elif cmd == "workload":
        workload()
    else:
        # 이름으로 간주
        show(cmd)


if __name__ == "__main__":
    main()
