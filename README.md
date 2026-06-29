# Sales Health Check

Diagnostic sales health assessment MVP — modular monolith with Next.js, TypeScript, PostgreSQL, and Prisma.

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL locally or full production stack)

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

Set at minimum for local auth (OTP + sessions):

- `AUTH_SESSION_SECRET` — long random string for signed session cookies
- `ADMIN_PASSWORD` — admin panel login (or `ADMIN_PASSWORD_HASH` in production)

Without `KAVENEGAR_API_KEY`, OTP codes are logged to the server console in dev.

3. Start PostgreSQL:

```bash
docker compose up -d
```

4. Run database migrations:

```bash
npm run db:migrate
```

5. Seed the question bank:

```bash
npm run db:seed
```

6. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `docs/` — PRD, architecture, API design, ADRs, QA scenarios
- `prisma/` — database schema and migrations
- `src/app/` — Next.js pages and API routes
- `src/modules/` — business logic (assessment, scoring, diagnosis, report, consultation)
- `src/components/` — UI components
- `src/config/model-v1/` — model configuration and question bank CSV

## User flow

Landing → **Phone OTP** → Business Info → Questions (16 domains) → Review → Processing → **Result Dashboard** → **Detailed Report** → **CTA (lead form)**

Returning users can sign in at `/account/login` and view past assessments at `/account/assessments`. Admins use `/admin/login` → `/admin/assessments`.

Legacy result links with `?token=` (email recovery) still work alongside session-based access.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run unit tests |
| `npm run test:integration` | Integration tests (requires PostgreSQL + migrations + seed) |
| `npm run test:all` | Unit + integration tests |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed ModelVersion v1 (idempotent) |
| `npm run db:studio` | Open Prisma Studio |

## Deploy on personal server (Docker)

Full HTTPS deploy with Caddy: [docs/ops/production-deploy.md](docs/ops/production-deploy.md).

1. Copy production env:

```bash
cp .env.production.example .env
```

Edit `.env` — at minimum set:

- `POSTGRES_PASSWORD` — strong database password
- `APP_DOMAIN` — public hostname (DNS A record → VPS)
- `APP_BASE_URL` — `https://<APP_DOMAIN>`
- `EXPERT_VIEW_TOKEN` — secret for internal expert view (`openssl rand -hex 32`)
- `AUTH_SESSION_SECRET` — signed user/admin session cookies (`openssl rand -hex 32`)
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` — admin panel login
- `KAVENEGAR_API_KEY` + `KAVENEGAR_OTP_TEMPLATE` — OTP SMS (optional in dev; codes logged when unset)

2. Build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. App available at `https://<APP_DOMAIN>` (Caddy handles TLS). Expert view: `/expert/<assessmentId>?adminToken=<EXPERT_VIEW_TOKEN>` — without a valid token, production returns 401.

The entrypoint runs `prisma migrate deploy` and seeds only if no active model exists.

### Deploy on VPS with host nginx (recommended)

Fast path: CI builds the image → GHCR → VPS pulls. See [production-deploy.md](docs/ops/production-deploy.md#deploy-with-host-nginx-multi-project-vps).

**First time:**

```bash
chmod +x scripts/bootstrap-vps.sh scripts/deploy-to-vps.sh
./scripts/bootstrap-vps.sh root@your-vps-ip
```

**Updates** (after push to `main` and CI completes):

```bash
./scripts/deploy-to-vps.sh root@your-vps-ip
```

Set GitHub Actions secrets `VPS_SSH_HOST` + `VPS_SSH_KEY` for automatic deploy on every merge to `main`.

### Database backup

Use the backup script (daily cron recommended on the VPS):

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

See [docs/ops/database-backup.md](docs/ops/database-backup.md) for cron setup, retention, and restore procedures.

## Documentation

See `docs/` for product and architecture documentation. Database overview: `docs/architecture/DatabaseSchema.md`. Manual QA: `docs/qa/MVP-Manual-Test-Scenarios.md`.
