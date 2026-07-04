# Cursor Rules — Sales Health Check

You are working on the Sales Health Check MVP.

This project is a modular monolith built with Next.js, TypeScript, PostgreSQL, Prisma, and an optional AI Explanation Layer.

## Product Rule

This is not a generic form app.
This is a diagnostic product.
The core value is the scoring and diagnostic engine.

## Architecture Rule

Follow the modular monolith structure.
Do not introduce microservices unless an ADR explicitly approves it.

## Backend Rule

Backend is the source of truth.
Scoring, diagnosis, report generation, and model versioning must run on the backend.

## Frontend Rule

Frontend must not calculate scores, bottlenecks, diagnoses, or final reports.
Frontend only collects answers and displays backend results.

## AI Rule

AI must not decide the diagnosis.
AI must not override scores, bottlenecks, or diagnostic results.
AI only explains and humanizes the structured report.

## Scoring Rule

Overall Score must be calculated from Overall Raw Score / Overall Max Score × 100.
Do not calculate Overall Score as a simple average of domain percentages.

## Answer Rule

Frontend sends only selectedOptionId.
Backend reads option score and stores score snapshot in Answer.

## Model Version Rule

Each AssessmentSession must be attached to a ModelVersion.
Questions must be loaded from the AssessmentSession's ModelVersion.

## Repository Rule

Keep route handlers thin.
Put business logic inside src/modules.

## Testing Rule

Any change to scoring, diagnosis, bottleneck logic, or finishAssessment must include or update tests.

## Diagnosis vs Report Rule

Diagnosis Engine decides what is wrong (bottlenecks, roots, survival, priority).
Report Engine only narrates structured diagnosis output — it must not compute diagnostic decisions.
See ADR 0010 and `docs/specs/diagnosis-engine-v2-spec.md`.

## Report Content Library Rule

Report narration copy comes from the in-repo **Report Content Library v1** (DomainBundle), not from Notion at runtime.
Canonical snapshot: `docs/specs/report-content-library-v1/` (`overview.md`, `cursor-implementation-guide.md`, `domain-bundles.v1.json`).
Seed and types: `src/config/model-v1/report-content/`; resolvers: `src/modules/report/content-library.ts`.
Regenerate seed after snapshot changes: `npm run sync:report-content` (supports `--check`).

**Bundle-first user copy (ADR 0016):** prefer DomainBundle public fields when present; fall back to CSV `question-analysis-config` only when bundle data is missing.
- Domain cards: `symptomsList` from `bundle.symptoms` (bullets); `levelHeadline`, `rootCauses`, actions from bundle.
- Issue cards: `mechanism` from `public_summary_fa` when available.
- Never expose `internal_*` fields (e.g. `internal_diagnosis_summary_fa`, `rendering_rules_fa`) in user-facing output.

**Report narrative coherence (ADR 0016):**
- `quickWin` in `StructuredDiagnosis` is chosen from `{primaryIssue, structuralRoots, bindingConstraint}` (see diagnosis-engine-v2-spec).
- Composer dedupes issue cards by `engineId`; UI title «مهم‌ترین اولویت‌ها» (not a fixed count).
- When `rootCauses` exist on a domain card, do not also render legacy standalone evidence for that domain.

New `ReportSpec` fields from bundles are optional — do not break existing report output.
Freemium: only the `quickWin` domain may show full corrective action; other domains show locked teasers only.
See ADR 0015 and ADR 0016.

## ADR Rule

If a proposed implementation conflicts with an ADR, stop and ask for a new ADR before changing the architecture.

## Deploy Rule (VPS production)

All production deploys go through **GitHub Actions → GHCR → VPS pull**. This minimizes transfer size (layer cache) and keeps one canonical build.

**Required flow:**
1. Merge/push to `main`
2. CI builds the Docker image and pushes to `ghcr.io/javid1371/sales-health-check` (`latest` + `<git-sha>`)
3. Deploy: `./scripts/deploy-to-vps.sh <ssh-host> <git-sha>` (or wait for the CI deploy job)

**Allowed on VPS:** `docker compose pull` + restart; rsync only small deploy files (compose, scripts, nginx config).

**Forbidden — never do these for production:**
- `docker build` on the VPS or locally then push to prod
- `docker save` / `docker load` / scp of images
- Local-only image tags (e.g. `system-lead-delay`) as `APP_IMAGE`
- Deploying unmerged local code to production

If code is not on `main` yet, do **not** deploy to production — test locally instead.

See `docs/ops/production-deploy.md` and `scripts/lib/validate-ghcr-image.sh` (enforced by deploy scripts).
