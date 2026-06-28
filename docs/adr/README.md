# Phase 10 — ADR System

## هدف این سند

این سند سیستم ADR پروژه Sales Health Check را تعریف می‌کند.

ADR یعنی Architecture Decision Record.

هدف ADR این است که تصمیم‌های مهم معماری و محصولی در چت، ذهن یا فایل‌های پراکنده گم نشوند.

هر تصمیم مهم باید ثبت شود:

- چه تصمیمی گرفتیم؟
- چرا گرفتیم؟
- چه گزینه‌هایی داشتیم؟
- پیامدهای این تصمیم چیست؟
- آیا این تصمیم قطعی است یا بعداً قابل تغییر است؟

---

# 1. Why ADR Matters

وقتی پروژه با AI و Cursor ساخته می‌شود، خطر اصلی این است که AI هر بار بر اساس context ناقص تصمیم جدید بگیرد.

ADR کمک می‌کند:

- تصمیم‌ها ثابت بمانند.
- Cursor بداند چرا معماری این‌طور طراحی شده است.
- در آینده خودمان بدانیم چرا یک مسیر انتخاب شد.
- تصمیم‌های قبلی بدون دلیل شکسته نشوند.
- پروژه از vibe coding به software engineering نزدیک شود.

---

# 2. ADR Principle

هر تصمیم مهم باید کوتاه، روشن و قابل استفاده باشد.

ADR نباید مقاله طولانی باشد.

ADR باید به اندازه‌ای باشد که یک انسان یا AI در چند دقیقه بفهمد:

- تصمیم چیست؟
- چرا مهم است؟
- چه کاری مجاز است و چه کاری مجاز نیست؟

---

# 3. ADR Folder Location

در repository، ADRها باید اینجا قرار بگیرند:

```
docs/adr/
```

نام فایل‌ها باید شماره‌دار باشند:

```
0001-use-rule-based-diagnostic-core.md
0002-use-overall-raw-score.md
0003-use-model-versioning.md
0004-use-modular-monolith.md
0005-ai-explanation-layer-only.md
```

---

# 4. ADR Statuses

هر ADR باید status داشته باشد.

## Proposed

تصمیم پیشنهاد شده، اما هنوز نهایی نیست.

## Accepted

تصمیم پذیرفته شده و باید در پروژه رعایت شود.

## Superseded

تصمیم قبلی با تصمیم جدید جایگزین شده است.

## Deprecated

تصمیم دیگر توصیه نمی‌شود، اما شاید هنوز در بخشی از سیستم وجود داشته باشد.

---

# 5. ADR Template

هر ADR باید ساختار زیر را داشته باشد:

```markdown
# ADR 000X — Title

## Status

Accepted / Proposed / Superseded / Deprecated

## Date

YYYY-MM-DD

## Context

چه مسئله‌ای داشتیم؟
چرا لازم بود تصمیم بگیریم؟

## Decision

چه تصمیمی گرفتیم؟

## Options Considered

1. Option A
2. Option B
3. Option C

## Consequences

### Positive

- پیامد مثبت اول
- پیامد مثبت دوم

### Negative / Tradeoffs

- هزینه یا محدودیت اول
- هزینه یا محدودیت دوم

## Implementation Notes

این تصمیم در کدام بخش‌ها باید رعایت شود؟

## Related Documents

- PRD
- System Architecture
- Data Model
- API Design
```

---

# 6. First Required ADRs

برای این پروژه، ADRهای اولیه باید این‌ها باشند:

1. ADR 0001 — Use Rule-Based Diagnostic Core
2. ADR 0002 — Use Overall Raw Score Instead of Domain Average
3. ADR 0003 — Use ModelVersion for Assessment Stability
4. ADR 0004 — Store Answer Score Snapshot
5. ADR 0005 — Use Modular Monolith for MVP
6. ADR 0006 — AI Explanation Layer Must Not Override Diagnosis
7. ADR 0007 — Backend is Source of Truth
8. ADR 0008 — Report Must Persist
9. ADR 0009 — Use Domain-by-Domain Question Flow
10. ADR 0010 — Separate Diagnosis Engine from Report Engine
11. ADR 0011 — Use EMC Diagnosis Engine v2
12. ADR 0012 — Persist Structured Diagnosis Payload

---

# 7. ADR 0001 — Use Rule-Based Diagnostic Core

## Status

Accepted

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

## Decision Chosen

Option 2

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

---

# 8. ADR 0002 — Use Overall Raw Score Instead of Domain Average

## Status

Accepted

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

---

# 9. ADR 0003 — Use ModelVersion for Assessment Stability

## Status

Accepted

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

---

# 10. ADR 0004 — Store Answer Score Snapshot

## Status

Accepted

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

---

# 11. ADR 0005 — Use Modular Monolith for MVP

## Status

Accepted

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

---

# 12. ADR 0006 — AI Explanation Layer Must Not Override Diagnosis

## Status

Accepted

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

---

# 13. ADR 0007 — Backend is Source of Truth

## Status

Accepted

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

---

# 14. ADR 0008 — Report Must Persist

## Status

Accepted

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

---

# 15. ADR 0009 — Use Domain-by-Domain Question Flow

## Status

Accepted

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

---

# 16. When to Create a New ADR

هر وقت یکی از این موارد رخ داد، باید ADR جدید ساخته شود:

- انتخاب یا تغییر Tech Stack
- تغییر در Scoring Logic
- تغییر در Diagnostic Engine
- تغییر در Role of AI
- تغییر در Data Model مهم
- تغییر در Authentication Strategy
- تغییر در Deployment Strategy
- تغییر در Repository Architecture
- تغییر در MVP Scope

---

# 17. ADR Rules for Cursor

وقتی با Cursor کار می‌کنیم:

1. قبل از تغییر معماری، ADRهای موجود را بخوان.
2. اگر تغییر با ADR موجود تناقض دارد، بدون ثبت ADR جدید تغییر نده.
3. اگر AI پیشنهاد کرد scoring را داخل UI بنویسد، رد کن.
4. اگر AI پیشنهاد کرد diagnosis را به prompt بسپارد، رد کن.
5. اگر تصمیم جدید مهم است، اول ADR بساز.

---

# 18. Definition of Done for Phase 10

Phase 10 زمانی Done است که:

- ADR template تعریف شده باشد.
- ADRهای اولیه پروژه ثبت شده باشند.
- قوانین استفاده از ADR مشخص شده باشند.
- Cursor بداند تصمیم‌های معماری باید از ADRها پیروی کنند.
- آماده ورود به Phase 11 — Cursor Execution Setup باشیم.

---

# 19. Next Phase

Phase 11 — Cursor Execution Setup

در فاز بعد باید Cursor Rules، AI Engineer Prompts، Definition of Done و Code Review Checklist را آماده کنیم.