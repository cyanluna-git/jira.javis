#!/usr/bin/env python3
"""
Confluence 정제 스크립트 - 컨텐츠 분석 및 정리

Usage:
  python scripts/refine_confluence.py --analyze      # 분석만 (기본)
  python scripts/refine_confluence.py --labels       # Label 분석
  python scripts/refine_confluence.py --orphans      # 고아 페이지 분석
  python scripts/refine_confluence.py --jira-links   # Jira 링크 추출
  python scripts/refine_confluence.py --export       # CSV로 내보내기
"""

import os
import sys
import re
import csv
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from collections import Counter

# Configuration
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import config


# Label normalization rules
LABEL_NORMALIZE_MAP = {
    # Sprint labels - standardize format
    'sprint-review': ['sprint-review-note', 'sprint_review', 'sprintreview'],
    'story-note': ['story-note', 'story_note', 'storynote'],
    'design-note': ['design-note', 'design_note', 'designnote'],
    'peer-review': ['peer-review', 'peerreview', 'peer_review'],

    # Project labels
    'tumalo': ['tumalo', 'gen4', 'euvgen4'],
    'protron': ['protron', 'proteus'],
}

# Sprint label pattern
SPRINT_PATTERN = re.compile(r'(tumalo|protron|gen\d+)[-_]?sprint[-_]?(\d+)', re.IGNORECASE)


def get_db_connection():
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASS
    )


def get_all_content(conn):
    """Get all Confluence content."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, type, title, parent_id, space_id, labels,
               version, web_url, created_at
        FROM confluence_v2_content
        ORDER BY title
    """)
    return cur.fetchall()


def get_label_stats(conn):
    """Get label usage statistics."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT label, COUNT(*) as cnt
        FROM confluence_v2_content, unnest(labels) as label
        GROUP BY label
        ORDER BY cnt DESC
    """)
    return cur.fetchall()


def get_content_with_body(conn, content_id):
    """Get content with body for Jira link extraction."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, title, body_storage
        FROM confluence_v2_content
        WHERE id = %s
    """, [content_id])
    return cur.fetchone()


def extract_jira_links(body_text):
    """Extract Jira issue keys from Confluence page body."""
    if not body_text:
        return []

    # Pattern for Jira keys (PROJECT-123 format)
    pattern = re.compile(r'\b([A-Z]{2,10}-\d+)\b')
    matches = pattern.findall(body_text)

    # Remove duplicates while preserving order
    seen = set()
    unique = []
    for m in matches:
        if m not in seen:
            seen.add(m)
            unique.append(m)

    return unique


def analyze_labels(conn):
    """Analyze label usage and suggest standardization."""
    stats = get_label_stats(conn)

    print("=" * 80)
    print("Confluence Label 분석")
    print("=" * 80)
    print(f"총 고유 Label 수: {len(stats)}개\n")

    # Categorize labels
    sprint_labels = []
    note_labels = []
    other_labels = []

    for row in stats:
        label = row['label']
        cnt = row['cnt']

        if SPRINT_PATTERN.search(label):
            sprint_labels.append((label, cnt))
        elif 'note' in label.lower() or 'review' in label.lower():
            note_labels.append((label, cnt))
        else:
            other_labels.append((label, cnt))

    # Print sprint labels
    print("📅 Sprint 관련 Label:")
    print("-" * 60)
    for label, cnt in sorted(sprint_labels, key=lambda x: x[0]):
        match = SPRINT_PATTERN.search(label)
        if match:
            project, num = match.groups()
            suggested = f"{project.lower()}-sprint-{num}"
            if suggested != label:
                print(f"  {label:30} ({cnt}건) → {suggested}")
            else:
                print(f"  {label:30} ({cnt}건) ✓")

    # Print note labels
    print(f"\n📝 노트 관련 Label:")
    print("-" * 60)
    for label, cnt in sorted(note_labels, key=lambda x: -x[1]):
        print(f"  {label:30} ({cnt}건)")

    # Print other labels
    print(f"\n📌 기타 Label ({len(other_labels)}개):")
    print("-" * 60)
    for label, cnt in sorted(other_labels, key=lambda x: -x[1]):
        print(f"  {label:30} ({cnt}건)")

    return stats


def analyze_orphans(conn):
    """Find pages without proper parent (orphan pages)."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get pages with non-existent parents
    cur.execute("""
        SELECT c.id, c.title, c.parent_id
        FROM confluence_v2_content c
        WHERE c.parent_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM confluence_v2_content p WHERE p.id = c.parent_id
          )
    """)
    orphans = cur.fetchall()

    print("=" * 80)
    print("고아 페이지 분석 (부모가 존재하지 않는 페이지)")
    print("=" * 80)
    print(f"총 {len(orphans)}개 발견\n")

    if orphans:
        for page in orphans[:20]:
            print(f"  ❌ {page['title'][:50]}...")
            print(f"      Missing parent: {page['parent_id']}")

        if len(orphans) > 20:
            print(f"\n  ... 외 {len(orphans) - 20}개")
    else:
        print("  고아 페이지 없음 ✓")

    return orphans


def analyze_jira_links(conn):
    """Extract and analyze Jira links from Confluence pages."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get all pages with body
    cur.execute("""
        SELECT id, title, body_storage, labels
        FROM confluence_v2_content
        WHERE body_storage IS NOT NULL AND body_storage != ''
    """)
    pages = cur.fetchall()

    print("=" * 80)
    print("Jira 링크 분석")
    print("=" * 80)
    print(f"분석 대상 페이지: {len(pages)}개\n")

    # Extract links
    page_links = []
    all_jira_keys = Counter()

    for page in pages:
        links = extract_jira_links(page['body_storage'])
        if links:
            page_links.append({
                'id': page['id'],
                'title': page['title'],
                'labels': page['labels'] or [],
                'jira_keys': links
            })
            for key in links:
                all_jira_keys[key] += 1

    print(f"Jira 링크 포함 페이지: {len(page_links)}개")
    print(f"총 고유 Jira 키: {len(all_jira_keys)}개\n")

    # Most referenced issues
    print("📊 가장 많이 참조된 Jira 이슈:")
    print("-" * 60)
    for key, cnt in all_jira_keys.most_common(15):
        print(f"  {key:15} - {cnt}회 참조")

    # Pages with most links
    print(f"\n📄 Jira 링크가 많은 페이지:")
    print("-" * 60)
    for pl in sorted(page_links, key=lambda x: -len(x['jira_keys']))[:10]:
        print(f"  {pl['title'][:40]}... ({len(pl['jira_keys'])}개 링크)")
        print(f"      Keys: {', '.join(pl['jira_keys'][:5])}{'...' if len(pl['jira_keys']) > 5 else ''}")

    return page_links, all_jira_keys


