#!/usr/bin/env bash
# Jarvis Viewer — Linux/WSL Deployment Script
# Bash equivalent of deploy_javis.ps1
set -e

SERVER_IP="${1:-10.182.252.32}"
USERNAME="${2:-atlasAdmin}"
DOMAIN="${3:-jarvis.10.182.252.32.sslip.io}"
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
    echo "[1/5] Building Docker Images..."

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

    # Build viewer image
    echo "Building javis-viewer image..."
    pushd "$VIEWER_DIR" > /dev/null
    docker build -t javis-viewer:latest .
    echo "Saving javis-viewer image..."
    docker save javis-viewer:latest -o "$BUILD_DIR/javis-viewer.tar"
    popd > /dev/null

    # Keep the deployment image aligned with javis-stack.yml.
    echo "Handling javis-db image (pgvector:pg17)..."
    docker pull pgvector/pgvector:pg17
    docker save pgvector/pgvector:pg17 -o "$BUILD_DIR/javis-db.tar"

    # Restore DOCKER_CONFIG
    unset DOCKER_CONFIG
fi

# 2. Prepare Remote
echo ""
echo "[2/5] Preparing Remote Directory..."
ssh -t "${USERNAME}@${SERVER_IP}" "sudo mkdir -p $REMOTE_PATH && sudo chown ${USERNAME}:${USERNAME} $REMOTE_PATH"

# 3. Upload
echo ""
echo "[3/5] Uploading Files..."
if [ "$SKIP_BUILD" != "true" ]; then
    scp "$BUILD_DIR/javis-viewer.tar" "${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/javis-viewer.tar"
    scp "$BUILD_DIR/javis-db.tar"     "${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/javis-db.tar"
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

# 4. Deploy Containers
echo ""
echo "[4/5] Deploying Containers..."
ssh "${USERNAME}@${SERVER_IP}" bash << EOF
cd $REMOTE_PATH
if [ -f javis-viewer.tar ]; then
    docker load -i javis-viewer.tar
    rm javis-viewer.tar
fi
if [ -f javis-db.tar ]; then
    docker load -i javis-db.tar
    rm javis-db.tar
fi
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose up -d
docker-compose ps
EOF

# 5. Configure Nginx
echo ""
echo "[5/5] Configuring Nginx..."
ssh -t "${USERNAME}@${SERVER_IP}" bash << 'EOF'
sudo mv /tmp/javis_nginx.conf /etc/nginx/sites-available/javis.conf
sudo ln -sf /etc/nginx/sites-available/javis.conf /etc/nginx/sites-enabled/javis.conf
sudo nginx -t && sudo systemctl reload nginx
echo "  ✓ Nginx configured"
EOF

echo ""
echo "===================================================="
echo "   ✓ Javis Deployment Complete!"
echo "   URL: https://${DOMAIN}"
echo "===================================================="
