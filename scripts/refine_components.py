#!/usr/bin/env python3
"""
컴포넌트 정제 스크립트 - 1단계: 누락된 컴포넌트 채우기

Usage:
  python scripts/refine_components.py --analyze      # 분석만 (기본)
  python scripts/refine_components.py --preview      # 변경 예정 미리보기
  python scripts/refine_components.py --apply        # Jira에 적용
  python scripts/refine_components.py --export       # CSV로 내보내기
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

# Component mapping rules (priority order)
COMPONENT_RULES = [
    # HRS 관련 (가장 구체적) - 확장된 패턴
    {
        'pattern': r'HRS|hydrogen|cell.*scanner|blender.*box|PSA|gas.*analy|H2.*NOK|heater.*deadband|ECN.*\d{0,3}|N2.*analy|N2.*OK|purge|heat.*up|shutdown.*button|drain.*timer|valve.*check|blowdown|cell.*voltage|PV\d+.*valve',
        'component': 'HRS',
        'confidence': 'high',
        'reason': 'HRS system keywords detected'
    },
    # Havasu
    {
        'pattern': r'Havasu|SCB.*Pump|Etch',
        'component': 'Havasu Etch',
        'confidence': 'high',
        'reason': 'Havasu/Etch keywords detected'
    },
    # Proteus
    {
        'pattern': r'Proteus',
        'component': 'Proteus',
        'confidence': 'high',
        'reason': 'Proteus keyword detected'
    },
    # Gen4/Tumalo
    {
        'pattern': r'Gen4|Tumalo|TSMC|\[GEN4\]',
        'component': 'EUVGen4 Tumalo',
        'confidence': 'high',
        'reason': 'Gen4/Tumalo keywords detected'
    },
    # H2D
    {
        'pattern': r'H2D|dual.*group|HP.*dual',
        'component': 'H2D',
        'confidence': 'high',
        'reason': 'H2D keywords detected'
    },
    # OQC
    {
        'pattern': r'OQC|digitali',
        'component': 'OQCDigitalization',
        'confidence': 'high',
        'reason': 'OQC keywords detected'
    },
    # Unify (ASP project)
    {
        'pattern': r'Unify|plasma',
        'component': 'Unify Plasma',
        'confidence': 'high',
        'reason': 'Unify/Plasma keywords detected'
    },
    # Gen3
    {
        'pattern': r'Gen3|3\.\d+\.\d+|4\.\d+\.\d+.*\[.*\]',
        'component': 'EUV Gen3/Gen3+',
        'confidence': 'medium',
        'reason': 'Gen3 or version pattern detected'
    },
    # Gen2
    {
        'pattern': r'Gen2|2\.\d+\.\d+',
        'component': 'EUV Gen2/Gen2+',
        'confidence': 'medium',
        'reason': 'Gen2 or version pattern detected'
    },
    # UI/SDG (CommonPlatform)
    {
        'pattern': r'trend|SDG|UI|display|screen|graph|chart|simulator|Codesys|runtime',
        'component': 'CommonPlatfrom,Innovative',
        'confidence': 'medium',
        'reason': 'UI/Platform keywords detected'
    },
    # Halo
    {
        'pattern': r'Halo|Mk1|Mk2|Hermes',
        'component': 'EUVHalo Mk1',
        'confidence': 'medium',
        'reason': 'Halo keywords detected'
    },
]

# Project-specific defaults
PROJECT_DEFAULTS = {
    'ASP': 'Unify Plasma',
    'PSSM': None,  # Support tickets - analyze individually
    'EUV': None,   # Must be determined by content
}


def get_db_connection():
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASS
    )


def get_issues_without_components(conn, months=3):
    """Get issues without components from last N months."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT
            key,
            project,
            raw_data->'fields'->'issuetype'->>'name' as issue_type,
            status,
            summary,
            COALESCE(raw_data->'fields'->'description'->'content'->0->'content'->0->>'text', '') as description,
            raw_data->'fields'->'fixVersions'->0->>'name' as fix_version,
            created_at
        FROM jira_issues
        WHERE created_at > NOW() - INTERVAL '%s months'
          AND (raw_data->'fields'->'components' IS NULL
               OR jsonb_array_length(raw_data->'fields'->'components') = 0)
        ORDER BY project, key
    """, [months])
    return cur.fetchall()


def suggest_component(issue):
    """Suggest component based on issue content."""
    text = f"{issue['summary']} {issue.get('description', '')} {issue.get('fix_version', '')}"

    # Try each rule in priority order
    for rule in COMPONENT_RULES:
        if re.search(rule['pattern'], text, re.IGNORECASE):
            return {
                'component': rule['component'],
                'confidence': rule['confidence'],
                'reason': rule['reason'],
                'matched_pattern': rule['pattern']
            }

    # Project default fallback
    default = PROJECT_DEFAULTS.get(issue['project'])
    if default:
        return {
            'component': default,
            'confidence': 'low',
            'reason': f"Project default for {issue['project']}",
            'matched_pattern': None
        }

    return {
        'component': None,
        'confidence': 'none',
        'reason': 'No matching pattern found',
        'matched_pattern': None
    }


def get_component_id(project_key):
    """Get component IDs from Jira for a project."""
    url = f"{config.JIRA_URL}/rest/api/3/project/{project_key}/components"
    auth = (config.JIRA_EMAIL, config.JIRA_TOKEN)

    try:
        response = requests.get(url, auth=auth, timeout=30)
        if response.ok:
            components = response.json()
            return {c['name']: c['id'] for c in components}
    except Exception as e:
        print(f"Error fetching components: {e}")
    return {}


def update_issue_component(issue_key, component_id):
    """Update issue component in Jira."""
    url = f"{config.JIRA_URL}/rest/api/3/issue/{issue_key}"
    auth = (config.JIRA_EMAIL, config.JIRA_TOKEN)

    payload = {
        'fields': {
            'components': [{'id': component_id}]
        }
    }

    try:
        response = requests.put(url, auth=auth, json=payload, timeout=30)
        return response.ok
    except Exception as e:
        print(f"Error updating {issue_key}: {e}")
        return False


def analyze(conn):
    """Analyze issues without components."""
    issues = get_issues_without_components(conn)

    print("=" * 80)
    print("컴포넌트 누락 이슈 분석")
    print("=" * 80)
    print(f"총 {len(issues)}개 이슈 발견\n")

    # Group by suggested component
    suggestions = {}
    no_suggestion = []

    for issue in issues:
        suggestion = suggest_component(issue)
        comp = suggestion['component']

        if comp:
            if comp not in suggestions:
                suggestions[comp] = []
            suggestions[comp].append({
                'issue': issue,
                'suggestion': suggestion
            })
        else:
            no_suggestion.append(issue)

    # Print summary
    print("📊 추천 결과 요약:")
    print("-" * 40)
    for comp, items in sorted(suggestions.items(), key=lambda x: -len(x[1])):
        high = sum(1 for i in items if i['suggestion']['confidence'] == 'high')
        med = sum(1 for i in items if i['suggestion']['confidence'] == 'medium')
        low = sum(1 for i in items if i['suggestion']['confidence'] == 'low')
        print(f"  {comp}: {len(items)}개 (high:{high}, medium:{med}, low:{low})")

    if no_suggestion:
        print(f"  [추천 불가]: {len(no_suggestion)}개")

    print("\n" + "=" * 80)
    print("상세 내역")
    print("=" * 80)

    for comp, items in sorted(suggestions.items()):
        print(f"\n### {comp} ({len(items)}개)")
        for item in items:
            issue = item['issue']
            sug = item['suggestion']
            conf_icon = {'high': '🟢', 'medium': '🟡', 'low': '🟠'}.get(sug['confidence'], '⚪')
            print(f"  {conf_icon} {issue['key']}: {issue['summary'][:60]}...")
            print(f"      └─ {sug['reason']}")

    if no_suggestion:
        print(f"\n### 추천 불가 ({len(no_suggestion)}개)")
        for issue in no_suggestion:
            print(f"  ❌ {issue['key']}: {issue['summary'][:60]}...")


def preview(conn):
    """Preview changes before applying."""
    issues = get_issues_without_components(conn)

    print("=" * 80)
    print("변경 예정 미리보기")
    print("=" * 80)

    changes = []
    for issue in issues:
        suggestion = suggest_component(issue)
        if suggestion['component'] and suggestion['confidence'] in ('high', 'medium'):
            changes.append({
                'key': issue['key'],
                'project': issue['project'],
                'summary': issue['summary'],
                'component': suggestion['component'],
                'confidence': suggestion['confidence'],
                'reason': suggestion['reason']
            })

    print(f"적용 대상: {len(changes)}개 (high/medium confidence만)\n")

    for c in changes:
        conf_icon = {'high': '🟢', 'medium': '🟡'}.get(c['confidence'], '⚪')
        print(f"{conf_icon} {c['key']} → {c['component']}")
        print(f"   {c['summary'][:70]}...")
        print()

    return changes


def apply_changes(conn, auto_confirm=False):
    """Apply component changes to Jira."""
    changes = preview(conn)

    if not changes:
        print("적용할 변경사항이 없습니다.")
        return

    if not auto_confirm:
        confirm = input(f"\n{len(changes)}개 이슈에 컴포넌트를 적용하시겠습니까? [y/N]: ")
        if confirm.lower() != 'y':
            print("취소되었습니다.")
            return
    else:
        print(f"\n{len(changes)}개 이슈에 컴포넌트를 적용합니다...")

    # Get component IDs for each project
    project_components = {}
    for c in changes:
        if c['project'] not in project_components:
            project_components[c['project']] = get_component_id(c['project'])

    success = 0
    failed = 0

    for c in changes:
        comp_map = project_components.get(c['project'], {})
        comp_id = comp_map.get(c['component'])

        if not comp_id:
            print(f"❌ {c['key']}: 컴포넌트 ID를 찾을 수 없음 ({c['component']})")
            failed += 1
            continue

        if update_issue_component(c['key'], comp_id):
            print(f"✅ {c['key']} → {c['component']}")
            success += 1
        else:
            print(f"❌ {c['key']}: 업데이트 실패")
            failed += 1

    print(f"\n완료: 성공 {success}, 실패 {failed}")


def export_csv(conn):
    """Export analysis to CSV."""
    issues = get_issues_without_components(conn)

    filename = f"component_suggestions_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Key', 'Project', 'Type', 'Status', 'Summary',
                        'Suggested Component', 'Confidence', 'Reason'])

        for issue in issues:
            suggestion = suggest_component(issue)
            writer.writerow([
                issue['key'],
                issue['project'],
                issue['issue_type'],
                issue['status'],
                issue['summary'],
                suggestion['component'] or '',
                suggestion['confidence'],
                suggestion['reason']
            ])

    print(f"CSV 내보내기 완료: {filename}")


def main():
    parser = argparse.ArgumentParser(description='컴포넌트 정제 스크립트')
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
