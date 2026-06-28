# ADR 0001 — Use Rule-Based Diagnostic Core

## Status

Accepted

## Date

2026-06-25

## Context

Sales Health Check باید یک ابزار تشخیصی قابل اعتماد باشد، نه فقط یک فرم که خروجی آن توسط AI حدس زده می‌شود.

اگر AI مستقیماً از پاسخ‌ها تشخیص بسازد، خروجی‌ها ممکن است ناپایدار، غیرقابل تست و غیرقابل audit شوند.

## Decision

هسته تشخیص سیستم باید Rule-Based باشد.

AI فقط بعد از تولید تشخیص، برای توضیح انسانی و شخصی‌سازی متن استفاده می‌شود.

## Options Considered

1. AI تشخیص را مستقیماً تولید کند.
2. Rule Engine تشخیص را تولید کند و AI فقط توضیح دهد.
3. ترکیب مبهمی از AI و Ruleها استفاده شود.

## Consequences

### Positive

- خروجی قابل تست می‌شود.
- تشخیص‌ها قابل توضیح می‌شوند.
- وابستگی به ناپایداری AI کاهش پیدا می‌کند.
- محصول از ChatGPT Wrapper فاصله می‌گیرد.

### Negative / Tradeoffs

- طراحی Rule Engine زمان بیشتری می‌برد.
- نیاز به نگهداری Ruleها وجود دارد.

## Implementation Notes

- Diagnostic Engine باید بدون AI کار کند.
- AI module نباید diagnosis را تغییر دهد.
- report باید حتی بدون AI قابل تولید باشد.

## Related Documents

- docs/prd/PRD01.md
- docs/architecture/SystemArchitecture.md
