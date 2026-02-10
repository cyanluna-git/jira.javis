#!/usr/bin/env python3
"""
Report Helper - 프로젝트 리포트 생성 스크립트

Usage:
    python3 report.py sprint [name]      # 스프린트 리포트
    python3 report.py weekly             # 주간 리포트
    python3 report.py epic <key>         # Epic 리포트
    python3 report.py velocity           # Velocity 리포트
    python3 report.py team               # 팀 성과 리포트
"""

import sys
from datetime import datetime
from pathlib import Path

# 공통 헬퍼 로드
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_shared"))
from db_helper import print_table, query, query_one


def sprint(sprint_name: str = ""):
    """스프린트 리포트"""

    # 스프린트 정보
    sp = query_one(
        """
        SELECT id, name, state, goal, start_date::date, end_date::date,
               EXTRACT(DAY FROM end_date - NOW())::int as days_left
        FROM jira_sprints
        WHERE state = 'active' OR name ILIKE %s
        ORDER BY CASE WHEN state = 'active' THEN 0 ELSE 1 END, start_date DESC
        LIMIT 1
    """,
        [f"%{sprint_name}%" if sprint_name else "%"],
    )

    if not sp:
        print("Sprint not found")
        return

    print(f"\n# Sprint Report: {sp['name']}\n")
    print(f"## Summary")
    print(f"- Period: {sp['start_date']} ~ {sp['end_date']}")
    print(f"- Status: {sp['state']}")
    if sp["days_left"] and sp["days_left"] > 0:
        print(f"- Days Left: {sp['days_left']}")
    if sp["goal"]:
        print(f"- Goal: {sp['goal']}")

    # 통계
    stats = query_one(
        """
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
            COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN ji.status = 'To Do' THEN 1 END) as todo,
            COALESCE(SUM((ji.raw_data->'fields'->>'customfield_10016')::numeric), 0) as points_total,
            COALESCE(SUM(CASE WHEN ji.status = 'Done'
                THEN (ji.raw_data->'fields'->>'customfield_10016')::numeric END), 0) as points_done
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON ji.key = jis.issue_key
        WHERE jis.sprint_id = %s
    """,
        [sp["id"]],
    )

    print(f"\n## Progress")
    print(f"| Status | Count | Percentage |")
    print(f"|--------|-------|------------|")
    total = stats["total"] or 1
    print(f"| Done | {stats['done']} | {stats['done'] * 100 // total}% |")
    print(
        f"| In Progress | {stats['in_progress']} | {stats['in_progress'] * 100 // total}% |"
    )
    print(f"| To Do | {stats['todo']} | {stats['todo'] * 100 // total}% |")
    print(f"| **Total** | **{stats['total']}** | - |")

    if stats["points_total"] > 0:
        pct = round(stats["points_done"] / stats["points_total"] * 100, 1)
        print(f"\n## Points")
        print(
            f"- Done: {stats['points_done']} / {stats['points_total']} total ({pct}%)"
        )

    # 담당자별
    assignees = query(
        """
        SELECT
            COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as member,
            COUNT(*) as assigned,
            COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done,
            COUNT(CASE WHEN ji.status = 'In Progress' THEN 1 END) as in_progress
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON ji.key = jis.issue_key
        WHERE jis.sprint_id = %s
        GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
        ORDER BY assigned DESC
    """,
        [sp["id"]],
    )

    print(f"\n## By Assignee")
    print(f"| Member | Assigned | Done | In Progress |")
    print(f"|--------|----------|------|-------------|")
    for a in assignees:
        print(f"| {a['member']} | {a['assigned']} | {a['done']} | {a['in_progress']} |")


def weekly():
    """주간 리포트"""

    today = datetime.now()
    print(f"\n# Weekly Report: Week of {today.strftime('%Y-%m-%d')}\n")

    # 이번 주 완료
    completed = query("""
        SELECT ji.key, LEFT(ji.summary, 40) as summary,
               ji.raw_data->'fields'->'assignee'->>'displayName' as assignee
        FROM jira_issues ji
        WHERE ji.status = 'Done'
          AND ji.updated_at > NOW() - INTERVAL '7 days'
        ORDER BY ji.updated_at DESC
        LIMIT 10
    """)

    print(f"## Completed This Week ({len(completed)} issues)")
    if completed:
        print(f"| Key | Summary | Assignee |")
        print(f"|-----|---------|----------|")
        for c in completed:
            print(f"| {c['key']} | {c['summary']} | {c['assignee'] or '-'} |")

    # 개발 활동
    activity = query_one("""
        SELECT
            (SELECT COUNT(*) FROM bitbucket_commits WHERE committed_at > NOW() - INTERVAL '7 days') as commits,
            (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'OPEN' AND created_at > NOW() - INTERVAL '7 days') as prs_opened,
            (SELECT COUNT(*) FROM bitbucket_pullrequests WHERE state = 'MERGED' AND updated_at > NOW() - INTERVAL '7 days') as prs_merged
    """)

    print(f"\n## Development Activity")
    print(f"- Commits: {activity['commits']}")
    print(f"- PRs Opened: {activity['prs_opened']}")
    print(f"- PRs Merged: {activity['prs_merged']}")

    # Top Contributors
    contributors = query("""
        SELECT
            ji.raw_data->'fields'->'assignee'->>'displayName' as member,
            COUNT(*) as issues
        FROM jira_issues ji
        WHERE ji.status = 'Done'
          AND ji.updated_at > NOW() - INTERVAL '7 days'
          AND ji.raw_data->'fields'->'assignee' IS NOT NULL
        GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
        ORDER BY issues DESC
        LIMIT 5
    """)

    if contributors:
        print(f"\n## Top Contributors")
        for i, c in enumerate(contributors, 1):
            print(f"{i}. {c['member']} - {c['issues']} issues")


