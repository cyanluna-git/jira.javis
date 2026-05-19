#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SW Portal Quick Deploy — fast iterative deployment for development
#
# Builds locally, transfers image via SSH, restarts test container.
# DB is NEVER touched.
#
# Target VM (Test):
#   VTISAZUAPP230  |  10.182.255.5  |  atlasAdmin
#
# URL: test-sw-portal.10.182.255.5.sslip.io:3010
#
# Usage:
#   ./scripts/deploy/quick_deploy.sh          # ~1-2 min (default: both)
#
# Automatically handles:
#   ✓ Builds Docker image locally
#   ✓ Streams image via SSH (docker save | gzip | docker load)
#   ✓ Syncs compose file + .env
#   ✓ Restarts container
#   ✓ Runs health checks
#   ✗ Never touches database
#
# Options:
#   --no-push     Skip git push (deploy whatever is locally built)
#   --no-cache    Force rebuild without Docker cache
#
# Environment overrides:
#   DEPLOY_HOST=10.x.x.x  DEPLOY_USER=username  Override target VM
#   ENV_SOURCE=.env       Use different env file (default: .env.test)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
# Default: Test server VTISAZUAPP230
DEPLOY_HOST="${DEPLOY_HOST:-10.182.255.5}"
DEPLOY_USER="${DEPLOY_USER:-atlasAdmin}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:-}"  # Optional: sshpass password
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-~/data/javis-test}"
ENV_SOURCE="${ENV_SOURCE:-.env.test}"
SSH_IDENTITY="${SSH_IDENTITY:-}"
PROJECT_NAME="javis-test"
DC="docker-compose"
CONTAINER_NAME="javis-viewer-test"
IMAGE_NAME="javis-viewer-test:latest"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; CYAN='\033[36m'; RESET='\033[0m'
log()     { echo -e "${GREEN}[$(date '+%H:%M:%S')] $*${RESET}"; }
warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] $*${RESET}"; }
error()   { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $*${RESET}"; }
section() { echo -e "\n${CYAN}── $* ──${RESET}"; }

# ── Args ─────────────────────────────────────────────────────────────────────
NO_PUSH=false
NO_CACHE=""
for arg in "$@"; do
  case "$arg" in
    --no-push)  NO_PUSH=true ;;
    --no-cache) NO_CACHE="--no-cache" ;;
    *) error "Unknown option: $arg"; exit 1 ;;
  esac
done

# ── SSH/SCP helpers ──────────────────────────────────────────────────────────
_ssh() {
  local ssh_base="ssh -o StrictHostKeyChecking=no -o BatchMode=yes"
  if [[ -n "$DEPLOY_PASSWORD" ]]; then
    ssh_base="sshpass -p '$DEPLOY_PASSWORD' ssh -o StrictHostKeyChecking=no"
  elif [[ -n "$SSH_IDENTITY" ]]; then
    ssh_base="ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i $SSH_IDENTITY"
  fi
  $ssh_base "${DEPLOY_USER}@${DEPLOY_HOST}" "bash -s" <<< "$1"
}

_rsync() {
  local ssh_opt="-o StrictHostKeyChecking=no"
  if [[ -n "$DEPLOY_PASSWORD" ]]; then
    ssh_opt="sshpass -p '$DEPLOY_PASSWORD' ssh -o StrictHostKeyChecking=no"
  elif [[ -n "$SSH_IDENTITY" ]]; then
    ssh_opt="ssh -o StrictHostKeyChecking=no -i $SSH_IDENTITY"
  fi
  rsync -az -e "$ssh_opt" "$@"
}

# ── Expand remote path ───────────────────────────────────────────────────────
expand_remote_path() {
  local remote_path="$1"
  if [[ "$remote_path" =~ ^~ ]]; then
    local remote_home
    remote_home=$(_ssh "echo \$HOME")
    remote_path="${remote_path/#\~/$remote_home}"
  fi
  echo "$remote_path"
}

DEPLOY_APP_DIR_EXPANDED=$(expand_remote_path "$DEPLOY_APP_DIR")

