# ADR 0017 — Scale Readiness: Async Finish, Redis Infra, Assessment Token

## Status

Accepted

## Date

2026-07-29

## Context

Paid acquisition may drive ~100 concurrent assessment users. Today `POST .../finish` runs scoring, diagnosis, and report persistence **synchronously** inside the HTTP request. Under concurrent finish load this risks nginx/proxy timeouts, Postgres connection saturation, and single-instance in-memory rate limits that do not hold across multiple app containers.

Existing building blocks must be reused, not reinvented:

- Redis + AOF already in production compose (`docker-compose.nginx.yml`).
- BullMQ SMS funnel worker pattern (same image, different CMD).
- PDF generation is already opt-in (`PDF_GENERATION_ENABLED`); campaign default remains off.
- Sync `finishAssessment` with idempotent P2002 handling already exists and must be extracted/enqueued, not rewritten.

ADR 0005 (modular monolith) forbids splitting into microservices. ADR 0014 already occupies number 0014 (OTP); this decision is **0017**.

## Decision

1. **Redis and PgBouncer are infrastructure**, not domain services. Modules talk to cache / rate-limit / queue helpers in `src/lib` and assessment finish-queue code under `src/modules/assessment/`. No direct Redis usage from unrelated modules.
2. **Finish worker** is the same app image with a different CMD (mirror `sms-funnel-worker`). Concurrency from `FINISH_WORKER_CONCURRENCY` (default 3).
3. **Async finish is flag-gated:**
   - `ASYNC_FINISH_ENABLED=true` in production → enqueue on BullMQ; HTTP returns `202`.
   - unset / `false` → keep today’s synchronous finish (`200`) for local dev and tests.
4. **API contract** (token auth and async finish ship in **one release**):

   | Endpoint | Behavior |
   |----------|----------|
   | `POST .../finish` | If already complete → current `200`. If async on → `202 { jobId, status: "queued" }`. If async off → `200` sync. |
   | `GET .../finish` | `{ status: queued\|active\|completed\|failed, reportId?, resultUrl?, error? }` |
   | Assessment mutate/read | `X-Assessment-Token` or `?token=` required (except start, which uses user session). |

5. **Job payload** is `{ assessmentId }` only. Token is validated at enqueue time and never stored on the job.
6. **Scoring / diagnosis / `persistAssessmentResults` / report builder** are not logically refactored for scale — only extracted for worker reuse and batched where I/O-bound (e.g. `saveAnswers`).
7. **Dev without Redis** continues to work (memory cache + in-memory rate limit). Prod uses Redis for cache, rate-limit, and both BullMQ queues.

## Options Considered

1. **Keep sync finish + raise nginx timeouts only** — rejected (does not fix Postgres saturation or multi-instance rate limits under ad traffic).
2. **Microservice for finish** — rejected (violates ADR 0005; operational overhead for MVP scale).
3. **Persist finish jobs in Postgres** — rejected for now (Redis/BullMQ already proven by SMS funnel; schema churn unnecessary).
4. **Async finish + Redis rate-limit/cache + PgBouncer + assessment token in one deploy** — **accepted**.

## Consequences

### Positive

- Finish work leaves the request path; UI polls until complete.
- Multiple app instances share rate limits and queues via Redis.
- PgBouncer caps DB connections under concurrent finish/save traffic.
- Dev/test stay simple with `ASYNC_FINISH_ENABLED` off and no Redis required.

### Negative / Tradeoffs

- Processing UI must handle `202` + poll (and failure/retry).
- Ops surface grows: finish-worker health, queue depth, PgBouncer.
- Token required on in-progress HTTP APIs; clients must pass `resultToken` consistently.
- Token auth and async finish must deploy together to avoid half-migrated clients.

## Implementation Notes

- Env (see `src/lib/env.ts`, `.env.production.example`):
  - `ASYNC_FINISH_ENABLED` — prod `true`; unset/false = sync finish.
  - `FINISH_WORKER_CONCURRENCY` — default `3`.
  - App/workers use `DATABASE_URL` via PgBouncer (`…@pgbouncer:6432/…?connection_limit=10&pgbouncer=true`); migrate/seed use `DIRECT_URL` to Postgres.
  - Optional second HTTP instance: nginx `upstream sales_health_check` + `docker-compose.scale.yml` (`APP_PORT_B=3106`); sticky sessions not required.
- Ops checklist: `docs/ops/scaling.md` (filled out as infra and load-test phases land).
- Out of scope: scoring/diagnosis/report builder redesign, new Prisma job table, AI layer, PDF always-on during campaigns.

## Related Documents

- docs/adr/0005-use-modular-monolith.md
- docs/adr/0007-backend-is-source-of-truth.md
- docs/adr/0014-otp-auth-and-panels.md
- docs/ops/scaling.md
- docs/ops/production-deploy.md
