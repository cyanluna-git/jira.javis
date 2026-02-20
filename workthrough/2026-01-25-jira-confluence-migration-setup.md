# Jira & Confluence Migration to GitLab Self-Managed

## Overview
Successfully established a foundational DevOps environment by setting up GitLab Self-Managed on an on-premise server. Implemented a comprehensive migration strategy to move issues from Jira Cloud and documentation from Confluence Cloud to GitLab, including a 2-step backup/restore process for reliability.

## Context
- **Objective:** Migrate from a fragmented toolchain (Jira, Confluence, Bitbucket) to a unified GitLab platform.
- **Constraints:** On-premise environment with limited resources, strict rate limits on Atlassian APIs.
- **Goal:** Enable "Jarvis" (AI) to manage projects using integrated data.

## Changes Made

### 1. GitLab Infrastructure Setup
- Deployed GitLab CE using Docker Compose with resource optimization (`Puma workers=0`).
- Configured initial user accounts (76 users) and groups (`Integrated System`, `Abatement`).
- Standardized group-level labels (`Workflow::`, `Component::`, `Priority::`) and Issue Boards.

### 2. Jira Migration (Extract & Load)
- Developed `fetch_jira_to_sqlite.py`: Fetches issues and attachments from Jira Cloud (API v3/v2 mixed) to local SQLite (`jira_backup.db`) to bypass rate limits and ensure data safety.
- Developed `push_sqlite_to_gitlab.py`: Restores data from SQLite to GitLab with:
    - User mapping (Jira accountId -> GitLab user_id).
    - Status/Label mapping.
    - **ADF (Atlassian Document Format) to Markdown conversion** for rich text descriptions.
    - Attachment uploading and linking.

### 3. Confluence Migration (Wiki)
- Developed `fetch_wiki_to_local.py`: Recursively fetches pages from Confluence (`ISP` space), converts HTML to Markdown using `pandoc`, and downloads images.
- Implemented `migrate_confluence_wiki.py`: Pushes the exported Markdown tree to GitLab Wiki via Git protocol.

### 4. Documentation & Governance
- Created comprehensive documentation:
    - `AI_DevOps_MasterPlan.md`: Strategic roadmap.
    - `atlas_copco_sso_integration_guide.md`: Azure AD SSO setup guide.
    - `customer_portal_architecture.md`: Blueprint for external customer portal.

## Code Examples

### ADF to Markdown Parser (`push_sqlite_to_gitlab.py`)
```python
def adf_to_md(node):
    if not node: return ""
    node_type = node.get('type')
    
    if node_type == 'paragraph':
        return "".join([adf_to_md(c) for c in node.get('content', [])]) + "\n\n"
    elif node_type == 'heading':
        level = node.get('attrs', {}).get('level', 1)
        return f"{('#' * level)} {child_text}\n\n"
    # ... handles lists, code blocks, links, etc.
```

### Jira Fetcher with Pagination (`fetch_jira_to_sqlite.py`)
```python
query = {
    "jql": f"project = {project_key} ORDER BY created ASC",
    "maxResults": 50,
    "fields": ["*all"]
}
if next_token:
    query["nextPageToken"] = next_token
    
res = jira_request("POST", "/search/jql", query)
```

## Verification Results

### Migration Status
- **Jira Issues:** 2,794 issues fetched and restored to GitLab (`pcas-software`, `abatement-core`, `software-helpdesk`).
- **Wiki Pages:** 1,700+ pages extraction in progress (resumed with full tree traversal).
- **Users:** 76 users created and mapped.

### Infrastructure
- GitLab URL: `http://10.82.37.79`
- Monitoring: `./monitor.sh` script created for real-time backup tracking.

## Next Steps
1.  **Monitor Wiki Backup:** Ensure all 1,700+ pages are exported (`./monitor.sh`).
2.  **Wiki Restore:** Push the completed `confluence_export` folder to GitLab Wiki.
3.  **Bitbucket Migration:** Execute repository mirroring/import for source code.
4.  **Azure Migration:** Move the entire setup to a high-spec Azure VM and enable SSO.
