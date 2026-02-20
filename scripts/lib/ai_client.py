"""
AI Client for Javis CLI.

Supports Claude (Anthropic) and OpenAI APIs.
"""

import json
import requests
from typing import Dict, List, Any, Optional
from . import config
from . import db


class AIClient:
    """AI client for generating work suggestions."""

    def __init__(self, provider: str = None):
        self.provider = provider or config.AI_PROVIDER

        if self.provider == 'claude':
            self.api_key = config.ANTHROPIC_API_KEY
            self.model = "claude-sonnet-4-20250514"
            self.api_url = "https://api.anthropic.com/v1/messages"
        elif self.provider == 'openai':
            self.api_key = config.OPENAI_API_KEY
            self.model = "gpt-4o"
            self.api_url = "https://api.openai.com/v1/chat/completions"
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

        if not self.api_key:
            raise ValueError(f"API key not configured for {self.provider}")

    def suggest_work(self, context: Dict[str, Any], focus: str = None, count: int = 3) -> Dict[str, Any]:
        """Generate work suggestions based on context."""
        prompt = self._build_suggestion_prompt(context, focus, count)
        response = self._call_api(prompt)

        # Save to history
        if response.get('suggestions'):
            db.save_suggestion(
                context=context,
                prompt=prompt,
                response=response,
                provider=self.provider,
                model=self.model,
                tokens=response.get('tokens_used')
            )

        return response

    def analyze_issue(self, issue_context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze an issue and provide insights."""
        prompt = self._build_analysis_prompt(issue_context)
        return self._call_api(prompt)

    def _build_suggestion_prompt(self, context: Dict, focus: str, count: int) -> str:
        """Build prompt for work suggestions."""
        focus_instruction = ""
        if focus == 'blocked':
            focus_instruction = "Focus on resolving blocked items first."
        elif focus == 'pr-review':
            focus_instruction = "Focus on PRs that need review."
        elif focus == 'stale':
            focus_instruction = "Focus on stale items that haven't been updated."

        prompt = f"""You are a work planning assistant. Based on the current work context, suggest the next {count} most important tasks to work on.

Current Context:
{json.dumps(context, indent=2, default=str)}

{focus_instruction}

Provide your response as a JSON object with this structure:
{{
  "suggestions": [
    {{
      "title": "Brief action title",
      "description": "What to do and why",
      "priority": "high" | "medium" | "low",
      "rationale": "Why this should be done now",
      "related_items": ["ASP-123", "PR #45"],
      "estimated_effort": "small" | "medium" | "large"
    }}
  ],
  "summary": "One sentence summary of current situation"
}}

Be specific and actionable. Reference actual issue keys and PR numbers from the context when relevant."""

        return prompt

    def _build_analysis_prompt(self, issue_context: Dict) -> str:
        """Build prompt for issue analysis."""
        return f"""Analyze this Jira issue and provide insights:

{json.dumps(issue_context, indent=2, default=str)}

Provide your response as a JSON object with this structure:
{{
  "status_assessment": "Brief assessment of issue status",
  "blockers": ["List of potential blockers"],
  "next_steps": ["Suggested next actions"],
  "related_work": ["Related issues or PRs to check"],
  "risks": ["Potential risks or concerns"]
}}"""

    def _call_api(self, prompt: str) -> Dict[str, Any]:
        """Call the AI API."""
        try:
            if self.provider == 'claude':
                return self._call_claude(prompt)
            elif self.provider == 'openai':
                return self._call_openai(prompt)
        except Exception as e:
            return {"error": str(e)}

    def _call_claude(self, prompt: str) -> Dict[str, Any]:
        """Call Claude API."""
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        payload = {
            "model": self.model,
            "max_tokens": 2000,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }

        response = requests.post(
            self.api_url,
            headers=headers,
            json=payload,
            timeout=60
        )

        if not response.ok:
            return {"error": f"API error: {response.status_code} - {response.text}"}

        data = response.json()
        content = data.get('content', [{}])[0].get('text', '')
        tokens = data.get('usage', {})

        # Parse JSON from response
        try:
            # Find JSON in response
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(content[json_start:json_end])
                result['tokens_used'] = tokens.get('input_tokens', 0) + tokens.get('output_tokens', 0)
                return result
        except json.JSONDecodeError:
            pass

        return {"raw_response": content, "tokens_used": tokens.get('input_tokens', 0) + tokens.get('output_tokens', 0)}

    def _call_openai(self, prompt: str) -> Dict[str, Any]:
        """Call OpenAI API."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a helpful work planning assistant. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 2000
        }

        response = requests.post(
            self.api_url,
            headers=headers,
            json=payload,
            timeout=60
        )

        if not response.ok:
            return {"error": f"API error: {response.status_code} - {response.text}"}

        data = response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        tokens = data.get('usage', {}).get('total_tokens', 0)

        try:
            result = json.loads(content)
            result['tokens_used'] = tokens
            return result
        except json.JSONDecodeError:
            return {"raw_response": content, "tokens_used": tokens}


def get_client(provider: str = None) -> AIClient:
    """Get AI client instance."""
    return AIClient(provider)


def suggest_work(context: Dict = None, focus: str = None, count: int = 3, project: str = None) -> Dict[str, Any]:
    """Convenience function to get work suggestions."""
    from .context_aggregator import ContextAggregator

    if context is None:
        aggregator = ContextAggregator(project)
        context = aggregator.get_full_context()

    client = get_client()
    return client.suggest_work(context, focus, count)


def analyze_issue(issue_key: str) -> Dict[str, Any]:
    """Convenience function to analyze an issue."""
    from .context_aggregator import ContextAggregator

    aggregator = ContextAggregator()
    issue_context = aggregator.get_issue_context(issue_key)

    if 'error' in issue_context:
        return issue_context

    client = get_client()
    return client.analyze_issue(issue_context)
