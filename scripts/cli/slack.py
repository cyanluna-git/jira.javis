"""
Slack command - Test and manage Slack integration.

Usage:
  javis slack test                    # Send test message
  javis slack risk                    # Send current risks to Slack
  javis slack sprint                  # Send sprint summary
  javis slack channels                # List available channels
"""

import argparse
import sys
import os

# Add scripts directory to path for imports
SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS_DIR)


def cmd_test(args):
    """Send a test message to Slack."""
    from lib.slack_notifications import send_test_message
    from lib import config

    channel = args.channel or config.SLACK_DEFAULT_CHANNEL
    print(f"Sending test message to {channel}...")

    result = send_test_message(channel)

    if result:
        print(f"✓ Message sent successfully!")
        print(f"  Channel: {result.get('channel')}")
        print(f"  Timestamp: {result.get('ts')}")
    else:
        print("✗ Failed to send message. Check your SLACK_BOT_TOKEN.")
        sys.exit(1)


def cmd_risk(args):
    """Send current open risks to Slack."""
    from lib import db
    from lib.slack_notifications import send_risk_alert
    from lib import config

    channel = args.channel or config.SLACK_DEFAULT_CHANNEL

    # Fetch open risks
    severity_filter = args.severity
    query = """
        SELECT
            r.*,
            m.title as milestone_title,
            v.title as vision_title
        FROM roadmap_risks r
        LEFT JOIN roadmap_milestones m ON r.milestone_id = m.id
        LEFT JOIN roadmap_visions v ON m.vision_id = v.id
        WHERE r.status = 'open'
    """

    if severity_filter:
        query += f" AND r.severity = '{severity_filter}'"

    query += """
        ORDER BY
            CASE r.severity
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END
        LIMIT 10
    """

    risks = db.fetch_all(query)

    if not risks:
        print("No open risks found.")
        return

    print(f"Found {len(risks)} open risks. Sending to {channel}...")

    sent = 0
    for risk in risks:
        result = send_risk_alert(risk, channel)
        if result:
            sent += 1
            print(f"  ✓ Sent: [{risk['severity'].upper()}] {risk['title'][:50]}")
        else:
            print(f"  ✗ Failed: {risk['title'][:50]}")

    print(f"\nSent {sent}/{len(risks)} risk alerts.")


def cmd_sprint(args):
    """Send sprint summary to Slack."""
    from lib import db
    from lib.slack_notifications import send_sprint_summary
    from lib import config

    channel = args.channel or config.SLACK_DEFAULT_CHANNEL

    # Get active sprint
    sprint = db.fetch_one("""
        SELECT * FROM jira_sprints
        WHERE state = 'active'
        ORDER BY start_date DESC
        LIMIT 1
    """)

    if not sprint:
        print("No active sprint found.")
        return

    print(f"Found active sprint: {sprint['name']}")

    # Get sprint issues
    issues = db.fetch_all("""
        SELECT
            key,
            raw_data->'fields'->'status'->>'name' as status
        FROM jira_issues
        WHERE raw_data->'fields'->'sprint'->>'id' = %s
           OR EXISTS (
               SELECT 1 FROM jsonb_array_elements(raw_data->'fields'->'sprints') s
               WHERE s->>'id' = %s
           )
    """, (str(sprint['id']), str(sprint['id'])))

    print(f"  Issues in sprint: {len(issues)}")
    print(f"Sending summary to {channel}...")

    result = send_sprint_summary(sprint, issues, channel)

    if result:
        print("✓ Sprint summary sent successfully!")
    else:
        print("✗ Failed to send sprint summary.")
        sys.exit(1)


def cmd_channels(args):
    """List available Slack channels."""
    from lib.slack_client import get_client, SlackError

    try:
        client = get_client()
        channels = client.list_channels()

        print(f"Found {len(channels)} channels:\n")
        for ch in channels:
            name = ch.get("name", "unknown")
            ch_id = ch.get("id", "")
            is_member = "✓" if ch.get("is_member") else " "
            print(f"  [{is_member}] #{name} ({ch_id})")

        print("\n✓ = Bot is a member")

    except SlackError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_status(args):
    """Show Slack integration status."""
    from lib import config, db

    print("=" * 60)
    print("SLACK INTEGRATION STATUS")
    print("=" * 60)

    # Config check
    print("\nConfiguration:")
    print(f"  SLACK_BOT_TOKEN: {'✓ Set' if config.SLACK_BOT_TOKEN else '✗ Not set'}")
    print(f"  SLACK_SIGNING_SECRET: {'✓ Set' if config.SLACK_SIGNING_SECRET else '✗ Not set'}")
    print(f"  SLACK_DEFAULT_CHANNEL: {config.SLACK_DEFAULT_CHANNEL}")

    # Recent notifications
    try:
        stats = db.fetch_one("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'sent') as sent,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                MAX(sent_at) as last_sent
            FROM slack_notifications
            WHERE created_at > NOW() - INTERVAL '24 hours'
        """)

        print("\nNotifications (last 24h):")
        print(f"  Total: {stats['total']}")
        print(f"  Sent: {stats['sent']}")
        print(f"  Failed: {stats['failed']}")
        if stats['last_sent']:
            print(f"  Last sent: {stats['last_sent']}")
    except Exception as e:
        print(f"\nNotifications: Table not found (run migration first)")

    # Connection test
    if config.SLACK_BOT_TOKEN:
        print("\nConnection test:")
        try:
            from lib.slack_client import get_client
            client = get_client()
            # Try to get auth test
            result = client._request("GET", "auth.test")
            print(f"  ✓ Connected as: {result.get('user', 'unknown')}")
            print(f"  ✓ Team: {result.get('team', 'unknown')}")
        except Exception as e:
            print(f"  ✗ Connection failed: {e}")


def run(args):
    """Run slack command."""
    parser = argparse.ArgumentParser(prog='javis slack', description='Slack integration')
    parser.add_argument('action', nargs='?', default='status',
                        choices=['test', 'risk', 'sprint', 'channels', 'status'],
                        help='Action to perform')
    parser.add_argument('--channel', '-c', type=str,
                        help='Target Slack channel')
    parser.add_argument('--severity', '-s', type=str,
                        choices=['critical', 'high', 'medium', 'low'],
                        help='Filter risks by severity')

    parsed = parser.parse_args(args)

    commands = {
        'test': cmd_test,
        'risk': cmd_risk,
        'sprint': cmd_sprint,
        'channels': cmd_channels,
        'status': cmd_status,
    }

    cmd_func = commands.get(parsed.action, cmd_status)
    cmd_func(parsed)


if __name__ == "__main__":
    run(sys.argv[1:])
