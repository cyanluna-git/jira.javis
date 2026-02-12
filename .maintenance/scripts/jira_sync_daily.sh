#!/bin/bash

################################################################################
# Jira Daily Sync Script
# Syncs all Jira data, Bitbucket, Sprints, Roadmap, and Members
# Frequency: 03:00 KST daily (to avoid API rate limits)
# Created: 2026-02-12
################################################################################

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/home/cyanluna-jarvis/jira.javis"
SCRIPTS_DIR="${PROJECT_ROOT}/scripts"
LOGS_DIR="/home/cyanluna-jarvis/.maintenance/logs"
LOG_FILE="${LOGS_DIR}/jira_sync_$(date +%Y-%m-%d).log"
ERROR_LOG="${LOGS_DIR}/jira_sync_$(date +%Y-%m-%d)_error.log"
LOCK_FILE="/tmp/jira_sync.lock"
MAX_RETRIES=3
RETRY_DELAY=5  # seconds

# Ensure log directory exists
mkdir -p "${LOGS_DIR}"

# Load environment variables if .env exists
if [ -f "/home/cyanluna-jarvis/.env" ]; then
    export $(cat /home/cyanluna-jarvis/.env | grep -v '#' | xargs)
fi

################################################################################
# Helper Functions
################################################################################

log_message() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_error() {
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [ERROR] ${message}" | tee -a "${LOG_FILE}" "${ERROR_LOG}"
}

acquire_lock() {
    if [ -f "${LOCK_FILE}" ]; then
        local lock_age=$(($(date +%s) - $(stat -c%Y "${LOCK_FILE}" 2>/dev/null || echo 0)))
        if [ $lock_age -lt 3600 ]; then
            log_error "Sync already in progress (lock file exists)"
            exit 1
        else
            log_message "WARN" "Removing stale lock file (age: ${lock_age}s)"
            rm -f "${LOCK_FILE}"
        fi
    fi
    touch "${LOCK_FILE}"
}

release_lock() {
    rm -f "${LOCK_FILE}"
}

sync_with_retry() {
    local retry_count=0
    local success=false

    while [ $retry_count -lt $MAX_RETRIES ]; do
        log_message "INFO" "Attempting Jira sync (attempt $((retry_count + 1))/${MAX_RETRIES})..."
        
        cd "${PROJECT_ROOT}" || {
            log_error "Failed to change to project directory: ${PROJECT_ROOT}"
            return 1
        }

        # Execute sync command
        if python3 "${SCRIPTS_DIR}/javis_cli.py" sync all >> "${LOG_FILE}" 2>&1; then
            success=true
            log_message "SUCCESS" "Jira sync completed successfully"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                log_message "WARN" "Sync failed, retrying in ${RETRY_DELAY} seconds..."
                sleep ${RETRY_DELAY}
            fi
        fi
    done

    if [ "$success" = false ]; then
        log_error "Jira sync failed after ${MAX_RETRIES} attempts"
        return 1
    fi
    return 0
}

################################################################################
# Main
################################################################################

trap release_lock EXIT

log_message "INFO" "========================================"
log_message "INFO" "Starting Jira sync job"
log_message "INFO" "========================================"

# Acquire lock
acquire_lock

# Execute sync with retry logic
if sync_with_retry; then
    sync_time=$(date '+%Y-%m-%d %H:%M:%S')
    log_message "INFO" "Sync completed at ${sync_time}"
    log_message "INFO" "========================================"
    exit 0
else
    log_error "Jira sync job failed"
    log_message "INFO" "========================================"
    exit 1
fi
