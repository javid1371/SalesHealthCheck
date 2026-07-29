#!/usr/bin/env bash
# Run on the VPS to pull the app image from GHCR and restart the stack.
# Invoked by deploy-to-vps.sh or GitHub Actions deploy job.
# Production rule: pull from GHCR only — never build or load images on the VPS.

set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/opt/sales-health-check}"
APP_PORT="${APP_PORT:-3105}"
# Optional second instance (docker-compose.scale.yml); leave unset for single-app.
APP_PORT_B="${APP_PORT_B:-}"
APP_IMAGE="${APP_IMAGE:-ghcr.io/javid1371/sales-health-check:latest}"
# Space-separated compose files. Single-app default; two-instance example:
#   COMPOSE_FILES="docker-compose.nginx.yml docker-compose.scale.yml"
COMPOSE_FILES="${COMPOSE_FILES:-${COMPOSE_FILE:-docker-compose.nginx.yml}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/validate-ghcr-image.sh
source "${SCRIPT_DIR}/lib/validate-ghcr-image.sh"
validate_ghcr_app_image "${APP_IMAGE}"

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

# Persist the deployed tag so later restarts (without APP_IMAGE in the shell)
# do not fall back to a stale value still sitting in .env.
if grep -q '^APP_IMAGE=' .env; then
  sed -i.bak "s|^APP_IMAGE=.*|APP_IMAGE=${APP_IMAGE}|" .env
  rm -f .env.bak
else
  printf '\nAPP_IMAGE=%s\n' "${APP_IMAGE}" >> .env
fi

COMPOSE_FILE_ARGS=()
# shellcheck disable=SC2086
for f in ${COMPOSE_FILES}; do
  COMPOSE_FILE_ARGS+=(-f "${f}")
done

echo "==> Pulling images (app/workers ${APP_IMAGE}, plus pgbouncer/redis/postgres)..."
docker compose "${COMPOSE_FILE_ARGS[@]}" pull

echo "==> Starting stack..."
docker compose "${COMPOSE_FILE_ARGS[@]}" up -d --no-build --remove-orphans

wait_healthy() {
  local port="$1"
  local label="$2"
  echo "==> Waiting for ${label} health on 127.0.0.1:${port}..."
  for i in $(seq 1 36); do
    if curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
      echo "${label} is healthy."
      return 0
    fi
    if [ "${i}" -eq 36 ]; then
      echo "ERROR: ${label} did not become healthy in time."
      docker compose "${COMPOSE_FILE_ARGS[@]}" logs app --tail 50
      if [ -n "${APP_PORT_B:-}" ]; then
        docker compose "${COMPOSE_FILE_ARGS[@]}" logs app-b --tail 50 || true
      fi
      return 1
    fi
    sleep 5
  done
}

wait_healthy "${APP_PORT}" "App" || exit 1
if [ -n "${APP_PORT_B}" ]; then
  wait_healthy "${APP_PORT_B}" "App-b" || exit 1
fi

echo "==> Pruning unused Docker images to free disk space..."
docker image prune -af >/dev/null 2>&1 || true
