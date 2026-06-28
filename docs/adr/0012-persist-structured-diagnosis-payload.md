# ADR 0012 — Persist Structured Diagnosis Payload

## Status

Accepted

## Date

2026-06-27

## Context

Diagnosis v1 persists normalized rows (`bottlenecks`, `diagnoses`) but not the full rule-engine output. v2 produces a rich `StructuredDiagnosis` object required for audit, report generation, and future calibration.

Reports are immutable (ADR 0008); diagnosis output at finish time must be stored alongside scores and report JSON.

## Decision

1. Add `assessment_sessions.structured_diagnosis` (JSON, nullable) for the full v2 payload.
2. When `diagnosisEngineVersion` is `"v2"`, always persist `structuredDiagnosis` at finish.
3. When `"v1"`, field remains `null`; legacy tables remain source of truth.
4. Report `structured_report` may include a derived `diagnosisSummary` for display; it must not be recomputed on read.

## Options Considered

1. Embed only in `reports.structured_report` — rejected (mixes diagnosis with narrative, harder to query).
2. Dedicated JSON column on session — **accepted**.
3. New `diagnosis_snapshots` table — deferred (JSON column sufficient for MVP).

## Consequences

### Positive

- Full audit trail for v2 assessments.
- Report engine reads stable snapshot, not live rules.
- Enables diffing rule changes against historical assessments.

### Negative / Tradeoffs

- Larger row size per completed assessment.
- Prisma migration required.

## Implementation Notes

- Set in `persistAssessmentResults` inside the finish transaction.
- Never update `structuredDiagnosis` after session is completed.

## Related Documents

- docs/adr/0008-report-must-persist.md
- docs/adr/0011-use-emc-diagnosis-engine-v2.md
- docs/architecture/DatabaseSchema.md
