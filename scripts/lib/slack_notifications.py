"""
Slack notification builders using Block Kit.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any

from . import config, db
from .slack_client import send_message, SlackError


# Severity to emoji mapping
SEVERITY_EMOJI = {
    "critical": ":rotating_light:",
    "high": ":warning:",
    "medium": ":large_orange_diamond:",
    "low": ":white_circle:",
}

# Risk type to emoji mapping
RISK_TYPE_EMOJI = {
    "delay": ":calendar:",
    "blocker": ":no_entry:",
    "velocity_drop": ":chart_with_downwards_trend:",
    "dependency_block": ":link:",
    "resource_conflict": ":busts_in_silhouette:",
}


def build_risk_alert(risk: dict) -> tuple[str, List[dict]]:
    """
    Build Block Kit message for a risk alert.

    Args:
        risk: Risk object with type, severity, title, description, etc.

    Returns:
        (text, blocks) tuple for Slack message
    """
    severity = risk.get("severity", "medium")
    risk_type = risk.get("risk_type", "unknown")

    emoji = SEVERITY_EMOJI.get(severity, ":question:")
    type_emoji = RISK_TYPE_EMOJI.get(risk_type, ":warning:")

    text = f"{emoji} [{severity.upper()}] {risk.get('title', 'Risk Alert')}"

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} Risk Alert: {risk.get('title', 'Unknown')}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Severity:*\n{emoji} {severity.upper()}",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Type:*\n{type_emoji} {risk_type.replace('_', ' ').title()}",
                },
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Description:*\n{risk.get('description', 'No description')}",
            },
        },
    ]

    # Add AI suggestion if available
    if risk.get("ai_suggestion"):
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":bulb: *Suggestion:*\n{risk['ai_suggestion']}",
            },
        })

    # Add context info
    context_parts = []
    if risk.get("milestone_title"):
        context_parts.append(f"Milestone: {risk['milestone_title']}")
    if risk.get("epic_key"):
        context_parts.append(f"Epic: {risk['epic_key']}")
    if risk.get("confidence_score"):
        context_parts.append(f"Confidence: {int(risk['confidence_score'] * 100)}%")

    if context_parts:
        blocks.append({
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": " | ".join(context_parts)},
            ],
        })

    # Add action buttons
    blocks.append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "View Details", "emoji": True},
                "value": f"risk_{risk.get('id', '')}",
                "action_id": "view_risk_details",
            },
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "Acknowledge", "emoji": True},
                "style": "primary",
                "value": f"risk_{risk.get('id', '')}",
                "action_id": "acknowledge_risk",
            },
        ],
    })

    return text, blocks


def build_sprint_summary(sprint: dict, issues: List[dict]) -> tuple[str, List[dict]]:
    """
    Build Block Kit message for sprint status summary.

    Args:
        sprint: Sprint object with name, state, dates
        issues: List of issues in the sprint

    Returns:
        (text, blocks) tuple for Slack message
    """
    total = len(issues)
    done = sum(1 for i in issues if i.get("status") in ("Done", "Closed", "Resolved", "Complete", "Completed"))
    in_progress = sum(1 for i in issues if i.get("status") in ("In Progress", "In Review", "Testing"))
    todo = total - done - in_progress

    progress_pct = int((done / total) * 100) if total > 0 else 0
    progress_bar = _build_progress_bar(progress_pct)

    text = f":runner: Sprint Update: {sprint.get('name', 'Sprint')} - {progress_pct}% complete"

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f":runner: Sprint Status: {sprint.get('name', 'Sprint')}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{progress_bar} *{progress_pct}%*",
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f":white_check_mark: *Done:* {done}"},
                {"type": "mrkdwn", "text": f":hourglass_flowing_sand: *In Progress:* {in_progress}"},
                {"type": "mrkdwn", "text": f":clipboard: *To Do:* {todo}"},
                {"type": "mrkdwn", "text": f":bar_chart: *Total:* {total}"},
            ],
        },
    ]

    # Add date info
    if sprint.get("start_date") or sprint.get("end_date"):
        date_text = []
        if sprint.get("start_date"):
            date_text.append(f"Start: {sprint['start_date'][:10]}")
        if sprint.get("end_date"):
            date_text.append(f"End: {sprint['end_date'][:10]}")

        blocks.append({
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": " | ".join(date_text)},
            ],
        })

    # Add action buttons
    blocks.append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "View Sprint", "emoji": True},
                "value": f"sprint_{sprint.get('id', '')}",
                "action_id": "view_sprint",
            },
        ],
    })

    return text, blocks


def build_milestone_update(milestone: dict) -> tuple[str, List[dict]]:
    """
    Build Block Kit message for milestone update.

    Args:
        milestone: Milestone object

    Returns:
        (text, blocks) tuple for Slack message
    """
    progress = milestone.get("progress_percent", 0)
    status = milestone.get("status", "unknown")
    progress_bar = _build_progress_bar(progress)

    # Status emoji
    status_emoji = {
        "not_started": ":white_circle:",
        "in_progress": ":large_blue_circle:",
        "at_risk": ":warning:",
        "blocked": ":no_entry:",
        "completed": ":white_check_mark:",
    }.get(status, ":question:")

    text = f":milestone: Milestone Update: {milestone.get('title', 'Milestone')} - {progress}%"

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f":dart: Milestone: {milestone.get('title', 'Milestone')}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Status:*\n{status_emoji} {status.replace('_', ' ').title()}"},
                {"type": "mrkdwn", "text": f"*Progress:*\n{progress}%"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{progress_bar}",
            },
        },
    ]

    # Add target dates
    context_parts = []
    if milestone.get("target_start"):
        context_parts.append(f"Start: {milestone['target_start'][:10]}")
    if milestone.get("target_end"):
        context_parts.append(f"Target: {milestone['target_end'][:10]}")
    if milestone.get("quarter"):
        context_parts.append(f"Quarter: {milestone['quarter']}")

    if context_parts:
        blocks.append({
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": " | ".join(context_parts)},
            ],
        })

    return text, blocks


def build_simple_message(title: str, message: str, emoji: str = ":robot_face:") -> tuple[str, List[dict]]:
    """
    Build a simple Block Kit message.

    Args:
        title: Message header
        message: Message body
        emoji: Header emoji

    Returns:
        (text, blocks) tuple
    """
    text = f"{emoji} {title}: {message[:50]}..."

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} {title}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": message,
            },
        },
    ]

    return text, blocks


def _build_progress_bar(percent: int, width: int = 10) -> str:
    """Build a text-based progress bar."""
    filled = int(width * percent / 100)
    empty = width - filled
    return f"[{'█' * filled}{'░' * empty}]"


# High-level send functions

def send_risk_alert(
    risk: dict,
    channel: str = None,
) -> Optional[dict]:
    """
    Send a risk alert notification.

    Args:
        risk: Risk object
        channel: Target channel (defaults to SLACK_DEFAULT_CHANNEL)

    Returns:
        Slack API response or None on failure
    """
    channel = channel or config.SLACK_DEFAULT_CHANNEL

    try:
        text, blocks = build_risk_alert(risk)
        result = send_message(channel=channel, text=text, blocks=blocks)

        # Log to database
        _log_notification(
            channel_id=channel,
            message_ts=result.get("ts"),
            notification_type="risk_alert",
            payload={"risk_id": risk.get("id"), "severity": risk.get("severity")},
            status="sent",
        )

        return result

    except SlackError as e:
        print(f"Failed to send risk alert: {e}")
        _log_notification(
            channel_id=channel,
            notification_type="risk_alert",
            payload={"risk_id": risk.get("id")},
            status="failed",
            error_message=str(e),
        )
        return None


def send_sprint_summary(
    sprint: dict,
    issues: List[dict],
    channel: str = None,
) -> Optional[dict]:
    """
    Send a sprint summary notification.

    Args:
        sprint: Sprint object
        issues: List of issues in the sprint
        channel: Target channel

    Returns:
        Slack API response or None on failure
    """
    channel = channel or config.SLACK_DEFAULT_CHANNEL

    try:
        text, blocks = build_sprint_summary(sprint, issues)
        result = send_message(channel=channel, text=text, blocks=blocks)

        _log_notification(
            channel_id=channel,
            message_ts=result.get("ts"),
            notification_type="sprint_update",
            payload={"sprint_id": sprint.get("id"), "issue_count": len(issues)},
            status="sent",
        )

        return result

    except SlackError as e:
        print(f"Failed to send sprint summary: {e}")
        _log_notification(
            channel_id=channel,
            notification_type="sprint_update",
            payload={"sprint_id": sprint.get("id")},
            status="failed",
            error_message=str(e),
        )
        return None


def send_milestone_update(
    milestone: dict,
    channel: str = None,
) -> Optional[dict]:
    """
    Send a milestone update notification.

    Args:
        milestone: Milestone object
        channel: Target channel

    Returns:
        Slack API response or None on failure
    """
    channel = channel or config.SLACK_DEFAULT_CHANNEL

    try:
        text, blocks = build_milestone_update(milestone)
        result = send_message(channel=channel, text=text, blocks=blocks)

        _log_notification(
            channel_id=channel,
            message_ts=result.get("ts"),
            notification_type="milestone_update",
            payload={"milestone_id": milestone.get("id")},
            status="sent",
        )

        return result

    except SlackError as e:
        print(f"Failed to send milestone update: {e}")
        return None


def send_test_message(channel: str = None) -> Optional[dict]:
    """
    Send a test message to verify Slack integration.

    Args:
        channel: Target channel

    Returns:
        Slack API response or None on failure
    """
    channel = channel or config.SLACK_DEFAULT_CHANNEL

    text, blocks = build_simple_message(
        "Jarvis Test",
        f"Slack integration is working!\nTimestamp: {datetime.now().isoformat()}",
        ":white_check_mark:",
    )

    try:
        result = send_message(channel=channel, text=text, blocks=blocks)

        _log_notification(
            channel_id=channel,
            message_ts=result.get("ts"),
            notification_type="test",
            payload={},
            status="sent",
        )

        return result

    except SlackError as e:
        print(f"Failed to send test message: {e}")
        return None


def _log_notification(
    channel_id: str,
    notification_type: str,
    payload: dict,
    status: str,
    message_ts: str = None,
    error_message: str = None,
):
    """Log notification to database."""
    try:
        import json
        db.execute(
            """
            INSERT INTO slack_notifications
            (channel_id, message_ts, notification_type, payload, status, error_message, sent_at)
            VALUES (%s, %s, %s, %s, %s, %s, CASE WHEN %s = 'sent' THEN NOW() ELSE NULL END)
            """,
            (
                channel_id,
                message_ts,
                notification_type,
                json.dumps(payload),
                status,
                error_message,
                status,
            ),
        )
    except Exception as e:
        # Don't fail if logging fails
        print(f"Warning: Failed to log notification: {e}")
