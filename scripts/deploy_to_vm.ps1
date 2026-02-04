#
# deploy_to_vm.ps1 - Company PC(Windows)에서 OneDrive의 dump를 Azure VM에 배포
#
# Usage:
#   .\scripts\deploy_to_vm.ps1                          # download + deploy
#   .\scripts\deploy_to_vm.ps1 -VMHost 10.0.0.4         # VM IP 지정
#   .\scripts\deploy_to_vm.ps1 -VMUser javis             # VM user 지정
#   .\scripts\deploy_to_vm.ps1 -RestoreOnly              # scp + restore만 (이미 다운로드됨)
#

param(
    [string]$VMHost = "VM_IP_HERE",       # Azure VM IP - 실제 IP로 변경
    [string]$VMUser = "VM_USER_HERE",     # Azure VM user - 실제 user로 변경
    [switch]$RestoreOnly
)

$ErrorActionPreference = "Stop"

# Paths
$OneDriveDir = "$env:USERPROFILE\OneDrive\jarvis.backup"
$DumpFile = "javis_brain.dump"
$DumpPath = Join-Path $OneDriveDir $DumpFile
$MetaPath = Join-Path $OneDriveDir "latest.json"
$RemotePath = "/tmp/javis_brain.dump"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  JAVIS DB Deploy to VM" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# --- Check dump file ---
Write-Host ""
Write-Host "[1/3] Checking dump file..." -ForegroundColor Yellow

if (!(Test-Path $DumpPath)) {
    Write-Host "  ERROR: Dump file not found at: $DumpPath" -ForegroundColor Red
    Write-Host "  Run deploy_upload.sh on Personal PC first." -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $DumpPath
$fileSize = "{0:N1} MB" -f ($fileInfo.Length / 1MB)
$fileTime = $fileInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")

Write-Host "  File: $DumpPath" -ForegroundColor Green
Write-Host "  Size: $fileSize" -ForegroundColor Green
Write-Host "  Modified: $fileTime" -ForegroundColor Green

# Show metadata if available
if (Test-Path $MetaPath) {
    $meta = Get-Content $MetaPath | ConvertFrom-Json
    Write-Host "  Source: $($meta.source), Created: $($meta.timestamp)" -ForegroundColor Green
}

# --- SCP to VM ---
Write-Host ""
Write-Host "[2/3] Uploading to Azure VM ($VMHost)..." -ForegroundColor Yellow

scp $DumpPath "${VMUser}@${VMHost}:${RemotePath}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: SCP failed." -ForegroundColor Red
    exit 1
}
Write-Host "  Upload complete." -ForegroundColor Green

# --- Restore on VM ---
Write-Host ""
Write-Host "[3/3] Restoring DB on VM..." -ForegroundColor Yellow

ssh "${VMUser}@${VMHost}" "pg_restore -h localhost -U javis -d javis_brain --clean --if-exists $RemotePath && rm -f $RemotePath"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: Restore may have had errors (partial restore is normal)." -ForegroundColor Yellow
} else {
    Write-Host "  Restore complete." -ForegroundColor Green
}

# --- Done ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
