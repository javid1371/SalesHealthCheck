# ADR 0013 — Report Engine v1

## Status

Accepted

## Date

2026-06-27

## Context

ADR 0010 separated the Diagnosis Engine (decides *what* is wrong) from the Report Engine (decides *how* to say it), and ADR 0011 introduced Diagnosis Engine v2 producing `StructuredDiagnosis`. The current `src/modules/report/report.builder.ts` is an MVP narrator that predates the v2 contract.

The Report Engine v1 spec (`docs/specs/report-engine-v1-spec.md`) defines a deterministic, AI-free, template-driven engine that consumes `StructuredDiagnosis` plus four optional business numbers (R0/AOV/L/RP) and emits an in-app report which is itself a sales funnel: free diagnosis up front, paid treatment (full plan + AI layer) behind a wall.

This requires architectural decisions beyond ADR 0010/0011, and Report Engine v1 mandates that the active `ModelVersion` runs Diagnosis v2 (in v1 mode `structuredDiagnosis` is never produced — `src/modules/diagnosis/facade.ts`). Activating v2 in seed conflicts with ADR 0011's documented default of `"v1"`, so this is recorded here.

## Decision

1. **Introduce Report Engine v1** in `src/modules/report/` as deterministic, AI-free, template-driven sub-modules:
   - **Composer** (pure): `StructuredDiagnosis + valueAtStake? + answers[] + capacityMode + contentLibrary → ReportSpec`. Decides which blocks, ordering, tone, and disclosure level.
   - **Renderer/Narrator**: `ReportSpec → view-model` for UI (and shared source for future PDF). No selection logic.
   - **Value-at-Stake** (pure): computes loss/recoverable potential from diagnosis + four business numbers; returns `null` on incomplete input (never a wrong number).
   - **Expert View** (pure): internal sales view (lead score + suggested offer).
2. **`ReportSpec`** (`src/types/report-spec.ts`) is the intermediate contract between Composer and Renderer. The golden rule of separation: content *selection* is the Composer's job; *sentence-building/render* is the Renderer's.
3. **The Report Engine makes no diagnostic decisions.** No bottleneck, root/symptom, survival, or priority logic is reproduced here. Domain↔lever mapping uses only `engine_id` from `src/config/model-v1/diagnosis-engine-v2/domain-crosswalk.ts`.
4. **`capacity_mode`** comes from env (default `free`) and drives CTA routing and disclosure; it is not a diagnostic input.
5. **Activate Diagnosis v2** for the active `ModelVersion` in `prisma/seed.ts` (`diagnosisEngineVersion: "v2"`), which is the precondition for the Report Engine. This **supersedes the default of `"v1"`** documented in ADR 0011 for the seeded model version (the dual-engine mechanism itself is unchanged).
6. **v1 is fully deterministic and snapshot-testable.** Tier 2/3 value remains qualitative in v1. AI layer, PDF output, benchmark data, and Action Library are out of scope (deferred).
7. **Migration safety:** keep the current `structuredReport` output alongside the new `reportSpec` during the migration window (ADR 0008 immutability unchanged).

## Options Considered

1. Extend the existing MVP `report.builder.ts` in place — rejected (mixes selection with rendering, not snapshot-testable, can't track disclosure/funnel logic cleanly).
2. Composer/Renderer split with `ReportSpec` contract + separate Value-at-Stake and Expert View — **accepted**.
3. Let an AI layer compose the report in v1 — rejected (ADR 0001, ADR 0006; also breaks determinism and the free/paid boundary).
4. Keep Diagnosis v1 and adapt report to legacy tables — rejected (Report Engine v1 requires `StructuredDiagnosis`).

## Consequences

### Positive

- Same input always yields the same report (snapshot-testable, auditable).
- Tone/template/medium (app vs PDF) can change without touching selection logic.
- The architectural boundary (diagnosis/treatment) cleanly matches the commercial boundary (free/paid).
- Value-at-Stake never invents numbers; missing metrics degrade gracefully.

### Negative / Tradeoffs

- Re-seeding dev DB to activate v2 wipes existing dev data.
- Prisma migration required on existing environments (business metrics + `reportSpec`).
- Two report contracts maintained briefly (legacy `structuredReport` + `reportSpec`).
- Snapshot tests must be locked only after templates stabilize, or selection logic changes will churn them.

## Implementation Notes

- Precondition: active `ModelVersion.diagnosisEngineVersion = "v2"` (set in `prisma/seed.ts`). Re-seed dev: `npm run db:seed` (after `npx prisma migrate reset` if a clean dev DB is needed).
- `finishAssessment` order stays deterministic: scoring → diagnosis → (value, if metrics present) → compose → persist. Any change to `finishAssessment` must include tests (project Testing Rule).
- Modules live in `src/modules/report/`; pure functions are unit/snapshot tested under `src/tests/report/`.
- Domain↔lever mapping only via `domain-crosswalk.ts`; never build a new mapping.

## Related Documents

- docs/specs/report-engine-v1-spec.md
- docs/specs/diagnosis-engine-v2-spec.md
- docs/adr/0010-separate-diagnosis-from-report-engine.md
- docs/adr/0011-use-emc-diagnosis-engine-v2.md
- docs/adr/0012-persist-structured-diagnosis-payload.md
- docs/adr/0008-report-must-persist.md
- docs/migration/diagnosis-engine-v1-to-v2.md
