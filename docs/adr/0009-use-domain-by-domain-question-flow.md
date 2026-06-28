# ADR 0009 — Use Domain-by-Domain Question Flow

## Status

Accepted

## Date

2026-06-25

## Context

نمایش همه سوالات در یک صفحه می‌تواند سنگین باشد.

نمایش یک سوال در هر صفحه می‌تواند طولانی و خسته‌کننده شود.

## Decision

برای MVP، Question Flow به صورت Domain-by-Domain طراحی می‌شود.

## Consequences

### Positive

- کاربر ساختار Health Check را بهتر می‌فهمد.
- تعداد مراحل کمتر به نظر می‌رسد.
- ذخیره مرحله‌ای پاسخ‌ها ساده‌تر است.

### Negative / Tradeoffs

- بعضی دامنه‌ها ممکن است صفحه طولانی‌تری داشته باشند.

## Implementation Notes

- هر صفحه شامل سوالات یک Domain باشد.
- progress کلی و progress دامنه نمایش داده شود.
- پاسخ‌های هر Domain هنگام رفتن به مرحله بعد ذخیره شوند.

## Related Documents

- docs/architecture/FrontendFlow.md
