#!/usr/bin/env python3
"""
Team Member Stats Sync Script

Syncs member stats from Jira issue data:
  1. Extract unique assignees -> team_members
  2. Calculate stats from completed issues -> member_stats
  3. Track stat changes -> member_stat_history

Usage:
  python scripts/sync_member_stats.py              # Incremental update
  python scripts/sync_member_stats.py --init       # Full initialization
  python scripts/sync_member_stats.py --recalculate # Recalculate all stats
  python scripts/sync_member_stats.py --sprint <sprint_id>  # Calculate sprint stats
"""

import os
import sys
import argparse
from datetime import datetime
from decimal import Decimal
import psycopg2
from psycopg2.extras import Json, DictCursor


# --- Configuration ---
def load_env(env_path=".env"):
    """Load environment variables from .env file"""
    config = {}

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    possible_paths = [
        env_path,
        os.path.join(project_root, ".env"),
        os.path.join(project_root, "src", "javis-viewer", ".env"),
    ]

    for path in possible_paths:
        if os.path.exists(path):
            env_path = path
            break

    try:
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
        print(f"Loaded config from: {env_path}")
    except FileNotFoundError:
        print(f"Warning: .env file not found at {env_path}")
    return config


config = load_env()

# DB Config
DB_HOST = "localhost"
DB_PORT = "5439"
DB_NAME = "javis_brain"
DB_USER = "javis"
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")


# --- Score Calculation Constants ---
POINTS_PER_STORY_POINT = 2
TYPE_MULTIPLIERS = {
    'Story': 1.0,
    'Bug': 1.2,
    'Task': 0.8,
    'Sub-task': 0.5,
    'Epic': 1.5,
}
ON_TIME_BONUS = 3
LATE_PENALTY = -1
COMPLEXITY_BONUS_THRESHOLD = 2


def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )


def calculate_story_completion_score(issue_data):
    """
    Calculate score when a story is completed.

    Args:
        issue_data: dict containing issue fields from raw_data->'fields'

    Returns:
        dict with score breakdown
    """
    fields = issue_data.get('fields', {})

    # 1. Story points base score
    story_points = fields.get('customfield_10016') or 0
    try:
        story_points = float(story_points)
    except (TypeError, ValueError):
        story_points = 0

    base_score = story_points * POINTS_PER_STORY_POINT

    # 2. Issue type multiplier
    issue_type = fields.get('issuetype', {}).get('name', 'Story')
    type_multiplier = TYPE_MULTIPLIERS.get(issue_type, 1.0)

    # 3. Due date bonus/penalty
    due_date_str = fields.get('duedate')
    resolution_date_str = fields.get('resolutiondate')
    time_bonus = 0
    on_time = None

    if due_date_str and resolution_date_str:
        try:
            due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00'))
            resolution_date = datetime.fromisoformat(resolution_date_str.replace('Z', '+00:00'))

            if resolution_date.date() <= due_date.date():
                time_bonus = ON_TIME_BONUS
                on_time = True
            else:
                time_bonus = LATE_PENALTY
                on_time = False
        except (ValueError, TypeError):
            pass

    # 4. Complexity bonus (components)
    components = fields.get('components', []) or []
    complexity_bonus = len(components) if len(components) >= COMPLEXITY_BONUS_THRESHOLD else 0

    # Final calculation
    raw_score = base_score + time_bonus + complexity_bonus
    final_score = raw_score * type_multiplier

    return {
        'story_points': story_points,
        'base_score': base_score,
        'type_multiplier': type_multiplier,
        'time_bonus': time_bonus,
        'complexity_bonus': complexity_bonus,
        'final_score': round(final_score, 2),
        'issue_type': issue_type,
        'on_time': on_time
    }


