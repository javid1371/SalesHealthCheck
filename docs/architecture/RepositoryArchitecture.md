# Phase 9 — Repository Architecture

## هدف این سند

این سند ساختار Repository پروژه Sales Health Check را تعریف می‌کند.

هدف این فاز این است که قبل از ورود به Cursor و کدنویسی، مشخص کنیم پروژه چطور سازماندهی می‌شود، فایل‌ها کجا قرار می‌گیرند، منطق‌ها چطور از هم جدا می‌شوند و AI هنگام توسعه پروژه چطور کمتر گیج می‌شود.

---

# 1. Core Principle

ساختار پروژه باید ساده، قابل فهم و قابل توسعه باشد.

برای MVP، هدف ما ساخت یک Enterprise Monorepo سنگین نیست.

هدف ما یک ساختار تمیز است که:

- Cursor بتواند راحت آن را بفهمد.
- فایل‌ها بیش از حد بزرگ نشوند.
- منطق‌های اصلی محصول از UI جدا باشند.
- Scoring و Diagnosis قابل تست باشند.
- بعداً بتوانیم پروژه را رشد بدهیم.

---

# 2. Architecture Choice

## Recommended Pattern

Modular Monolith

یعنی:

- یک اپلیکیشن واحد داریم.
- اما داخل آن، ماژول‌ها مرزبندی شده‌اند.
- Scoring، Diagnosis، Report و AI در فایل‌های جدا و قابل تست هستند.
- لازم نیست از روز اول چند سرویس جدا بسازیم.

## Why not Microservices?

برای MVP بسیار زود است.

Microservices باعث پیچیدگی زیاد می‌شود:

- deployment سخت‌تر
- تست سخت‌تر
- اتصال سرویس‌ها سخت‌تر
- debugging سخت‌تر
- هزینه ذهنی بیشتر برای کاربر غیرتکنیکال

## Why not messy single app?

چون اگر همه چیز در چند فایل بزرگ باشد، Cursor و خودمان خیلی زود گیج می‌شویم.

پس راه درست:

یک app واحد، با ماژول‌های داخلی تمیز.

---

# 3. Tech Stack Assumption

این ساختار بر اساس انتخاب احتمالی زیر طراحی شده است:

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- Recharts برای Spider Chart
- OpenAI API برای AI Explanation Layer

اگر Stack بعداً تغییر کند، ساختار کلی همچنان قابل استفاده است.

---

# 4. Proposed Repository Structure

```
sales-health-check/
  README.md
  package.json
  tsconfig.json
  .env.example
  .gitignore

  docs/
    prd/
    architecture/
    adr/
    api/
    testing/

  prisma/
    schema.prisma
    migrations/
    seed.ts

  src/
    app/
      page.tsx
      assessment/
        start/
          page.tsx
        [assessmentId]/
          questions/
            page.tsx
          review/
            page.tsx
          processing/
            page.tsx
          result/
            page.tsx
      report/
        [reportId]/
          page.tsx
      api/
        assessments/
          start/
            route.ts
          [assessmentId]/
            route.ts
            questions/
              route.ts
            answers/
              route.ts
            business-info/
              route.ts
            finish/
              route.ts
            result/
              route.ts
        reports/
          [reportId]/
            route.ts
          [reportId]/
            regenerate-ai-text/
              route.ts

    components/
      ui/
      assessment/
      report/
      charts/
      layout/

    modules/
      assessment/
      question-bank/
      scoring/
      diagnosis/
      report/
      ai/
      user/
      organization/

    lib/
      db.ts
      env.ts
      errors.ts
      validators.ts
      utils.ts

    types/
      assessment.ts
      scoring.ts
      diagnosis.ts
      report.ts
      api.ts

    config/
      model-v1/
        domains.ts
        questions.ts
        diagnostic-rules.ts
        report-templates.ts

    tests/
      scoring/
      diagnosis/
      api/
      e2e/
```

---

# 5. Folder Responsibilities

## docs/

محل نگهداری مستندات مهم پروژه.

### Suggested Structure

- docs/prd
- docs/architecture
- docs/adr
- docs/api
- docs/testing

### Rule

تصمیم‌های مهم باید در docs ثبت شوند، نه فقط در چت یا حافظه.

---

## prisma/

محل Prisma schema، migrationها و seed data.

### Responsibilities