# ── drift_check ──────────────────────────────────────────────────────────────
# Hard-abort if server compose file differs from local.
# Fresh deployments (server MISSING) are allowed.
drift_check() {
  section "Drift check (server vs local sha256)"

  local target="javis-stack.test.yml"
  if [[ ! -f "deploy/javis/$target" ]]; then
    warn "Local file missing: deploy/javis/$target — skipping drift check"
    return 0
  fi

  local local_sha
  local_sha=$(sha256sum "deploy/javis/$target" | awk '{print $1}')

  local server_sha
  server_sha=$(_ssh "
    if [[ -f ${DEPLOY_APP_DIR_EXPANDED}/docker-compose.yml ]]; then
      sha256sum ${DEPLOY_APP_DIR_EXPANDED}/docker-compose.yml | awk '{print \$1}'
    else
      echo MISSING
    fi
  " | tr -d '\r')

  if [[ "$server_sha" == "MISSING" ]]; then
    log "Fresh deployment (no server compose yet)"
    return 0
  fi

  if [[ "$local_sha" != "$server_sha" ]]; then
    warn "drift: $target  local=${local_sha:0:12}  server=${server_sha:0:12}"
    echo ""
    warn "Showing diff (server → local):"
    echo ""
    echo "── diff: $target ──"
    local server_content
    server_content=$(_ssh "cat ${DEPLOY_APP_DIR_EXPANDED}/docker-compose.yml 2>/dev/null || echo ''")
    local local_content
    local_content=$(cat "deploy/javis/$target")
    diff -u \
      <(printf '%s' "$server_content") \
      <(printf '%s' "$local_content") \
      --label "server:$target" --label "local:$target" || true
    echo ""
    error "Deploy aborted — server has changes not in git."
    error "Action required: commit the server-side changes to git first, then re-run."
    exit 1
  fi

  log "No drift detected"
}

# ── Start ────────────────────────────────────────────────────────────────────
START_TIME=$(date +%s)
section "Quick Deploy: javis-viewer → ${DEPLOY_HOST} (test)"
log "URL: test-sw-portal.10.182.255.5.sslip.io:3010"
log "Commit: $(git rev-parse --short HEAD)"

# ── Verify env source exists ────────────────────────────────────────────────
if [[ ! -f "$ENV_SOURCE" ]]; then
  error "Environment file not found: $ENV_SOURCE"
  error "Create .env.test or set ENV_SOURCE to an existing file."
  exit 1
fi

# ── Git push (optional) ─────────────────────────────────────────────────────
if [[ "$NO_PUSH" == "false" ]]; then
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    warn "Uncommitted changes detected — skipping git push"
  else
    section "Git push"
    git push origin "$(git rev-parse --abbrev-ref HEAD)" 2>/dev/null && log "Pushed" || warn "Push failed (non-fatal)"
  fi
fi

# ── Sync .env → server ──────────────────────────────────────────────────────
section "Syncing $ENV_SOURCE → server .env"
_ssh "mkdir -p ${DEPLOY_APP_DIR_EXPANDED}"
_rsync \
  "$ENV_SOURCE" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_APP_DIR_EXPANDED}/.env"
log ".env synced"

# ── Drift check ──────────────────────────────────────────────────────────────
drift_check

# ── Sync compose file ────────────────────────────────────────────────────────
section "Syncing compose file"
_rsync \
  "deploy/javis/javis-stack.test.yml" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_APP_DIR_EXPANDED}/docker-compose.yml"
log "docker-compose.yml synced"

# ── Build ────────────────────────────────────────────────────────────────────
section "Building Docker image"
log "Building ${IMAGE_NAME}..."
cd src/javis-viewer
docker build $NO_CACHE -t "$IMAGE_NAME" .
cd ../..
log "Build complete"

# ── Transfer (stream) ────────────────────────────────────────────────────────
section "Transferring image to test server"
log "Streaming: ${IMAGE_NAME} → ${DEPLOY_HOST}"

_ssh_stream() {
  local ssh_base="ssh -o StrictHostKeyChecking=no"
  if [[ -n "$DEPLOY_PASSWORD" ]]; then
    ssh_base="sshpass -p '$DEPLOY_PASSWORD' ssh -o StrictHostKeyChecking=no"
  elif [[ -n "$SSH_IDENTITY" ]]; then
    ssh_base="ssh -o StrictHostKeyChecking=no -i $SSH_IDENTITY"
  fi
  $ssh_base "${DEPLOY_USER}@${DEPLOY_HOST}" "gunzip | docker load"
}

docker save "$IMAGE_NAME" | gzip | _ssh_stream
log "Image loaded on target"

# ── Restart ──────────────────────────────────────────────────────────────────
section "Restarting container"
_ssh "
  cd ${DEPLOY_APP_DIR_EXPANDED}
  ${DC} -f docker-compose.yml -p ${PROJECT_NAME} down --timeout 10 2>/dev/null || true
  ${DC} -f docker-compose.yml -p ${PROJECT_NAME} up -d --force-recreate
"
log "Container restarted"

# ── Health check ─────────────────────────────────────────────────────────────
section "Health check"
sleep 5

STATUS=$(_ssh "docker inspect -f '{{.State.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo missing")
if [[ "$STATUS" == "running" ]]; then
  log "${CONTAINER_NAME}: running"
else
  error "${CONTAINER_NAME}: ${STATUS}"
  _ssh "docker logs --tail 20 ${CONTAINER_NAME} 2>&1 || true"
  exit 1
fi

HTTP=$(_ssh "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/ 2>/dev/null || echo 000")
if [[ "$HTTP" == "200" ]]; then
  log "Health check: HTTP 200"
else
  warn "Health check: HTTP ${HTTP} (may still be starting)"
fi

# ── Env verification ─────────────────────────────────────────────────────────
section "Env verification"
ENV_CHECK=$(_ssh "
  cd ${DEPLOY_APP_DIR_EXPANDED}
  EXPECTED_DB=\$(grep '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2-)
  ACTUAL_DB=\$(docker exec ${CONTAINER_NAME} printenv DATABASE_URL 2>/dev/null || echo '')
  if [[ -n \"\$EXPECTED_DB\" && -z \"\$ACTUAL_DB\" ]]; then
    echo 'MISMATCH: DATABASE_URL (empty in container, set in .env)'
  elif [[ \"\$EXPECTED_DB\" != *\"\$ACTUAL_DB\"* && -n \"\$ACTUAL_DB\" ]]; then
    echo 'MISMATCH: DATABASE_URL differs between .env and container'
  else
    echo 'OK: DATABASE_URL verified'
  fi
")
echo "$ENV_CHECK"

# ── Done ─────────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))

section "Done in ${ELAPSED}s"
echo ""
echo -e "${GREEN}  Access: http://test-sw-portal.10.182.255.5.sslip.io:3010${RESET}"
echo ""