def epic(epic_key: str):
    """Epic 리포트"""

    # Epic 정보
    ep = query_one(
        """
        SELECT key, summary, status,
               raw_data->'fields'->'components'->0->>'name' as component,
               created_at::date, updated_at::date
        FROM jira_issues WHERE key = %s
    """,
        [epic_key],
    )

    if not ep:
        print(f"Epic not found: {epic_key}")
        return

    print(f"\n# Epic Report: {ep['key']}\n")
    print(f"## Summary")
    print(f"- Title: {ep['summary']}")
    print(f"- Status: {ep['status']}")
    if ep["component"]:
        print(f"- Component: {ep['component']}")

    # 진행률
    progress = query_one(
        """
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
            COALESCE(SUM((raw_data->'fields'->>'customfield_10016')::numeric), 0) as total_pts,
            COALESCE(SUM(CASE WHEN status = 'Done'
                THEN (raw_data->'fields'->>'customfield_10016')::numeric END), 0) as done_pts
        FROM jira_issues
        WHERE raw_data->'fields'->'parent'->>'key' = %s
    """,
        [epic_key],
    )

    total = progress["total"] or 1
    print(f"\n## Progress")
    print(
        f"- Stories: {progress['done']}/{progress['total']} ({progress['done'] * 100 // total}%)"
    )
    if progress["total_pts"] > 0:
        pts_pct = round(progress["done_pts"] / progress["total_pts"] * 100, 0)
        print(
            f"- Story Points: {progress['done_pts']}/{progress['total_pts']} ({pts_pct}%)"
        )

    # Story 목록
    stories = query(
        """
        SELECT key, LEFT(summary, 35) as summary, status,
               raw_data->'fields'->'assignee'->>'displayName' as assignee,
               (raw_data->'fields'->>'customfield_10016')::numeric as points
        FROM jira_issues
        WHERE raw_data->'fields'->'parent'->>'key' = %s
        ORDER BY CASE status WHEN 'In Progress' THEN 1 WHEN 'To Do' THEN 2 ELSE 3 END, key
    """,
        [epic_key],
    )

    if stories:
        print(f"\n## Stories")
        print(f"| Key | Summary | Status | Assignee | Points |")
        print(f"|-----|---------|--------|----------|--------|")
        for s in stories:
            print(
                f"| {s['key']} | {s['summary']} | {s['status']} | {s['assignee'] or '-'} | {s['points'] or '-'} |"
            )

    print(f"\n## Timeline")
    print(f"- Created: {ep['created_at']}")
    print(f"- Last Updated: {ep['updated_at']}")


def velocity():
    """Velocity 리포트"""

    print(f"\n# Velocity Report\n")

    sprints = query("""
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

    if not sprints:
        print("No closed sprints found")
        return

    print(f"## Last {len(sprints)} Sprints")
    print(f"| Sprint | Committed | Done | Completion | Points |")
    print(f"|--------|-----------|------|------------|--------|")

    sprints.reverse()
    for s in sprints:
        pct = s["done"] * 100 // s["committed"] if s["committed"] > 0 else 0
        print(
            f"| {s['name']} | {s['committed']} | {s['done']} | {pct}% | {s['points']} |"
        )

    # 통계
    avg_done = sum(s["done"] for s in sprints) / len(sprints)
    avg_pts = sum(s["points"] for s in sprints) / len(sprints)

    print(f"\n## Statistics")
    print(
        f"- Average Velocity: {avg_done:.1f} issues / {avg_pts:.1f} points per sprint"
    )
    print(f"- Recommended next sprint: {int(avg_done - 2)}-{int(avg_done + 2)} issues")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == "sprint":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        sprint(name)
    elif cmd == "weekly":
        weekly()
    elif cmd == "epic":
        if len(sys.argv) < 3:
            print("Usage: report.py epic <epic_key>")
            return
        epic(sys.argv[2])
    elif cmd == "velocity":
        velocity()
    elif cmd == "team":
        sprint()  # 팀 리포트는 스프린트 리포트와 유사
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()
