# Phase 5 — System Architecture

## هدف این سند

این سند معماری اولیه سیستم Sales Health Check را تعریف می‌کند.

هدف این مرحله این نیست که وارد دیتابیس، API یا کدنویسی شویم.

هدف این است که قبل از ورود به فازهای فنی بعدی، بدانیم سیستم از چه ماژول‌هایی تشکیل می‌شود، هر ماژول چه مسئولیتی دارد و جریان داده در محصول چگونه حرکت می‌کند.

---

# 1. Architecture Principle

اصل معماری این محصول:

Diagnostic First, AI Second

یعنی سیستم نباید از همان ابتدا تصمیم تشخیصی را به AI بسپارد.

AI باید روی خروجی Diagnostic Engine بنشیند، نه جایگزین آن شود.

مسیر اصلی سیستم:

Questions → Answers → Scores → Diagnostic Engine → Report Engine → AI Explanation

---

# 2. Why AI Should Not Be the Core Decision Maker

اگر AI مستقیماً از پاسخ‌های کاربر گزارش بسازد، چند مشکل ایجاد می‌شود:

- خروجی‌ها ناپایدار می‌شوند.
- تست کردن سیستم سخت می‌شود.
- یک کاربر با پاسخ مشابه ممکن است گزارش متفاوت بگیرد.
- دلیل تشخیص‌ها شفاف نیست.
- محصول به جای Diagnostic Product تبدیل به ChatGPT Wrapper می‌شود.

بنابراین تصمیم معماری:

Rule-Based Diagnostic Engine هسته تصمیم‌گیری است.

AI فقط برای توضیح انسانی، شخصی‌سازی متن، لحن، خلاصه‌سازی و تولید گزارش نهایی استفاده می‌شود.

---

# 3. High-Level System Flow

جریان کلی محصول:

1. کاربر وارد Landing Page می‌شود.
2. Health Check را شروع می‌کند.
3. اطلاعات پایه کسب‌وکار را وارد می‌کند.
4. به سوالات Evidence-Based پاسخ می‌دهد.
5. سیستم پاسخ‌ها را ذخیره می‌کند.
6. Scoring Engine امتیازها را محاسبه می‌کند.
7. Diagnostic Engine گلوگاه‌ها و ریشه مشکل را تشخیص می‌دهد.
8. Report Engine گزارش ساختاریافته تولید می‌کند.
9. AI Explanation Layer گزارش را انسانی‌تر و قابل فهم‌تر می‌کند.
10. کاربر صفحه نتیجه را می‌بیند.

---

# 4. Core Modules

## 4.1 Frontend App

مسئولیت‌ها:

- نمایش Landing Page
- دریافت اطلاعات اولیه کاربر
- نمایش فرم سوالات
- مدیریت Progress فرم
- نمایش صفحه نتیجه
- نمایش Spider Chart
- نمایش گزارش نهایی

Frontend نباید منطق اصلی scoring یا diagnosis را نگه دارد.

Frontend فقط داده می‌گیرد و نتیجه را نمایش می‌دهد.

---

## 4.2 Assessment Module

مسئولیت‌ها:

- شروع Assessment
- ایجاد Assessment Session
- نگهداری وضعیت تکمیل فرم
- دریافت پاسخ‌ها
- تشخیص اینکه فرم کامل شده یا نه
- ارسال داده به Scoring Engine

این ماژول مرکز تجربه Health Check است.

---

## 4.3 Question Bank Module

مسئولیت‌ها:

- نگهداری دامنه‌ها
- نگهداری سوالات
- نگهداری گزینه‌ها
- نگهداری امتیاز هر گزینه
- نگهداری ترتیب نمایش سوالات
- نگهداری نسخه مدل سوالات

نکته مهم:

Question Bank باید versioned باشد.

چون ممکن است بعداً سوالات، گزینه‌ها یا وزن‌ها تغییر کنند.

اگر نسخه‌بندی نداشته باشیم، گزارش‌های قدیمی با مدل جدید قاطی می‌شوند.

---

## 4.4 Scoring Engine

مسئولیت‌ها:

- محاسبه امتیاز خام هر دامنه
- محاسبه حداکثر امتیاز هر دامنه
- محاسبه درصد هر دامنه
- محاسبه امتیاز کل خام
- محاسبه حداکثر امتیاز کل
- محاسبه Overall Score
- آماده‌سازی داده برای Spider Chart