def analyze_structure(conn):
    """Analyze content structure and hierarchy."""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 80)
    print("페이지 구조 분석")
    print("=" * 80)

    # Get hierarchy stats
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_pages,
            COUNT(CASE WHEN labels IS NOT NULL AND array_length(labels, 1) > 0 THEN 1 END) as with_labels,
            COUNT(CASE WHEN body_storage IS NULL OR body_storage = '' THEN 1 END) as empty_body
        FROM confluence_v2_content
    """)
    stats = cur.fetchone()

    print(f"총 페이지 수: {stats['total']}개")
    print(f"루트 페이지: {stats['root_pages']}개")
    print(f"Label 있는 페이지: {stats['with_labels']}개")
    print(f"본문 없는 페이지: {stats['empty_body']}개\n")

    # Top-level structure
    cur.execute("""
        SELECT c.title,
               (SELECT COUNT(*) FROM confluence_v2_content c2 WHERE c2.parent_id = c.id) as children
        FROM confluence_v2_content c
        WHERE (SELECT COUNT(*) FROM confluence_v2_content c2 WHERE c2.parent_id = c.id) > 5
        ORDER BY children DESC
        LIMIT 15
    """)
    top_parents = cur.fetchall()

    print("📁 주요 상위 페이지 (하위 5개 이상):")
    print("-" * 60)
    for p in top_parents:
        print(f"  {p['title'][:45]:45} ({p['children']}개 하위)")

    return stats


def export_csv(conn):
    """Export analysis results to CSV files."""

    # 1. Content structure
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT c.id, c.title, c.type, c.parent_id,
               p.title as parent_title,
               c.labels,
               (SELECT COUNT(*) FROM confluence_v2_content c2 WHERE c2.parent_id = c.id) as child_count,
               c.created_at, c.web_url
        FROM confluence_v2_content c
        LEFT JOIN confluence_v2_content p ON p.id = c.parent_id
        ORDER BY c.title
    """)
    pages = cur.fetchall()

    filename1 = f"confluence_structure_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    with open(filename1, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', 'Title', 'Type', 'Parent Title', 'Labels', 'Child Count', 'Created At', 'URL'])

        for p in pages:
            writer.writerow([
                p['id'],
                p['title'],
                p['type'],
                p['parent_title'] or '(root)',
                ', '.join(p['labels']) if p['labels'] else '',
                p['child_count'],
                p['created_at'],
                p['web_url']
            ])

    print(f"구조 CSV 내보내기 완료: {filename1}")

    # 2. Jira links
    cur.execute("""
        SELECT id, title, body_storage
        FROM confluence_v2_content
        WHERE body_storage IS NOT NULL AND body_storage != ''
    """)
    pages = cur.fetchall()

    filename2 = f"confluence_jira_links_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    with open(filename2, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Page ID', 'Page Title', 'Jira Keys'])

        for p in pages:
            links = extract_jira_links(p['body_storage'])
            if links:
                writer.writerow([
                    p['id'],
                    p['title'],
                    ', '.join(links)
                ])

    print(f"Jira 링크 CSV 내보내기 완료: {filename2}")
    print(f"총 {len(pages)}개 페이지 분석")


def main():
    parser = argparse.ArgumentParser(description='Confluence 정제 스크립트')
    parser.add_argument('--analyze', action='store_true', default=True, help='전체 분석 (기본)')
    parser.add_argument('--labels', action='store_true', help='Label 분석')
    parser.add_argument('--orphans', action='store_true', help='고아 페이지 분석')
    parser.add_argument('--jira-links', action='store_true', help='Jira 링크 분석')
    parser.add_argument('--structure', action='store_true', help='구조 분석')
    parser.add_argument('--export', action='store_true', help='CSV로 내보내기')
    args = parser.parse_args()

    conn = get_db_connection()

    try:
        if args.labels:
            analyze_labels(conn)
        elif args.orphans:
            analyze_orphans(conn)
        elif args.jira_links:
            analyze_jira_links(conn)
        elif args.structure:
            analyze_structure(conn)
        elif args.export:
            export_csv(conn)
        else:
            # Full analysis
            analyze_structure(conn)
            print()
            analyze_labels(conn)
            print()
            analyze_orphans(conn)
            print()
            analyze_jira_links(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