def sync_members_from_issues(conn):
    """Extract unique assignees/reporters from issues and sync to team_members"""
    cur = conn.cursor(cursor_factory=DictCursor)

    print("\n[1/4] Syncing Team Members from Issues...")

    # Get unique assignees
    cur.execute("""
        SELECT DISTINCT
            raw_data->'fields'->'assignee'->>'accountId' as account_id,
            raw_data->'fields'->'assignee'->>'displayName' as display_name,
            raw_data->'fields'->'assignee'->'avatarUrls'->>'48x48' as avatar_url
        FROM jira_issues
        WHERE raw_data->'fields'->'assignee'->>'accountId' IS NOT NULL
    """)

    assignees = cur.fetchall()

    # Also get reporters
    cur.execute("""
        SELECT DISTINCT
            raw_data->'fields'->'reporter'->>'accountId' as account_id,
            raw_data->'fields'->'reporter'->>'displayName' as display_name,
            raw_data->'fields'->'reporter'->'avatarUrls'->>'48x48' as avatar_url
        FROM jira_issues
        WHERE raw_data->'fields'->'reporter'->>'accountId' IS NOT NULL
    """)

    reporters = cur.fetchall()

    # Merge unique
    all_users = {}
    for user in assignees + reporters:
        if user['account_id'] and user['account_id'] not in all_users:
            all_users[user['account_id']] = user

    # Upsert members
    inserted = 0
    updated = 0

    for account_id, user in all_users.items():
        cur.execute("""
            INSERT INTO team_members (account_id, display_name, avatar_url)
            VALUES (%s, %s, %s)
            ON CONFLICT (account_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url,
                updated_at = NOW()
            RETURNING (xmax = 0) as inserted
        """, (account_id, user['display_name'], user['avatar_url']))

        result = cur.fetchone()
        if result['inserted']:
            inserted += 1
        else:
            updated += 1

    conn.commit()
    print(f"  Members: {inserted} new, {updated} updated, {len(all_users)} total")

    cur.close()
    return len(all_users)


