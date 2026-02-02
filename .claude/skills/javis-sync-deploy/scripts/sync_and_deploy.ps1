# Unified Sync & Deploy Script for Javis
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\..\..\.."

Write-Host ">>> [1/4] Pulling Jira changes..." -ForegroundColor Green
python "$ProjectRoot\scripts\sync_bidirectional.py" --pull-only

Write-Host "`n>>> [2/4] Pulling Confluence changes..." -ForegroundColor Green
python "$ProjectRoot\scripts\sync_confluence_bidirectional.py" --pull-only

Write-Host "`n>>> [3/4] Creating local DB backup..." -ForegroundColor Green
$BackupFile = "$ProjectRoot\backups\javis_brain_synced_auto.sql"
docker exec javis_db pg_dump -U javis -d javis_brain --no-owner --no-acl -f /tmp/backup.sql
docker cp javis_db:/tmp/backup.sql "$BackupFile"

Write-Host "`n>>> [4/4] Deploying to Remote Server..." -ForegroundColor Green
powershell -ExecutionPolicy Bypass -File "$ProjectRoot\deploy\javis\restore_db.ps1" -BackupFile "$BackupFile"

Write-Host "`n✅ All tasks completed successfully!" -ForegroundColor Cyan
