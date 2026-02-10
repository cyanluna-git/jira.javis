#!/usr/bin/env python3
"""
Label 표준화 스크립트 - 3단계: Label 정리 및 표준화

Usage:
  python scripts/refine_labels.py --analyze      # 분석만 (기본)
  python scripts/refine_labels.py --preview      # 변경 예정 미리보기
  python scripts/refine_labels.py --apply        # Jira에 적용
  python scripts/refine_labels.py --apply --yes  # 확인 없이 적용
  python scripts/refine_labels.py --export       # CSV로 내보내기
"""

import os
import sys
import csv
import argparse
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from collections import Counter

# Configuration
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import config


# Label normalization rules
# Format: { 'normalized_label': ['variant1', 'variant2', ...] }
LABEL_NORMALIZE_MAP = {
    # Priority/Urgency
    'urgent': ['Urgent', 'URGENT', 'urgent!', 'high-priority', 'HighPriority'],
    'blocker': ['Blocker', 'BLOCKER', 'blocking', 'blocked'],

    # Status indicators
    'tech-debt': ['TechDebt', 'tech_debt', 'technical-debt', 'Technical_Debt', 'techdebt'],
    'bug-fix': ['BugFix', 'bugfix', 'bug_fix', 'Bug_Fix', 'hotfix', 'HotFix'],
    'spike': ['Spike', 'SPIKE', 'spike-task', 'research', 'investigation'],

    # Feature types
    'ui': ['UI', 'ui', 'frontend', 'Frontend', 'FrontEnd', 'front-end'],
    'backend': ['Backend', 'backend', 'BackEnd', 'back-end', 'server-side'],
    'api': ['API', 'api', 'Api', 'rest-api', 'REST'],
    'database': ['Database', 'database', 'DB', 'db', 'sql', 'SQL'],

    # Product/Module
    'hrs': ['HRS', 'hrs', 'Hrs', 'hydrogen'],
    'gen4': ['Gen4', 'GEN4', 'gen4', 'Tumalo', 'TUMALO'],
    'gen3': ['Gen3', 'GEN3', 'gen3', 'Gen3+', 'gen3+'],
    'gen2': ['Gen2', 'GEN2', 'gen2', 'Gen2+', 'gen2+'],
    'h2d': ['H2D', 'h2d', 'H2d'],
    'oqc': ['OQC', 'oqc', 'Oqc'],
    'vizeon': ['VIZEON', 'Vizeon', 'vizeon'],

    # Process
    'needs-review': ['NeedsReview', 'needs_review', 'review-needed', 'ReviewNeeded'],
    'wip': ['WIP', 'wip', 'work-in-progress', 'WorkInProgress'],
    'done': ['Done', 'DONE', 'completed', 'Completed'],

    # Customer/Site
    'tsmc': ['TSMC', 'tsmc', 'Tsmc'],
    'samsung': ['Samsung', 'SAMSUNG', 'samsung', 'SEC'],
    'intel': ['Intel', 'INTEL', 'intel'],
    'micron': ['Micron', 'MICRON', 'micron'],
}

# Build reverse lookup: variant -> normalized
LABEL_VARIANTS = {}
for normalized, variants in LABEL_NORMALIZE_MAP.items():
    for variant in variants:
        LABEL_VARIANTS[variant.lower()] = normalized


def get_db_connection():
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASS
    )


def get_all_labels(conn):
    """Get all unique labels from issues."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT DISTINCT jsonb_array_elements_text(raw_data->'fields'->'labels') as label
        FROM jira_issues
        WHERE raw_data->'fields'->'labels' IS NOT NULL
          AND jsonb_array_length(raw_data->'fields'->'labels') > 0
        ORDER BY label
    """)
    return [row['label'] for row in cur.fetchall()]


