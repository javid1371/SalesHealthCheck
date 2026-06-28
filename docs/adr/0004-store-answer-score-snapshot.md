# ADR 0004 — Store Answer Score Snapshot

## Status

Accepted

## Date

2026-06-25

## Context

اگر فقط selectedOptionId ذخیره شود و بعداً score آن option تغییر کند، نتیجه Assessment قدیمی ممکن است تغییر کند.

## Decision

Answer باید score انتخاب‌شده را همان لحظه ذخیره کند.

## Consequences

### Positive

- گزارش‌های قبلی پایدار می‌مانند.
- audit کردن نتایج آسان‌تر می‌شود.

### Negative / Tradeoffs

- کمی داده تکراری ذخیره می‌شود.

## Implementation Notes

- Frontend نباید score ارسال کند.
- Backend score را از QuestionOption می‌خواند و در Answer ذخیره می‌کند.

## Related Documents

- docs/architecture/DomainDataModel.md
- docs/api/APIDesign.md
