# api-conventions.md - API Design Rules

## REST API Standards

### URL Structure

**Resources:**
```
GET    /api/roadmap/visions           — List all visions
GET    /api/roadmap/visions/{id}      — Get single vision
POST   /api/roadmap/visions           — Create vision
PUT    /api/roadmap/visions/{id}      — Update vision
DELETE /api/roadmap/visions/{id}      — Delete vision

/api/roadmap/milestones/*             — Milestones CRUD
/api/roadmap/epics/*                  — Epics (sync from Jira)
/api/members/*                        — Team members + stats
/api/search                           — Full-text search
/api/slack/commands                   — Slack slash commands
```

### Response Format

**Success (200/201):**
```json
{
  "success": true,
  "data": {
    "id": "vision-uuid",
    "title": "Q2 Product Launch",
    "createdAt": "2025-02-12T10:00:00Z"
  }
}
```

**Error (4xx/5xx):**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_DETECTED",
    "message": "Local and remote changes conflict on field 'status'",
    "details": {
      "field": "status",
      "local": "InProgress",
      "remote": "OnHold"
    }
  }
}
```

### HTTP Status Codes
- **200 OK** — Successful GET, PUT, DELETE
- **201 Created** — Successful POST
- **400 Bad Request** — Invalid input (validation failed)
- **401 Unauthorized** — Missing/invalid auth
- **403 Forbidden** — Read-only mode or insufficient permissions
- **404 Not Found** — Resource not found
- **409 Conflict** — Sync conflict or state mismatch
- **500 Internal Server Error** — Unexpected error

## Read-Only Mode

When `NEXT_PUBLIC_READ_ONLY=true`:
- **POST/PUT/PATCH/DELETE**: Return 403 (Forbidden)
- **GET/OPTIONS/HEAD**: Allowed normally
- **Exception**: Slack API endpoints excluded

## Versioning

- **Current**: v1 (implicit, no prefix required)
- **Future**: /api/v2/* (for backwards compatibility)
- **Deprecation**: Add X-Deprecated header 30 days before removal

## Pagination (for list endpoints)

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Error Codes (Javis-specific)

| Code | HTTP | Meaning |
|------|------|----------|
| SYNC_CONFLICT | 409 | Bidirectional sync detected conflicts |
| JIRA_API_ERROR | 502 | Jira API call failed |
| DB_ERROR | 500 | Database operation failed |
| INVALID_ROADMAP | 400 | Roadmap hierarchy violation |
| EXTERNAL_LOCK | 409 | Resource locked by external sync |

