# Production deploy (VPS + Docker + Caddy)

Deploy the Sales Health Check stack on a personal VPS with HTTPS via [Caddy](https://caddyserver.com/) and PostgreSQL in Docker.

## Prerequisites

- VPS with Docker and Docker Compose v2
- Domain name with DNS **A record** pointing to the server public IP
- Ports **80** and **443** open in the firewall (app port 3000 stays internal to Docker)

## 1. Server setup

Clone the repo on the VPS:

```bash
git clone <repo-url> sales-health-check
cd sales-health-check
```

Copy and edit production environment:

```bash
cp .env.production.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong database password |
| `APP_DOMAIN` | Public hostname (e.g. `sales.example.com`) |
| `EXPERT_VIEW_TOKEN` | Secret for `/expert/[id]?adminToken=` in production |
| `APP_BASE_URL` | Full public URL (`https://sales.example.com`) — used for result links and email recovery |
| `CAPACITY_MODE` | `free` (default) or `full` — report CTA routing |

Optional (Phase 2 email recovery):

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified sender (e.g. `noreply@yourdomain.com`) |

Generate a strong expert token:

```bash
openssl rand -hex 32
```

## 2. DNS

Create an **A record** for `APP_DOMAIN` → VPS public IP. Wait for propagation before the first deploy (Caddy needs HTTP-01 for Let's Encrypt).

## 3. Firewall

Allow inbound HTTP/HTTPS only:

```bash
# ufw example
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do **not** expose PostgreSQL (5432) or the app container (3000) to the public internet.

## 4. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts:

- **postgres** — database with healthcheck
- **app** — Next.js (internal port 3000, runs migrations + seed on start)
- **caddy** — reverse proxy with automatic HTTPS → `app:3000`

The entrypoint runs `prisma migrate deploy` and seeds only if no active model exists.

## 5. Verify

```bash
# Stack status
docker compose -f docker-compose.prod.yml ps

# App health (via Caddy)
curl -sS "https://${APP_DOMAIN}/api/health"
# Expected: {"status":"ok"}

# Expert view gate (wrong token → 401)
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://${APP_DOMAIN}/expert/<assessment-id>?adminToken=wrong"
```

Open `https://<APP_DOMAIN>` in a browser and run manual QA: [MVP-Manual-Test-Scenarios.md](../qa/MVP-Manual-Test-Scenarios.md).

## 6. Update deployment

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Architecture

```
Internet :443/:80
    → caddy (TLS, Let's Encrypt)
    → app:3000 (Next.js)
    → postgres:5432 (internal only)
```

- **Health:** `GET /api/health` — returns `200` with `{ "status": "ok" }` when the app and database are reachable; `503` if the database is down.
- **Optional direct app access:** bind `127.0.0.1:3000` on the host for local debugging by setting `APP_PORT=3000` in `.env` (see `docker-compose.prod.yml`).

## Troubleshooting

| Issue | Check |
|-------|--------|
| Caddy won't get certificate | DNS A record, ports 80/443 open, correct `APP_DOMAIN` |
| App unhealthy | `docker compose -f docker-compose.prod.yml logs app` |
| Database connection | Postgres container healthy; `DATABASE_URL` built from `.env` |
| 401 on expert view | Set `EXPERT_VIEW_TOKEN` in `.env` and restart app |

## 7. Database backup

Before the first real users, enable automated backups:

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Configure daily cron and restore procedures: [database-backup.md](./database-backup.md).

## Deploy with host nginx (multi-project VPS)

Use this when the VPS already runs **nginx** on ports 80/443 for other projects (no Caddy).

### Stack

- **postgres** + **app** only — see [`docker-compose.nginx.yml`](../../docker-compose.nginx.yml)
- App bound to `127.0.0.1:${APP_PORT:-3105}` on the host
- Host nginx reverse-proxies the public domain → localhost port
- SSL via **certbot** (same pattern as other subdomains on the server)

### One-command deploy from your machine

```bash
chmod +x scripts/deploy-to-vps.sh
./scripts/deploy-to-vps.sh root@193.163.201.132
```

The script rsyncs the repo to `/opt/sales-health-check`, creates `.env` with generated secrets on first run, builds Docker, installs nginx site config from [`deploy/nginx/health.javidmgdm.com.conf`](../../deploy/nginx/health.javidmgdm.com.conf), and runs certbot.

Override certbot email: `CERTBOT_EMAIL=you@example.com ./scripts/deploy-to-vps.sh`

### Manual steps (server)

```bash
cd /opt/sales-health-check
cp .env.production.example .env   # edit secrets
docker compose -f docker-compose.nginx.yml up -d --build

cp deploy/nginx/health.javidmgdm.com.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/health.javidmgdm.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d health.javidmgdm.com
```

### Architecture (nginx variant)

```
Internet :443/:80
    → nginx (host, TLS via certbot)
    → 127.0.0.1:3105 (Docker app)
    → postgres:5432 (internal only)
```

### Update (nginx variant)

```bash
./scripts/deploy-to-vps.sh
# or on server:
cd /opt/sales-health-check && docker compose -f docker-compose.nginx.yml up -d --build
```

## Related

- [README.md](../../README.md) — local dev and quick deploy
- [database-backup.md](./database-backup.md) — backup cron, retention, restore test
