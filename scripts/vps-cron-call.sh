#!/usr/bin/env bash
# Call a protected cron API route on the running app.
# Usage: ./scripts/vps-cron-call.sh /api/cron/lead-assignment
# Reads APP_BASE_URL and SMS_FUNNEL_CRON_SECRET from .env in the project root.

set -euo pipefail

ENDPOINT="${1:-}"
if [ -z "${ENDPOINT}" ]; then
  echo "Usage: $0 /api/cron/<name>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

BASE_URL="${APP_BASE_URL:-}"
SECRET="${SMS_FUNNEL_CRON_SECRET:-}"

if [ -z "${BASE_URL}" ]; then
  echo "ERROR: APP_BASE_URL is not set in ${ENV_FILE}" >&2
  exit 1
fi

if [ -z "${SECRET}" ]; then
  echo "ERROR: SMS_FUNNEL_CRON_SECRET is not set in ${ENV_FILE}" >&2
  exit 1
fi

URL="${BASE_URL%/}${ENDPOINT}"
curl -sf -X POST -H "Authorization: Bearer ${SECRET}" "${URL}"
