#!/bin/bash
# Javis hourly sync & deploy
# Pulls Jira/Confluence/Bitbucket to local DB, then deploys to remote server
#
# Cron: 0 * * * * /mnt/d/00.Dev/javis.gerald/scripts/javis_sync_and_deploy.sh

PROJECT_ROOT="/mnt/d/00.Dev/javis.gerald"
LOG_DIR="$PROJECT_ROOT/logs/sync"
TIMESTAMP=$(date '+%Y-%m-%d_%H%M')
LOG_FILE="$LOG_DIR/sync_${TIMESTAMP}.log"
REMOTE_USER="atlasAdmin"
REMOTE_HOST="10.182.252.32"

mkdir -p "$LOG_DIR"

exec > "$LOG_FILE" 2>&1

echo "=== Javis Sync & Deploy: $(date) ==="

cd "$PROJECT_ROOT"

# 1. Jira pull
echo ""
echo "[1/4] Jira pull..."
python3 scripts/sync_bidirectional.py --pull-only
JIRA_RC=$?
echo "Jira: exit $JIRA_RC"

# 2. Confluence pull
echo ""
echo "[2/4] Confluence pull..."
python3 scripts/sync_confluence_bidirectional.py --pull-only
CONF_RC=$?
echo "Confluence: exit $CONF_RC"

# 3. Bitbucket sync
echo ""
echo "[3/4] Bitbucket sync..."
python3 scripts/sync_bitbucket.py
BB_RC=$?
echo "Bitbucket: exit $BB_RC"

# 4. Deploy to remote
echo ""
echo "[4/4] Deploying to remote server..."
DUMP_FILE="/tmp/javis_brain_deploy.sql"

docker exec javis_db pg_dump -U javis -d javis_brain --no-owner --no-acl -f /tmp/backup.sql
docker cp javis_db:/tmp/backup.sql "$DUMP_FILE"
docker exec javis_db rm /tmp/backup.sql

scp "$DUMP_FILE" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/restore.sql"
SCP_RC=$?

if [ $SCP_RC -eq 0 ]; then
    ssh "${REMOTE_USER}@${REMOTE_HOST}" 'bash -s' << 'REMOTE_EOF'
set -e
docker cp /tmp/restore.sql javis-db:/tmp/restore.sql
docker exec javis-db psql -U javis -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='javis_brain' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true
docker exec javis-db dropdb -U javis --if-exists javis_brain
docker exec javis-db createdb -U javis javis_brain
docker exec javis-db psql -U javis -d javis_brain -f /tmp/restore.sql > /dev/null 2>&1
docker exec javis-db rm /tmp/restore.sql
rm /tmp/restore.sql
echo "Remote restore OK"
REMOTE_EOF
    DEPLOY_RC=$?
else
    DEPLOY_RC=1
    echo "SCP failed, skipping remote restore"
fi

rm -f "$DUMP_FILE"

echo ""
echo "=== Completed: $(date) ==="
echo "Jira=$JIRA_RC Confluence=$CONF_RC Bitbucket=$BB_RC Deploy=$DEPLOY_RC"

# Keep only last 48 log files
ls -t "$LOG_DIR"/sync_*.log 2>/dev/null | tail -n +49 | xargs -r rm
