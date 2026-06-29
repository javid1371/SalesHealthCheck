#!/usr/bin/env bash
# Run on the VPS to pull the app image from GHCR and restart the stack.
# Invoked by deploy-to-vps.sh or GitHub Actions deploy job.

set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/opt/sales-health-check}"
APP_PORT="${APP_PORT:-3105}"
APP_IMAGE="${APP_IMAGE:-ghcr.io/javid1371/sales-health-check:latest}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.nginx.yml}"

cd "${REMOTE_DIR}"

if [ ! -f .env ]; then
  echo "ERROR: ${REMOTE_DIR}/.env not found. Run ./scripts/bootstrap-vps.sh first."
  exit 1
fi

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> Logging in to ghcr.io..."
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER:-javid1371}" --password-stdin
fi

export APP_IMAGE

echo "==> Pulling ${APP_IMAGE}..."
docker compose -f "${COMPOSE_FILE}" pull app

echo "==> Starting stack..."
docker compose -f "${COMPOSE_FILE}" up -d --no-build --remove-orphans

echo "==> Waiting for app health on 127.0.0.1:${APP_PORT}..."
for i in $(seq 1 36); do
  if curl -sf "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    echo "App is healthy."
    exit 0
  fi
  if [ "${i}" -eq 36 ]; then
    echo "ERROR: app did not become healthy in time."
    docker compose -f "${COMPOSE_FILE}" logs app --tail 50
    exit 1
  fi
  sleep 5
done
