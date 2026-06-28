# ADR 0008 — Report Must Persist

## Status

Accepted

## Date

2026-06-25

## Context

اگر گزارش هر بار از صفر تولید شود، تغییر در Report Engine یا AI می‌تواند خروجی کاربر را عوض کند.

## Decision

گزارش نهایی باید در دیتابیس ذخیره شود.

## Consequences

### Positive

- گزارش کاربر پایدار می‌ماند.
- لینک گزارش قابل استفاده است.
- تغییرات آینده گزارش‌های قبلی را خراب نمی‌کند.

### Negative / Tradeoffs

- داده بیشتری ذخیره می‌شود.
- نیاز به مدیریت reportStatus داریم.

## Implementation Notes

- structuredReport ذخیره شود.
- aiGeneratedText اگر تولید شد ذخیره شود.
- reportStatus مشخص باشد.

## Related Documents

- docs/architecture/DomainDataModel.md
- src/modules/report/
