#!/usr/bin/env python3
"""
Epic 연결 정제 스크립트 - 2단계: Story-Epic 연결

Usage:
  python scripts/refine_epic_links.py --analyze      # 분석만 (기본)
  python scripts/refine_epic_links.py --preview      # 변경 예정 미리보기
  python scripts/refine_epic_links.py --apply        # Jira에 적용
  python scripts/refine_epic_links.py --apply --yes  # 확인 없이 적용
  python scripts/refine_epic_links.py --export       # CSV로 내보내기
"""

import os
import sys
import re
import csv
import argparse
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Configuration
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import config


def get_db_connection():
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASS
    )


def extract_version_from_text(text):
    """Extract version number from text like 'Bundle 1.2.0' or 'VIZEON-1.2.0'."""
    if not text:
        return None
    # Match patterns like 1.2.0, 3.10.0, etc.
    match = re.search(r'(\d+\.\d+\.\d+)', text)
    return match.group(1) if match else None


def get_orphan_stories(conn, months=3):
    """Get stories without Epic parent."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT
            key,
            project,
            summary,
            status,
            raw_data->'fields'->'components'->0->>'name' as component,
            raw_data->'fields'->'fixVersions'->0->>'name' as fix_version,
            created_at
        FROM jira_issues
        WHERE raw_data->'fields'->'issuetype'->>'name' = 'Story'
          AND created_at > NOW() - INTERVAL '%s months'
          AND raw_data->'fields'->'parent' IS NULL
        ORDER BY project, key
    """, [months])
    return cur.fetchall()


def get_epics(conn):
    """Get all epics with their components and versions."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT
            key,
            project,
            summary,
            status,
            raw_data->'fields'->'components'->0->>'name' as component,
            raw_data->'fields'->'fixVersions'->0->>'name' as fix_version
        FROM jira_issues
        WHERE raw_data->'fields'->'issuetype'->>'name' = 'Epic'
        ORDER BY key
    """)
    return cur.fetchall()


def find_matching_epic(story, epics):
    """Find the best matching Epic for a Story."""
    story_component = story.get('component')
    story_fix_version = story.get('fix_version')
    story_version = extract_version_from_text(story_fix_version)

    best_match = None
    match_score = 0
    match_reason = None

    for epic in epics:
        epic_component = epic.get('component')
        epic_fix_version = epic.get('fix_version')
        epic_version = extract_version_from_text(epic.get('summary'))

        score = 0
        reason = []

        # Component match (high priority)
        if story_component and epic_component and story_component == epic_component:
            score += 10
            reason.append('component')

        # Fix version exact match (highest priority)
        if story_fix_version and epic_fix_version and story_fix_version == epic_fix_version:
            score += 20
            reason.append('fix_version_exact')

        # Version number match from summary (medium priority)
        elif story_version and epic_version and story_version == epic_version:
            score += 15
            reason.append(f'version_match({story_version})')

        # Only consider if there's some match
        if score > match_score:
            match_score = score
            best_match = epic
            match_reason = ', '.join(reason)

    return best_match, match_score, match_reason


def update_story_parent(story_key, epic_key):
    """Update story's parent to epic in Jira."""
    url = f"{config.JIRA_URL}/rest/api/3/issue/{story_key}"
    auth = (config.JIRA_EMAIL, config.JIRA_TOKEN)

    payload = {
        'fields': {
            'parent': {'key': epic_key}
        }
    }

    try:
        response = requests.put(url, auth=auth, json=payload, timeout=30)
        return response.ok, response.text if not response.ok else None
    except Exception as e:
        return False, str(e)


