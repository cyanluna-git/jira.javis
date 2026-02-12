# Javis Backend (Python CLI & Sync)

## Project Overview

Javis Backend provides Python automation for bidirectional data synchronization between Jira, Confluence, and PostgreSQL. It includes CLI tools for AI-powered recommendations, context aggregation, and Slack integration.

## Directory Structure

```
scripts/
├└ sync_bidirectional.py           # Jira <-> DB sync (incremental)
├└ sync_confluence_bidirectional.py # Confluence <-> DB sync
├└ javis_cli.py                     # CLI entry point
├└ lib/
│  ├└ db.py                      # PostgreSQL utilities
│  ├└ config.py                  # Configuration loader
│  ├└ jira_client.py             # Jira API wrapper
│  ├└ ai_client.py               # Anthropic Claude API
│  ├└ slack_client.py            # Slack API wrapper
│  ├└ context_aggregator.py      # Work context builder
│  └└ exceptions.py              # Custom exceptions
├└ cli/
│  ├└ suggest.py                 # AI recommendations
│  ├└ context.py                 # View work context
│  ├└ tag.py                     # Tag management
│  ├└ sync.py                    # Sync commands
│  └└ slack.py                   # Slack integration
└└ tests/
   ├└ unit/
   └└ integration/
```

## Setup & Development

### Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Dependencies
```bash
# Core
psycopg2-binary    # PostgreSQL adapter
requests           # HTTP client
pydantic           # Data validation
aiohttp            # Async HTTP

# AI
anthropian         # Claude API

# CLI
click              # Command-line interface
python-dotenv      # .env loading

# Development
pytest             # Testing
mypy               # Type checking
black              # Code formatting
isort              # Import sorting
```

## CLI Usage

### Entry Point
```bash
python3 scripts/javis_cli.py --help
```

### Commands

#### Suggest (AI recommendations)
```bash
python3 scripts/javis_cli.py suggest
python3 scripts/javis_cli.py suggest --epic EUV-3299
python3 scripts/javis_cli.py suggest --sprint "Sprint 52"
```

#### Context (View work context)
```bash
python3 scripts/javis_cli.py context
python3 scripts/javis_cli.py context --project OQC
python3 scripts/javis_cli.py context --show-risks
```

#### Sync (Bidirectional synchronization)
```bash
python3 scripts/javis_cli.py sync all                # Full sync
python3 scripts/javis_cli.py sync jira              # Jira only
python3 scripts/javis_cli.py sync confluence       # Confluence only
python3 scripts/javis_cli.py sync --dry-run        # Simulate
python3 scripts/javis_cli.py sync --show-conflicts # View conflicts
```

#### Tag (Tag management)
```bash
python3 scripts/javis_cli.py tag list
python3 scripts/javis_cli.py tag add --issue EUV-3299 --tag priority:high
python3 scripts/javis_cli.py tag remove --issue EUV-3299 --tag priority:high
```

#### Slack (Slack integration)
```bash
python3 scripts/javis_cli.py slack test        # Send test message
python3 scripts/javis_cli.py slack risk        # Send risk alerts
python3 scripts/javis_cli.py slack status      # Sync status report
```

## Core Modules

### Database (`lib/db.py`)
```python
import asyncio
from lib.db import get_db_pool, query, transaction

# Query
pool = get_db_pool()
result = await query(pool, 'SELECT * FROM roadmap_visions')

# Transaction
async with transaction(pool) as conn:
    await conn.execute('INSERT INTO ...')
```

### Jira Client (`lib/jira_client.py`)
```python
from lib.jira_client import JiraClient

jira = JiraClient(
    url=os.getenv('JIRA_URL'),
    email=os.getenv('JIRA_EMAIL'),
    token=os.getenv('JIRA_TOKEN'),
)

# Fetch issue
issue = await jira.get_issue('EUV-1234')
changelog = await jira.get_issue_changelog('EUV-1234')
```

