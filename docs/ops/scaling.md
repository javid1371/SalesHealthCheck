# Scaling checklist (campaign readiness)

Ops guide for running Sales Health Check under paid-acquisition load (~100 concurrent users). Architecture decisions: [ADR 0017](../adr/0017-scale-readiness-async-finish.md). Load test procedure: [load-test.md](./load-test.md).

---

## Goals

| Goal | Target |
|------|--------|
| No finish timeouts | Async finish + nginx `proxy_read_timeout` ≥ 120s |
| Stable Postgres | App/workers via PgBouncer; per-process `connection_limit` |
| Multi-instance safe | Redis cache + Redis rate-limit + BullMQ |
| Campaign defaults | `CAPACITY_MODE=free`, PDF off, Resend/SMS quotas watched |

---

## Environment flags

| Variable | Campaign / prod | Dev / test |
|----------|-----------------|------------|
| `ASYNC_FINISH_ENABLED` | `true` | unset / `false` (sync finish) |
| `FINISH_WORKER_CONCURRENCY` | `3` (tune after load test) | n/a if async off |
| `REDIS_URL` | required (`redis://redis:6379`) | optional |
| `DATABASE_URL` | via PgBouncer `:6432`, `connection_limit=10` | direct Postgres OK |
| `PDF_GENERATION_ENABLED` | unset / `false` (do not enable at ads peak) | opt-in locally |
| `CAPACITY_MODE` | `free` at peak | as needed |

PDF after load test only: `docker compose -f docker-compose.nginx.yml -f docker-compose.pdf.yml up -d` (see [pdf-export.md](./pdf-export.md)). Route limit: 3 downloads / hour / IP.

See `.env.production.example` and `src/lib/env.ts`.

---

## Stack components

