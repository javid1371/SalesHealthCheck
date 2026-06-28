# Diagnosis Engine v2 — Machine-Readable Constants

Companion to [`diagnosis-engine-v2-spec.md`](./diagnosis-engine-v2-spec.md).  
Implementation source of truth: `src/config/model-v1/diagnosis-engine-v2/`.

## Domain crosswalk (DB displayOrder → engine_id)

| DB # | Slug | engine_id | Vitality tier |
| --- | --- | --- | --- |
| 1 | persona | 2 | foundation |
| 2 | uvp | 3 | foundation |
| 3 | offer-design | 4 | foundation |
| 4 | lead-generation | 5 | survival |
| 5 | lead-nurturing | 6 | growth |
| 6 | speed-to-lead | 7 | survival |
| 7 | lead-qualification | 8 | engine |
| 8 | initial-trust | 9 | engine |
| 9 | needs-discovery | 10 | engine |
| 10 | presentation | 11 | engine |
| 11 | objection-handling | 12 | engine |
| 12 | closing | 13 | survival |
| 13 | loyalty | 14 | growth |
| 14 | touchpoint-consistency | 15 | growth |
| 15 | sales-journey-clarity | 1 | foundation |
| 16 | measurement-optimization | 16 | foundation |

## Domain constants (engine_id)

| engine_id | R | Q | U | k_T | tier |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 2 | 3 | 1.3 | foundation |
| 2 | 2 | 2 | 3 | 1.3 | foundation |
| 3 | 2 | 2 | 3 | 1.3 | foundation |
| 4 | 3 | 2 | 2 | 1.3 | foundation |
| 5 | 2 | 1 | 1 | 1.6 | survival |
| 6 | 2 | 2 | 2 | 0.7 | growth |
| 7 | 3 | 3 | 3 | 1.6 | survival |
| 8 | 2 | 2 | 3 | 1.0 | engine |
| 9 | 2 | 2 | 1 | 1.0 | engine |
| 10 | 3 | 2 | 1 | 1.0 | engine |
| 11 | 3 | 2 | 1 | 1.0 | engine |
| 12 | 3 | 2 | 1 | 1.0 | engine |
| 13 | 3 | 3 | 1 | 1.6 | survival |
| 14 | 2 | 2 | 1 | 0.7 | growth |
| 15 | 2 | 1 | 2 | 0.7 | growth |
| 16 | 1 | 2 | 3 | 1.3 | foundation |

**W formula:** `W = k_T × (0.45×R + 0.30×Q + 0.25×U)`

## Survival domains (engine_id)

`5` (lead-generation), `7` (speed-to-lead), `13` (closing)

## Flow order (binding constraint)

engine_id: `5 → 7 → 8 → 9 → 10 → 11 → 12 → 13`

## Gate questions (DB domain.question)

| DB key | engine_id.question |
| --- | --- |
| 4.5 | 5.5 |
| 6.1 | 7.1 |
| 6.4 | 7.4 |
| 12.2 | 13.2 |
| 9.1 | 10.1 |
| 16.2 | 16.2 |

## Weighted dependency edges (root → symptom)

See `src/config/model-v1/diagnosis-engine-v2/dependencies.ts`.

## Thresholds

| Parameter | Value |
| --- | --- |
| weak | pct ≤ 0.40 (raw ≤ 6) |
| survival RED | pct ≤ 0.20 |
| survival AMBER | pct ≤ 0.40 |
| quick win | raw ≤ 9 and Q = 3 |
| pattern P pervasive | 1.25 |
| constraint bonus C | 0.5 × gap |