### AI Client (`lib/ai_client.py`)
```python
from lib.ai_client import ClaudeClient

ai = ClaudeClient(api_key=os.getenv('ANTHROPIC_API_KEY'))
response = await ai.generate_suggestions(
    context='Current sprint status...',
    max_tokens=1000,
)
```

### Context Aggregator (`lib/context_aggregator.py`)
```python
from lib.context_aggregator import ContextAggregator

agg = ContextAggregator(db_pool=pool, jira_client=jira)
context = await agg.get_work_context(
    project='OQC',
    include_risks=True,
    include_blockers=True,
)
```

### Slack Client (`lib/slack_client.py`)
```python
from lib.slack_client import SlackClient

slack = SlackClient(bot_token=os.getenv('SLACK_BOT_TOKEN'))
await slack.send_message(
    channel='C1234567',
    text='Work update...',
    blocks=[...],
)
```

## Bidirectional Sync

### How It Works
1. **Incremental sync**: Track `last_synced_at` timestamp
2. **Local changes**: DB triggers record `local_modified_at`, `local_modified_fields`
3. **Conflict detection**: Compare timestamps and track in `sync_conflicts` table
4. **Resolution**: User-selected strategy (--force-local, --force-remote)

### Key Tables
```sql
-- Jira sync tracking
jira_issues (
  key text PRIMARY KEY,
  title text,
  status text,
  last_synced_at timestamp,
  local_modified_at timestamp,
  local_modified_fields jsonb,
  sync_status enum
)

-- Conflict tracking
sync_conflicts (
  id uuid PRIMARY KEY,
  resource_type enum,
  resource_id text,
  field_name text,
  local_value text,
  remote_value text,
  resolution enum,
  created_at timestamp
)
```

## Parent Project Rules

Follows all root conventions:

- **Code Style**: @../../.claude/rules/code-style.md
- **API Design**: @../../.claude/rules/api-conventions.md
- **Testing**: @../../.claude/rules/testing.md
- **Git Workflow**: @../../.claude/rules/commit-workflow.md
- **Security**: @../../.claude/rules/security.md

## Testing

### Unit Tests
```bash
pytest tests/unit/
pytest tests/unit/test_jira_client.py -v
```

### Integration Tests
```bash
pytest tests/integration/ -v
pytest -k "test_sync" -v
```

### Coverage
```bash
pytest --cov=scripts --cov-report=html
```

### Test Example
```python
import pytest
from lib.jira_client import JiraClient
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_fetch_jira_issue():
    """Test Jira issue fetching."""
    jira = JiraClient(
        url='http://localhost:8080',
        email='test@example.com',
        token='test_token'
    )
    
    with patch.object(jira, '_request', new_callable=AsyncMock) as mock:
        mock.return_value = {'key': 'TEST-1', 'summary': 'Test issue'}
        result = await jira.get_issue('TEST-1')
        assert result['key'] == 'TEST-1'
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://javis:password@localhost:5439/javis_brain

# Jira
JIRA_URL=https://jira.company.com
JIRA_EMAIL=your@email.com
JIRA_TOKEN=secret_token

# Confluence
CONFLUENCE_URL=https://confluence.company.com
CONFLUENCE_EMAIL=your@email.com
CONFLUENCE_TOKEN=secret_token

# AI
ANTHROPIC_API_KEY=sk-...
ANTHROPIC_MODEL=claude-3-5-sonnet

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=signing_secret
SLACK_DEFAULT_CHANNEL=C1234567

# Logging
LOG_LEVEL=INFO
```

## Code Quality

### Formatting
```bash
black scripts/ tests/
isort scripts/ tests/
```

### Type Checking
```bash
mypy scripts/
mypy scripts/lib/db.py --strict
```

### Linting
```bash
pylint scripts/
flake8 scripts/ --max-line-length=100
```

## Deployment

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY scripts/ ./scripts/
CMD ["python", "scripts/javis_cli.py"]
```

### Cron Scheduling
```bash
# Daily sync at 08:00
0 8 * * * cd /home/javis && python3 scripts/javis_cli.py sync all

# Risk alerts every 6 hours
0 */6 * * * python3 scripts/javis_cli.py slack risk
```

