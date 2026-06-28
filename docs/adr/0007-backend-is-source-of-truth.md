# ADR 0007 — Backend is Source of Truth

## Status

Accepted

## Date

2026-06-25

## Context

Frontend می‌تواند در معرض دستکاری یا خطا باشد.

اگر score یا diagnosis در Frontend انجام شود، امنیت و صحت سیستم کاهش پیدا می‌کند.

## Decision

Backend منبع حقیقت برای scoring، diagnosis، report generation و model versioning است.

## Consequences

### Positive

- منطق محصول امن‌تر است.
- نتایج قابل اعتمادتر هستند.
- تست و audit ساده‌تر می‌شود.

### Negative / Tradeoffs

- Backend مسئولیت بیشتری دارد.

## Implementation Notes

- Frontend فقط selectedOptionId ارسال می‌کند.
- Backend score را محاسبه و ذخیره می‌کند.
- Diagnostic Engine در Backend اجرا می‌شود.

## Related Documents

- docs/api/APIDesign.md
- docs/architecture/FrontendFlow.md
