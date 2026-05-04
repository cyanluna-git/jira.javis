#!/usr/bin/env bash
# Jarvis Viewer — Linux/WSL Deployment Script
# Bash equivalent of deploy_javis.ps1
#
# DB note: Postgres has been migrated to Azure (cloud). The local docker
# javis-db service was removed; this script now deploys only javis-viewer.
set -e

SERVER_IP="${1:-10.182.252.32}"
USERNAME="${2:-atlasAdmin}"
DOMAIN="${3:-sw-portal.atlascopco.group}"
SKIP_BUILD="${SKIP_BUILD:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VIEWER_DIR="$PROJECT_ROOT/src/javis-viewer"
REMOTE_PATH="/data/javis"
BUILD_DIR="$SCRIPT_DIR/build"

mkdir -p "$BUILD_DIR"

echo ""
echo "===================================================="
echo "   Javis Viewer - Deployment (bash)"
echo "   Target: ${USERNAME}@${SERVER_IP}"
echo "===================================================="
echo ""

# 0. Check SSH
echo "Checking SSH connectivity..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "${USERNAME}@${SERVER_IP}" "exit" 2>/dev/null; then
    echo "[ERROR] Cannot connect to ${USERNAME}@${SERVER_IP}."
    exit 1
fi
echo "  ✓ SSH OK"

# 1. Build
if [ "$SKIP_BUILD" != "true" ]; then
    echo ""
    echo "[1/4] Building javis-viewer image..."

    # Sanitize Docker config for WSL (remove credsStore)
    DOCKER_CONFIG_PATH="$HOME/.docker/config.json"
    if [ -f "$DOCKER_CONFIG_PATH" ] && grep -q "credsStore" "$DOCKER_CONFIG_PATH" 2>/dev/null; then
        TEMP_DOCKER_DIR=$(mktemp -d)
        python3 -c "
import json, sys
with open('$DOCKER_CONFIG_PATH') as f:
    cfg = json.load(f)
cfg.pop('credsStore', None)
with open('$TEMP_DOCKER_DIR/config.json', 'w') as f:
    json.dump(cfg, f)
"
        export DOCKER_CONFIG="$TEMP_DOCKER_DIR"
        echo "  [INFO] Using sanitized Docker config (removed credsStore)"
    fi

    pushd "$VIEWER_DIR" > /dev/null
    docker build -t javis-viewer:latest .
    echo "Saving javis-viewer image (gzip)..."
    docker save javis-viewer:latest | gzip > "$BUILD_DIR/javis-viewer.tar.gz"
    popd > /dev/null

    unset DOCKER_CONFIG
fi

# 2. Prepare Remote
echo ""
echo "[2/4] Preparing Remote Directory..."
ssh -t "${USERNAME}@${SERVER_IP}" "sudo mkdir -p $REMOTE_PATH && sudo chown ${USERNAME}:${USERNAME} $REMOTE_PATH"

# 3. Upload
echo ""
echo "[3/4] Uploading Files..."
if [ "$SKIP_BUILD" != "true" ]; then
    scp "$BUILD_DIR/javis-viewer.tar.gz" "${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/javis-viewer.tar.gz"
fi
scp "$SCRIPT_DIR/javis-stack.yml"  "${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/docker-compose.yml"
scp "$SCRIPT_DIR/javis_nginx.conf" "${USERNAME}@${SERVER_IP}:/tmp/javis_nginx.conf"

# Upload .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Uploading .env file..."
    scp "$PROJECT_ROOT/.env" "${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/.env"
else
    echo "[WARNING] No .env file found at project root!"
fi

# 4. Deploy javis-viewer (surgical: only this service is recreated)
echo ""
echo "[4/4] Deploying javis-viewer (no-deps, force-recreate)..."
ssh "${USERNAME}@${SERVER_IP}" bash << EOF
set -e
cd $REMOTE_PATH

# Clean up legacy javis-db artifacts (DB now lives in Azure cloud)
rm -f javis-db.tar javis-db.tar.gz

if [ -f javis-viewer.tar.gz ]; then
    gunzip -f javis-viewer.tar.gz
fi
if [ -f javis-viewer.tar ]; then
    docker load -i javis-viewer.tar
    rm -f javis-viewer.tar
fi

# Stop and remove the old javis-db container if it still exists from a prior deploy
docker rm -f javis-db 2>/dev/null || true

docker-compose up -d --no-deps --force-recreate javis-viewer
docker-compose ps
EOF

# 5. Configure Nginx
echo ""
echo "[Bonus] Configuring Nginx..."
ssh -t "${USERNAME}@${SERVER_IP}" bash << 'EOF'
sudo mv /tmp/javis_nginx.conf /etc/nginx/sites-available/javis.conf
sudo ln -sf /etc/nginx/sites-available/javis.conf /etc/nginx/sites-enabled/javis.conf
sudo nginx -t && sudo systemctl reload nginx
echo "  ✓ Nginx configured"
EOF

# Health check
echo ""
echo "Checking javis-viewer health..."
sleep 3
ssh "${USERNAME}@${SERVER_IP}" "curl -sS -o /dev/null -w 'local 3009: HTTP %{http_code}\n' http://127.0.0.1:3009/" || echo "  [WARN] Health check failed"

echo ""
echo "===================================================="
echo "   ✓ Javis Deployment Complete!"
echo "   URL: https://${DOMAIN}"
echo "===================================================="