- تعریف مدل دیتابیس
- مدیریت migration
- seed کردن ModelVersion، Domains، Questions، Options و Rules

---

## src/app/

مسیرهای اصلی Next.js App Router.

این بخش شامل صفحات و API routeهاست.

### Rule

فایل‌های route.ts نباید منطق سنگین داشته باشند.

آن‌ها فقط باید request را بگیرند، validation کنند، service مناسب را صدا بزنند و response بدهند.

---

## src/components/

کامپوننت‌های UI.

### Suggested Subfolders

- ui: کامپوننت‌های عمومی مثل Button،Input،Card
- assessment: کامپوننت‌های مخصوص فرم Health Check
- report: کامپوننت‌های گزارش
- charts: نمودارها مثل Spider Chart
- layout: Header،Footer،PageLayout

### Rule

کامپوننت‌ها نباید منطق diagnosis یا scoring داشته باشند.

---

## src/modules/

قلب پروژه.

اینجا منطق محصول قرار می‌گیرد.

### Modules

- assessment
- question-bank
- scoring
- diagnosis
- report
- ai
- user
- organization

### Rule

هر module باید مسئولیت مشخص داشته باشد.

هیچ module نباید همه کارها را انجام دهد.

---

## src/lib/

کدهای زیرساختی مشترک.

مثلاً:

- db.ts برای Prisma Client
- env.ts برای خواندن envها
- errors.ts برای errorهای مشترک
- validators.ts برای validation helpers
- utils.ts برای utilityهای کوچک

---

## src/types/

TypeScript typeهای مشترک.

### Rule

Typeها باید به فهم پروژه کمک کنند، نه اینکه تبدیل به فایل‌های عظیم و نامفهوم شوند.

اگر type مخصوص یک module است، بهتر است داخل همان module باشد.

اگر بین چند بخش مشترک است، در src/types قرار بگیرد.

---

## src/config/

در MVP، بخشی از مدل تشخیص می‌تواند در config file ذخیره شود.

مثلاً:

- domains
- questions
- diagnostic rules
- report templates

### Important Rule

حتی اگر config file استفاده شود، ساختار آن باید طوری باشد که بعداً بتوان به دیتابیس منتقلش کرد.

---

## src/tests/

تست‌های پروژه.

حداقل تست‌های مهم:

- scoring engine
- diagnostic engine
- finish assessment flow
- API validation

---

# 6. Module Architecture

## 6.1 assessment module

### Responsibilities

- startAssessment
- getAssessmentStatus
- saveAnswers
- finishAssessment
- getAssessmentResult

### Suggested Files

```
src/modules/assessment/
  assessment.service.ts
  assessment.repository.ts
  assessment.types.ts
  assessment.validators.ts
```

---

## 6.2 question-bank module

### Responsibilities

- loadActiveModelVersion
- loadQuestionsForAssessment
- validateQuestionBelongsToModel
- validateOptionBelongsToQuestion

### Suggested Files

```
src/modules/question-bank/
  question-bank.service.ts
  question-bank.repository.ts
  question-bank.types.ts
```

---

## 6.3 scoring module

### Responsibilities

- calculateDomainScores
- calculateLayerScores
- calculateOverallScore
- prepareSpiderChartData

### Suggested Files

```
src/modules/scoring/
  scoring.engine.ts
  scoring.types.ts
  scoring.test.ts
```

### Rule

Scoring Engine باید pure logic باشد تا راحت تست شود.

یعنی تا جای ممکن مستقیم به دیتابیس وابسته نباشد.

---

## 6.4 diagnosis module

### Responsibilities

- calculateBottlenecks
- applyDiagnosticRules
- produceDiagnoses
- rankPriorities

### Suggested Files

```
src/modules/diagnosis/
  diagnosis.engine.ts
  diagnostic-rules.ts
  diagnosis.types.ts
  diagnosis.test.ts
```

### Rule

Diagnosis Engine باید بدون AI کار کند.

---

## 6.5 report module

### Responsibilities

- buildStructuredReport
- generateOverallSummary
- generateBottleneckSummaries
- generateActionPlans
- persistReport

### Suggested Files

```
src/modules/report/
  report.service.ts
  report.builder.ts
  report.templates.ts
  report.types.ts
```

---

## 6.6 ai module

### Responsibilities

- buildPromptFromStructuredReport
- callAIProvider
- validateAIOutput
- saveAIEnhancedText

### Suggested Files

