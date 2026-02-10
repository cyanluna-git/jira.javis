param (
    [string]$ServerIP = "10.182.252.32",
    [string]$Username = "atlasAdmin",
    [string]$BackupFile = "D:\00.Dev\javis.gerald\backups\javis_brain_20260202_204652.sql"
)

$ErrorActionPreference = "Stop"

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   Javis DB - Restore Data to Remote (Script Mode)" -ForegroundColor Cyan
Write-Host "   Target: ${Username}@${ServerIP}" -ForegroundColor Cyan
Write-Host "   File: $BackupFile" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

if (-not (Test-Path $BackupFile)) {
    Write-Host "[ERROR] Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

# 1. Upload Backup
Write-Host "[1/3] Uploading backup file..." -ForegroundColor Green
scp "$BackupFile" "${Username}@${ServerIP}:/tmp/restore.sql"
if ($LASTEXITCODE -ne 0) { throw "Upload failed" }

# 2. Create & Upload Script
Write-Host "`n[2/3] Preparing Remote Script..." -ForegroundColor Green
$RemoteScriptContent = @"
#!/bin/bash
set -e

echo "[Remote] Copying file to container..."
docker cp /tmp/restore.sql javis-db:/tmp/restore.sql

echo "[Remote] Terminating connections..."
# Ignore error if no connections to kill
docker exec javis-db psql -U javis -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'javis_brain' AND pid <> pg_backend_pid();" || true

echo "[Remote] Recreating Database..."
docker exec javis-db dropdb -U javis --if-exists javis_brain
docker exec javis-db createdb -U javis javis_brain

echo "[Remote] Restoring Data..."
docker exec javis-db psql -U javis -d javis_brain -f /tmp/restore.sql > /dev/null

echo "[Remote] Cleaning up..."
rm /tmp/restore.sql
echo "[Remote] Success!"
"@

$TempScript = Join-Path $PSScriptRoot "temp_restore.sh"
$RemoteScriptContent | Out-File -FilePath $TempScript -Encoding ASCII # Use ASCII for Linux compatibility
# Fix line endings (CRLF -> LF)
(Get-Content $TempScript) -join "`n" | Set-Content -NoNewline $TempScript

Write-Host "Uploading script..."
scp "$TempScript" "${Username}@${ServerIP}:/tmp/run_restore.sh"
Remove-Item $TempScript

# 3. Execute
Write-Host "`n[3/3] Executing Restore on Server..." -ForegroundColor Green
ssh "${Username}@${ServerIP}" "chmod +x /tmp/run_restore.sh && /tmp/run_restore.sh && rm /tmp/run_restore.sh"

Write-Host "`n[Verify] Checking jira_issues table..." -ForegroundColor Yellow
ssh "${Username}@${ServerIP}" "docker exec javis-db psql -U javis -d javis_brain -c '\dt jira_issues'"

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   Restore Complete!" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan