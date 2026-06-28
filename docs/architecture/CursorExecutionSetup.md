# Phase 11 — Cursor Execution Setup

## هدف این سند

این سند تنظیمات اجرایی کار با Cursor را برای پروژه Sales Health Check تعریف می‌کند.

تا اینجا ما محصول، معماری، داده، API، Frontend Flow، Repository Architecture و ADRها را طراحی کرده‌ایم.

حالا باید کاری کنیم که Cursor مثل یک توسعه‌دهنده بی‌نظم عمل نکند، بلکه در چارچوب معماری پروژه حرکت کند.

این فاز شامل این موارد است:

- Cursor Rules
- AI Engineer Prompts
- Definition of Done
- Code Review Checklist
- Development Workflow
- Guardrails

---

# 1. Core Principle

Cursor نباید آزادانه حدس بزند.

Cursor باید بر اساس اسناد پروژه کار کند.

قبل از هر پیاده‌سازی، Cursor باید بداند:

- MVP Scope چیست.
- معماری سیستم چیست.
- کدام ADRها باید رعایت شوند.
- Scoring و Diagnosis کجا قرار دارند.
- AI چه کاری مجاز است و چه کاری مجاز نیست.

---

# 2. Cursor Operating Mode

برای این پروژه، Cursor باید در نقش‌های زیر کار کند:

## AI Software Engineer

وظیفه:

- پیاده‌سازی featureها
- نوشتن کد تمیز
- رعایت structure repository
- اضافه کردن تست‌های ضروری

## AI Reviewer

وظیفه:

- بررسی کد قبل از merge
- پیدا کردن نقض معماری
- بررسی اینکه logic در جای درست نوشته شده یا نه

## AI Refactoring Assistant

وظیفه:

- ساده‌سازی فایل‌های بزرگ
- جدا کردن logic از UI
- تمیز کردن module boundaries

## AI Test Assistant

وظیفه:

- نوشتن تست برای Scoring Engine
- نوشتن تست برای Diagnostic Engine
- نوشتن تست برای finishAssessment flow

---

# 3. Required Project Context for Cursor

قبل از شروع کدنویسی، این فایل‌ها یا اسناد باید به Cursor داده شوند یا در docs پروژه قرار بگیرند:

1. PRD 01 — Sales Health Check MVP
2. Phase 5 — System Architecture
3. Phase 6 — Domain & Data Model
4. Phase 7 — API Design
5. Phase 8 — Frontend Flow
6. Phase 9 — Repository Architecture
7. Phase 10 — ADR System

## Rule

اگر Cursor پیشنهادی داد که با ADRها تناقض دارد، پیشنهاد باید رد شود مگر اینکه ADR جدید ساخته شود.

---

# 4. Cursor Rules File

در پروژه باید یک فایل Cursor Rules داشته باشیم.

مسیر پیشنهادی:

```
.cursor/rules/project-rules.md
```

یا اگر Cursor از فایل root پشتیبانی کند:

```
.cursorrules
```

---

# 5. Core Cursor Rules

متن پیشنهادی برای Cursor Rules:

```markdown
# Cursor Rules — Sales Health Check

You are working on the Sales Health Check MVP.

This project is a modular monolith built with Next.js, TypeScript, PostgreSQL, Prisma, and an optional AI Explanation Layer.

## Product Rule

This is not a generic form app.
This is a diagnostic product.
The core value is the scoring and diagnostic engine.

## Architecture Rule

Follow the modular monolith structure.
Do not introduce microservices unless an ADR explicitly approves it.

## Backend Rule

Backend is the source of truth.
Scoring, diagnosis, report generation, and model versioning must run on the backend.

## Frontend Rule

Frontend must not calculate scores, bottlenecks, diagnoses, or final reports.
Frontend only collects answers and displays backend results.

## AI Rule

AI must not decide the diagnosis.
AI must not override scores, bottlenecks, or diagnostic results.
AI only explains and humanizes the structured report.

## Scoring Rule

Overall Score must be calculated from Overall Raw Score / Overall Max Score × 100.
Do not calculate Overall Score as a simple average of domain percentages.

## Answer Rule

Frontend sends only selectedOptionId.
Backend reads option score and stores score snapshot in Answer.

## Model Version Rule

Each AssessmentSession must be attached to a ModelVersion.
Questions must be loaded from the AssessmentSession's ModelVersion.

## Repository Rule

Keep route handlers thin.
Put business logic inside src/modules.

## Testing Rule

Any change to scoring, diagnosis, bottleneck logic, or finishAssessment must include or update tests.

## ADR Rule

If a proposed implementation conflicts with an ADR, stop and ask for a new ADR before changing the architecture.
```

---

# 6. Standard Implementation Prompt

این پرامپت برای زمانی است که می‌خواهیم Cursor یک feature را پیاده‌سازی کند.

```markdown
You are implementing a feature in the Sales Health Check MVP.

Before writing code:
1. Read the relevant docs in /docs.
2. Check ADRs in /docs/adr.
3. Identify which module owns the logic.
4. Keep route handlers thin.
5. Do not put business logic in UI components.
6. Do not let AI override diagnostic results.

Task:
[Describe the feature]

Expected output:
- Files to create or update
- Implementation plan
- Code changes
- Tests if needed
- Notes about any architectural risk
```

---

# 7. Standard Review Prompt

این پرامپت برای بررسی کد با Cursor است.

```markdown
Review this implementation against the Sales Health Check architecture.

Check specifically:
1. Does it violate any ADR?
2. Is scoring or diagnosis accidentally implemented in the frontend?
3. Are route handlers thin?
4. Is business logic inside the correct module?
5. Are score snapshots handled correctly?
6. Is ModelVersion respected?
7. Does AI only explain and not decide?
8. Are error states handled?
9. Are tests needed or missing?
10. Is the code simple enough for MVP?

Give me:
- Critical issues
- Architectural issues
- Missing tests
- Suggested fixes
```

---

# 8. Standard Refactor Prompt

```markdown
Refactor this code without changing behavior.

Goals:
- Keep module boundaries clean.
- Move business logic out of route handlers or UI components.
- Keep scoring and diagnosis in their own engines.
- Preserve existing tests.
- Add tests if the refactor touches scoring or diagnosis logic.
- Do not change public API contracts unless explicitly requested.

Before refactoring, explain what you will change and why.
```

---

# 9. Standard Test Prompt

```markdown
Write tests for this module.

Focus on:
- happy path
- edge cases
- invalid inputs
- regression risks

For scoring tests, verify:
- DomainScore calculation
- OverallScore calculation
- OverallScore is not average of domain percentages

For diagnosis tests, verify:
- WeaknessScore
- BottleneckPriorityScore
- Top 3 bottlenecks
- Diagnostic rule activation

Do not mock the core calculation logic.
```

---

# 10. Definition of Done

هر feature زمانی Done است که:

- در جای درست از repository پیاده‌سازی شده باشد.
- با ADRها تناقض نداشته باشد.
- route handlerها بزرگ و شلوغ نشده باشند.
- UI منطق scoring یا diagnosis نداشته باشد.
- validation پایه انجام شده باشد.
- error stateهای اصلی پوشش داده شده باشند.
- اگر scoring یا diagnosis تغییر کرده، تست نوشته شده باشد.
- کد TypeScript error نداشته باشد.
- نام فایل‌ها و توابع با naming convention هماهنگ باشد.
- feature با MVP Scope هماهنگ باشد.

---

# 11. Code Review Checklist

قبل از پذیرش هر تغییر، این سوال‌ها باید بررسی شوند:

## Product Fit

- آیا این feature داخل MVP Scope است؟
- آیا feature محصول را به MVP نزدیک‌تر می‌کند یا فقط پیچیدگی اضافه می‌کند؟

## Architecture

