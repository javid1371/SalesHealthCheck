#!/usr/bin/env bash
# One-time VPS setup: sync deploy files, create .env, nginx, SSL, first pull.
# Usage: ./scripts/bootstrap-vps.sh [ssh-host]
# Example: ./scripts/bootstrap-vps.sh root@193.163.201.132

set -euo pipefail

SSH_HOST="${1:-root@193.163.201.132}"
REMOTE_DIR="/opt/sales-health-check"
DOMAIN="${APP_DOMAIN:-health.javidmgdm.com}"
APP_PORT="${APP_PORT:-3105}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@javidmgdm.com}"
APP_IMAGE="${APP_IMAGE:-ghcr.io/javid1371/sales-health-check:latest}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Syncing deploy files to ${SSH_HOST}:${REMOTE_DIR}"
ssh "${SSH_HOST}" "mkdir -p ${REMOTE_DIR}/deploy/nginx ${REMOTE_DIR}/scripts"
rsync -avz \
  "${PROJECT_ROOT}/docker-compose.nginx.yml" \
  "${PROJECT_ROOT}/.env.production.example" \
  "${SSH_HOST}:${REMOTE_DIR}/"
rsync -avz \
  "${PROJECT_ROOT}/scripts/vps-update.sh" \
  "${PROJECT_ROOT}/scripts/bootstrap-vps.sh" \
  "${PROJECT_ROOT}/scripts/deploy-to-vps.sh" \
  "${SSH_HOST}:${REMOTE_DIR}/scripts/"
rsync -avz \
  "${PROJECT_ROOT}/deploy/nginx/" \
  "${SSH_HOST}:${REMOTE_DIR}/deploy/nginx/"

echo "==> Running remote bootstrap..."
ssh "${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
REMOTE_DIR="${REMOTE_DIR}"
DOMAIN="${DOMAIN}"
APP_PORT="${APP_PORT}"
CERTBOT_EMAIL="${CERTBOT_EMAIL}"
APP_IMAGE="${APP_IMAGE}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
GHCR_USER="${GHCR_USER:-javid1371}"

mkdir -p "\${REMOTE_DIR}/scripts"
chmod +x "\${REMOTE_DIR}/scripts/vps-update.sh" 2>/dev/null || true

cd "\${REMOTE_DIR}"

if [ ! -f .env ]; then
  echo "Creating .env from template..."
  POSTGRES_PASSWORD=\$(openssl rand -hex 24)
  EXPERT_VIEW_TOKEN=\$(openssl rand -hex 32)
  AUTH_SESSION_SECRET=\$(openssl rand -hex 32)
  cat > .env <<ENV
POSTGRES_USER=postgres
POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
POSTGRES_DB=sales_health_check

APP_PORT=\${APP_PORT}
APP_DOMAIN=\${DOMAIN}
APP_BASE_URL=https://\${DOMAIN}
APP_IMAGE=\${APP_IMAGE}

EXPERT_VIEW_TOKEN=\${EXPERT_VIEW_TOKEN}
AUTH_SESSION_SECRET=\${AUTH_SESSION_SECRET}
CAPACITY_MODE=free

# OTP + admin panel (ADR 0014) — set before first OTP deploy
# KAVENEGAR_API_KEY=
# KAVENEGAR_OTP_TEMPLATE=
# ADMIN_PASSWORD=
ENV
  echo ".env created with generated secrets."
else
  echo ".env already exists — keeping existing secrets."
fi

if ss -tlnp | grep -q ":\${APP_PORT} " && ! curl -sf "http://127.0.0.1:\${APP_PORT}/api/health" >/dev/null 2>&1; then
  echo "ERROR: port \${APP_PORT} is in use by another process."
  ss -tlnp | grep ":\${APP_PORT} " || true
  exit 1
fi

REMOTE_DIR="\${REMOTE_DIR}" APP_PORT="\${APP_PORT}" APP_IMAGE="\${APP_IMAGE}" \
  GHCR_TOKEN="\${GHCR_TOKEN}" GHCR_USER="\${GHCR_USER}" \
  bash "\${REMOTE_DIR}/scripts/vps-update.sh"

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
echo "Bootstrap complete: https://\${DOMAIN}"
REMOTE

echo "==> Done. Future updates: ./scripts/deploy-to-vps.sh ${SSH_HOST}"
