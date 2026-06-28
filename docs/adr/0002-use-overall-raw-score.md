# ADR 0002 — Use Overall Raw Score Instead of Domain Average

## Status

Accepted

## Date

2026-06-25

## Context

در Health Check، دامنه‌ها ممکن است تعداد سوالات برابر نداشته باشند.

اگر Overall Score را با میانگین ساده درصد دامنه‌ها بسنجیم، ممکن است تصویر غلطی از وضعیت کلی ایجاد شود.

## Decision

Overall Score باید با عدد کل محاسبه شود:

Overall Score = Overall Raw Score / Overall Max Score × 100

نه میانگین ساده Domain Percentageها.

## Consequences

### Positive

- امتیاز کلی دقیق‌تر است.
- اگر تعداد سوالات دامنه‌ها متفاوت باشد، خطای میانگین‌گیری کمتر می‌شود.
- محاسبه قابل audit است.

### Negative / Tradeoffs

- برای نمایش دامنه‌ای همچنان باید درصد دامنه‌ها جدا محاسبه شوند.

## Implementation Notes

- OverallScore باید جدا ذخیره شود.
- Scoring Engine نباید میانگین ساده دامنه‌ها را به عنوان امتیاز کلی برگرداند.

## Related Documents

- docs/architecture/DomainDataModel.md
- src/modules/scoring/
