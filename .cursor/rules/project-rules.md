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

## ADR Rule

If a proposed implementation conflicts with an ADR, stop and ask for a new ADR before changing the architecture.
