# ADR 0011 — Use EMC Diagnosis Engine v2

## Status

Accepted

## Date

2026-06-27

## Context

Diagnosis v1 uses `WeaknessScore × DomainWeight` to pick top-3 bottlenecks. This ignores question-level evidence, survival-tier overrides, dependency root/symptom separation, and funnel binding constraints.

The EMC spec (`docs/specs/diagnosis-engine-v2-spec.md`) defines a multi-layer rule engine aligned with ADR 0001 (rule-based core).

## Decision

1. Introduce **Diagnosis Engine v2** implementing the EMC spec (layers 0–9).
2. Run **dual-engine** via `ModelVersion.diagnosisEngineVersion` (`"v1"` | `"v2"`), default `"v1"` for existing assessments.
3. v2 output is `StructuredDiagnosis` (see `src/types/structured-diagnosis.ts`).
4. Legacy `Bottleneck` / `Diagnosis` rows are populated via adapter for backward-compatible UI/API.
5. **`health_weighted`** from v2 is a diagnosis/report display metric. It does **not** replace Overall Score (ADR 0002 unchanged).

## Options Considered

1. Big-bang replace v1 — rejected (breaks persisted reports, high rollback risk).
2. Dual-engine on ModelVersion — **accepted** (ADR 0003 compatible).
3. AI-enhanced diagnosis — rejected (ADR 0001, ADR 0006).

## Consequences

### Positive

- Question-level root cause via `issue_root_questions`.
- Survival gate prevents mis-prioritizing growth domains over funnel survival.
- Snapshot-testable against spec worked example.

### Negative / Tradeoffs

- PRD weighted bottleneck formula superseded for **diagnosis priority only** (v1 legacy label retained in docs).
- Constants (R/Q/U/k_T, edge weights) are expert-tuned, not yet calibrated on live data.
- `engine_id` crosswalk must be correct or diagnosis is dangerously wrong.

## Implementation Notes

- Constants: `src/config/model-v1/diagnosis-engine-v2/`
- Engine: `src/modules/diagnosis/v2/`
- Facade: `src/modules/diagnosis/facade.ts`
- Activate v2 by setting `diagnosisEngineVersion: "v2"` on a ModelVersion (see migration runbook).

## Related Documents

- docs/specs/diagnosis-engine-v2-spec.md
- docs/migration/diagnosis-engine-v1-to-v2.md
- docs/adr/0003-use-model-versioning.md
- docs/adr/0002-use-overall-raw-score.md
