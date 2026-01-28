"""
Configuration management for Javis CLI.
"""

import os
from typing import Dict, Optional


def load_env(env_path: str = None) -> Dict[str, str]:
    """Load environment variables from .env file."""
    config = {}

    if env_path is None:
        # Try current directory first, then project root
        if os.path.exists(".env"):
            env_path = ".env"
        else:
            env_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                ".env"
            )

    try:
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
    except FileNotFoundError:
        pass

    return config


# Load config once at import
_config = load_env()


def get(key: str, default: str = None) -> Optional[str]:
    """Get configuration value."""
    return _config.get(key, os.environ.get(key, default))


# Database config
DB_HOST = get("DB_HOST", "localhost")
DB_PORT = get("DB_PORT", "5432")
DB_NAME = get("DB_NAME", "javis_brain")
DB_USER = get("DB_USER", "javis")
DB_PASS = get("JAVIS_DB_PASSWORD", "javis_password")

# Jira config
JIRA_URL = get("JIRA_URL")
JIRA_EMAIL = get("JIRA_EMAIL")
JIRA_TOKEN = get("JIRA_TOKEN")

# Bitbucket config
BITBUCKET_WORKSPACE = get("BITBUCKET_WORKSPACE")
BITBUCKET_REPOS = [r.strip() for r in get("BITBUCKET_REPOS", "").split(",") if r.strip()]
BITBUCKET_USERNAME = get("BITBUCKET_USERNAME")
BITBUCKET_APP_PASSWORD = get("BITBUCKET_APP_PASSWORD")

# AI config
AI_PROVIDER = get("AI_PROVIDER", "claude")  # claude | openai
ANTHROPIC_API_KEY = get("ANTHROPIC_API_KEY")
OPENAI_API_KEY = get("OPENAI_API_KEY")

# Target projects
TARGET_PROJECTS = [p.strip() for p in get("TARGET_PROJECTS", "ASP,PSSM").split(",") if p.strip()]
