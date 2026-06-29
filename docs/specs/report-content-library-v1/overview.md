# Sales Health Check — Report Content Library v1

> این صفحه نسخه‌ی نهایی **Report Content Library v1** برای Sales Health Check است. هدف این صفحه این است که Cursor بتواند موتور گزارش را بدون حدس، بدون AI و با متن‌های قطعی پیاده‌سازی کند.

## هدف

این کتابخانه بین **Diagnosis Engine** و **Report Engine** قرار می‌گیرد.

```
Assessment Question Bank → Diagnosis Engine → Report Content Library → Report Engine
```

## قاعده اصلی استفاده در Cursor

- فیلدهای داخلی مثل `internal_diagnosis` نباید مستقیم به کاربر نمایش داده شوند.
- گزارش کاربر فقط باید از فیلدهای public استفاده کند.
- موتور گزارش نباید تشخیص جدید بسازد؛ فقط خروجی موتور تشخیص را به محتوای آماده وصل کند.
- راهکار کامل فقط برای `quick_win` باز می‌شود؛ باقی اقدامات باید قفل/تیزر باشند.

## ساختار دیتابیس

دیتابیس **Report Content Library — Domain Bundles** به‌صورت **Domain Bundle** طراحی شده است: هر ردیف نماینده‌ی یک دامنه از مدل ۱۶ دامنه‌ای است و داخل همان ردیف، سؤال‌ها، گزینه‌ها، منطق نمایش ریشه، تفسیر سطح و اقدام اصلاحی ذخیره می‌شود.

- Snapshot رسمی داخل ریپو: [`domain-bundles.v1.json`](./domain-bundles.v1.json)
- راهنمای پیاده‌سازی Cursor: [`cursor-implementation-guide.md`](./cursor-implementation-guide.md)

## قرارداد نمایش ریشه در گزارش

```
نشانه → شاهد از پاسخ کاربر → ریشه قابل‌فهم → اثر روی فروش → اقدام قفل‌شده یا برد سریع
```

## قرارداد فیلدهای public/internal

```
internal_*  = مخصوص موتور، QA، کارشناس و دیباگ
public_*    = مجاز برای نمایش به مخاطب
locked_*    = تیزر راهکار، نه راهکار کامل
```

## منبع Notion (مرجع)

- صفحه Library: [Sales Health Check — Report Content Library v1](https://app.notion.com/p/8a472c052d3242fcbf7e68c4921ecdf6)
- دیتابیس Domain Bundles: [Report Content Library — Domain Bundles](https://app.notion.com/p/32af24eade0544d092052dc8c7b4f75d)
- راهنمای Cursor: [Cursor Implementation Guide — Report Content Library v1](https://app.notion.com/p/47c733bfa68d43d9a9de581b5f88284c)

_Snapshot date: 2026-06-29_
