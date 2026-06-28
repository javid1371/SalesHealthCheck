#!/usr/bin/env bash
set -euo pipefail

# Deploy Sales Health Check to VPS with host nginx + Docker.
# Builds the image locally (saves VPS disk) and loads it on the server.
# Usage: ./scripts/deploy-to-vps.sh [ssh-host]
# Example: ./scripts/deploy-to-vps.sh root@193.163.201.132

SSH_HOST="${1:-root@193.163.201.132}"
REMOTE_DIR="/opt/sales-health-check"
DOMAIN="health.javidmgdm.com"
APP_PORT="3105"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@javidmgdm.com}"
IMAGE_NAME="sales-health-check-app:latest"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Building Docker image locally (linux/amd64)..."
docker build \
  --platform linux/amd64 \
  --build-arg INSTALL_PLAYWRIGHT="${PDF_GENERATION_ENABLED:-false}" \
  -t "${IMAGE_NAME}" \
  "${PROJECT_ROOT}"

echo "==> Syncing project to ${SSH_HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.cursor' \
  --exclude 'coverage' \
  "${PROJECT_ROOT}/" "${SSH_HOST}:${REMOTE_DIR}/"

echo "==> Loading image on server (via temp file — more reliable than SSH pipe)..."
IMAGE_TAR="/tmp/sales-health-check-app.tar.gz"
docker save "${IMAGE_NAME}" | gzip > "${IMAGE_TAR}"
echo "Image archive: $(du -h "${IMAGE_TAR}" | cut -f1)"
scp "${IMAGE_TAR}" "${SSH_HOST}:/tmp/sales-health-check-app.tar.gz"
ssh "${SSH_HOST}" "gunzip -c /tmp/sales-health-check-app.tar.gz | docker load && rm -f /tmp/sales-health-check-app.tar.gz"
rm -f "${IMAGE_TAR}"

echo "==> Remote setup: .env, Docker, nginx, SSL"
ssh "${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
REMOTE_DIR="${REMOTE_DIR}"
DOMAIN="${DOMAIN}"
APP_PORT="${APP_PORT}"
CERTBOT_EMAIL="${CERTBOT_EMAIL}"

cd "\${REMOTE_DIR}"

if [ ! -f .env ]; then
  echo "Creating .env from template..."
  POSTGRES_PASSWORD=\$(openssl rand -hex 24)
  EXPERT_VIEW_TOKEN=\$(openssl rand -hex 32)
  cat > .env <<ENV
POSTGRES_USER=postgres
POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
POSTGRES_DB=sales_health_check

APP_PORT=\${APP_PORT}
APP_DOMAIN=\${DOMAIN}
APP_BASE_URL=https://\${DOMAIN}

EXPERT_VIEW_TOKEN=\${EXPERT_VIEW_TOKEN}
CAPACITY_MODE=free
ENV
  echo ".env created with generated secrets."
else
  echo ".env already exists — keeping existing secrets."
fi

if ss -tlnp | grep -q ":${APP_PORT} " && ! curl -sf "http://127.0.0.1:\${APP_PORT}/api/health" >/dev/null 2>&1; then
  echo "ERROR: port ${APP_PORT} is in use by another process."
  ss -tlnp | grep ":${APP_PORT} " || true
  exit 1
fi

echo "==> Pruning Docker build cache (free disk before start)..."
docker builder prune -af >/dev/null 2>&1 || true

echo "==> Starting Docker stack (prebuilt image)..."
docker compose -f docker-compose.nginx.yml up -d --no-build

echo "==> Waiting for app health on 127.0.0.1:\${APP_PORT}..."
for i in \$(seq 1 60); do
  if curl -sf "http://127.0.0.1:\${APP_PORT}/api/health" >/dev/null 2>&1; then
    echo "App is healthy."
    break
  fi
  if [ "\$i" -eq 60 ]; then
    echo "ERROR: app did not become healthy in time."
    docker compose -f docker-compose.nginx.yml logs app --tail 50
    exit 1
  fi
  sleep 5
done

echo "==> Installing nginx site config..."
cp deploy/nginx/health.javidmgdm.com.conf /etc/nginx/sites-available/health.javidmgdm.com.conf
ln -sf /etc/nginx/sites-available/health.javidmgdm.com.conf /etc/nginx/sites-enabled/health.javidmgdm.com.conf
nginx -t
systemctl reload nginx

echo "==> Obtaining SSL certificate..."
if [ -d "/etc/letsencrypt/live/\${DOMAIN}" ]; then
  echo "Certificate already exists for \${DOMAIN}, renewing if needed..."
  certbot renew --quiet || true
else
  certbot --nginx -d "\${DOMAIN}" --non-interactive --agree-tos -m "\${CERTBOT_EMAIL}" --redirect
fi
nginx -t
systemctl reload nginx

echo "==> Health check via HTTPS..."
curl -sf "https://\${DOMAIN}/api/health"
echo ""
echo "Deploy complete: https://\${DOMAIN}"
REMOTE

echo "==> Done."
