---
name: javis-sync-deploy
description: Pulls latest data from Jira/Confluence to the local database and then deploys that data to the remote Javis server (10.182.252.32). Use when the user wants to update the remote server's database with current data.
---

# Javis Sync & Deploy

This skill automates the full data pipeline from cloud sources (Jira/Confluence) to the remote production/staging server.

## Workflow

When triggered, this skill will:
1.  Run `sync_bidirectional.py --pull-only` to fetch Jira updates.
2.  Run `sync_confluence_bidirectional.py --pull-only` to fetch Confluence updates.
3.  Dump the local `javis_db` to a temporary SQL file.
4.  Upload and restore that SQL file to the remote server using `restore_db.ps1`.

## Usage

You can trigger this skill by asking:
- "Sync everything to server"
- "Push latest Jira/Confluence data to remote"
- "Update the javis database on the server"

## Bundled Resources

- `scripts/sync_and_deploy.ps1`: The main automation script that coordinates the entire process.

## Important Note
This skill assumes the server (`10.182.252.32`) is reachable via SSH and the local database container (`javis_db`) is running.