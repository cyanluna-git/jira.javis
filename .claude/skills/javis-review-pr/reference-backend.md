# Backend Review Rubric Guide & Output Format

## Review Perspectives (10)

Analyze the diff from each perspective and classify findings with the tags below.

### 1. API Design `[API]`

- RESTful principles (HTTP methods, status codes, URL patterns)
- API versioning strategy consistency
- Request/response schema design (consistent field names, unnecessary data exposure)
- Breaking changes (field removal, type changes, new required fields)
- Pagination, filtering, sorting patterns
- API documentation (OpenAPI/Swagger) update status

### 2. Security `[Security]`

- **Injection**: SQL/NoSQL injection, command injection
- **Auth**: Token validation, missing permission checks, session management
- **Input validation**: User input sanitization, type/range validation
- **Sensitive data**: API keys, passwords, tokens exposed in code/logs
- **CORS**: Overly permissive CORS configuration
- **Dependencies**: Packages with known vulnerabilities

### 3. Database `[DB]`

- **Query performance**: N+1 problems, unnecessary joins, missing index usage
- **Migrations**: Backward compatibility of schema changes, rollback capability
- **Transactions**: Transaction scope for data consistency
- **Connection management**: Pool sizing, connection leaks
- **ORM usage**: Appropriate lazy/eager loading, raw query necessity
- **Indexes**: Index existence for columns used in WHERE/JOIN/ORDER BY

### 4. Error Handling `[Error]`

- **Error responses**: Consistent error format, appropriate HTTP status codes
- **Exception handling**: Catch-all overuse, swallowed exceptions, specific exception types
- **Recovery strategy**: Retry logic, fallback, circuit breaker
- **Error propagation**: Internal errors exposed to client (stack traces, etc.)
- **Validation errors**: Clear error messages, per-field error info

### 5. Performance `[Perf]`

- **Algorithms**: O(n^2) or worse complexity, unnecessary iterations
- **Caching**: Missed cache opportunities, cache invalidation strategy
- **Async processing**: Blocking I/O, parallelizable operations
- **Payload size**: Unnecessary data transfer, compression
- **Batch processing**: Memory/time efficiency for large data processing
- **Resource management**: File handles, connections, memory leaks

### 6. Concurrency `[Concurrency]`

- **Race conditions**: Concurrent access to shared resources
- **Deadlocks**: Inconsistent lock acquisition order
- **Atomic operations**: Multiple DB modifications without transactions
- **Idempotency**: Safe handling of duplicate requests
- **Queues/workers**: Message processing order, failure reprocessing

### 7. Logic `[Logic]`

- Business logic errors
- Unhandled edge cases (empty arrays, null, 0, negatives, boundary values)
- Conditional logic errors (AND/OR confusion)
- State transition errors
- Time/timezone handling

### 8. Configuration `[Config]`

- Hardcoded values (magic numbers, URLs, ports)
- Environment-specific config separation (dev/staging/prod)
- Environment variable validation (clear errors for missing required values)
- Secret management (prevent plaintext storage)
- Appropriateness of default values

### 9. Observability `[Observability]`

- **Logging**: Appropriate log levels, structured logs, sensitive data masking
- **Metrics**: Key business/technical metric collection
- **Tracing**: Distributed tracing support
- **Health checks**: Readiness/liveness probes
- **Debug logs**: console.log/print left in production code

### 10. Testing `[Testing]`

- Insufficient test coverage (especially error paths, edge cases)
- Unit/integration/E2E test appropriateness
- Test isolation (external dependency mocking)
- Test data management (fixtures, factories)
- CI integration status

---

## Classification Criteria

### "Must-fix before merge" (Must-fix)

Meets one of the following:
- Security vulnerabilities (injection, auth bypass, sensitive data exposure)
- Data loss/integrity issues
- High likelihood of causing production outages
- Breaking API changes (without backward compatibility)

### "Suggested improvements" (Nice-to-have)

Meets one of the following:
- Performance improvement opportunities
- Code quality/readability improvements
- Test coverage enhancements
- Observability improvements
- Refactoring suggestions

## Verdict Criteria

| Verdict | Condition |
|---------|-----------|
| **APPROVED** | No "must-fix" items |
| **APPROVED with suggestions** | No "must-fix" items, but "suggested improvements" exist |
| **CHANGES REQUESTED** | 1 or more "must-fix" items |

---

## Output Format

```markdown
## PR #{id} Backend Code Review: {title}

**Repo**: {workspace}/{repo}
**Branch**: {source} → {target}
**Author**: {author}
**Date**: {date}
**Domain**: Backend

---

### Change Summary

{2-3 sentence summary of what this PR does}

---

### Must-fix Before Merge

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Security] | `src/api/users.py:45` | Description |
| 2 | [DB] | `migrations/002_add_index.sql:12` | Description |

{Detailed explanation and fix suggestion for each item}

---

### Suggested Improvements

| # | Type | File | Description |
|---|------|------|-------------|
| 1 | [Perf] | `src/services/report.py:88` | Description |
| 2 | [Testing] | Overall | Description |

{Detailed explanation and fix suggestion for each item}

---

### Well Done

- {Commendable implementation decisions or code quality}
- {Appropriate error handling or security considerations}

---

### Final Verdict

**APPROVED / APPROVED with suggestions / CHANGES REQUESTED**

{1-2 sentence rationale}
```

---

## Review Writing Principles

1. **Security first**: Injection, auth bypass, and sensitive data exposure are top-priority checks.
2. **Data integrity**: Focus on DB transactions, concurrency, and migration safety.
3. **Be specific**: Always include file names and line numbers.
4. **Provide evidence**: Explain why it's a problem and under what conditions it occurs.
5. **Suggest alternatives**: Don't just point out problems — suggest how to fix them.
6. **Stay balanced**: Mention what was done well, not just issues.