قانون مهم:

Overall Score نباید میانگین ساده دامنه‌ها باشد.

Overall Score باید از امتیاز کل واقعی محاسبه شود.

Overall Score = Overall Raw Score / Overall Max Score × 100

---

## 4.5 Diagnostic Engine

مسئولیت‌ها:

- دریافت ۸۰ پاسخ (ماتریس ۱۶×۵) و ثابت‌های مدل
- نرمال‌سازی raw / pct / gap / level
- تحلیل سؤال‌محور، دروازه بقا، گراف ریشه/علامت
- تولید `StructuredDiagnosis` (v2) — see `docs/specs/diagnosis-engine-v2-spec.md`
- (Legacy v1) Weakness × DomainWeight → top 3 bottlenecks

Dual-engine: `ModelVersion.diagnosisEngineVersion` (`v1` | `v2`). See ADR 0011.

**v1 formula (legacy):**

Weakness Score = 100 - Domain Percentage  
Bottleneck Priority Score = Weakness Score × Domain Weight

**v2:** Priority Index (PI), survival gate, binding constraint — spec layer 6–7.

نکته مهم:

Diagnostic Engine باید Rule-Based باشد (ADR 0001).

AI نباید تصمیم بگیرد مشکل اصلی چیست.

Report Engine فقط خروجی diagnosis را روایت می‌کند (ADR 0010).

---

## 4.6 Report Engine

مسئولیت‌ها:

- تبدیل خروجی Diagnostic Engine به گزارش ساختاریافته
- تولید بخش‌های گزارش
- انتخاب متن پایه برای هر وضعیت
- تولید Action Plan هفت‌روزه
- تولید Action Plan سی‌روزه
- آماده‌سازی خروجی برای AI Explanation Layer

Report Engine باید بتواند بدون AI هم یک گزارش پایه تولید کند.

این باعث می‌شود MVP حتی بدون AI هم کار کند.

---

## 4.7 AI Explanation Layer

مسئولیت‌ها:

- انسانی‌تر کردن گزارش
- ساده‌سازی متن برای مدیر SME
- شخصی‌سازی گزارش با توجه به نوع کسب‌وکار
- خلاصه‌سازی گلوگاه‌ها
- تولید نسخه قابل خواندن و حرفه‌ای‌تر از گزارش

AI نباید:

- امتیازها را تغییر دهد.
- گلوگاه اصلی را عوض کند.
- تشخیص Rule Engine را نادیده بگیرد.
- توصیه‌ای خارج از Diagnostic Engine تولید کند.

AI فقط باید توضیح دهد، نه تصمیم بگیرد.

---

## 4.8 Result Dashboard Module

مسئولیت‌ها:

- نمایش امتیاز کلی
- نمایش Spider Chart
- نمایش امتیاز ۱۶ دامنه
- نمایش وضعیت ۴ لایه
- نمایش ۳ گلوگاه اصلی
- نمایش Action Plan
- نمایش گزارش نهایی

---

## 4.9 Admin / Configuration Module

در MVP ممکن است این بخش UI کامل نداشته باشد، اما معماری باید برای آن آماده باشد.

مسئولیت‌های آینده:

- مدیریت سوالات
- مدیریت گزینه‌ها
- مدیریت وزن دامنه‌ها
- مدیریت نسخه مدل
- مدیریت قالب گزارش‌ها
- مدیریت Ruleها

نکته مهم:

وزن‌ها و سوالات نباید به شکل غیرقابل تغییر در کد دفن شوند.

حتی اگر در MVP با فایل config شروع شود، باید از نظر معماری قابل انتقال به دیتابیس باشد.

---

# 5. System Boundaries

## Frontend Boundary

Frontend فقط مسئول تجربه کاربر است.

Frontend نباید مسئول diagnosis باشد.

## Backend Boundary

Backend مسئول منطق محصول است:

- Assessment
- Scoring
- Diagnosis
- Report
- AI Call

## AI Boundary

AI فقط خروجی ساختاریافته سیستم را به زبان انسانی تبدیل می‌کند.

AI نباید منبع حقیقت باشد.

## Data Boundary

داده‌های اصلی باید قابل ذخیره، بازیابی و audit باشند.