def analyze(conn):
    """Analyze orphan stories and potential Epic matches."""
    stories = get_orphan_stories(conn)
    epics = get_epics(conn)

    print("=" * 80)
    print("Epic 연결 분석")
    print("=" * 80)
    print(f"Epic 없는 Story: {len(stories)}개")
    print(f"사용 가능한 Epic: {len(epics)}개\n")

    # Group by match quality
    matched = []
    unmatched = []

    for story in stories:
        epic, score, reason = find_matching_epic(story, epics)
        if epic and score >= 10:  # Minimum score threshold
            matched.append({
                'story': story,
                'epic': epic,
                'score': score,
                'reason': reason
            })
        else:
            unmatched.append(story)

    # Summary
    print("📊 매칭 결과 요약:")
    print("-" * 40)
    print(f"  매칭 성공: {len(matched)}개")
    print(f"  매칭 실패: {len(unmatched)}개")

    # Group matched by Epic
    by_epic = {}
    for m in matched:
        epic_key = m['epic']['key']
        if epic_key not in by_epic:
            by_epic[epic_key] = {
                'epic': m['epic'],
                'stories': []
            }
        by_epic[epic_key]['stories'].append(m)

    print("\n" + "=" * 80)
    print("매칭된 Story → Epic")
    print("=" * 80)

    for epic_key, data in sorted(by_epic.items()):
        epic = data['epic']
        stories = data['stories']
        print(f"\n### {epic_key}: {epic['summary']}")
        print(f"    Component: {epic['component']}, FixVersion: {epic.get('fix_version', 'N/A')}")
        print(f"    Stories ({len(stories)}개):")
        for m in stories:
            s = m['story']
            confidence = '🟢' if m['score'] >= 20 else '🟡'
            print(f"      {confidence} {s['key']}: {s['summary'][:50]}...")
            print(f"         └─ {m['reason']} (score: {m['score']})")

    if unmatched:
        print("\n" + "=" * 80)
        print(f"매칭 실패 ({len(unmatched)}개)")
        print("=" * 80)
        for s in unmatched:
            print(f"  ❌ {s['key']}: {s['summary'][:50]}...")
            print(f"     Component: {s.get('component', 'N/A')}, FixVersion: {s.get('fix_version', 'N/A')}")

    return matched, unmatched


def preview(conn):
    """Preview changes before applying."""
    matched, _ = analyze(conn)

    print("\n" + "=" * 80)
    print("적용 예정 변경사항")
    print("=" * 80)

    # Filter high confidence matches only
    high_confidence = [m for m in matched if m['score'] >= 15]

    print(f"\n적용 대상: {len(high_confidence)}개 (score >= 15)")

    for m in high_confidence:
        print(f"  {m['story']['key']} → {m['epic']['key']} ({m['reason']})")

    return high_confidence


def apply_changes(conn, auto_confirm=False):
    """Apply Epic links to Jira."""
    changes = preview(conn)

    if not changes:
        print("\n적용할 변경사항이 없습니다.")
        return

    if not auto_confirm:
        confirm = input(f"\n{len(changes)}개 Story에 Epic을 연결하시겠습니까? [y/N]: ")
        if confirm.lower() != 'y':
            print("취소되었습니다.")
            return
    else:
        print(f"\n{len(changes)}개 Story에 Epic을 연결합니다...")

    success = 0
    failed = 0

    for m in changes:
        story_key = m['story']['key']
        epic_key = m['epic']['key']

        ok, error = update_story_parent(story_key, epic_key)
        if ok:
            print(f"✅ {story_key} → {epic_key}")
            success += 1
        else:
            print(f"❌ {story_key}: {error[:100] if error else 'Unknown error'}")
            failed += 1

    print(f"\n완료: 성공 {success}, 실패 {failed}")


def export_csv(conn):
    """Export matching results to CSV."""
    stories = get_orphan_stories(conn)
    epics = get_epics(conn)

    filename = f"epic_story_matching_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Story Key', 'Story Title', 'Story Component', 'Story FixVersion',
            'Epic Key', 'Epic Title', 'Epic Component', 'Epic FixVersion',
            'Score', 'Match Reason'
        ])

        for story in stories:
            epic, score, reason = find_matching_epic(story, epics)
            writer.writerow([
                story['key'],
                story['summary'],
                story.get('component', ''),
                story.get('fix_version', ''),
                epic['key'] if epic else '',
                epic['summary'] if epic else '',
                epic.get('component', '') if epic else '',
                epic.get('fix_version', '') if epic else '',
                score,
                reason or ''
            ])

    print(f"CSV 내보내기 완료: {filename}")
    print(f"총 {len(stories)}개 Story 분석 결과 저장")


def main():
    parser = argparse.ArgumentParser(description='Epic 연결 정제 스크립트')
    parser.add_argument('--analyze', action='store_true', default=True, help='분석만 수행 (기본)')
    parser.add_argument('--preview', action='store_true', help='변경 예정 미리보기')
    parser.add_argument('--apply', action='store_true', help='Jira에 적용')
    parser.add_argument('--yes', '-y', action='store_true', help='확인 없이 적용')
    parser.add_argument('--export', action='store_true', help='CSV로 내보내기')
    parser.add_argument('--months', type=int, default=3, help='분석 기간 (월)')
    args = parser.parse_args()

    conn = get_db_connection()

    try:
        if args.apply:
            apply_changes(conn, auto_confirm=args.yes)
        elif args.preview:
            preview(conn)
        elif args.export:
            export_csv(conn)
        else:
            analyze(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
