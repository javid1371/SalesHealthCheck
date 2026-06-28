# ADR 0005 — Use Modular Monolith for MVP

## Status

Accepted

## Date

2026-06-25

## Context

پروژه در مرحله MVP است.

Microservices در این مرحله پیچیدگی غیرضروری ایجاد می‌کند.

از طرف دیگر، یک اپلیکیشن نامنظم و شلوغ هم باعث می‌شود Cursor و توسعه بعدی گیج شوند.

## Decision

برای MVP از Modular Monolith استفاده می‌کنیم.

یک اپلیکیشن واحد، اما با module boundaries روشن.

## Consequences

### Positive

- توسعه سریع‌تر است.
- deployment ساده‌تر است.
- برای Cursor قابل فهم‌تر است.
- ماژول‌های اصلی جدا می‌مانند.

### Negative / Tradeoffs

- اگر محصول خیلی بزرگ شود، بعداً شاید نیاز به جداسازی سرویس‌ها باشد.

## Implementation Notes

- logicهای اصلی باید در src/modules باشند.
- route.ts باید نازک بماند.
- scoring و diagnosis نباید داخل UI نوشته شوند.

## Related Documents

- docs/architecture/RepositoryArchitecture.md
