"""
Slack API client with retry logic.
"""

import time
import json
from typing import Dict, List, Optional, Any
import requests

from . import config

SLACK_API_BASE = "https://slack.com/api"


class SlackError(Exception):
    """Slack API error."""
    def __init__(self, message: str, error_code: str = None, response: dict = None):
        super().__init__(message)
        self.error_code = error_code
        self.response = response


class SlackClient:
    """Slack API client with retry logic."""

    def __init__(self, token: str = None):
        self.token = token or config.SLACK_BOT_TOKEN
        if not self.token:
            raise SlackError("SLACK_BOT_TOKEN not configured")

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json; charset=utf-8",
        }

    def _request(
        self,
        method: str,
        endpoint: str,
        data: dict = None,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ) -> dict:
        """Make API request with retry logic for rate limits."""
        url = f"{SLACK_API_BASE}/{endpoint}"

        for attempt in range(max_retries):
            try:
                if method.upper() == "GET":
                    response = requests.get(url, headers=self._headers(), params=data)
                else:
                    response = requests.post(url, headers=self._headers(), json=data)

                # Handle rate limiting (429)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", retry_delay * 2))
                    if attempt < max_retries - 1:
                        print(f"Rate limited, waiting {retry_after}s...")
                        time.sleep(retry_after)
                        continue
                    raise SlackError(f"Rate limited after {max_retries} retries", "rate_limited")

                response.raise_for_status()
                result = response.json()

                if not result.get("ok"):
                    error = result.get("error", "unknown_error")
                    raise SlackError(f"Slack API error: {error}", error, result)

                return result

            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (attempt + 1))
                    continue
                raise SlackError(f"Request failed: {e}")

        raise SlackError("Max retries exceeded")

    def send_message(
        self,
        channel: str,
        text: str = None,
        blocks: List[dict] = None,
        thread_ts: str = None,
        unfurl_links: bool = False,
        unfurl_media: bool = True,
    ) -> dict:
        """
        Send a message to a Slack channel.

        Args:
            channel: Channel ID or name (e.g., "#jarvis-alerts" or "C1234567890")
            text: Plain text message (required for accessibility)
            blocks: Block Kit blocks for rich formatting
            thread_ts: Thread timestamp to reply in thread
            unfurl_links: Whether to unfurl URLs
            unfurl_media: Whether to unfurl media

        Returns:
            API response with ts (timestamp) and channel
        """
        data = {
            "channel": channel,
            "unfurl_links": unfurl_links,
            "unfurl_media": unfurl_media,
        }

        if text:
            data["text"] = text
        if blocks:
            data["blocks"] = blocks
        if thread_ts:
            data["thread_ts"] = thread_ts

        return self._request("POST", "chat.postMessage", data)

    def update_message(
        self,
        channel: str,
        ts: str,
        text: str = None,
        blocks: List[dict] = None,
    ) -> dict:
        """
        Update an existing message.

        Args:
            channel: Channel ID
            ts: Message timestamp
            text: New text
            blocks: New Block Kit blocks

        Returns:
            API response
        """
        data = {
            "channel": channel,
            "ts": ts,
        }

        if text:
            data["text"] = text
        if blocks:
            data["blocks"] = blocks

        return self._request("POST", "chat.update", data)

    def delete_message(self, channel: str, ts: str) -> dict:
        """
        Delete a message.

        Args:
            channel: Channel ID
            ts: Message timestamp

        Returns:
            API response
        """
        return self._request("POST", "chat.delete", {
            "channel": channel,
            "ts": ts,
        })

    def add_reaction(self, channel: str, ts: str, name: str) -> dict:
        """
        Add a reaction to a message.

        Args:
            channel: Channel ID
            ts: Message timestamp
            name: Reaction emoji name (without colons)

        Returns:
            API response
        """
        return self._request("POST", "reactions.add", {
            "channel": channel,
            "timestamp": ts,
            "name": name,
        })

    def get_channel_info(self, channel: str) -> dict:
        """Get channel information."""
        return self._request("GET", "conversations.info", {"channel": channel})

    def list_channels(self, types: str = "public_channel,private_channel") -> List[dict]:
        """
        List channels the bot has access to.

        Args:
            types: Channel types to include

        Returns:
            List of channel objects
        """
        result = self._request("GET", "conversations.list", {
            "types": types,
            "exclude_archived": True,
        })
        return result.get("channels", [])

    def post_ephemeral(
        self,
        channel: str,
        user: str,
        text: str = None,
        blocks: List[dict] = None,
    ) -> dict:
        """
        Send an ephemeral message visible only to one user.

        Args:
            channel: Channel ID
            user: User ID to show message to
            text: Message text
            blocks: Block Kit blocks

        Returns:
            API response
        """
        data = {
            "channel": channel,
            "user": user,
        }

        if text:
            data["text"] = text
        if blocks:
            data["blocks"] = blocks

        return self._request("POST", "chat.postEphemeral", data)

    def respond_to_response_url(
        self,
        response_url: str,
        text: str = None,
        blocks: List[dict] = None,
        replace_original: bool = False,
        delete_original: bool = False,
        response_type: str = "ephemeral",
    ) -> bool:
        """
        Respond to a slash command or interaction using the response_url.

        Args:
            response_url: The response URL from Slack
            text: Message text
            blocks: Block Kit blocks
            replace_original: Replace the original message
            delete_original: Delete the original message
            response_type: "ephemeral" or "in_channel"

        Returns:
            True if successful
        """
        data = {
            "response_type": response_type,
            "replace_original": replace_original,
            "delete_original": delete_original,
        }

        if text:
            data["text"] = text
        if blocks:
            data["blocks"] = blocks

        response = requests.post(response_url, json=data)
        return response.status_code == 200


# Singleton instance for convenience
_client = None


def get_client() -> SlackClient:
    """Get or create the default Slack client."""
    global _client
    if _client is None:
        _client = SlackClient()
    return _client


def send_message(
    channel: str = None,
    text: str = None,
    blocks: List[dict] = None,
    **kwargs
) -> dict:
    """Convenience function to send a message."""
    channel = channel or config.SLACK_DEFAULT_CHANNEL
    return get_client().send_message(channel, text=text, blocks=blocks, **kwargs)


def update_message(channel: str, ts: str, **kwargs) -> dict:
    """Convenience function to update a message."""
    return get_client().update_message(channel, ts, **kwargs)
