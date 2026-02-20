"""
Context Aggregator for Javis CLI.

Collects and aggregates context from multiple sources:
- Jira issues (in progress, blocked, etc.)
- Bitbucket (open PRs, recent commits)
- Roadmap (current milestone progress)
- Tags
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from . import db


class ContextAggregator:
    """Aggregates context from multiple sources for AI analysis."""

    def __init__(self, project: str = None):
        self.project = project
        self._cache = {}

    def get_full_context(self) -> Dict[str, Any]:
        """Get complete context snapshot."""
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "project": self.project,
            "work_in_progress": self.get_in_progress(),
            "blocked_items": self.get_blocked(),
            "pending_reviews": self.get_pending_reviews(),
            "recent_activity": self.get_recent_activity(),
            "roadmap_status": self.get_roadmap_status(),
            "attention_needed": self.get_attention_items(),
        }

    def get_summary_context(self) -> Dict[str, Any]:
        """Get lightweight context for quick AI prompts."""
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "project": self.project,
            "in_progress_count": len(self.get_in_progress()),
            "blocked_count": len(self.get_blocked()),
            "open_prs_count": len(self.get_pending_reviews()),
            "attention_items": self.get_attention_items()[:5],
        }

    def get_in_progress(self, limit: int = 20) -> List[Dict]:
        """Get issues currently in progress."""
        if 'in_progress' not in self._cache:
            # Try common "in progress" status names
            issues = []
            for status in ['In Progress', 'In Development', 'Doing', 'Active']:
                issues.extend(db.get_issues_by_status(status, self.project, limit))
                if len(issues) >= limit:
                    break

            self._cache['in_progress'] = issues[:limit]

        return self._cache['in_progress']

    def get_blocked(self, limit: int = 20) -> List[Dict]:
        """Get blocked issues."""
        if 'blocked' not in self._cache:
            self._cache['blocked'] = db.get_blocked_issues(self.project, limit)
        return self._cache['blocked']

    def get_pending_reviews(self, limit: int = 10) -> List[Dict]:
        """Get open PRs waiting for review."""
        if 'pending_reviews' not in self._cache:
            self._cache['pending_reviews'] = db.get_open_prs(limit)
        return self._cache['pending_reviews']

    def get_recent_activity(self, days: int = 3, limit: int = 20) -> Dict[str, Any]:
        """Get recent activity summary."""
        if 'recent_activity' not in self._cache:
            commits = db.get_recent_commits(days, limit)
            prs = db.get_open_prs(limit)

            # Extract unique Jira keys from commits
            jira_keys = set()
            for commit in commits:
                if commit.get('jira_keys'):
                    jira_keys.update(commit['jira_keys'])

            self._cache['recent_activity'] = {
                "recent_commits": len(commits),
                "active_jira_keys": list(jira_keys)[:20],
                "open_prs": len(prs),
            }

        return self._cache['recent_activity']

    def get_roadmap_status(self) -> Optional[Dict[str, Any]]:
        """Get current roadmap milestone status."""
        if 'roadmap' not in self._cache:
            try:
                query = """
                    SELECT m.*, v.title as vision_title
                    FROM roadmap_milestones m
                    LEFT JOIN roadmap_visions v ON v.id = m.vision_id
                    WHERE m.status = 'active'
                    ORDER BY m.target_date ASC
                    LIMIT 1
                """
                milestone = db.fetch_one(query)

                if milestone:
                    # Get epic progress
                    epics_query = """
                        SELECT
                            COUNT(*) as total,
                            COUNT(*) FILTER (WHERE status = 'Done') as done
                        FROM jira_issues
                        WHERE raw_data->'fields'->>'issuetype' LIKE '%Epic%'
                          AND raw_data->'fields'->'fixVersions' @> %s::jsonb
                    """
                    # This is simplified - would need proper milestone-epic linking

                    self._cache['roadmap'] = {
                        "current_milestone": milestone.get('title'),
                        "target_date": str(milestone.get('target_date')) if milestone.get('target_date') else None,
                        "vision": milestone.get('vision_title'),
                    }
                else:
                    self._cache['roadmap'] = None
            except Exception:
                self._cache['roadmap'] = None

        return self._cache['roadmap']

    def get_attention_items(self) -> List[Dict[str, Any]]:
        """Get items that need attention."""
        if 'attention' not in self._cache:
            items = []

            # Blocked issues
            blocked = self.get_blocked(5)
            for issue in blocked:
                items.append({
                    "type": "blocked",
                    "key": issue['key'],
                    "summary": issue['summary'],
                    "reason": "Issue is blocked",
                })

            # Old in-progress issues (stale)
            query = """
                SELECT key, summary, updated_at
                FROM jira_issues
                WHERE status IN ('In Progress', 'In Development', 'Doing')
                  AND updated_at < NOW() - INTERVAL '7 days'
                ORDER BY updated_at ASC
                LIMIT 5
            """
            stale = db.fetch_all(query)
            for issue in stale:
                items.append({
                    "type": "stale",
                    "key": issue['key'],
                    "summary": issue['summary'],
                    "reason": f"No updates for 7+ days",
                })

            # PRs waiting for review
            prs = self.get_pending_reviews(5)
            for pr in prs:
                items.append({
                    "type": "review",
                    "title": pr.get('title', ''),
                    "repo": pr.get('repo_name', ''),
                    "pr_number": pr.get('pr_number'),
                    "reason": "Waiting for review",
                })

            self._cache['attention'] = items

        return self._cache['attention']

    def get_issue_context(self, issue_key: str) -> Dict[str, Any]:
        """Get detailed context for a specific issue."""
        # Get issue details
        query = """
            SELECT key, project, summary, status, raw_data, updated_at
            FROM jira_issues
            WHERE key = %s
        """
        issue = db.fetch_one(query, [issue_key])

        if not issue:
            return {"error": f"Issue {issue_key} not found"}

        # Get related commits and PRs
        commits = db.get_commits_for_issue(issue_key)
        prs = db.get_prs_for_issue(issue_key)
        tags = db.get_issue_tags(issue_key)

        # Extract linked issues
        raw_data = issue.get('raw_data', {})
        fields = raw_data.get('fields', {})
        links = fields.get('issuelinks', [])

        linked_issues = []
        for link in links:
            link_type = link.get('type', {}).get('name', '')
            if 'outwardIssue' in link:
                linked_issues.append({
                    "key": link['outwardIssue']['key'],
                    "relation": link_type,
                    "direction": "outward"
                })
            if 'inwardIssue' in link:
                linked_issues.append({
                    "key": link['inwardIssue']['key'],
                    "relation": link_type,
                    "direction": "inward"
                })

        return {
            "issue": {
                "key": issue['key'],
                "summary": issue['summary'],
                "status": issue['status'],
                "project": issue['project'],
                "updated_at": str(issue['updated_at']),
                "priority": fields.get('priority', {}).get('name'),
                "assignee": fields.get('assignee', {}).get('displayName') if fields.get('assignee') else None,
                "labels": fields.get('labels', []),
            },
            "tags": [t['name'] for t in tags],
            "linked_issues": linked_issues,
            "commits": [
                {
                    "hash": c['hash'][:8],
                    "message": c['message'][:100] if c.get('message') else '',
                    "date": str(c['committed_at']) if c.get('committed_at') else None,
                }
                for c in commits[:10]
            ],
            "pull_requests": [
                {
                    "number": p['pr_number'],
                    "title": p['title'],
                    "state": p['state'],
                    "repo": p.get('repo_name', ''),
                }
                for p in prs
            ],
        }

    def format_for_display(self) -> str:
        """Format context for CLI display."""
        ctx = self.get_full_context()
        lines = []

        lines.append("=" * 60)
        lines.append("CURRENT CONTEXT")
        lines.append("=" * 60)

        # In Progress
        in_progress = ctx.get('work_in_progress', [])
        lines.append(f"\n[In Progress] {len(in_progress)} items")
        for item in in_progress[:5]:
            assignee = item.get('assignee') or 'Unassigned'
            lines.append(f"  {item['key']}: {item['summary'][:50]}... ({assignee})")

        # Blocked
        blocked = ctx.get('blocked_items', [])
        if blocked:
            lines.append(f"\n[Blocked] {len(blocked)} items")
            for item in blocked[:5]:
                lines.append(f"  {item['key']}: {item['summary'][:50]}...")

        # Pending Reviews
        reviews = ctx.get('pending_reviews', [])
        if reviews:
            lines.append(f"\n[Pending Review] {len(reviews)} PRs")
            for pr in reviews[:5]:
                lines.append(f"  #{pr.get('pr_number')}: {pr.get('title', '')[:50]}...")

        # Attention Items
        attention = ctx.get('attention_needed', [])
        if attention:
            lines.append(f"\n[Needs Attention] {len(attention)} items")
            for item in attention[:5]:
                if item['type'] == 'blocked':
                    lines.append(f"  BLOCKED: {item['key']} - {item['summary'][:40]}...")
                elif item['type'] == 'stale':
                    lines.append(f"  STALE: {item['key']} - {item['summary'][:40]}...")
                elif item['type'] == 'review':
                    lines.append(f"  REVIEW: PR #{item.get('pr_number')} in {item.get('repo')}")

        # Roadmap
        roadmap = ctx.get('roadmap_status')
        if roadmap:
            lines.append(f"\n[Roadmap]")
            lines.append(f"  Milestone: {roadmap.get('current_milestone')}")
            if roadmap.get('target_date'):
                lines.append(f"  Target: {roadmap['target_date']}")

        lines.append("\n" + "=" * 60)

        return "\n".join(lines)
