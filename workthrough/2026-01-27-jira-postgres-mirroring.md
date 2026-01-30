# Workthrough: Jira Data Mirroring to Local PostgreSQL
**Date**: 2026-01-27  
**Author**: Gemini Agent  
**Status**: Completed  

## 1. Objective
To establish a foundational "Knowledge Base" for the Javis AI assistant by mirroring Jira Cloud issues into a local PostgreSQL database. The goal is to preserve the raw JSON structure (`JSONB`) to ensure full context availability without data loss.

## 2. Infrastructure Setup
### PostgreSQL with pgvector
We deployed a PostgreSQL container optimized for future AI/RAG tasks using `pgvector`.
- **Compose File**: `config/javis-db-compose.yml`
- **Image**: `pgvector/pgvector:pg16`
- **Storage**: Docker Named Volume `javis_postgres_data` (to resolve WSL2 permission issues).
- **Project Name**: `gerald-javis`

## 3. Script Development: `mirror_jira.py`
We developed a Python script to fetch data from Jira Cloud API v3 and store it in Postgres.

### Key Challenges & Solutions
1.  **API Deprecation (410 Gone)**:
    - Attempted standard `/rest/api/3/search` but received `410`.
    - **Solution**: Migrated to `/rest/api/3/search/jql` as explicitly requested by the API error message.

2.  **Pagination & Payload Issues (400 Bad Request)**:
    - `search/jql` endpoint is strict about payload structure.
    - `startAt` parameter caused 400 errors on subsequent pages.
    - **Solution**: Implemented **Next Page Token** pagination logic (`nextPageToken`), which is the modern standard for Atlassian v3 APIs.

3.  **Rate Limiting**:
    - Added exponential backoff retry logic for `429 Too Many Requests` responses.

## 4. Execution Results
Successfully mirrored issues from the following projects:
- **EUV**: 2,256 issues
- **PSSM**: 342 issues
- **ASP**: 196 issues

**Total**: ~2,800 issues stored in `javis_brain.jira_issues`.

## 5. Next Steps
- Mirror Confluence data (`archive/confluence`) to PostgreSQL.
- Implement vector embedding for search and retrieval (RAG).
