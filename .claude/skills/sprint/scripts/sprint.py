#!/usr/bin/env python3
"""
Sprint Helper - 스프린트 관리 스크립트

Usage:
    python3 sprint.py current              # 현재 스프린트 상태
    python3 sprint.py list                 # 최근 스프린트 목록
    python3 sprint.py velocity             # Velocity 추이
    python3 sprint.py assignees            # 담당자별 현황
    python3 sprint.py show <sprint_name>   # 특정 스프린트 상세
"""

import sys
from pathlib import Path

# 공통 헬퍼 로드
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_shared"))
from db_helper import query, query_one, print_table


def current():
    """현재 활성 스프린트 상태"""

    # 스프린트 기본 정보
    sprint = query_one("""
        SELECT id, name, goal, start_date::date, end_date::date,
               EXTRACT(DAY FROM end_date - NOW())::int as days_left
        FROM jira_sprints
        WHERE state = 'active'
        ORDER BY start_date DESC
        LIMIT 1
    """)

    if not sprint:
        print("No active sprint found")
        return

    print(f"\n=== Sprint: {sprint['name']} ===")
    if sprint["goal"]:
        print(f"Goal: {sprint['goal']}")
    print(f"Period: {sprint['start_date']} ~ {sprint['end_date']}")
    print(f"Days Left: {sprint['days_left']}")

    # 이슈 통계
    stats = query_one(
        """
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
            COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN ji.status = 'To Do' THEN 1 END) as todo,
            COALESCE(SUM(CASE WHEN ji.status = 'Done'
                THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done,
            COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as points_total
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON ji.key = jis.issue_key
        WHERE jis.sprint_id = %s
    """,
        [sprint["id"]],
    )

    print(f"\n=== Progress ===")
    print(f"Total: {stats['total']} issues")
    if stats["total"] > 0:
        pct = stats["done"] * 100 // stats["total"]
        print(f"Done: {stats['done']} ({pct}%)")
        print(f"In Progress: {stats['in_progress']}")
        print(f"To Do: {stats['todo']}")

        if stats["points_total"] > 0:
            pts_pct = round(stats["points_done"] / stats["points_total"] * 100, 1)
            print(
                f"\nPoints: {stats['points_done']} / {stats['points_total']} ({pts_pct}%)"
            )


def assignees():
    """담당자별 현황"""

    sprint = query_one(
        "SELECT id, name FROM jira_sprints WHERE state = 'active' LIMIT 1"
    )
    if not sprint:
        print("No active sprint found")
        return

    print(f"\n=== {sprint['name']} - 담당자별 현황 ===")

    rows = query(
        """
        SELECT
            COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as assignee,
            COUNT(*) as issues,
            COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
            COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
            COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as points
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON ji.key = jis.issue_key
        WHERE jis.sprint_id = %s
        GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
        ORDER BY issues DESC
    """,
        [sprint["id"]],
    )

    print_table(rows, ["assignee", "issues", "done", "in_progress", "points"])


def velocity():
    """Velocity 추이"""

    print("\n=== Velocity (Last 6 Sprints) ===")

    rows = query("""
        SELECT
            s.name,
            COUNT(jis.issue_key) as committed,
            COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
            COALESCE(SUM(CASE WHEN ji.status = 'Done'
                THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points
        FROM jira_sprints s
        LEFT JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
        LEFT JOIN jira_issues ji ON ji.key = jis.issue_key
        WHERE s.state = 'closed'
        GROUP BY s.id, s.name, s.start_date
        ORDER BY s.start_date DESC
        LIMIT 6
    """)

    if not rows:
        print("No closed sprints found")
        return

    # 완료율 추가
    for r in rows:
        r["completion_pct"] = (
            f"{r['done'] * 100 // r['committed']}%" if r["committed"] > 0 else "0%"
        )

    rows.reverse()  # 오래된 것부터 표시
    print_table(rows, ["name", "committed", "done", "completion_pct", "points"])

    # 평균 계산
    if rows:
        avg_done = sum(r["done"] for r in rows) / len(rows)
        avg_pts = sum(r["points"] for r in rows) / len(rows)
        print(f"\n=== Statistics ===")
        print(f"Average: {avg_done:.1f} issues / {avg_pts:.1f} points per sprint")


def list_sprints():
    """최근 스프린트 목록"""

    print("\n=== Recent Sprints ===")

    rows = query("""
        SELECT
            s.name,
            s.state,
            s.start_date::date,
            s.end_date::date,
            COUNT(jis.issue_key) as issues
        FROM jira_sprints s
        LEFT JOIN jira_issue_sprints jis ON jis.sprint_id = s.id
        WHERE s.state IN ('active', 'closed', 'future')
        GROUP BY s.id
        ORDER BY s.start_date DESC
        LIMIT 10
    """)

    print_table(rows, ["name", "state", "start_date", "end_date", "issues"])


def show(sprint_name: str):
    """특정 스프린트 상세"""

    sprint = query_one(
        """
        SELECT id, name, state, goal, start_date::date, end_date::date
        FROM jira_sprints
        WHERE name ILIKE %s
        LIMIT 1
    """,
        [f"%{sprint_name}%"],
    )

    if not sprint:
        print(f"Sprint not found: {sprint_name}")
        return

    print(f"\n=== Sprint: {sprint['name']} ===")
    print(f"State: {sprint['state']}")
    print(f"Period: {sprint['start_date']} ~ {sprint['end_date']}")
    if sprint["goal"]:
        print(f"Goal: {sprint['goal']}")

    # 이슈 목록
    issues = query(
        """
        SELECT
            ji.key,
            LEFT(ji.summary, 40) as summary,
            ji.status,
            ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
            (ji.raw_data->'fields'->>'customfield_10016')::numeric as points
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON ji.key = jis.issue_key
        WHERE jis.sprint_id = %s
        ORDER BY
            CASE ji.status WHEN 'In Progress' THEN 1 WHEN 'To Do' THEN 2 ELSE 3 END,
            ji.key
    """,
        [sprint["id"]],
    )

    if issues:
        print(f"\n=== Issues ({len(issues)}) ===")
        print_table(issues, ["key", "summary", "status", "assignee", "points"])


def main():
    if len(sys.argv) < 2:
        current()
        return

    cmd = sys.argv[1]

    if cmd == "current":
        current()
    elif cmd == "list":
        list_sprints()
    elif cmd == "velocity":
        velocity()
    elif cmd == "assignees":
        assignees()
    elif cmd == "show":
        if len(sys.argv) < 3:
            print("Usage: sprint.py show <sprint_name>")
            return
        show(sys.argv[2])
    else:
        # 스프린트 이름으로 간주
        show(cmd)


if __name__ == "__main__":
if __name__ == '__main__':
    main()
