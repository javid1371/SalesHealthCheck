# Database Schema — Sales Health Check

PostgreSQL schema managed by Prisma. See [`prisma/schema.prisma`](../../prisma/schema.prisma).

## Entity groups

### Identity and session

| Table | Purpose |
|-------|---------|
| `users` | Respondent (name, email, phone) |
| `organizations` | Business info per assessment |
| `assessment_sessions` | One health check run; `result_token` for anonymous access; `structured_diagnosis` JSON (v2 snapshot) |

### Model versioning (Question Bank)

| Table | Purpose |
|-------|---------|
| `model_versions` | Locked version per assessment (v1.0.0 active); `diagnosis_engine_version` (`v1` \| `v2`) |
| `layers` | 4 sales layers |
| `domains` | 16 weighted domains |
| `questions` / `question_options` | Evidence-based questions (score 0–3) |
| `diagnostic_rules` | Rule metadata (future use) |

### Answers and scores

| Table | Purpose |
|-------|---------|
| `answers` | One row per question; `score_snapshot` at answer time |
| `domain_scores` | Computed domain results |
| `layer_scores` | Aggregated layer results |
| `overall_scores` | Overall raw/max/percentage/health |

### Diagnosis and report

| Table | Purpose |
|-------|---------|
| `bottlenecks` | Top 3 priority bottlenecks (legacy v1 shape; v2 via adapter) |
| `diagnoses` | Root-cause diagnoses (legacy v1 shape; v2 via adapter) |
| `action_plans` | 7-day and 30-day actions |
| `reports` | Persisted `structured_report` JSON |

### Leads (CTA)

| Table | Purpose |
|-------|---------|
| `consultation_requests` | CTA form submissions linked to assessment/report |

## Finish flow persistence

When `POST /api/assessments/:id/finish` runs:

1. Validates all answers exist
2. Runs scoring + diagnosis + report builder
3. In one transaction: replaces scores, bottlenecks, diagnoses, action plans; upserts report; sets session `completed`

Reports are idempotent: re-finish on completed session returns existing `reportId`.

## Migrations

- Dev: `npm run db:migrate`
- Production (Docker): `prisma migrate deploy` via entrypoint — never `migrate dev` on server

## Seed

- `npm run db:seed` loads ModelVersion v1 (80 questions from CSV)
- Production seed is **idempotent**: skips if active model with 80+ questions exists