def get_issues_with_labels(conn, months=6):
    """Get issues with their labels."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT
            key,
            project,
            summary,
            status,
            raw_data->'fields'->'labels' as labels,
            raw_data->'fields'->'issuetype'->>'name' as issue_type,
            created_at
        FROM jira_issues
        WHERE created_at > NOW() - INTERVAL '%s months'
          AND raw_data->'fields'->'labels' IS NOT NULL
          AND jsonb_array_length(raw_data->'fields'->'labels') > 0
        ORDER BY project, key
    """, [months])
    return cur.fetchall()


def normalize_label(label):
    """Normalize a single label."""
    lower = label.lower()
    if lower in LABEL_VARIANTS:
        return LABEL_VARIANTS[lower]
    return None  # No normalization needed or unknown


def suggest_label_changes(issue):
    """Suggest label changes for an issue."""
    labels = issue.get('labels', [])
    if not labels:
        return None

    changes = []
    new_labels = []

    for label in labels:
        normalized = normalize_label(label)
        if normalized and normalized != label:
            changes.append({
                'from': label,
                'to': normalized
            })
            if normalized not in new_labels:
                new_labels.append(normalized)
        else:
            if label not in new_labels:
                new_labels.append(label)

    if changes:
        return {
            'old_labels': labels,
            'new_labels': new_labels,
            'changes': changes
        }
    return None


def update_issue_labels(issue_key, new_labels):
    """Update issue labels in Jira."""
    url = f"{config.JIRA_URL}/rest/api/3/issue/{issue_key}"
    auth = (config.JIRA_EMAIL, config.JIRA_TOKEN)

    payload = {
        'fields': {
            'labels': new_labels
        }
    }

    try:
        response = requests.put(url, auth=auth, json=payload, timeout=30)
        return response.ok, response.text if not response.ok else None
    except Exception as e:
        return False, str(e)


def analyze(conn):
    """Analyze labels across all issues."""
    all_labels = get_all_labels(conn)
    issues = get_issues_with_labels(conn)

    print("=" * 80)
    print("Label 분석")
    print("=" * 80)
    print(f"총 고유 Label 수: {len(all_labels)}개")
    print(f"Label 있는 이슈 수: {len(issues)}개\n")

    # Count label usage
    label_counts = Counter()
    for issue in issues:
        for label in issue.get('labels', []):
            label_counts[label] += 1

    # Categorize labels
    normalizable = []
    unknown = []

    for label in all_labels:
        normalized = normalize_label(label)
        if normalized:
            if normalized != label:
                normalizable.append((label, normalized, label_counts[label]))
        else:
            unknown.append((label, label_counts[label]))

    # Print normalizable labels
    print("📊 표준화 가능 Label:")
    print("-" * 60)
    if normalizable:
        for orig, norm, count in sorted(normalizable, key=lambda x: -x[2]):
            print(f"  {orig:30} → {norm:20} ({count}건)")
    else:
        print("  (없음)")

    # Print unknown labels
    print(f"\n📋 분류되지 않은 Label ({len(unknown)}개):")
    print("-" * 60)
    for label, count in sorted(unknown, key=lambda x: -x[1])[:30]:
        print(f"  {label:40} ({count}건)")
    if len(unknown) > 30:
        print(f"  ... 외 {len(unknown) - 30}개")

    # Find issues needing changes
    issues_to_change = []
    for issue in issues:
        suggestion = suggest_label_changes(issue)
        if suggestion:
            issues_to_change.append({
                'issue': issue,
                'suggestion': suggestion
            })

    print(f"\n📝 변경 필요 이슈: {len(issues_to_change)}개")

    return issues_to_change, unknown


def preview(conn):
    """Preview label changes."""
    issues_to_change, _ = analyze(conn)

    print("\n" + "=" * 80)
    print("변경 예정 상세")
    print("=" * 80)

    if not issues_to_change:
        print("변경할 이슈가 없습니다.")
        return []

    for item in issues_to_change[:20]:
        issue = item['issue']
        sug = item['suggestion']
        print(f"\n{issue['key']}: {issue['summary'][:50]}...")
        for change in sug['changes']:
            print(f"    {change['from']} → {change['to']}")

    if len(issues_to_change) > 20:
        print(f"\n... 외 {len(issues_to_change) - 20}개")

    return issues_to_change


