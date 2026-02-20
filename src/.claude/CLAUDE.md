# Javis Frontend (Next.js 16 + React 19)

## Project Overview

Javis Frontend is a real-time project management dashboard connecting Jira, Confluence, and internal workflows. Built with Next.js 16 (App Router), React 19, and TypeScript, it provides vision planning, milestone tracking, sprint management, and risk detection.

## Directory Structure (`src/javis-viewer/`)

```
src/
├└ app/                     # Next.js App Router
│  ├└ api/                  # API routes
│  ├└ roadmap/              # Vision/Milestone pages
│  ├└ sprints/              # Sprint dashboard
│  ├└ members/              # Team dashboard
│  ├└ search/               # Search page
│  └└ layout.tsx            # Root layout
├└ components/              # Reusable React components
│  ├└ RiskPanel.tsx
│  ├└ MilestoneCard.tsx
│  ├└ Chart*.tsx
│  └└ Slack/
├└ types/                   # TypeScript interfaces
│  ├└ roadmap.ts
│  ├└ sprint.ts
│  └└ member.ts
├└ lib/                     # Utilities
│  ├└ db.ts                 # PostgreSQL pool
│  ├└ api-client.ts         # Axios HTTP client
│  └└ readonly.ts           # Read-only mode check
├└ contexts/                # React Context
│  ├└ ReadOnlyContext.tsx
│  └└ RiskContext.tsx
├└ hooks/                   # Custom React hooks
│  ├└ useRoadmap.ts
│  ├└ useSearch.ts
│  └└ useSlack.ts
└└ __tests__/               # Jest tests
   ├└ unit/
   └└ integration/
```

## Setup & Development

### Installation
```bash
cd src/javis-viewer
npm install
```

### Development Server
```bash
npm run dev      # Vite dev server on port 3009
```

### Build & Type Check
```bash
npm run build
npm run type-check
npm run lint
```

### Testing
```bash
npm run test           # Run Jest
npm run test -- --watch
npm run test:coverage
```

## Key Components

### Pages (App Router)
- **`/`** — Dashboard overview
- **`/roadmap/[visionId]`** — Vision details with milestones
- **`/sprints`** — Sprint tracking and velocity
- **`/members`** — Team stats and workload
- **`/search`** — Full-text search
- **`/confluence`** — Confluence pages

### API Routes
- **`/api/roadmap/*`** — Vision, Milestone, Stream CRUD
- **`/api/search`** — Full-text search
- **`/api/slack/*`** — Slack commands and interactivity
- **`/api/issues`** — Jira issue proxy

## Database Access

### PostgreSQL Connection
```typescript
// lib/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(sql: string, params: any[]) {
  return pool.query(sql, params);
}
```

### Usage in API Routes
```typescript
import { query } from '@/lib/db';

export async function GET(req: Request) {
  const result = await query(
    'SELECT * FROM roadmap_visions WHERE id = $1',
    [visionId]
  );
  return Response.json(result.rows[0]);
}
```

## Read-Only Mode

### Configuration
```bash
# .env.local
NEXT_PUBLIC_READ_ONLY=true   # Production: disable modifications
NEXT_PUBLIC_READ_ONLY=false  # Local dev: allow modifications
```

### Implementation
```typescript
// contexts/ReadOnlyContext.tsx
const ReadOnlyContext = createContext<boolean>(false);

export const useReadOnly = () => useContext(ReadOnlyContext);

// In components
const isReadOnly = useReadOnly();
if (isReadOnly) {
  return <div>View only mode</div>;
}
```

### API Protection
```typescript
// lib/readonly.ts
export function checkReadOnly(req: Request) {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    return Response.json({ error: 'Read-only mode' }, { status: 403 });
  }
}

// In API route
export async function POST(req: Request) {
  const readOnlyCheck = checkReadOnly(req);
  if (readOnlyCheck) return readOnlyCheck;
  // ...
}
```

## Parent Project Rules

Follows all root conventions:

- **Code Style**: @../../.claude/rules/code-style.md
- **API Design**: @../../.claude/rules/api-conventions.md
- **Testing**: @../../.claude/rules/testing.md
- **Git Workflow**: @../../.claude/rules/commit-workflow.md
- **Security**: @../../.claude/rules/security.md

## Dependencies

- **next**: 16.x (App Router)
- **react**: 19.x
- **typescript**: 5.x
- **tailwindcss**: 4.x
- **recharts**: Charts library
- **pg**: PostgreSQL client
- **axios**: HTTP client
- **zod**: Input validation

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5439/javis_brain

# API
NEXT_PUBLIC_API_BASE_URL=http://localhost:3009

# Jira
JIRA_URL=https://jira.company.com
JIRA_EMAIL=your@email.com
JIRA_TOKEN=secret_token

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=signing_secret
SLACK_DEFAULT_CHANNEL=C1234567

# Mode
NEXT_PUBLIC_READ_ONLY=false
```

## Testing

### Unit Tests (Jest + React Testing Library)
```typescript
import { render, screen } from '@testing-library/react';
import { RiskPanel } from '@/components/RiskPanel';

describe('RiskPanel', () => {
  it('renders risk title', () => {
    render(<RiskPanel risk={{ id: '1', title: 'Test' }} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Integration Tests
```typescript
import { GET } from '@/app/api/roadmap/visions/route';

describe('GET /api/roadmap/visions', () => {
  it('returns visions list', async () => {
    const response = await GET(new Request('http://localhost:3009/api/roadmap/visions'));
    expect(response.status).toBe(200);
  });
});
```

## Useful Commands

```bash
# Format and lint
npm run format
npm run lint -- --fix

# Type checking
npm run type-check

# Build for production
npm run build

# Run production build locally
npm run build && npm run start
```

