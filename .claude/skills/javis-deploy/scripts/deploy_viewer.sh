#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-deploy}"
SERVER_IP="${SERVER_IP:-10.182.252.32}"
USERNAME="${USERNAME:-atlasAdmin}"
CANONICAL_HOST="${CANONICAL_HOST:-sw-portal.atlascopco.group}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
VIEWER_DIR="$PROJECT_ROOT/src/javis-viewer"
REMOTE_PATH="/data/javis"
TMP_TAR="$(mktemp /tmp/javis-viewer.XXXXXX.tar)"

cleanup() {
  rm -f "$TMP_TAR"
}
trap cleanup EXIT

check_ssh() {
  echo "Checking SSH connectivity..."
  ssh -o BatchMode=yes -o ConnectTimeout=5 "${USERNAME}@${SERVER_IP}" "exit"
}

verify_host() {
  local host="$1"
  local headers
  headers="$(ssh "${USERNAME}@${SERVER_IP}" \
    "curl -k -sS -I --max-time 20 -H 'Host: ${host}' https://127.0.0.1/bundles")"

  echo "Verify ${host}"
  echo "$headers" | sed -n '1p;/^location:/Ip'

  if echo "$headers" | grep -qi '^location: .*eob'; then
    echo "[ERROR] ${host} redirects to EOB" >&2
    return 1
  fi

  if ! echo "$headers" | grep -q '^HTTP/.* 200 '; then
    echo "[ERROR] ${host} did not return HTTP 200" >&2
    return 1
  fi
}

deploy() {
  echo "[1/4] Building javis-viewer image..."
  docker build --progress=plain -t javis-viewer:latest "$VIEWER_DIR"

  echo "[2/4] Saving image tarball..."
  docker save javis-viewer:latest -o "$TMP_TAR"

  echo "[3/4] Uploading image to remote..."
  scp "$TMP_TAR" "${USERNAME}@${SERVER_IP}:${REMOTE_PATH}/javis-viewer.tar"

  echo "[4/4] Reloading remote javis-viewer container..."
  ssh "${USERNAME}@${SERVER_IP}" "
    cd ${REMOTE_PATH} &&
    docker load -i javis-viewer.tar &&
    rm -f javis-viewer.tar &&
    docker-compose up -d javis-viewer &&
    docker-compose ps javis-viewer
  "
}

main() {
  echo "===================================================="
  echo "   Javis Viewer Routine Deploy"
  echo "   Canonical host: ${CANONICAL_HOST}"
  echo "   Target: ${USERNAME}@${SERVER_IP}"
  echo "===================================================="

  check_ssh

  case "$MODE" in
    deploy)
      deploy
      verify_host "$CANONICAL_HOST"
      ;;
    verify)
      verify_host "$CANONICAL_HOST"
      ;;
    *)
      echo "Usage: $0 [deploy|verify]" >&2
      exit 1
      ;;
  esac

  echo "Done."
}

main "$@"
