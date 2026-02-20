# code-style.md - Coding Standards

## TypeScript / React (Frontend)

### Style & Formatting
- **Line length**: 100 characters (Prettier configured)
- **Formatter**: Prettier with ESLint
- **Target**: TypeScript strict mode, React 19

### Component Patterns
- **Functional components only** (no class components)
- **Custom hooks** for shared logic
- **Memoization**: Use React.memo() for expensive renders
- **File structure**:
  - src/components/ — Reusable UI components
  - src/app/*/page.tsx — Page components
  - src/types/ — TypeScript interfaces
  - src/lib/ — Utilities
  - src/contexts/ — React Context

### Naming Conventions
- **Components**: PascalCase (e.g., RiskPanel, MilestoneCard)
- **Functions/hooks**: camelCase (e.g., useRoadmap, formatDate)
- **Constants**: UPPER_SNAKE_CASE
- **CSS classes**: kebab-case

### Type Annotations
- **Required**: All function signatures must have type hints
- **No `any`**: Use explicit types or `unknown`
- **Props interfaces**: Define above component

```typescript
interface RiskPanelProps {
  riskId: string;
  severity: 'low' | 'medium' | 'high';
  onDismiss: () => void;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({
  riskId,
  severity,
  onDismiss,
}) => {
  // ...
};
```

## Python (Backend CLI)

### Style & Formatting
- **Line length**: 100 characters
- **Formatter**: Black v24+
- **Import order**: isort (Black profile)
- **Target version**: Python 3.10+

### Type Annotations
- **Required**: All function signatures must have type hints
- **Strict mypy**: Type checking enabled

### Naming Conventions
- **Classes**: PascalCase (e.g., BiDirectionalSync, JiraClient)
- **Functions/methods**: snake_case (e.g., sync_issues, fetch_epic)
- **Constants**: UPPER_SNAKE_CASE
- **Private attributes**: Leading underscore

### Async/Await
- Use async def for I/O-bound operations
- Use asyncio for concurrent operations
- Await all coroutines

### Error Handling
- Define custom exceptions in `lib/exceptions.py`
- Use specific exception types
- Log errors with context before re-raising

```python
class SyncConflictError(Exception):
    """Raised when bidirectional sync detects conflicts."""
    pass
```

## Documentation

### Markdown Style
- **Headers**: Consistent hierarchy (# → ## → ###)
- **Code blocks**: Always specify language
- **Links**: Use relative paths
- **Tables**: Use pipe syntax

### Docstrings (Python)
- **Required** for all public functions
- **Format**: Google style

```python
def sync_jira_to_db(issue_key: str, dry_run: bool = False) -> dict:
    """Sync a Jira issue to local database.
    
    Args:
        issue_key: Jira issue key (e.g., 'EUV-1234')
        dry_run: If True, simulate without writing
        
    Returns:
        Dictionary with sync result (status, conflicts, etc.)
    
    Raises:
        JiraClientError: If Jira API call fails
        SyncConflictError: If sync conflicts detected
    """
    # ...
```

