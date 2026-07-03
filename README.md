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
- `ADMIN_BOOTSTRAP_PHONE` — mobile for the first admin account (Iranian format `09XXXXXXXXX`)
- `ADMIN_BOOTSTRAP_PASSWORD` — initial admin password (falls back to `ADMIN_PASSWORD` if unset)

Without `KAVENEGAR_API_KEY`, OTP codes are logged to the server console in dev.

**Staff panel login** (`/admin/login`, `/expert/login`) uses **phone + password** against `StaffUser` records in the database. Legacy env passwords (`ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`, `SALES_EXPERT_PASSWORD` / `SALES_EXPERT_PASSWORD_HASH`) apply only as a **bootstrap fallback** when no active user exists for that role — create real accounts via `/admin/staff` after the first login.

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

6. Bootstrap the first admin staff user (idempotent — skips if an admin already exists):

```bash
npm run db:seed-admin
```

Uses `ADMIN_BOOTSTRAP_PHONE`, `ADMIN_BOOTSTRAP_PASSWORD` (or `ADMIN_PASSWORD`), and optional `ADMIN_BOOTSTRAP_NAME` (default: `ادمین`).

7. Start the development server:

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

Returning users can sign in at `/account/login` and view past assessments at `/account/assessments`.

Internal staff panels (phone + password):

- **Admin** — `/admin/login` → `/admin/dashboard` (assessments, leads, staff users)
- **Sales expert** — `/expert/login` → `/expert/dashboard` (assigned leads)

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
| `npm run db:seed-admin` | Create first admin `StaffUser` if none exists (idempotent) |
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
- `ADMIN_BOOTSTRAP_PHONE` — mobile for the first admin staff account
- `ADMIN_BOOTSTRAP_PASSWORD` — initial admin password (or `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` as fallback)
- `KAVENEGAR_API_KEY` + `KAVENEGAR_OTP_TEMPLATE` — OTP SMS (optional in dev; codes logged when unset)

Legacy `ADMIN_PASSWORD` / `SALES_EXPERT_PASSWORD` env vars are **bootstrap-only**: they let you sign in before any `StaffUser` exists. After bootstrap, manage staff at `/admin/staff`.

2. Build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Bootstrap the first admin (once per environment, after migrations):

The container entrypoint runs `prisma migrate deploy` and seeds the question bank when needed, but **does not** create staff users. From a machine with this repo and network access to Postgres:

```bash
ADMIN_BOOTSTRAP_PHONE=09XXXXXXXXX \
ADMIN_BOOTSTRAP_PASSWORD='your-secure-password' \
DATABASE_URL='postgresql://postgres:<POSTGRES_PASSWORD>@<postgres-host>:5432/sales_health_check' \
npm run db:seed-admin
```

On a VPS where Postgres is Docker-internal only, run the command from a local checkout over an SSH tunnel, or clone the repo on the server and use the compose network URL (`postgresql://postgres:…@postgres:5432/sales_health_check`) via a one-off Node container on the same Docker network.

Until `db:seed-admin` runs, you can still open `/admin/login` with any valid mobile number and the `ADMIN_PASSWORD` fallback (only while no admin `StaffUser` exists).

4. App available at `https://<APP_DOMAIN>` (Caddy handles TLS). Expert view: `/expert/<assessmentId>?adminToken=<EXPERT_VIEW_TOKEN>` — without a valid token, production returns 401.

### Deploy on VPS with host nginx (recommended)

Fast path: CI builds the image → GHCR → VPS pulls. See [production-deploy.md](docs/ops/production-deploy.md#deploy-with-host-nginx-multi-project-vps).

**First time** (private GHCR — [how to create token](docs/ops/ghcr-private-setup.md)):

```bash
chmod +x scripts/bootstrap-vps.sh scripts/deploy-to-vps.sh
GHCR_TOKEN=ghp_xxxx ./scripts/bootstrap-vps.sh root@your-vps-ip
```

**Updates** (after push to `main` and CI completes):

```bash
./scripts/deploy-to-vps.sh root@your-vps-ip
```

Set GitHub Actions secrets `GHCR_TOKEN`, `VPS_SSH_HOST`, and `VPS_SSH_KEY` for automatic deploy on every merge to `main`.

After the first deploy, run `npm run db:seed-admin` once (see step 3 above) or sign in via the env-password fallback at `/admin/login`, then create staff accounts at `/admin/staff`.

### Database backup

Use the backup script (daily cron recommended on the VPS):

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

See [docs/ops/database-backup.md](docs/ops/database-backup.md) for cron setup, retention, and restore procedures.

## Documentation

See `docs/` for product and architecture documentation.

| Topic | Location |
|-------|----------|
| Database schema | [docs/architecture/DatabaseSchema.md](docs/architecture/DatabaseSchema.md) |
| Diagnosis Engine v2 | [docs/specs/diagnosis-engine-v2-spec.md](docs/specs/diagnosis-engine-v2-spec.md) |
| Report Content Library v1 | [docs/specs/report-content-library-v1/overview.md](docs/specs/report-content-library-v1/overview.md) — domain bundles, public/internal fields, freemium rules; implementation guide and JSON snapshot in the same folder |
| Architecture decisions (ADRs) | [docs/adr/](docs/adr/) — including [ADR 0015](docs/adr/0015-adopt-report-content-library-v1.md) (DomainBundle adoption) and [ADR 0016](docs/adr/0016-report-coherence-v1.md) (aligned report narrative + bundle-first copy) |
| Manual QA | [docs/qa/MVP-Manual-Test-Scenarios.md](docs/qa/MVP-Manual-Test-Scenarios.md) |
