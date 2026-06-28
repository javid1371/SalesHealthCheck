# Migration Runbook — Diagnosis Engine v1 → v2

## Overview

Safe dual-engine rollout per ADR 0011. Default remains v1 until explicitly enabled on a ModelVersion.

## Pre-flight checklist

- [ ] All tests pass: `npm test`
- [ ] Snapshot test passes: `src/tests/diagnosis/v2/snapshot.example.test.ts`
- [ ] Crosswalk validated against `domainsV1` displayOrder
- [ ] Gate questions validated against CSV

## Phase A — Deploy code (v1 default)

1. Deploy application with v2 engine code but `ModelVersion.diagnosisEngineVersion = "v1"` for all versions.
2. Verify existing finish flow unchanged.
3. Completed assessments remain immutable.

## Phase B — Staging validation (v2)

1. Create or update a staging ModelVersion with `diagnosisEngineVersion: "v2"`.
2. Run full assessment (80 questions) on staging.
3. Verify:
   - `assessment_sessions.structured_diagnosis` populated
   - Legacy bottlenecks/diagnoses populated via adapter
   - Report renders with `diagnosisSummary`
   - Snapshot example numbers match spec

## Phase C — Production enable

1. Set active ModelVersion to `diagnosisEngineVersion: "v2"` **or** activate new model version with v2.
2. New assessments use v2; old completed assessments unchanged.

## Rollback

1. Set `diagnosisEngineVersion: "v1"` on active ModelVersion (seed or admin SQL).
2. Redeploy not required if code supports dual-engine (already deployed).
3. v2-completed assessments keep their stored `structured_diagnosis` — do not delete.

## SQL reference

```sql
-- Check engine version
SELECT id, name, version_number, diagnosis_engine_version FROM model_versions;

-- Rollback active model to v1
UPDATE model_versions SET diagnosis_engine_version = 'v1' WHERE status = 'active';

-- Enable v2 on active model (after QA)
UPDATE model_versions SET diagnosis_engine_version = 'v2' WHERE status = 'active';
```

## QA scenarios

See [`docs/qa/MVP-Manual-Test-Scenarios.md`](../qa/MVP-Manual-Test-Scenarios.md) plus:

1. Complete assessment on v1 model — no `structured_diagnosis`
2. Complete assessment on v2 model — `structured_diagnosis` present
3. Re-finish completed session — idempotent, same report
4. Result API exposes `diagnosisSummary` for v2 only

## Related

- [ADR 0011](../adr/0011-use-emc-diagnosis-engine-v2.md)
- [Spec](../specs/diagnosis-engine-v2-spec.md)
