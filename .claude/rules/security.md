# security.md - Security Guidelines

## Environment Variables

### Sensitive Data (Never commit to Git)
- `DATABASE_URL`, `POSTGRES_PASSWORD`
- `JIRA_TOKEN`, `JIRA_EMAIL`
- `ANTHROPIC_API_KEY`
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

**Use `.env` (gitignored) for local development.**

### .env Template
```bash
# Database
DATABASE_URL=postgresql://javis:password@localhost:5439/javis_brain
POSTGRES_USER=javis
POSTGRES_PASSWORD=secure_password

# Jira
JIRA_URL=https://jira.company.com
JIRA_EMAIL=your@email.com
JIRA_TOKEN=secret_token

# API Keys
ANTHROPIC_API_KEY=sk-...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=signing_secret

# Deployment
NEXT_PUBLIC_READ_ONLY=false
```

## Authentication & Authorization

### API Token Security
- **Generation**: Use strong random tokens (32+ bytes)
- **Storage**: Hash tokens before persisting
- **Expiration**: Set 24h - 90d expiration
- **Revocation**: Revoke immediately on request
- **Rotation**: Rotate every 90 days

### Slack Bot Token
- **Scopes**: Minimal necessary (commands, chat:write)
- **Verification**: Always verify request signature
- **Storage**: Keep in `.env`, never in code

```typescript
// Verify Slack request signature
import crypto from 'crypto';

function verifySlackRequest(req: Request) {
  const signature = req.headers['x-slack-request-timestamp'] + ':' + 
                    req.headers['x-slack-request-body-hash'];
  const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET!);
  hmac.update(signature);
  return crypto.timingSafeEqual(
    Buffer.from(hmac.digest('hex')),
    Buffer.from(req.headers['x-slack-signature'] as string)
  );
}
```

## Input Validation

### TypeScript / API
- **Validate all user input** using Zod or similar
- **Type safety**: Never use `any` type
- **Escape output**: Sanitize before rendering

```typescript
import { z } from 'zod';

const CreateVisionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime().optional(),
});

function validateVisionInput(data: unknown) {
  return CreateVisionSchema.parse(data);
}
```

### Python / Database
- **Parameterized queries**: Always use parameters, never string interpolation
- **SQLAlchemy ORM**: Use ORM, avoid raw SQL
- **Input sanitization**: Validate with Pydantic

```python
# Good
query = "SELECT * FROM issues WHERE key = %s"
cursor.execute(query, (issue_key,))

# Bad
query = f"SELECT * FROM issues WHERE key = '{issue_key}'"  # SQL injection!
```

## Network Security

### HTTPS in Production
- **Always TLS 1.2+** (1.3 preferred)
- **Certificate**: Use CA-signed (Let's Encrypt)
- **Redirect**: HTTP (80) → HTTPS (443)
- **HSTS**: Set Strict-Transport-Security header

### CORS Configuration
```typescript
// Only allow trusted origins
const ALLOWED_ORIGINS = [
  'https://javis.company.com',
  'https://app.company.com',
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
```

## Data Synchronization Security

### Bidirectional Sync
- **Conflict tracking**: Record conflicting modifications
- **Audit trail**: Log all sync operations (user, time, action)
- **Dry-run mode**: Always test before force-pushing
- **User review**: Require approval for force operations

### External API Access
- **Rate limiting**: Implement backoff for API calls
- **Timeout**: Set reasonable timeouts (30s default)
- **Retry logic**: Exponential backoff with jitter
- **Error logging**: Log API errors without credentials

## Secrets Management

### Key Rotation
- **API keys**: Every 90 days
- **Tokens**: Every 24 - 90 days
- **Passwords**: Every 6 months
- **Rollover**: Keep old + new key valid during rotation

### Production Deployment
- **Secrets tool**: Use AWS Secrets Manager, HashiCorp Vault, or equivalent
- **No .env in production**: Load from secret manager
- **Audit access**: Log who accessed what secrets

## Logging & Monitoring

### What to Log
- Important state changes
- Errors with context (user, action, timestamp)
- API requests/responses (non-sensitive)

### What NOT to Log
- **Never**: Tokens, passwords, API keys
- **Never**: User credentials
- **Never**: Sensitive business data

### Log Levels
- **DEBUG**: Development only (verbose internals)
- **INFO**: Important state changes
- **WARNING**: Recoverable issues
- **ERROR**: Errors but app continues
- **CRITICAL**: Severe issues requiring attention

```python
import logging

logger = logging.getLogger(__name__)

# Good
logger.info('Syncing issue %s', issue_key)  # Safe
logger.error('Jira API error: %s', error_msg)  # No token

# Bad
logger.info(f'Using token {jira_token}')  # Exposes secret!
```