| Component | Role | Status |
|-----------|------|--------|
| Redis (AOF) | Cache, rate-limit, BullMQ (SMS + finish) | In compose today |
| PgBouncer | Transaction pooling in front of Postgres (`edoburu/pgbouncer`, `:6432`, max_client_conn 100) | Ready in compose |
| `finish-worker` | Same image, finish queue consumer | Ready (`assessment-finish` BullMQ worker) |
| `sms-funnel-worker` | Existing SMS queue consumer | Ready |
| nginx timeouts | `proxy_read/send_timeout 120s`, `proxy_connect_timeout 10s` | Ready |
| Multi-instance upstream | `:3105` + optional `:3106` | Ready — see [Multi-instance](#multi-instance) |
| Health | `{ status, db, redis?, finishQueueDepth? }` | Ready — see [Health](#health) |

---

## Health

`GET /api/health` returns:

| Field | When |
|-------|------|
| `status` / `db` | Always (`ok` or `503` if DB down) |
| `redis` | When `REDIS_URL` is set (`ok` \| `unreachable`) |
| `finishQueueDepth` | When Redis is reachable **and** `ASYNC_FINISH_ENABLED=true` — sum of waiting + active + delayed + prioritized + paused jobs on `assessment-finish` |

Example (campaign stack):

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "finishQueueDepth": 0
}
```

Queue depth is best-effort: BullMQ errors do not flip the endpoint to `503`.

Monitor during ads: depth should spike briefly under concurrent finish then drain. Sustained growth means raise `FINISH_WORKER_CONCURRENCY`, add a second finish-worker replica, or pause acquisition.

---

## Multi-instance

Default production is **one** app on `127.0.0.1:3105`. For higher HTTP capacity, add a second app and round-robin in nginx.

| Piece | Detail |
|-------|--------|
| Primary app | `APP_PORT=3105` (`docker-compose.nginx.yml`) |
| Second app | `APP_PORT_B=3106` via [`docker-compose.scale.yml`](../../docker-compose.scale.yml) |
| nginx | `upstream sales_health_check` in [`deploy/nginx/health.javidmgdm.com.conf`](../../deploy/nginx/health.javidmgdm.com.conf) — uncomment `127.0.0.1:3106` |
| Sticky sessions | **Not required** — rate limits and finish/SMS queues are Redis-backed |

### Prisma `connection_limit`

Every app and worker process must use PgBouncer with a capped pool:

```text
DATABASE_URL=…@pgbouncer:6432/…?connection_limit=10&pgbouncer=true
```

Compose already sets this on `app`, `app-b`, `finish-worker`, and `sms-funnel-worker`. With two app instances that is ~20 Prisma clients from HTTP alone (plus workers), still well under PgBouncer `MAX_CLIENT_CONN=100`. Do not raise `connection_limit` without checking the PgBouncer ceiling.

Migrations still use `DIRECT_URL` (Postgres `:5432`) from the entrypoint — never point migrate at PgBouncer.

### Enable two app instances

```bash
# On VPS
COMPOSE_FILES="docker-compose.nginx.yml docker-compose.scale.yml" \
  APP_PORT_B=3106 bash scripts/vps-update.sh

# Uncomment the 3106 line in the nginx upstream, then:
sudo cp /opt/sales-health-check/deploy/nginx/health.javidmgdm.com.conf /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
```

Verify both loopback ports: `curl -sf http://127.0.0.1:3105/api/health` and `:3106`.

---

## API contract (finish)

When `ASYNC_FINISH_ENABLED=true`:

1. `POST /api/assessments/[id]/finish` → `202 { jobId, status: "queued" }` (or `200` if already complete).
2. Client polls `GET /api/assessments/[id]/finish` every ~2s (UI budget ~90s).
3. Assessment HTTP mutate/read requires `X-Assessment-Token` or `?token=` (except start).

When the flag is off, finish stays synchronous (`200`) as today.

---

## Redis AOF (persistence + recovery)

Compose runs Redis with `--appendonly yes` and a durable `redis_data` volume.

### Verify AOF is on

```bash
docker compose -f docker-compose.nginx.yml exec redis redis-cli INFO persistence
# expect: aof_enabled:1
# aof_last_write_status:ok
```

### Recovery mental model

1. Redis restart reloads the AOF from `/data` — BullMQ keys (finish + SMS queues), rate-limit keys, and question-bank cache keys come back.
2. Jobs that were **active** when Redis/worker died may need a worker restart; BullMQ stalls/retries according to job options (finish: 2 attempts, exponential backoff).
3. Cache misses after wipe are safe (question bank reloads from Postgres).
4. Rate-limit windows reset if AOF/volume is lost — expect briefly higher allow rates until windows refill.

If the volume is corrupted: stop Redis, move/remove `/data`, start fresh, and re-warm caches by traffic. Finish jobs not yet completed must be re-enqueued by the user (retry on processing UI) or ops.

---

## Observability

### Finish failures → Sentry

`scripts/finish-worker.ts` calls `Sentry.captureException` on job `failed` with tag `queue=assessment-finish` and `assessmentId` in extras.

**Before ads:** in Sentry, create an alert for events with tag `queue` = `assessment-finish` (or message containing `[finish] job`), notify Slack/email, threshold ≥ 1 event in 5 minutes during campaign.

### Quotas

| Provider | Watch |
|----------|--------|
| Resend | Daily send quota / bounce rate (recovery emails) |
| Kavenegar | OTP + funnel SMS balance during peak hours |

### Health / queue

Poll `/api/health` (or uptime monitor) and alert if `redis` ≠ `ok` or `finishQueueDepth` stays high (e.g. &gt; 50 for &gt; 5 minutes).

---

## Pre-ads checklist

### Infra

- [x] PgBouncer in front of Postgres; app + workers use it (`connection_limit=10`, migrate via `DIRECT_URL`)
- [x] `finish-worker` service in compose (`FINISH_WORKER_CONCURRENCY`); queue processor wired
- [ ] Redis healthy; AOF persistence verified (`aof_enabled:1` — see [Redis AOF](#redis-aof-persistence--recovery))
- [x] nginx timeouts updated (`120s` read/send); `/api/health` exposes `finishQueueDepth` when async + Redis
- [x] Multi-instance nginx upstream + `docker-compose.scale.yml` (`connection_limit=10` per app)
- [x] Memory limits on app / finish-worker; Playwright not required on finish-worker

### App / product defaults

- [ ] `ASYNC_FINISH_ENABLED=true` on VPS `.env` and confirmed via a 202 finish response
- [x] Assessment token required on in-progress APIs (shipped with async finish)
- [x] `PDF_GENERATION_ENABLED` unset/false for campaign (code default; enable only via `docker-compose.pdf.yml` after load test)
- [ ] `CAPACITY_MODE=free` at peak (compose default; confirm admin report-settings CTA mode)
- [x] Rate limits: start / recover / consultation / finish enqueue / pdf (Redis-backed when `REDIS_URL` is set)

### Observability

- [ ] Sentry alert on finish job failed (`queue=assessment-finish`)
- [ ] Watch Resend / Kavenegar quota during ads
- [x] Finish queue depth on `GET /api/health` (`finishQueueDepth`)

### Load test (before spend)

- [x] k6 script: start → answers → finish enqueue → poll → result — [`loadtests/k6/full-assessment.js`](../../loadtests/k6/full-assessment.js) + [load-test.md](./load-test.md)
- [ ] 100 VU save/browse: p95 &lt; 2s (run `SCENARIO=browse`)
- [ ] 20 concurrent finish: p95 complete &lt; 30s (run `SCENARIO=finish`)
- [ ] Error rate &lt; 1%
- [ ] DB connections stable under PgBouncer ceiling

### Backup / recovery

- [ ] Postgres backup/restore path verified — see [database-backup.md](./database-backup.md)
- [x] Redis AOF recovery understood — see [Redis AOF](#redis-aof-persistence--recovery)

---

## Related docs

- [ADR 0017 — Scale readiness](../adr/0017-scale-readiness-async-finish.md)
- [Load test](./load-test.md)
- [Production deploy](./production-deploy.md)
- [PDF export](./pdf-export.md)
- [Database backup](./database-backup.md)
