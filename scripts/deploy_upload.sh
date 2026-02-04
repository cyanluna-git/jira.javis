#!/bin/bash
#
# deploy_upload.sh - Personal PC에서 DB sync + dump + OneDrive 업로드
#
# Usage:
#   ./scripts/deploy_upload.sh              # sync + dump + upload
#   ./scripts/deploy_upload.sh --dump-only  # dump + upload만 (sync 생략)
#   ./scripts/deploy_upload.sh --sync-only  # sync만 (dump 생략)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ONEDRIVE_DIR="/Users/cyanluna-pro16/Library/CloudStorage/OneDrive-개인/jarvis.backup"
DUMP_FILE="javis_brain.dump"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# DB connection
DB_HOST="localhost"
DB_PORT="5439"
DB_USER="javis"
DB_NAME="javis_brain"
export PGPASSWORD="javis_password"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  JAVIS DB Deploy Upload${NC}"
echo -e "${BLUE}============================================================${NC}"

# Parse args
SKIP_SYNC=false
SKIP_DUMP=false

for arg in "$@"; do
    case $arg in
        --dump-only) SKIP_SYNC=true ;;
        --sync-only) SKIP_DUMP=true ;;
    esac
done

# --- Step 1: Sync from Jira ---
if [ "$SKIP_SYNC" = false ]; then
    echo ""
    echo -e "${YELLOW}[1/3] Syncing from Jira API...${NC}"
    cd "$PROJECT_DIR"

    echo "  Syncing issues..."
    python3 scripts/sync_bidirectional.py --pull-only 2>&1 | tail -3

    echo "  Syncing boards..."
    python3 scripts/sync_boards.py 2>&1 | tail -3

    echo "  Syncing sprints..."
    python3 scripts/sync_sprints.py 2>&1 | tail -3

    echo -e "${GREEN}  Sync complete.${NC}"
else
    echo ""
    echo -e "${YELLOW}[1/3] Sync skipped (--dump-only)${NC}"
fi

# --- Step 2: pg_dump ---
if [ "$SKIP_DUMP" = false ]; then
    echo ""
    echo -e "${YELLOW}[2/3] Creating DB dump...${NC}"

    # Dump to temp first
    TEMP_DUMP="/tmp/${DUMP_FILE}"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
        -Fc --no-owner --no-privileges \
        -f "$TEMP_DUMP"

    DUMP_SIZE=$(du -h "$TEMP_DUMP" | cut -f1)
    echo -e "${GREEN}  Dump created: ${DUMP_SIZE}${NC}"

    # --- Step 3: Copy to OneDrive ---
    echo ""
    echo -e "${YELLOW}[3/3] Uploading to OneDrive...${NC}"

    # Ensure directory exists
    mkdir -p "$ONEDRIVE_DIR"

    # Copy latest (overwrite)
    cp "$TEMP_DUMP" "$ONEDRIVE_DIR/$DUMP_FILE"

    # Keep timestamped backup (최근 5개만 유지)
    cp "$TEMP_DUMP" "$ONEDRIVE_DIR/javis_brain_${TIMESTAMP}.dump"

    # Clean old backups (keep latest 5)
    ls -t "$ONEDRIVE_DIR"/javis_brain_2*.dump 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

    # Write metadata
    cat > "$ONEDRIVE_DIR/latest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "file": "$DUMP_FILE",
  "size": "$DUMP_SIZE",
  "source": "personal-pc",
  "db": "$DB_NAME"
}
EOF

    echo -e "${GREEN}  Uploaded to: $ONEDRIVE_DIR/$DUMP_FILE${NC}"
    echo ""

    # Cleanup temp
    rm -f "$TEMP_DUMP"
else
    echo ""
    echo -e "${YELLOW}[2/3] Dump skipped (--sync-only)${NC}"
    echo -e "${YELLOW}[3/3] Upload skipped (--sync-only)${NC}"
fi

# --- Summary ---
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}  Done!${NC}"
if [ "$SKIP_DUMP" = false ]; then
    echo ""
    echo "  OneDrive will auto-sync to Company PC."
    echo "  Then run on Company PC:"
    echo "    .\\deploy_to_vm.ps1"
fi
echo -e "${BLUE}============================================================${NC}"
echo ""
