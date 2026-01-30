# Workthrough: Javis Viewer Setup (Next.js)
**Date**: 2026-01-27  
**Author**: Gemini Agent  
**Status**: Completed  

## 1. Objective
To build a lightweight, local web interface ("Javis Viewer") for browsing the Jira issues and Confluence pages mirrored in the `javis_brain` PostgreSQL database.

## 2. Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via `pg` library)
- **Language**: TypeScript

## 3. Implementation Steps

### 3.1. Project Scaffolding
Created a new Next.js application at `src/javis-viewer`.
- Used `npm` instead of `pnpm` to avoid WSL2/NTFS file permission issues.
- Configured `.env.local` to connect to the local Dockerized PostgreSQL (`javis_brain`).

### 3.2. Database Connection
Implemented a connection pool helper in `src/lib/db.ts` using the `pg` library to allow Server Components to query the database directly.

### 3.3. Features

#### Dashboard (`/`)
- Displays summary statistics:
  - Total Jira Issues synced.
  - Total Confluence Pages synced.

#### Jira Viewer (`/jira`)
- A tabular view of the most recent 100 Jira issues.
- Columns: Key, Summary, Status, Project, Created Date.

#### Confluence Viewer (`/confluence`)
- **Two-pane layout**:
  - **Sidebar**: List of all 1,700+ pages (titles).
  - **Main View**: Renders the selected page's HTML content (`body_storage`).
- Links to open the original page in Confluence Cloud.

## 4. How to Run
```bash
cd src/javis-viewer
npm run dev
```
Access the application at http://localhost:3000.
