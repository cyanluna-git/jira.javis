#!/usr/bin/env python3
"""
Stories Helper - Story 관리 스크립트

Usage:
    python3 stories.py context [vision_title]     # Vision 맥락 조회
    python3 stories.py list <epic_key>            # Epic Story 목록
    python3 stories.py dev <epic_key>             # Epic 개발 현황
    python3 stories.py push <epic_key> [--dry-run] # Jira에 Story 생성
"""

import json
import sys
from pathlib import Path

# 공통 헬퍼 로드
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "_shared"))
from db_helper import query, query_one, get_jira_config, print_table, format_date


def context(vision_title: str = ""):
    """Vision의 프로젝트 맥락 조회"""

    # Vision 정보
    visions = query(
        """
        SELECT v.title, v.description, v.status,
               v.north_star_metric, v.north_star_target, v.north_star_current,
               COUNT(m.id) as milestone_count,
               ROUND(AVG(m.progress_percent), 1) as avg_progress
        FROM roadmap_visions v
        LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
        WHERE v.title ILIKE %s OR %s = ''
        GROUP BY v.id
        ORDER BY v.created_at DESC
    """,
        [f"%{vision_title}%", vision_title],
    )

    if not visions:
        print(f"Vision not found: {vision_title}")
        return

    for v in visions:
        print(f"\n=== Vision: {v['title']} ===")
        print(f"Description: {v['description'] or '-'}")
        print(f"Status: {v['status']}")
        if v["north_star_metric"]:
            print(
                f"North Star: {v['north_star_metric']} (목표: {v['north_star_target']}, 현재: {v['north_star_current']})"
            )
        print(
            f"Milestones: {v['milestone_count']}개, 평균 진행률: {v['avg_progress'] or 0}%"
        )

    # Milestone 상세
    milestones = query(
        """
        SELECT m.title, m.quarter, m.status, m.progress_percent,
               COUNT(el.epic_key) as epic_count
        FROM roadmap_milestones m
        JOIN roadmap_visions v ON v.id = m.vision_id
        LEFT JOIN roadmap_epic_links el ON el.milestone_id = m.id
        WHERE v.title ILIKE %s OR %s = ''
        GROUP BY m.id
        ORDER BY m.quarter
    """,
        [f"%{vision_title}%", vision_title],
    )

    if milestones:
        print("\n=== Milestones ===")
        for m in milestones:
            print(
                f"{m['quarter']}: {m['title']} ({m['status']}) - 진행률: {m['progress_percent']}%, Epic: {m['epic_count']}개"
            )

    # 팀 구성
    members = query(
        """
        SELECT tm.display_name, vm.role_title, vm.role_category, vm.mm_allocation
        FROM roadmap_vision_members vm
        JOIN team_members tm ON tm.account_id = vm.member_account_id
        JOIN roadmap_visions v ON v.id = vm.vision_id
        WHERE v.title ILIKE %s OR %s = ''
        ORDER BY vm.role_category, tm.display_name
    """,
        [f"%{vision_title}%", vision_title],
    )

    if members:
        print("\n=== 팀 구성 ===")
        for m in members:
            print(f"{m['display_name']} - {m['role_title']} ({m['mm_allocation']} MM)")


def list_stories(epic_key: str):
    """Epic 하위 Story 목록"""

    # Epic 정보
    epic = query_one(
        """
        SELECT key, summary, status,
               raw_data->'fields'->>'description' as description
        FROM jira_issues
        WHERE key = %s
    """,
        [epic_key],
    )

    if not epic:
        print(f"Epic not found: {epic_key}")
        return

    print(f"\n=== Epic: {epic['key']} ===")
    print(f"Summary: {epic['summary']}")
    print(f"Status: {epic['status']}")

    # Story 목록
    stories = query(
        """
        SELECT
            key,
            summary,
            status,
            raw_data->'fields'->'assignee'->>'displayName' as assignee,
            raw_data->'fields'->>'customfield_10016' as story_points,
            raw_data->'fields'->'issuetype'->>'name' as issue_type
        FROM jira_issues
        WHERE raw_data->'fields'->'parent'->>'key' = %s
        ORDER BY
            CASE status
                WHEN 'In Progress' THEN 1
                WHEN 'To Do' THEN 2
                WHEN 'Done' THEN 3
                ELSE 4
            END,
            key
    """,
        [epic_key],
    )

    if stories:
        print(f"\n=== Stories ({len(stories)}) ===")
        print_table(stories, ["key", "summary", "status", "assignee", "story_points"])

        # 통계
        done = sum(1 for s in stories if s["status"] == "Done")
        total_pts = sum(float(s["story_points"] or 0) for s in stories)
        done_pts = sum(
            float(s["story_points"] or 0) for s in stories if s["status"] == "Done"
        )
        print(
            f"\nProgress: {done}/{len(stories)} ({done * 100 // len(stories) if stories else 0}%) | Points: {total_pts} total, {done_pts} done"
        )
    else:
        print("\n(No stories found)")


