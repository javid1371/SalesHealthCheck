# MVP QA Run Log

| Field | Value |
|-------|-------|
| **Date** | 2026-06-27 |
| **Environment** | Localhost — `npm run` against Docker PostgreSQL (`localhost:5432`) |
| **App version** | `0.1.0` (commit at time of run) |
| **Database** | Migrations applied (`prisma migrate deploy`), seed present (80 questions, ModelVersion 1.0.0) |
| **Tester** | Automated integration suite + build gate |

## Automated gates

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Unit tests | `npm test` | **PASS** | 72/72 tests (14 files) |
| Lint | `npm run lint` | **PASS** | 0 errors (9 pre-existing warnings) |
| Production build | `npm run build` | **PASS** | Next.js 16.2.9, TypeScript clean; includes `/report/[id]/print` and PDF API |

Integration coverage: `src/tests/integration/mvp-qa.integration.test.ts`  
Optional HTTP runner (requires `npm run start`): `node scripts/run-mvp-qa.mjs`

## Scenario results

Reference: [MVP-Manual-Test-Scenarios.md](./MVP-Manual-Test-Scenarios.md)

| # | Scenario | Result | Method | Notes |
|---|----------|--------|--------|-------|
| 1 | Full completion | **PASS** | Integration | Finish → `completed`; ≥3 bottlenecks; overall score; detailed report with `reportSpec` and domain breakdown |
| 2 | Incomplete assessment | **PASS** | Integration | 3/16 domains answered → `finishAssessment` throws `400 assessment_not_complete` |
| 3 | Change answer before finish | **PASS** | Integration | Re-saved answer on domain 1 → finish succeeds; domain score present in result |
| 4 | Revisit with token | **PASS** | Integration | Two `getAssessmentResult` calls with same token → identical `reportId` and overall score |
| 5 | Idempotent finish | **PASS** | Integration | Second `finishAssessment` returns same `reportId`; no duplicate report |
| 6 | CTA lead form | **PASS** | Integration | `submitConsultationRequest` → row in `consultation_requests` with correct `assessmentSessionId` |
| 7 | Email recovery | — | Manual | See [Scenario 7](./MVP-Manual-Test-Scenarios.md#scenario-7--email-recovery) |
| 8 | PDF download / print | — | Manual | See [Scenario 8](./MVP-Manual-Test-Scenarios.md#scenario-8--pdf-download-and-print-layout); requires `PDF_GENERATION_ENABLED=true` |

### Critical scenarios (plan emphasis)

| Scenario | Status |
|----------|--------|
| 4 — Revisit token | PASS |
| 5 — Idempotent finish | PASS |
| 2 — Incomplete block | PASS |

### UI / browser checklist (not run this session)

These items require manual browser verification on staging VPS before production soft launch:

- [ ] Scenario 1: Spider chart renders on result dashboard
- [ ] Scenario 1: Review page shows 16/16 before finish
- [ ] Scenario 2: Review UI disables Finish when incomplete
- [ ] Scenario 3: Spider chart visually reflects changed domain
- [ ] Scenario 4: Incognito paste of result URL loads without sessionStorage
- [ ] Scenario 6: CTA form submission from `/assessment/:id/cta` or report page
- [ ] Scenario 7: Email recovery flow and rate limit (429 on 4th request)
- [ ] Scenario 8: Print page preview at `/report/{id}/print?token=` — RTL, expanded domains, semantic gauge bar
- [ ] Scenario 8: PDF download from result + report pages; charts not blank in viewer

## Bugs found and fixed during this run

| ID | Severity | Description | Fix |
|----|----------|-------------|-----|
| QA-001 | **Blocker** | `npm run build` failed — `family.engineIds.includes(domain.engineId)` type error in `outputs.ts` (`number` not assignable to `never` on `as const` tuple) | Use `.some((id) => id === domain.engineId)` in `src/modules/diagnosis/v2/layers/outputs.ts` |

## Summary

**Phase 1 QA + build gate: PASS** for backend/API flows and production build.  
**Follow-up:** Run browser checklist above on staging VPS after Item 3 deploy (HTTPS + Caddy).