- آیا module boundary رعایت شده؟
- آیا route handler نازک مانده؟
- آیا business logic در جای درست است؟
- آیا ADRها رعایت شده‌اند؟

## Scoring & Diagnosis

- آیا Overall Score درست محاسبه می‌شود؟
- آیا Bottleneck با وزن‌دهی محاسبه می‌شود؟
- آیا AI تشخیص را override نکرده؟

## Data Integrity

- آیا AssessmentSession به ModelVersion وصل است؟
- آیا Answer score snapshot ذخیره می‌شود؟
- آیا Report persist می‌شود؟

## Frontend

- آیا کاربر مسیر ساده‌ای دارد؟
- آیا loading و error state وجود دارد؟
- آیا موبایل در نظر گرفته شده؟

## Testing

- آیا تست‌های لازم وجود دارد؟
- آیا تغییرات scoring یا diagnosis تست دارند؟

---

# 12. Development Workflow

پیشنهاد workflow برای MVP:

1. یک feature کوچک انتخاب کن.
2. اسناد مرتبط را به Cursor بده.
3. از Cursor بخواه implementation plan بدهد.
4. قبل از کدنویسی plan را بررسی کن.
5. Cursor کد را مرحله‌ای بنویسد.
6. تست‌های لازم نوشته شود.
7. با Review Prompt کد را بررسی کن.
8. اگر معماری نقض شد، اصلاح کن.
9. بعد برو feature بعدی.

## Rule

هیچ‌وقت به Cursor نگو:

«کل پروژه را بساز.»

بگو:

«این feature کوچک را طبق این اسناد بساز.»

---

# 13. First Build Order Recommendation

وقتی وارد ساخت واقعی شدیم، ترتیب پیشنهادی:

1. Project setup
2. Prisma schema draft
3. Seed ModelVersion + Domains + Questions + Options
4. Scoring Engine pure functions
5. Diagnostic Engine pure functions
6. Report Builder basic version
7. Assessment start API
8. Questions API
9. Answers API
10. Finish Assessment API
11. Result API
12. Frontend Business Info page
13. Frontend Question Flow
14. Frontend Result Dashboard
15. Detailed Report
16. AI Explanation Layer

## Important Rule

قبل از UI کامل، Scoring و Diagnosis باید تست‌پذیر و درست باشند.

---

# 14. Guardrails Against Vibe Coding

این‌ها خط قرمزهای پروژه هستند:

- ساختن UI قبل از Scoring Engine کامل
- سپردن تشخیص به AI
- گذاشتن منطق محصول در route.ts
- ساختن feature خارج از MVP
- تغییر Overall Score به میانگین ساده
- حذف ModelVersion برای ساده‌سازی
- ذخیره نکردن score snapshot
- تولید نکردن تست برای logicهای حیاتی
- تغییر معماری بدون ADR

---

# 15. Phase 11 Decisions

## Decision 1 — Cursor must follow project docs

Cursor باید بر اساس اسناد کار کند، نه حدس آزاد.

## Decision 2 — Features must be built in small slices

هر بار فقط یک feature کوچک ساخته شود.

## Decision 3 — Core engines before full UI

Scoring و Diagnosis باید قبل از UI کامل ساخته و تست شوند.

## Decision 4 — Review prompt is mandatory

بعد از هر پیاده‌سازی مهم، Review Prompt باید اجرا شود.

---

# 16. Definition of Done for Phase 11

Phase 11 زمانی Done است که:

- Cursor Rules آماده باشد.
- Implementation Prompt آماده باشد.
- Review Prompt آماده باشد.
- Refactor Prompt آماده باشد.
- Test Prompt آماده باشد.
- Definition of Done پروژه مشخص باشد.
- Code Review Checklist مشخص باشد.
- Build Order اولیه مشخص باشد.
- آماده ورود به Phase 12 — MVP Build Sprint باشیم.

---

# 17. Next Phase

Phase 12 — MVP Build Sprint

در فاز بعد، دیگر از طراحی وارد برنامه اجرای ساخت MVP می‌شویم.