def ensure_cumulative_stats(conn):
    """Ensure each member has a cumulative (period_type=NULL) stats row"""
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO member_stats (member_id, period_type, period_id)
        SELECT id, NULL, NULL
        FROM team_members
        WHERE id NOT IN (
            SELECT member_id FROM member_stats
            WHERE period_type IS NULL AND period_id IS NULL
        )
    """)

    inserted = cur.rowcount
    conn.commit()
    cur.close()

    if inserted > 0:
        print(f"  Created {inserted} cumulative stat records")


def calculate_cumulative_stats(conn):
    """Calculate cumulative stats for all members from completed issues"""
    cur = conn.cursor(cursor_factory=DictCursor)

    print("\n[2/4] Calculating Cumulative Stats...")

    # Get all active members
    cur.execute("SELECT id, account_id, display_name FROM team_members WHERE is_active = TRUE")
    members = cur.fetchall()

    for member in members:
        member_id = member['id']
        account_id = member['account_id']
        display_name = member['display_name']

        # Get completed issues for this member (check status name for Done-like statuses)
        cur.execute("""
            SELECT
                key,
                raw_data
            FROM jira_issues
            WHERE raw_data->'fields'->'assignee'->>'accountId' = %s
            AND (
                raw_data->'fields'->'status'->>'name' IN ('Done', 'Closed', 'Resolved', 'Complete', 'Completed')
                OR raw_data->'fields'->'resolution' IS NOT NULL
            )
        """, (account_id,))

        completed_issues = cur.fetchall()

        # Aggregate stats
        stats = {
            'stories_completed': 0,
            'story_points_earned': Decimal('0'),
            'bugs_fixed': 0,
            'tasks_completed': 0,
            'on_time_delivery': 0,
            'late_delivery': 0,
            'contribution_score': Decimal('0'),
        }

        for issue in completed_issues:
            raw_data = issue['raw_data']
            score_data = calculate_story_completion_score(raw_data)

            issue_type = score_data['issue_type']

            # Count by type
            if issue_type == 'Bug':
                stats['bugs_fixed'] += 1
            elif issue_type in ('Task', 'Sub-task'):
                stats['tasks_completed'] += 1
            else:
                stats['stories_completed'] += 1

            # Points and score
            stats['story_points_earned'] += Decimal(str(score_data['story_points']))
            stats['contribution_score'] += Decimal(str(score_data['final_score']))

            # Timing
            if score_data['on_time'] is True:
                stats['on_time_delivery'] += 1
            elif score_data['on_time'] is False:
                stats['late_delivery'] += 1

        # Calculate derived scores (normalized 0-100)
        total_completed = stats['stories_completed'] + stats['bugs_fixed'] + stats['tasks_completed']

        # Development score: based on points and completion rate
        dev_score = 50  # base
        if stats['story_points_earned'] > 0:
            dev_score = min(100, 50 + float(stats['story_points_earned']) * 2)

        # Maturity level: based on total completions
        maturity = min(10, 1 + total_completed // 10)

        # Update stats
        cur.execute("""
            UPDATE member_stats SET
                stories_completed = %s,
                story_points_earned = %s,
                bugs_fixed = %s,
                tasks_completed = %s,
                on_time_delivery = %s,
                late_delivery = %s,
                contribution_score = %s,
                development_score = %s,
                maturity_level = %s,
                calculated_at = NOW()
            WHERE member_id = %s AND period_type IS NULL
        """, (
            stats['stories_completed'],
            stats['story_points_earned'],
            stats['bugs_fixed'],
            stats['tasks_completed'],
            stats['on_time_delivery'],
            stats['late_delivery'],
            stats['contribution_score'],
            dev_score,
            maturity,
            member_id
        ))

        if total_completed > 0:
            print(f"  {display_name}: {total_completed} completed, {stats['story_points_earned']} pts, score={stats['contribution_score']}")

    conn.commit()
    cur.close()
    print(f"  Processed {len(members)} members")


def calculate_sprint_stats(conn, sprint_id=None):
    """Calculate per-sprint stats for members"""
    cur = conn.cursor(cursor_factory=DictCursor)

    print("\n[3/4] Calculating Sprint Stats...")

    # Get sprints to process
    if sprint_id:
        cur.execute("SELECT id, name FROM jira_sprints WHERE id = %s", (sprint_id,))
    else:
        # Only active and recently closed sprints
        cur.execute("""
            SELECT id, name FROM jira_sprints
            WHERE state IN ('active', 'closed')
            ORDER BY COALESCE(end_date, start_date) DESC
            LIMIT 10
        """)

    sprints = cur.fetchall()

    for sprint in sprints:
        sprint_id = sprint['id']
        sprint_name = sprint['name']

        # Get issues in this sprint with their assignees
        cur.execute("""
            SELECT
                ji.key,
                ji.raw_data,
                tm.id as member_id,
                tm.display_name
            FROM jira_issue_sprints jis
            JOIN jira_issues ji ON jis.issue_key = ji.key
            LEFT JOIN team_members tm ON tm.account_id = ji.raw_data->'fields'->'assignee'->>'accountId'
            WHERE jis.sprint_id = %s
            AND tm.id IS NOT NULL
        """, (sprint_id,))

        sprint_issues = cur.fetchall()

        # Group by member
        member_issues = {}
        for issue in sprint_issues:
            mid = issue['member_id']
            if mid not in member_issues:
                member_issues[mid] = {
                    'display_name': issue['display_name'],
                    'issues': []
                }
            member_issues[mid]['issues'].append(issue)

        # Calculate and save stats for each member in this sprint
        for member_id, data in member_issues.items():
            stats = {
                'stories_completed': 0,
                'story_points_earned': Decimal('0'),
                'bugs_fixed': 0,
                'on_time_delivery': 0,
                'late_delivery': 0,
                'contribution_score': Decimal('0'),
            }

            for issue in data['issues']:
                raw_data = issue['raw_data']
                fields = raw_data.get('fields', {})

                # Check if done
                status = fields.get('status', {}).get('name', '')
                resolution = fields.get('resolution')

                if status in ('Done', 'Closed', 'Resolved', 'Complete', 'Completed') or resolution:
                    score_data = calculate_story_completion_score(raw_data)
                    issue_type = score_data['issue_type']

                    if issue_type == 'Bug':
                        stats['bugs_fixed'] += 1
                    else:
                        stats['stories_completed'] += 1

                    stats['story_points_earned'] += Decimal(str(score_data['story_points']))
                    stats['contribution_score'] += Decimal(str(score_data['final_score']))

                    if score_data['on_time'] is True:
                        stats['on_time_delivery'] += 1
                    elif score_data['on_time'] is False:
                        stats['late_delivery'] += 1

            # Upsert sprint stats
            cur.execute("""
                INSERT INTO member_stats (
                    member_id, period_type, period_id,
                    stories_completed, story_points_earned, bugs_fixed,
                    on_time_delivery, late_delivery, contribution_score,
                    calculated_at
                ) VALUES (
                    %s, 'sprint', %s,
                    %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (member_id, period_type, period_id) DO UPDATE SET
                    stories_completed = EXCLUDED.stories_completed,
                    story_points_earned = EXCLUDED.story_points_earned,
                    bugs_fixed = EXCLUDED.bugs_fixed,
                    on_time_delivery = EXCLUDED.on_time_delivery,
                    late_delivery = EXCLUDED.late_delivery,
                    contribution_score = EXCLUDED.contribution_score,
                    calculated_at = NOW()
            """, (
                member_id, str(sprint_id),
                stats['stories_completed'],
                stats['story_points_earned'],
                stats['bugs_fixed'],
                stats['on_time_delivery'],
                stats['late_delivery'],
                stats['contribution_score']
            ))

        if member_issues:
            print(f"  Sprint '{sprint_name}': {len(member_issues)} members processed")

    conn.commit()
    cur.close()


def record_stat_change(conn, member_id, trigger_type, trigger_ref, stat_name, old_value, new_value, changed_by='system', reason=None):
    """Record a stat change in history"""
    cur = conn.cursor()

    delta = (new_value or 0) - (old_value or 0)

    cur.execute("""
        INSERT INTO member_stat_history
        (member_id, trigger_type, trigger_ref, stat_name, old_value, new_value, delta, changed_by, reason)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (member_id, trigger_type, trigger_ref, stat_name, old_value, new_value, delta, changed_by, reason))

    cur.close()


