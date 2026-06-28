# ADR 0006 — AI Explanation Layer Must Not Override Diagnosis

## Status

Accepted

## Date

2026-06-25

## Context

AI برای توضیح و انسانی‌تر کردن گزارش مفید است، اما اگر اجازه داشته باشد diagnosis را تغییر دهد، محصول غیرقابل اعتماد می‌شود.

## Decision

AI فقط مجاز است خروجی Diagnostic Engine را توضیح دهد.

AI مجاز نیست:

- امتیازها را تغییر دهد.
- Bottleneckها را تغییر دهد.
- Diagnosis را override کند.
- توصیه‌ای خارج از ساختار Report Engine تولید کند.

## Consequences

### Positive

- خروجی سیستم کنترل‌شده‌تر است.
- اعتمادپذیری افزایش پیدا می‌کند.
- تست کردن محصول ساده‌تر می‌شود.

### Negative / Tradeoffs

- آزادی AI محدود می‌شود.
- برای متن‌های خیلی خلاقانه ممکن است نیاز به prompt دقیق‌تر باشد.

## Implementation Notes

- AI prompt باید structuredReport را بگیرد.
- AI output باید validate شود.
- اگر AI fail شد، Rule-Based Report باید نمایش داده شود.

## Related Documents

- docs/architecture/SystemArchitecture.md
- src/modules/ai/
