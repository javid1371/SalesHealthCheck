#!/usr/bin/env bash
# Install or refresh host crontab entries for Sales Health Check cron routes.
# Run on the VPS from the project directory (e.g. /opt/sales-health-check).
#
# Usage: ./scripts/install-vps-crons.sh
# Optional: CRON_LOG_DIR=/var/log/sales-health-check

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CRON_LOG_DIR="${CRON_LOG_DIR:-/var/log/sales-health-check}"
MARKER="# sales-health-check-cron"

chmod +x "${PROJECT_ROOT}/scripts/vps-cron-call.sh"

mkdir -p "${CRON_LOG_DIR}"

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "${MARKER}" > "${TMP}" || true

cat >> "${TMP}" <<CRON
*/15 * * * * cd ${PROJECT_ROOT} && ./scripts/vps-cron-call.sh /api/cron/lead-assignment >> ${CRON_LOG_DIR}/lead-assignment.log 2>&1 ${MARKER} lead-assignment
*/5 * * * * cd ${PROJECT_ROOT} && ./scripts/vps-cron-call.sh /api/cron/sms-funnel >> ${CRON_LOG_DIR}/sms-funnel.log 2>&1 ${MARKER} sms-funnel
CRON

crontab "${TMP}"
rm -f "${TMP}"

echo "Installed crontab entries (${MARKER}):"
crontab -l | grep "${MARKER}" || true
echo "Logs: ${CRON_LOG_DIR}/lead-assignment.log, ${CRON_LOG_DIR}/sms-funnel.log"