def print_summary(conn):
    """Print sync summary"""
    cur = conn.cursor(cursor_factory=DictCursor)

    print("\n[4/4] Summary")
    print("-" * 50)

    # Total members
    cur.execute("SELECT COUNT(*) as count FROM team_members WHERE is_active = TRUE")
    member_count = cur.fetchone()['count']

    # Top contributors
    cur.execute("""
        SELECT
            tm.display_name,
            ms.story_points_earned,
            ms.contribution_score,
            ms.maturity_level
        FROM member_stats ms
        JOIN team_members tm ON ms.member_id = tm.id
        WHERE ms.period_type IS NULL
        ORDER BY ms.contribution_score DESC
        LIMIT 5
    """)

    top_members = cur.fetchall()

    print(f"\nActive Members: {member_count}")
    print("\nTop Contributors:")
    for i, m in enumerate(top_members, 1):
        print(f"  {i}. {m['display_name']}: {m['story_points_earned']} pts, score={m['contribution_score']}, level={m['maturity_level']}")

    cur.close()


def main():
    parser = argparse.ArgumentParser(description='Sync team member stats from Jira data')
    parser.add_argument('--init', action='store_true', help='Full initialization')
    parser.add_argument('--recalculate', action='store_true', help='Recalculate all stats')
    parser.add_argument('--sprint', type=int, help='Calculate stats for specific sprint')

    args = parser.parse_args()

    print("=" * 60)
    print("Team Member Stats Sync")
    print("=" * 60)

    try:
        conn = get_db_connection()
        print("Database connection OK")
    except Exception as e:
        print(f"Database connection failed: {e}")
        sys.exit(1)

    try:
        # Always sync members first
        sync_members_from_issues(conn)
        ensure_cumulative_stats(conn)

        if args.init or args.recalculate:
            calculate_cumulative_stats(conn)
            calculate_sprint_stats(conn)
        elif args.sprint:
            calculate_sprint_stats(conn, args.sprint)
        else:
            # Incremental: just recalculate cumulative
            calculate_cumulative_stats(conn)

        print_summary(conn)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

    print("\n" + "=" * 60)
    print("Sync completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