```
src/modules/ai/
  ai.service.ts
  ai.prompts.ts
  ai.types.ts
  ai.guardrails.ts
```

### Rule

AI module نباید scoring یا diagnosis انجام دهد.

---

# 7. Route Handler Rule

API routeها باید نازک باشند.

یعنی route.ts نباید تبدیل به محل اصلی منطق شود.

## Bad Pattern

route.ts:

- validation
- database query
- scoring logic
- diagnosis logic
- report generation
- AI call
- response formatting

همه در یک فایل.

## Good Pattern

route.ts:

1. read request
2. validate input
3. call service
4. return response

منطق اصلی داخل modules باشد.

---

# 8. Naming Conventions

## Files

- services: something.service.ts
- repositories: something.repository.ts
- engines: something.engine.ts
- validators: something.validators.ts
- types: something.types.ts
- tests: something.test.ts

## Functions

تابع‌ها باید با فعل شروع شوند:

- startAssessment
- saveAnswers
- calculateDomainScores
- calculateBottlenecks
- buildStructuredReport
- generateAIExplanation

## Types

Typeها باید معنی دامنه‌ای داشته باشند:

- AssessmentSession
- DomainScore
- BottleneckResult
- DiagnosisResult
- StructuredReport

---

# 9. Config Strategy

برای MVP، این موارد می‌توانند در config file باشند:

- domain definitions
- domain weights
- questions
- options
- diagnostic rules
- report templates

اما باید با ModelVersion هماهنگ باشند.

## Suggested Path

```
src/config/model-v1/
  domains.ts
  questions.ts
  diagnostic-rules.ts
  report-templates.ts
```

## Rule

هیچ logic مهمی نباید فقط به صورت پنهان داخل UI باشد.

---

# 10. Testing Strategy in Repository

حتی در MVP باید چند تست حیاتی داشته باشیم.

## Must Test

1. OverallScore calculation
2. DomainScore calculation
3. Bottleneck priority calculation
4. Diagnostic rule activation
5. finishAssessment happy path
6. AI failure fallback

## Why

چون Health Check بدون scoring و diagnosis قابل اعتماد، فقط یک فرم زیباست.

---

# 11. Cursor-Specific Rules

این قوانین بعداً باید در Cursor Rules هم ثبت شوند:

1. قبل از تغییر یک feature، فایل‌های مرتبط در modules را بررسی کن.
2. منطق scoring و diagnosis را داخل UI ننویس.
3. route.ts را بزرگ نکن.
4. هر تغییر در scoring باید تست داشته باشد.
5. AI نباید diagnosis را override کند.
6. فایل‌های بزرگ‌تر از حد لازم نساز.
7. اگر تصمیم معماری جدید لازم است، ADR پیشنهاد بده.
8. قبل از ساخت فیچر جدید، existing types را بررسی کن.

---

# 12. MVP Repository Decision

## Decision

برای MVP از یک Next.js project با ساختار Modular Monolith استفاده می‌کنیم.

## Reason

این ساختار:

- برای شروع سریع است.
- برای Cursor قابل فهم است.
- از overengineering جلوگیری می‌کند.
- ماژول‌های اصلی را تمیز جدا می‌کند.
- بعداً قابل توسعه است.

## Consequence

فعلاً monorepo پیچیده، microservices و backend جداگانه لازم نیست.

---

# 13. What Not To Do

در MVP نباید این کارها را انجام دهیم:

- ساخت microservice جدا برای AI
- ساخت packageهای زیاد از روز اول
- ساخت admin panel کامل قبل از MVP
- پخش کردن منطق scoring در چند جای مختلف
- قرار دادن diagnosis داخل prompt AI
- نوشتن همه چیز در یک route.ts بزرگ
- شروع کدنویسی بدون Cursor Rules

---

# 14. Definition of Done for Phase 9

Phase 9 زمانی Done است که:

- ساختار repository مشخص شده باشد.
- module boundaries مشخص شده باشند.
- مسیرهای اصلی فایل‌ها تعریف شده باشند.
- rules مخصوص Cursor مشخص شده باشند.
- testing strategy اولیه ثبت شده باشد.
- آماده ورود به Phase 10 — ADR System باشیم.

---

# 15. Next Phase

Phase 10 — ADR System

در فاز بعد تصمیم‌های معماری مهم را به شکل رسمی ثبت می‌کنیم.