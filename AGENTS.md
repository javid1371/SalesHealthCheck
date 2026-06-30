<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a Next.js 16 (Turbopack) modular monolith with Prisma + PostgreSQL. See `README.md` for the canonical command list (`npm run dev`, `lint`, `test`, `test:integration`, `db:migrate`, `db:seed`).

### Database (required for the app + integration tests)
- PostgreSQL 16 is installed natively (not Docker — Docker is unavailable in this VM, so ignore `docker compose up`). It must be started each session; the snapshot keeps the installed server and seeded data but not the running process:
  - `sudo pg_ctlcluster 16 main start`
- Connection (matches `DATABASE_URL` in `.env`): db `sales_health_check`, user/password `postgres`/`postgres` on `localhost:5432`.
- Migrations and seed are already applied in the snapshot. If you ever hit a missing-table or empty-question-bank error, re-run `npm run db:migrate` then `npm run db:seed` (both idempotent).

### Environment file
- `.env` is gitignored and is NOT recreated by the update script. It persists in the snapshot. If it is ever missing, recreate it with at least: `DATABASE_URL` (above), `AUTH_SESSION_SECRET` (any long random string), and `ADMIN_PASSWORD`. `APP_BASE_URL=http://localhost:3000` is useful too. Without `KAVENEGAR_API_KEY`, OTP codes are NOT sent via SMS — instead the dev code is returned in the OTP send API response and shown in an amber box on the verify page.

### Running / testing notes
- Cursor sandbox injects deprecated `npm_config_devdir`; project hook `.cursor/hooks/strip-devdir-env.py` rewrites agent `npm` commands. In a normal terminal, `npm config get devdir` should be `undefined`.
- `npm run dev` serves on `http://localhost:3000`. The UI is Persian/RTL.
- `npm run lint` currently reports pre-existing errors (e.g. `no-empty-object-type`, a React `setState`-in-effect rule) and exits non-zero on an unmodified checkout — this is a baseline repo state, not an environment problem.
- `npm test` (unit) needs no DB; `npm run test:integration` requires Postgres running with migrations+seed applied.
