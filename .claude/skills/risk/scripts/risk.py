#!/usr/bin/env python3
"""
Risk Helper - 리스크 감지 및 관리 스크립트

Usage:
    python3 risk.py summary              # 리스크 요약
    python3 risk.py detect               # 자동 감지
    python3 risk.py list                 # 리스크 목록
    python3 risk.py analyze <epic_key>   # Epic 분석
"""

import sys
from pathlib import Path

# 공통 헬퍼 로드
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_shared"))
from db_helper import print_table, query, query_one


def summary():
    """리스크 요약"""

    print("\n=== Risk Summary ===\n")

    # 유형별 집계
    stats = query("""
        SELECT risk_type, severity, COUNT(*) as count
        FROM roadmap_risks
        WHERE status = 'open'
        GROUP BY risk_type, severity
        ORDER BY
            CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
            count DESC
    """)

    if not stats:
        print("No open risks")
        return

    # 심각도별
    severities = {}
    types = {}
    for s in stats:
        severities[s["severity"]] = severities.get(s["severity"], 0) + s["count"]
        types[s["risk_type"]] = types.get(s["risk_type"], 0) + s["count"]

    total = sum(severities.values())
    print(f"Open Risks: {total}")
    for sev in ["critical", "high", "medium", "low"]:
        if sev in severities:
            print(f"- {sev.capitalize()}: {severities[sev]}")

    print(f"\nBy Type:")
    for t, c in sorted(types.items(), key=lambda x: -x[1]):
        print(f"- {t}: {c}")


def detect():
    """자동 리스크 감지"""

    print("\n=== Risk Detection ===\n")
    risks_found = []

    # 1. 스프린트 지연
    sprint = query_one("""
        WITH active_sprint AS (
            SELECT id, name, end_date,
                   EXTRACT(DAY FROM end_date - NOW())::int as days_left,
                   EXTRACT(DAY FROM end_date - start_date)::int as total_days
            FROM jira_sprints WHERE state = 'active' LIMIT 1
        ),
        progress AS (
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN ji.status = 'Done' THEN 1 END) as done
            FROM jira_issue_sprints jis
            JOIN jira_issues ji ON ji.key = jis.issue_key
            JOIN active_sprint a ON a.id = jis.sprint_id
        )
        SELECT a.name, a.days_left, a.total_days, p.done, p.total,
               ROUND(p.done::numeric / NULLIF(p.total, 0) * 100, 0) as pct
        FROM active_sprint a, progress p
    """)

    if sprint and sprint["days_left"] is not None:
        expected_pct = (1 - sprint["days_left"] / max(sprint["total_days"], 1)) * 100
        if sprint["pct"] < expected_pct - 20:
            severity = "CRITICAL" if sprint["days_left"] <= 3 else "HIGH"
            risks_found.append(
                {
                    "type": "SPRINT DELAY",
                    "severity": severity,
                    "detail": f"Sprint: {sprint['name']}\nDays Left: {sprint['days_left']}\nCompletion: {sprint['pct']}% (expected: {expected_pct:.0f}%)",
                }
            )

    # 2. 블로커 이슈
    blockers = query("""
        SELECT ji.key, ji.summary,
               ji.raw_data->'fields'->'assignee'->>'displayName' as assignee
        FROM jira_issues ji
        WHERE ji.raw_data->'fields'->'priority'->>'name' IN ('Highest', 'Blocker')
          AND ji.status NOT IN ('Done', 'Closed', 'Resolved')
        LIMIT 5
    """)

    for b in blockers:
        risks_found.append(
            {
                "type": "BLOCKER",
                "severity": "CRITICAL",
                "detail": f"Issue: {b['key']} - {b['summary']}\nAssignee: {b['assignee'] or 'Unassigned'}",
            }
        )

    # 3. 리소스 충돌
    overloaded = query("""
        WITH active_sprint AS (
            SELECT id FROM jira_sprints WHERE state = 'active' LIMIT 1
        )
        SELECT
            ji.raw_data->'fields'->'assignee'->>'displayName' as assignee,
            COUNT(CASE WHEN ji.status NOT IN ('Done', 'Closed') THEN 1 END) as open_issues
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON ji.key = jis.issue_key
        JOIN active_sprint a ON a.id = jis.sprint_id
        WHERE ji.raw_data->'fields'->'assignee' IS NOT NULL
        GROUP BY ji.raw_data->'fields'->'assignee'->>'displayName'
        HAVING COUNT(CASE WHEN ji.status NOT IN ('Done', 'Closed') THEN 1 END) > 6
    """)

    for o in overloaded:
        severity = "HIGH" if o["open_issues"] > 8 else "MEDIUM"
        risks_found.append(
            {
                "type": "RESOURCE CONFLICT",
                "severity": severity,
                "detail": f"Member: {o['assignee']}\nOpen Issues: {o['open_issues']} (threshold: 6)",
            }
        )

    # 4. 방치된 이슈
    stale = query("""
        SELECT ji.key, ji.summary,
               EXTRACT(DAY FROM NOW() - ji.updated_at)::int as days_stale
        FROM jira_issues ji
        WHERE ji.status = 'In Progress'
          AND ji.updated_at < NOW() - INTERVAL '14 days'
        ORDER BY ji.updated_at
        LIMIT 5
    """)

    for s in stale:
        severity = "HIGH" if s["days_stale"] > 21 else "MEDIUM"
        risks_found.append(
            {
                "type": "STALE ISSUE",
                "severity": severity,
                "detail": f"Issue: {s['key']} - {s['summary']}\nLast Update: {s['days_stale']} days ago",
            }
        )

    # 출력
    if not risks_found:
        print("No risks detected")
        return

    for i, r in enumerate(risks_found, 1):
        print(f"[{i}] {r['type']} - {r['severity']}")
        for line in r["detail"].split("\n"):
            print(f"    {line}")
        print()

    # 요약
    crit = sum(1 for r in risks_found if r["severity"] == "CRITICAL")
    high = sum(1 for r in risks_found if r["severity"] == "HIGH")
    med = sum(1 for r in risks_found if r["severity"] == "MEDIUM")
    print(f"=== Summary ===")
    print(f"Detected: {len(risks_found)} risks")
    print(f"Critical: {crit}, High: {high}, Medium: {med}")