def apply_changes(conn, auto_confirm=False):
    """Apply label changes to Jira."""
    changes = preview(conn)

    if not changes:
        print("\n적용할 변경사항이 없습니다.")
        return

    if not auto_confirm:
        confirm = input(f"\n{len(changes)}개 이슈의 Label을 변경하시겠습니까? [y/N]: ")
        if confirm.lower() != 'y':
            print("취소되었습니다.")
            return
    else:
        print(f"\n{len(changes)}개 이슈의 Label을 변경합니다...")

    success = 0
    failed = 0

    for item in changes:
        issue = item['issue']
        sug = item['suggestion']

        ok, error = update_issue_labels(issue['key'], sug['new_labels'])
        if ok:
            print(f"✅ {issue['key']}")
            success += 1
        else:
            print(f"❌ {issue['key']}: {error[:100] if error else 'Unknown error'}")
            failed += 1

    print(f"\n완료: 성공 {success}, 실패 {failed}")


def export_csv(conn):
    """Export label analysis to CSV."""
    all_labels = get_all_labels(conn)
    issues = get_issues_with_labels(conn)

    # Count label usage
    label_counts = Counter()
    for issue in issues:
        for label in issue.get('labels', []):
            label_counts[label] += 1

    # Export labels summary
    filename = f"label_analysis_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Label', 'Count', 'Normalized To', 'Category'])

        for label in sorted(all_labels):
            normalized = normalize_label(label)
            category = ''
            if normalized:
                # Find category
                for cat, variants in LABEL_NORMALIZE_MAP.items():
                    if cat == normalized:
                        if 'urgent' in cat or 'blocker' in cat:
                            category = 'Priority'
                        elif cat in ['tech-debt', 'bug-fix', 'spike']:
                            category = 'Type'
                        elif cat in ['ui', 'backend', 'api', 'database']:
                            category = 'Layer'
                        elif cat in ['hrs', 'gen4', 'gen3', 'gen2', 'h2d', 'oqc', 'vizeon']:
                            category = 'Product'
                        elif cat in ['needs-review', 'wip', 'done']:
                            category = 'Status'
                        elif cat in ['tsmc', 'samsung', 'intel', 'micron']:
                            category = 'Customer'
                        break

            writer.writerow([
                label,
                label_counts[label],
                normalized if normalized and normalized != label else '',
                category
            ])

    print(f"Label 분석 CSV 내보내기 완료: {filename}")

    # Export issues with labels
    filename2 = f"issues_with_labels_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"

    with open(filename2, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Key', 'Project', 'Type', 'Summary', 'Labels', 'Suggested Labels', 'Changes'])

        for issue in issues:
            suggestion = suggest_label_changes(issue)
            labels = issue.get('labels', [])

            writer.writerow([
                issue['key'],
                issue['project'],
                issue['issue_type'],
                issue['summary'],
                ', '.join(labels) if labels else '',
                ', '.join(suggestion['new_labels']) if suggestion else '',
                '; '.join([f"{c['from']}→{c['to']}" for c in suggestion['changes']]) if suggestion else ''
            ])

    print(f"이슈별 Label CSV 내보내기 완료: {filename2}")
    print(f"총 {len(issues)}개 이슈, {len(all_labels)}개 고유 Label")


def main():
    parser = argparse.ArgumentParser(description='Label 표준화 스크립트')
    parser.add_argument('--analyze', action='store_true', default=True, help='분석만 수행 (기본)')
    parser.add_argument('--preview', action='store_true', help='변경 예정 미리보기')
    parser.add_argument('--apply', action='store_true', help='Jira에 적용')
    parser.add_argument('--yes', '-y', action='store_true', help='확인 없이 적용')
    parser.add_argument('--export', action='store_true', help='CSV로 내보내기')
    parser.add_argument('--months', type=int, default=6, help='분석 기간 (월)')
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
