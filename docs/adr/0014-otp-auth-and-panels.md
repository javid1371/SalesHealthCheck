# ADR 0014 — OTP Auth, User Panel, and Admin Panel

## Status

Accepted

## Date

2026-06-28

## Context

The MVP currently starts assessments without verifying phone ownership and exposes results only via `resultToken` (email recovery links). Product needs:

- Verified phone identity before the assessment starts.
- A user panel to list and reopen past assessments.
- An internal admin panel to browse assessments and view reports.
- Backward compatibility with existing `resultToken` links and email recovery.

ADR 0005 (modular monolith) requires auth, OTP, account, and admin logic in `src/modules/` with thin routes — not scattered in UI or route handlers.

## Decision

1. **OTP via SMS (Kavenegar)** before assessment start. Phone is normalized and verified once; the user receives a signed HTTP-only session cookie. An abstract `SmsSender` adapter sends via Kavenegar when `KAVENEGAR_API_KEY` is set; in dev without the key, OTP codes are logged only (same pattern as access-recovery email).
2. **Signed session cookies** (HMAC-SHA256 via Node `crypto`, no new dependency):
   - User payload: `{ userId, exp }`.
   - Admin payload: `{ role: "admin", exp }`.
   - Production: `secure`, `sameSite=lax`. Signature and password comparisons use `timingSafeEqual`.
3. **Admin auth** uses a fixed password from env (`ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`) plus a signed admin cookie — not `resultToken` and not user session.
4. **Preserve `resultToken`** for direct links and email recovery. Result access accepts any of:
   - Valid `?token=` (unchanged for legacy users).
   - User session cookie when `userId` owns the assessment.
   - Admin session cookie.
5. **OTP storage**: codes stored hashed only; single use; TTL and max attempts enforced. Generic API responses to avoid user enumeration.
6. **User phone lookup**: normalize phone and `findFirst` (latest) — no unique constraint on `User.phone` yet due to possible duplicate legacy data.

## Options Considered

1. **JWT in Authorization header** — rejected for MVP (more client complexity; cookie fits same-site app flows).
2. **OAuth / third-party IdP** — rejected (Iranian users expect phone OTP; adds integration scope).
3. **Admin via `EXPERT_VIEW_TOKEN` query param only** — rejected (no assessment list, no persistent admin session, conflates expert view with ops panel).
4. **Replace `resultToken` with session-only access** — rejected (breaks emailed recovery links and bookmarked URLs).
5. **Signed HTTP-only cookies + OTP + three-path result access + env-based admin password** — **accepted**.

## Consequences

### Positive

- Phone ownership is verified before data collection.
- Users can return to incomplete and completed assessments without re-entering email recovery.
- Admins can search and open reports without per-assessment tokens.
- Legacy `resultToken` links keep working.
- No new npm dependencies for signing or SMS HTTP calls.

### Negative / Tradeoffs

- New Prisma models and migrations (`OtpCode`, `User.phoneVerifiedAt`).
- `AUTH_SESSION_SECRET` becomes required when auth routes are enabled.
- Kavenegar credentials needed in production for real SMS.
- Duplicate `User.phone` rows remain possible until a follow-up migration adds uniqueness.

## Implementation Notes

- Modules: `src/modules/auth/`, `src/modules/account/`, `src/modules/admin/`; session helpers in `src/lib/session.ts`.
- Routes stay thin; business logic in services (ADR 0005, ADR 0007).
- `assertResultAccess({ assessment, token, session })` centralizes result/report/expert access checks.
- `startAssessment` requires user session; phone comes from session, not request body.
- Rate limits: `otpSendLimiter` in `src/lib/rate-limit.ts` (per phone + per IP).
- Environment variables (see `src/lib/env.ts`, `.env.example`):
  - `AUTH_SESSION_SECRET` — required for cookie signing when auth is used.
  - `KAVENEGAR_API_KEY`, `KAVENEGAR_OTP_TEMPLATE` — optional in dev.
  - `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH` — admin login.
  - `OTP_TTL_SECONDS` (default 300), `OTP_MAX_ATTEMPTS` (default 3).

## Related Documents

- docs/adr/0005-use-modular-monolith.md
- docs/adr/0007-backend-is-source-of-truth.md
- docs/qa/MVP-Manual-Test-Scenarios.md
