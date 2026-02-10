param (
    [string]$ServerIP = "10.182.252.32",
    [string]$Username = "atlasAdmin",
    [string]$Domain = "jarvis.10.182.252.32.sslip.io",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ProjectRoot = Resolve-Path "$ScriptDir\..\.."
$ViewerDir = Join-Path $ProjectRoot "src\javis-viewer"
$RemotePath = "/data/javis"
$BuildDir = Join-Path $ScriptDir "build"

if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir | Out-Null }

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   Javis Viewer - Deployment" -ForegroundColor Cyan
Write-Host "   Target: ${Username}@${ServerIP}" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# 0. Check SSH
Write-Host "Checking SSH connectivity..." -ForegroundColor Gray
ssh -o BatchMode=yes -o ConnectTimeout=5 "${Username}@${ServerIP}" "exit" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Cannot connect to ${Username}@${ServerIP}." -ForegroundColor Red
    exit 1
}

# 1. Build
if (-not $SkipBuild) {
    Write-Host "`n[1/5] Building Docker Images..." -ForegroundColor Green
    
    # Viewer Build
    Push-Location $ViewerDir
    docker build -t javis-viewer:latest .
    if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }
    
    Write-Host "Saving javis-viewer image..."
    docker save javis-viewer:latest -o "$BuildDir\javis-viewer.tar"
    Pop-Location

    # DB Image (Pull & Save)
    Write-Host "Handling javis-db image (pgvector:pg16)..."
    docker pull pgvector/pgvector:pg16
    docker save pgvector/pgvector:pg16 -o "$BuildDir\javis-db.tar"
}

# 2. Prepare Remote
Write-Host "`n[2/5] Preparing Remote Directory..." -ForegroundColor Green
ssh -t "${Username}@${ServerIP}" "sudo mkdir -p $RemotePath"
ssh -t "${Username}@${ServerIP}" "sudo chown ${Username}:${Username} $RemotePath"

# 3. Upload
Write-Host "`n[3/5] Uploading Files..." -ForegroundColor Green
# Upload Images
if (-not $SkipBuild) {
    scp "$BuildDir\javis-viewer.tar" "${Username}@${ServerIP}:${RemotePath}/javis-viewer.tar"
    scp "$BuildDir\javis-db.tar" "${Username}@${ServerIP}:${RemotePath}/javis-db.tar"
}
# Upload Configs
scp "$ScriptDir\javis-stack.yml" "${Username}@${ServerIP}:${RemotePath}/docker-compose.yml"
scp "$ScriptDir\javis_nginx.conf" "${Username}@${ServerIP}:/tmp/javis_nginx.conf"

# Upload .env if exists in root
if (Test-Path "$ProjectRoot\.env") {
    Write-Host "Uploading .env file..."
    scp "$ProjectRoot\.env" "${Username}@${ServerIP}:${RemotePath}/.env"
} else {
    Write-Host "[WARNING] No .env file found at project root!" -ForegroundColor Yellow
}

# 4. Deploy Containers
Write-Host "`n[4/5] Deploying Containers..." -ForegroundColor Green
$DeployCmd = @"
cd $RemotePath
# Load Viewer Image
if [ -f javis-viewer.tar ]; then
    docker load -i javis-viewer.tar
    rm javis-viewer.tar
fi
# Load DB Image
if [ -f javis-db.tar ]; then
    docker load -i javis-db.tar
    rm javis-db.tar
fi
docker-compose up -d
"@
ssh "${Username}@${ServerIP}" $DeployCmd

# 5. Configure Nginx
Write-Host "`n[5/5] Configuring Nginx..." -ForegroundColor Green
$NginxCmd = @"
sudo mv /tmp/javis_nginx.conf /etc/nginx/sites-available/javis.conf
sudo ln -sf /etc/nginx/sites-available/javis.conf /etc/nginx/sites-enabled/javis.conf
sudo nginx -t && sudo systemctl reload nginx
"@
ssh -t "${Username}@${ServerIP}" $NginxCmd

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "   Deployment Complete!" -ForegroundColor Cyan
Write-Host "   URL: http://$Domain" -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Cyan
