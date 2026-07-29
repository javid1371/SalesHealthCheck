# Load test (campaign readiness)

k6 scenarios for Sales Health Check before paid acquisition. Architecture: [ADR 0017](../adr/0017-scale-readiness-async-finish.md). Ops checklist: [scaling.md](./scaling.md).

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| k6 installed | [Install k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) |
| Target stack | App + Postgres + PgBouncer + Redis + `finish-worker` |
| `ASYNC_FINISH_ENABLED=true` | Required for the async finish path under test |
| Auth | OTP `devCode` **or** a pre-minted `SESSION_COOKIE` |
| Seeded question bank | `npm run db:seed` |

**Auth options**

1. **devCode (preferred for staging):** run target with `NODE_ENV` ≠ `production` and without Kavenegar (`KAVENEGAR_API_KEY` / template unset). Each VU calls `/api/auth/otp/send` → uses `devCode` → verify → session cookie.
2. **SESSION_COOKIE:** skip OTP; set `SESSION_COOKIE` to a valid `shc_user_session` value (same `AUTH_SESSION_SECRET` as the target).

**Rate limits:** the script sets a unique `X-Forwarded-For` per VU/iteration so start/OTP IP buckets do not collapse. Prefer hitting the app (or nginx that forwards client `X-Forwarded-For` first) as documented in [request-ip](../../src/lib/request-ip.ts).

Do **not** run destructive load against live production with real users. Use a staging clone or a maintenance window.

## Script

[`loadtests/k6/full-assessment.js`](../../loadtests/k6/full-assessment.js)

Per VU (except `browse`):

1. OTP login (unless `SESSION_COOKIE`)
2. `POST /api/assessments/start`
3. `GET .../questions` (`X-Assessment-Token`)
4. `POST .../answers` (batch)
5. `POST .../finish` → `200` sync or `202` queued
6. Poll `GET .../finish` every 2s (budget 90s)
7. `GET .../result`

## Scenarios

| `SCENARIO` | Default load | What it stresses | Thresholds |
|------------|--------------|------------------|------------|
| `smoke` | 2 VU × 30s | Sanity | errors &lt; 1%, browse/save p95 &lt; 2s |
| `browse` | 100 VU × 2m | Questions + save | browse/save p95 &lt; 2s, errors &lt; 1% |
| `finish` | 20 VU × 3m | Async finish + poll | `finish_complete_duration` p95 &lt; 30s, errors &lt; 1% |
| `full` | ramp to 100 VU | End-to-end mix | all of the above |

## Acceptance criteria (before ads)

| Metric | Target |
|--------|--------|
| 100 VU save/browse | p95 &lt; 2s (`browse_duration`, `save_duration`) |
| 20 concurrent finish | p95 time-to-complete &lt; 30s (`finish_complete_duration`) |
| Error rate | &lt; 1% (`errors`, `http_req_failed`) |
| DB connections | Stable under PgBouncer `MAX_CLIENT_CONN` (100); watch `SHOW POOLS` / app errors |
| Finish queue | `finishQueueDepth` on `/api/health` should drain; not grow unbounded |

## Commands

```bash
# Smoke against local
k6 run -e BASE_URL=http://localhost:3000 -e SCENARIO=smoke \
  loadtests/k6/full-assessment.js

# Browse / save (100 VU)
k6 run -e BASE_URL=https://staging.example.com -e SCENARIO=browse \
  loadtests/k6/full-assessment.js

# Concurrent finish (20 VU)
k6 run -e BASE_URL=https://staging.example.com -e SCENARIO=finish \
  loadtests/k6/full-assessment.js

# Full ramp
k6 run -e BASE_URL=https://staging.example.com -e SCENARIO=full \
  loadtests/k6/full-assessment.js

# Pre-minted session (skip OTP)
k6 run -e BASE_URL=http://localhost:3000 -e SCENARIO=smoke \
  -e SESSION_COOKIE='<shc_user_session value>' \
  loadtests/k6/full-assessment.js
```

Optional knobs: `VUS`, `DURATION`, `POLL_INTERVAL_SEC` (default 2), `POLL_TIMEOUT_SEC` (default 90).

## During the run — what to watch

```bash
# Health (includes finishQueueDepth when Redis + async finish are on)
curl -sS "$BASE_URL/api/health"

# Finish worker
docker compose -f docker-compose.nginx.yml logs -f finish-worker

# PgBouncer pools (from the pgbouncer container)
docker compose -f docker-compose.nginx.yml exec pgbouncer \
  psql -h 127.0.0.1 -p 6432 -U postgres -c "SHOW POOLS;"

# Redis memory / AOF
docker compose -f docker-compose.nginx.yml exec redis redis-cli INFO persistence
docker compose -f docker-compose.nginx.yml exec redis redis-cli INFO memory
```

## After pass / fail

- **Pass:** proceed with [scaling.md](./scaling.md) pre-ads checklist (PDF stays off; `CAPACITY_MODE=free`).
- **Fail:** capture k6 summary, `/api/health`, finish-worker logs, PgBouncer `SHOW POOLS`, and Sentry finish failures before raising concurrency or opening ads.

CI: optional nightly smoke only — not a PR blocker.
