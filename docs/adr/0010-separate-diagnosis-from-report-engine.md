# ADR 0010 — Separate Diagnosis Engine from Report Engine

## Status

Accepted

## Date

2026-06-27

## Context

The MVP initially combined bottleneck detection, diagnosis text selection, and report narrative in overlapping modules (`diagnosis.engine.ts`, `report.builder.ts`, `analysis-context.ts`). This makes future diagnosis improvements risky because report changes can accidentally alter diagnostic decisions.

The EMC Diagnosis Engine v2 spec requires a strict boundary: diagnosis decides *what* is wrong; report decides *how* to say it.

## Decision

1. **Diagnosis Engine** (`src/modules/diagnosis/`) produces a structured, rule-based `StructuredDiagnosis` object. No marketing copy, no template selection for user-facing narrative.
2. **Report Engine** (`src/modules/report/`) consumes `StructuredDiagnosis` + scores + model text templates. It must not compute bottlenecks, root/symptom classification, survival gates, or priority ranking.
3. `analysis-context.ts` diagnostic metadata assembly moves into diagnosis output; report may only format it.

## Options Considered

1. Keep diagnosis logic inside report builder — rejected (hard to test, violates ADR 0001 intent).
2. Full separation with structured contract — **accepted**.
3. AI decides diagnosis in report layer — rejected (conflicts with ADR 0001, ADR 0006).

## Consequences

### Positive

- Diagnosis v2 can evolve without breaking report templates.
- Pure functions are fully unit-testable.
- Clear audit trail: persisted `structuredDiagnosis` JSON.

### Negative / Tradeoffs

- Extra adapter layer during migration (legacy bottlenecks/diagnoses tables).
- Two contracts to maintain briefly (legacy + StructuredDiagnosis).

## Implementation Notes

- `finishAssessment` order: scoring → diagnosis → report → persist.
- Report builder input must include `structuredDiagnosis` when engine version is v2.
- See `docs/specs/diagnosis-engine-v2-spec.md` for output contract.

## Related Documents

- docs/adr/0001-use-rule-based-diagnostic-core.md
- docs/adr/0011-use-emc-diagnosis-engine-v2.md
- docs/specs/diagnosis-engine-v2-spec.md