این یعنی باید بدانیم هر گزارش بر اساس کدام نسخه سوالات، گزینه‌ها، وزن‌ها و Ruleها ساخته شده است.

---

# 6. Proposed High-Level Architecture

## Layer 1 — Presentation Layer

- Landing Page
- Assessment UI
- Result Dashboard
- Report View

## Layer 2 — Application Layer

- Assessment Service
- Answer Submission Service
- Result Generation Service
- Report Request Service

## Layer 3 — Domain Logic Layer

- Scoring Engine
- Diagnostic Engine
- Report Engine
- Action Plan Engine

## Layer 4 — AI Layer

- AI Explanation Generator
- Prompt Templates
- AI Safety Guardrails

## Layer 5 — Data Layer

- Users
- Organizations
- Assessment Sessions
- Questions
- Options
- Answers
- Scores
- Diagnoses
- Reports
- Model Versions

---

# 7. First Architecture Decision

## Decision

The system will use a Rule-Based Diagnostic Core with an optional AI Explanation Layer.

## Reason

This makes the product:

- قابل تست
- قابل اعتماد
- قابل توسعه
- قابل توضیح
- کمتر وابسته به رفتار ناپایدار AI

## Consequence

قبل از طراحی AI Promptها باید Scoring Engine، Diagnostic Engine و Report Engine مشخص شوند.

---

# 8. Architecture Risks

## Risk 1 — Overengineering

ممکن است از همین ابتدا سیستم را بیش از حد پیچیده کنیم.

Mitigation:

MVP باید با کمترین زیرساخت ممکن ساخته شود، اما مرزهای معماری باید درست باشند.

## Risk 2 — AI Dependency

اگر گزارش بیش از حد وابسته به AI شود، تست و کنترل سخت می‌شود.

Mitigation:

Report Engine باید بدون AI هم خروجی پایه بدهد.

## Risk 3 — Hard-coded Diagnostic Logic

اگر سوالات، وزن‌ها و Ruleها داخل کد دفن شوند، تغییرات بعدی سخت می‌شود.

Mitigation:

در MVP می‌توان از config file شروع کرد، اما ساختار باید آماده انتقال به دیتابیس باشد.

## Risk 4 — No Versioning

اگر نسخه مدل ذخیره نشود، گزارش‌های قدیمی غیرقابل تفسیر می‌شوند.

Mitigation:

هر Assessment باید modelVersion داشته باشد.

---

# 9. Tech Stack Direction — Draft

این تصمیم نهایی نیست، اما جهت اولیه برای MVP:

## Frontend

Next.js

## Backend

Next.js API Routes یا یک Backend ساده Node.js/TypeScript

## Database

PostgreSQL

## ORM

Prisma

## Charts

Recharts یا مشابه آن برای Spider Chart

## AI

OpenAI API برای Explanation Layer

## Deployment

Vercel برای Frontend و API ساده

PostgreSQL Managed Database

نکته:

این Stack باید در ADR جداگانه نهایی شود.

---

# 10. What This Architecture Enables Later

این معماری فقط برای Sales Health Check نیست.

بعداً می‌توان همین ساختار را برای Health Checkهای دیگر استفاده کرد:

- Marketing Health Check
- Finance Health Check
- Operations Health Check
- HR Health Check
- Business System Health Check
- EMC Diagnostic System

چون ساختار اصلی قابل تکرار است:

Question Bank → Scoring Engine → Diagnostic Engine → Report Engine → AI Explanation

---

# 11. Definition of Done for Phase 5

Phase 5 زمانی Done است که:

- ماژول‌های اصلی سیستم مشخص شده باشند.
- مسئولیت هر ماژول روشن باشد.
- مرز AI و Rule Engine مشخص باشد.
- جریان داده از پاسخ تا گزارش مشخص باشد.
- ریسک‌های معماری ثبت شده باشند.
- Tech Stack اولیه پیشنهاد شده باشد.
- آماده ورود به Phase 6 — Domain & Data Model باشیم.

---

# 12. Next Phase

Phase 6 — Domain & Data Model

در فاز بعدی باید موجودیت‌های اصلی را طراحی کنیم:

- User
- Organization
- Assessment
- AssessmentSession
- Question
- QuestionOption
- Domain
- Answer
- Score
- Diagnosis
- Report
- ActionPlan
- ModelVersion