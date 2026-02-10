# Jarvis Viewer Deployment (2026-02-02)

## Overview
Successfully deployed `javis-viewer` and `javis-db` to the remote server `10.182.252.32` as an independent stack (`jarvis`).

## Architecture
- **Stack:** Docker Compose (`deploy/javis/javis-stack.yml`)
- **Frontend:** `javis-viewer` (Next.js Standalone, Node 20-alpine)
  - Port: 3009 (Host) -> 3009 (Container, via `PORT=3009` env)
- **Database:** `javis-db` (`pgvector/pgvector:pg16`)
  - Port: 5439 (Host) -> 5432 (Container)
- **Proxy:** Nginx (Host-based)
  - Domain: `jarvis.10.182.252.32.sslip.io`
  - Config: `deploy/javis/javis_nginx.conf` -> `/etc/nginx/sites-enabled/javis.conf`

## Deployment Process
1. **Dockerization:**
   - Created `src/javis-viewer/Dockerfile` (Multi-stage, standalone output).
   - Configured `next.config.ts` for `output: "standalone"`.
   - Used `pnpm` with `--shamefully-hoist` to resolve module issues in Alpine.

2. **Automation Script (`deploy/javis/deploy_javis.ps1`):**
   - Builds `javis-viewer` image locally.
   - Saves `javis-viewer` and pulls/saves `pgvector/pgvector:pg16` images.
   - Uploads images, `javis-stack.yml`, `javis_nginx.conf`, and `.env` to server.
   - Loads Docker images on server.
   - Deploys stack via `docker-compose up -d`.
   - Configures and reloads Nginx.

3. **Data Restoration (`deploy/javis/restore_db.ps1`):**
   - Uploads local backup (`.sql`) to server.
   - Uploads a helper Bash script to handle Docker commands safely.
   - Executes restore process: Terminate connections -> Drop DB -> Create DB -> Restore SQL.

## File Structure (`deploy/javis/`)
- `deploy_javis.ps1`: Main deployment script.
- `restore_db.ps1`: Database restore script.
- `javis-stack.yml`: Docker Compose definition.
- `javis_nginx.conf`: Nginx server block.
- `build/`: Temporary folder for build artifacts (images).

## Usage
- **Deploy:** `.\deploy\javis\deploy_javis.ps1`
- **Restore DB:** `.\deploy\javis\restore_db.ps1`
