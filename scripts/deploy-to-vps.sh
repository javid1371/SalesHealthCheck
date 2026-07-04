#!/usr/bin/env bash
# Fast deploy: sync compose/scripts, pull prebuilt image from GHCR, restart stack.
# Production rule: GitHub Actions builds the image → GHCR → VPS pulls only changed layers.
# Never docker build on VPS, docker save/load, or scp images. See AGENTS.md.
#
# First-time setup: ./scripts/bootstrap-vps.sh [ssh-host]
#
# Usage: ./scripts/deploy-to-vps.sh [ssh-host] [image-tag]
# Example: ./scripts/deploy-to-vps.sh root@193.163.201.132
# Example: ./scripts/deploy-to-vps.sh root@193.163.201.132 abc1234   # deploy specific SHA

set -euo pipefail

SSH_HOST="${1:-root@193.163.201.132}"
IMAGE_TAG="${2:-latest}"
REMOTE_DIR="/opt/sales-health-check"
APP_IMAGE="${APP_IMAGE:-ghcr.io/javid1371/sales-health-check:${IMAGE_TAG}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/validate-ghcr-image.sh
source "${SCRIPT_DIR}/lib/validate-ghcr-image.sh"
validate_ghcr_app_image "${APP_IMAGE}"

SSH_BASE=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
SCP_BASE=(scp -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [ -n "${SSH_IDENTITY_FILE:-}" ]; then
  SSH_BASE+=(-i "${SSH_IDENTITY_FILE}")
  SCP_BASE+=(-i "${SSH_IDENTITY_FILE}")
fi

echo "==> Deploying ${APP_IMAGE} to ${SSH_HOST}"
echo "==> Syncing deploy files..."
"${SSH_BASE[@]}" "${SSH_HOST}" "mkdir -p ${REMOTE_DIR}/deploy/nginx ${REMOTE_DIR}/scripts/lib"
rsync -avz -e "${SSH_BASE[*]}" \
  "${PROJECT_ROOT}/docker-compose.nginx.yml" \
  "${SSH_HOST}:${REMOTE_DIR}/"
rsync -avz -e "${SSH_BASE[*]}" \
  "${PROJECT_ROOT}/scripts/vps-update.sh" \
  "${PROJECT_ROOT}/scripts/vps-cron-call.sh" \
  "${PROJECT_ROOT}/scripts/install-vps-crons.sh" \
  "${PROJECT_ROOT}/scripts/lib/" \
  "${SSH_HOST}:${REMOTE_DIR}/scripts/lib/"
rsync -avz -e "${SSH_BASE[*]}" \
  "${PROJECT_ROOT}/deploy/nginx/" \
  "${SSH_HOST}:${REMOTE_DIR}/deploy/nginx/"

echo "==> Pulling image and restarting stack..."
"${SSH_BASE[@]}" "${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
chmod +x "${REMOTE_DIR}/scripts/vps-update.sh"
REMOTE_DIR="${REMOTE_DIR}" APP_IMAGE="${APP_IMAGE}" GHCR_TOKEN="${GHCR_TOKEN:-}" GHCR_USER="${GHCR_USER:-javid1371}" \
  bash "${REMOTE_DIR}/scripts/vps-update.sh"
REMOTE

echo "==> Deploy complete (${APP_IMAGE})"