def list_risks():
    """리스크 목록"""

    print("\n=== Open Risks ===\n")

    risks = query("""
        SELECT id, risk_type, severity, title, epic_key, detected_at::date
        FROM roadmap_risks
        WHERE status = 'open'
        ORDER BY
            CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
            detected_at DESC
    """)

    if not risks:
        print("No open risks")
        return

    print_table(
        risks, ["id", "risk_type", "severity", "title", "epic_key", "detected_at"]
    )


def analyze(epic_key: str):
    """Epic 리스크 분석"""

    # Epic 정보
    epic = query_one(
        """
        SELECT key, summary, status, created_at::date
        FROM jira_issues WHERE key = %s
    """,
        [epic_key],
    )

    if not epic:
        print(f"Epic not found: {epic_key}")
        return

    print(f"\n=== Epic Risk Analysis: {epic['key']} ===\n")
    print(f"Epic: {epic['summary']}")
    print(f"Status: {epic['status']}")

    # 진행률
    progress = query_one(
        """
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'Done' THEN 1 END) as done,
            COUNT(CASE WHEN status = 'In Progress' AND updated_at < NOW() - INTERVAL '14 days' THEN 1 END) as stale,
            COUNT(CASE WHEN raw_data->'fields'->'assignee' IS NULL THEN 1 END) as unassigned
        FROM jira_issues
        WHERE raw_data->'fields'->'parent'->>'key' = %s
    """,
        [epic_key],
    )

    print(f"\n## Progress")
    total = progress["total"] or 1
    pct = progress["done"] * 100 // total
    print(f"- Stories: {progress['done']}/{progress['total']} ({pct}%)")

    # 리스크 분석
    print(f"\n## Detected Risks")

    if pct < 30 and progress["total"] > 0:
        print(f"\n[MEDIUM] Low Completion Rate")
        print(f"- Current: {pct}%")

    if progress["stale"] > 0:
        print(f"\n[HIGH] Stale Issues")
        print(f"- {progress['stale']} issue(s) without update for 14+ days")

    if progress["unassigned"] > 0:
        print(f"\n[LOW] Unassigned Stories")
        print(f"- {progress['unassigned']} story(ies) need assignment")

    if pct >= 30 and progress["stale"] == 0 and progress["unassigned"] == 0:
        print("\nNo significant risks detected")


def main():
    if len(sys.argv) < 2:
        summary()
        return

    cmd = sys.argv[1]

    if cmd == "summary":
        summary()
    elif cmd == "detect":
        detect()
    elif cmd == "list":
        list_risks()
    elif cmd == "analyze":
        if len(sys.argv) < 3:
            print("Usage: risk.py analyze <epic_key>")
            return
        analyze(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
