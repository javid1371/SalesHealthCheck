# ADR 0003 — Use ModelVersion for Assessment Stability

## Status

Accepted

## Date

2026-06-25

## Context

سوالات، گزینه‌ها، وزن‌ها و Ruleهای Health Check ممکن است در آینده تغییر کنند.

اگر هر Assessment به نسخه مشخصی از مدل وصل نباشد، گزارش‌های قدیمی با مدل‌های جدید قاطی می‌شوند.

## Decision

هر AssessmentSession باید به یک ModelVersion مشخص وصل شود.

## Consequences

### Positive

- گزارش‌های قبلی پایدار می‌مانند.
- تغییر مدل، Assessmentهای قبلی را خراب نمی‌کند.
- امکان مقایسه نسخه‌ها در آینده فراهم می‌شود.

### Negative / Tradeoffs

- مدل داده کمی پیچیده‌تر می‌شود.
- seed و مدیریت نسخه‌ها نیاز به دقت دارد.

## Implementation Notes

- Questionها، Optionها، Domainها و Ruleها باید به ModelVersion مرتبط باشند.
- GET questions باید از ModelVersion همان Assessment بخواند.

## Related Documents

- docs/architecture/DomainDataModel.md
- prisma/schema.prisma
