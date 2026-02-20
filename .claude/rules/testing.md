# testing.md - Testing Conventions

## Frontend Testing (Jest + React Testing Library)

### Test Structure
- `src/__tests__/` — Unit tests (component tests, utilities)
- `src/__tests__/integration/` — Integration tests (API mocking)

### Jest Configuration
- **Test files**: `*.test.ts`, `*.test.tsx`
- **Setup**: jest.config.js + jest.setup.ts
- **Coverage**: Minimum 75% for components

### Test Naming
```typescript
describe('RiskPanel', () => {
  it('should render risk title and severity badge', () => {
    // ...
  });
  
  it('should call onDismiss when close button clicked', () => {
    // ...
  });
});
```

### Mocking API Calls
```typescript
import { rest } from 'msw';
import { server } from './__mocks__/server';

server.use(
  rest.get('/api/roadmap/visions/:id', (req, res, ctx) => {
    return res(ctx.json({ id: '1', title: 'Vision' }));
  })
);
```

## Backend Testing (pytest)

### Test Structure
- `tests/unit/` — Unit tests (no external deps)
- `tests/integration/` — Integration tests (DB, API mocks)

### pytest Configuration
- **Test files**: `test_*.py`, `*_test.py`
- **Coverage**: Minimum 80% for sync scripts
- **Markers**: @pytest.mark.asyncio for async tests

### Test Naming
```python
def test_sync_jira_to_db_with_conflict():
    """Test that conflicts are detected and recorded."""
    # Arrange
    
    # Act
    
    # Assert
```

### Database Testing
```python
@pytest.fixture
async def db_connection():
    """Provide clean test database."""
    pool = await create_pool('postgresql://test:test@localhost/javis_test')
    yield pool
    await pool.close()

@pytest.mark.asyncio
async def test_sync_jira_issue(db_connection):
    # Test with isolated database
    pass
```

### Mocking External APIs
```python
from unittest.mock import AsyncMock, patch

@patch('lib.jira_client.JiraClient.get_issue')
async def test_fetch_jira_issue(mock_get_issue):
    mock_get_issue.return_value = {
        'key': 'EUV-1234',
        'summary': 'Test issue'
    }
    # ...
```

## Coverage Requirements

- **Frontend components**: 75%+ (UI-heavy, focus on logic)
- **API endpoints**: 80%+ (test all status codes)
- **Sync logic**: 90%+ (critical business logic)
- **Utilities**: 100% (if practical)

## Running Tests

### Frontend
```bash
npm run test              # Run all tests
npm run test -- --watch  # Watch mode
npm run test:coverage    # With coverage report
```

### Backend
```bash
pytest                   # Run all tests
pytest tests/unit/       # Only unit tests
pytest -k "sync"         # Tests matching pattern
pytest --cov=scripts     # With coverage
```