def dev_status(epic_key: str):
    """Epic 개발 현황 (커밋/PR)"""

    # Epic 관련 이슈 키들
    keys = query(
        """
        SELECT key FROM jira_issues
        WHERE key = %s OR raw_data->'fields'->'parent'->>'key' = %s
    """,
        [epic_key, epic_key],
        as_dict=False,
    )

    if not keys:
        print(f"Epic not found: {epic_key}")
        return

    issue_keys = [k[0] for k in keys]

    print(f"\n=== {epic_key} 개발 현황 ===")
    print(f"관련 이슈: {len(issue_keys)}개")

    # 최근 커밋
    commits = query(
        """
        SELECT
            bc.committed_at::date as date,
            bc.author_name,
            LEFT(bc.message, 50) as message,
            br.slug as repo
        FROM bitbucket_commits bc
        JOIN bitbucket_repositories br ON br.uuid = bc.repo_uuid
        WHERE bc.committed_at > NOW() - INTERVAL '7 days'
          AND bc.jira_keys && %s
        ORDER BY bc.committed_at DESC
        LIMIT 10
    """,
        [issue_keys],
    )

    if commits:
        print("\n=== 최근 커밋 (7일) ===")
        print_table(commits, ["date", "author_name", "message", "repo"])

    # 오픈 PR
    prs = query(
        """
        SELECT
            bp.pr_number,
            LEFT(bp.title, 40) as title,
            bp.state,
            bp.author_name,
            br.slug as repo
        FROM bitbucket_pullrequests bp
        JOIN bitbucket_repositories br ON br.uuid = bp.repo_uuid
        WHERE bp.jira_keys && %s
        ORDER BY bp.created_at DESC
        LIMIT 10
    """,
        [issue_keys],
    )

    if prs:
        print("\n=== PR 현황 ===")
        print_table(prs, ["pr_number", "title", "state", "author_name", "repo"])


def push_stories(epic_key: str, dry_run: bool = False):
    """Story를 Jira에 생성"""

    print(f"\n=== Story Push: {epic_key} ===")

    if dry_run:
        print("(Dry-run mode - 실제 생성하지 않음)")
        print("\n생성할 Story가 준비되면 이 스크립트를 사용하세요.")
        print("먼저 '/javis-stories create' 로 Story 초안을 생성하세요.")
        return

    # 실제 생성 로직은 AI가 Story 초안을 만든 후 수동으로 호출
    jira_config = get_jira_config()
    if not jira_config["url"]:
        print("Error: JIRA_URL not configured in .env")
        return

    print("Story 생성 준비 완료.")
    print("AI가 생성한 Story 초안을 확인하고 push를 진행하세요.")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == "context":
        vision = sys.argv[2] if len(sys.argv) > 2 else ""
        context(vision)

    elif cmd == "list":
        if len(sys.argv) < 3:
            print("Usage: stories.py list <epic_key>")
            return
        list_stories(sys.argv[2])

    elif cmd == "dev":
        if len(sys.argv) < 3:
            print("Usage: stories.py dev <epic_key>")
            return
        dev_status(sys.argv[2])

    elif cmd == "push":
        if len(sys.argv) < 3:
            print("Usage: stories.py push <epic_key> [--dry-run]")
            return
        dry_run = "--dry-run" in sys.argv
        push_stories(sys.argv[2], dry_run)

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()
