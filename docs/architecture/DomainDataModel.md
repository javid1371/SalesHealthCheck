# Phase 6 — Domain & Data Model

## هدف این سند

این سند مدل دامنه و مدل داده اولیه Sales Health Check را تعریف می‌کند.

در این فاز هنوز هدف نوشتن دیتابیس نهایی یا Prisma Schema نیست.

هدف این است که موجودیت‌های اصلی سیستم، رابطه بین آن‌ها و چیزهایی که باید ذخیره شوند روشن شوند.

---

# 1. Core Principle

اول Domain Model، بعد Database Model.

یعنی قبل از اینکه بپرسیم «چه جدول‌هایی در دیتابیس لازم داریم؟» باید بپرسیم:

- سیستم با چه مفاهیمی کار می‌کند؟
- هر مفهوم چه مسئولیتی دارد؟
- کدام داده‌ها بخشی از مدل تشخیص هستند؟
- کدام داده‌ها مربوط به اجرای یک Assessment هستند؟
- کدام داده‌ها باید versioned باشند؟

---

# 2. Main Domain Areas

سیستم از ۵ ناحیه اصلی تشکیل می‌شود:

1. User & Organization
2. Diagnostic Model Configuration
3. Assessment Execution
4. Scoring & Diagnosis
5. Report & Action Plan

---

# 3. User & Organization Domain

## 3.1 User

User نماینده فردی است که Health Check را انجام می‌دهد.

در MVP ممکن است کاربر فقط با نام، موبایل یا ایمیل ثبت شود.

### Responsibilities

- نگهداری اطلاعات فردی کاربر
- اتصال کاربر به Assessmentها
- امکان مشاهده نتیجه در آینده

### Fields — Draft

- id
- name
- email
- phone
- createdAt
- updatedAt

### Notes

در MVP نیازی به سیستم پیچیده Authentication نیست.

اما مدل باید طوری باشد که بعداً بتوان User Account واقعی اضافه کرد.

---

## 3.2 Organization

Organization نماینده کسب‌وکاری است که Health Check برای آن انجام می‌شود.

ممکن است یک User بعداً چند Organization داشته باشد، اما در MVP می‌توان ساده شروع کرد.

### Responsibilities

- نگهداری اطلاعات پایه کسب‌وکار
- اتصال کسب‌وکار به Assessmentها

### Fields — Draft

- id
- userId
- businessName
- industry
- teamSize
- salesModel
- createdAt
- updatedAt

### salesModel Examples

- online
- offline
- phone
- direct-message
- hybrid

---

# 4. Diagnostic Model Configuration Domain

این بخش مربوط به مدل تشخیص است؛ یعنی چیزهایی که قبل از اجرای Assessment وجود دارند.

این داده‌ها نباید با پاسخ‌های کاربر قاطی شوند.

---

## 4.1 ModelVersion

ModelVersion نسخه‌ای از مدل Health Check است.

چرا لازم است؟

چون سوالات، گزینه‌ها، وزن‌ها و Ruleها ممکن است بعداً تغییر کنند.

هر Assessment باید بداند بر اساس کدام نسخه مدل ساخته شده است.

### Responsibilities

- نسخه‌بندی مدل تشخیص
- اتصال دامنه‌ها، سوال‌ها، گزینه‌ها و Ruleها به یک نسخه مشخص
- جلوگیری از قاطی شدن گزارش‌های قدیمی و جدید

### Fields — Draft

- id
- name
- versionNumber
- status
- createdAt
- activatedAt

### status Examples

- draft
- active
- archived

---

## 4.2 Domain

Domain یکی از حوزه‌های تشخیصی Health Check است.

مثلاً Persona، UVP، Offer، Lead Generation و غیره.

### Responsibilities

- تعریف حوزه تشخیصی
- اتصال سوالات به حوزه
- نگهداری وزن دامنه
- نمایش در گزارش و Spider Chart

### Fields — Draft

- id
- modelVersionId
- name
- slug
- description
- layer
- weight
- displayOrder
- isActive

### Notes

وزن دامنه باید قابل تغییر باشد.

در MVP می‌تواند از config شروع شود، اما در مدل داده باید جای مشخص داشته باشد.

---

## 4.3 Layer

Layer گروهی از چند Domain است.

در مدل فعلی ۴ لایه داریم:

1. بازار، پیام و پیشنهاد
2. لید و مدیریت سرنخ
3. مکالمه فروش و تبدیل
4. رابطه، تجربه و بهینه‌سازی

### Responsibilities

- گروه‌بندی دامنه‌ها
- نمایش ساده‌تر گزارش برای کاربر
- کمک به تشخیص ریشه‌ای‌تر

### Fields — Draft

- id
- modelVersionId
- name
- slug
- description
- displayOrder

### Notes

Layer می‌تواند به صورت فیلد در Domain ذخیره شود یا به عنوان موجودیت جدا.

برای MVP، اگر سرعت مهم باشد، می‌توان آن را به صورت field در Domain نگه داشت.

برای توسعه آینده، موجودیت جدا بهتر است.

---

## 4.4 Question

Question سوالی است که از کاربر پرسیده می‌شود.

هر Question باید به یک Domain وصل باشد.

### Responsibilities

- گرفتن شواهد قابل مشاهده از کسب‌وکار
- اتصال پاسخ کاربر به دامنه تشخیصی
- ساخت پایه Scoring

### Fields — Draft

- id
- modelVersionId
- domainId
- text
- helpText
- displayOrder
- isActive

### Design Rule

Question نباید از کاربر قضاوت کیفی بخواهد.

Question باید درباره رفتار، فرایند، وضعیت یا شواهد قابل مشاهده در کسب‌وکار باشد.

---

## 4.5 QuestionOption

QuestionOption گزینه‌ای است که کاربر برای یک Question انتخاب می‌کند.

هر گزینه امتیاز مشخص دارد.

### Responsibilities

- نمایش سطح بلوغ قابل مشاهده
- نگهداری score
- کمک به محاسبه Domain Score

### Fields — Draft

- id
- questionId
- text
- score
- displayOrder

### Score Range

- 0
- 1
- 2
- 3

### Design Rule

متن گزینه‌ها باید برای هر سؤال اختصاصی نوشته شود.

نباید فقط گزینه‌های عمومی مثل ضعیف، متوسط، خوب، عالی باشد.

---

## 4.6 DiagnosticRule

DiagnosticRule یک قانون تشخیصی است که بر اساس امتیاز دامنه‌ها یا لایه‌ها تشخیص تولید می‌کند.

### Responsibilities

- تشخیص الگوهای مهم
- تشخیص Root Cause
- تولید Diagnosisهای قابل توضیح
- کمک به انتخاب Action Plan

### Fields — Draft

- id
- modelVersionId
- name
- description
- conditionType
- conditionConfig
- diagnosisKey
- priority
- isActive

### conditionConfig

conditionConfig می‌تواند JSON باشد.

مثال مفهومی:

اگر Persona < 45 و UVP < 50، تشخیص Market Foundation Weakness فعال شود.

### Notes

برای MVP می‌توان Ruleها را در کد یا فایل config نگه داشت، اما مدل داده باید آماده انتقال آن‌ها به دیتابیس باشد.

---

# 5. Assessment Execution Domain

این بخش مربوط به اجرای واقعی Health Check توسط یک کاربر است.

---

## 5.1 AssessmentSession

AssessmentSession یک بار اجرای Health Check است.

هر بار که کاربر فرم را شروع می‌کند، یک session ساخته می‌شود.

### Responsibilities

- نگهداری وضعیت اجرای Assessment
- اتصال User، Organization و ModelVersion
- نگهداری زمان شروع و پایان
- مشخص کردن کامل یا ناقص بودن Assessment

### Fields — Draft

- id
- userId
- organizationId
- modelVersionId
- status
- startedAt
- completedAt
- createdAt
- updatedAt

### status Examples

- started
- in-progress
- completed
- abandoned

---

## 5.2 Answer

Answer پاسخ کاربر به یک Question است.

هر Answer باید به یک AssessmentSession، Question و QuestionOption وصل باشد.

### Responsibilities

- ذخیره پاسخ انتخاب‌شده
- فراهم کردن ورودی Scoring Engine
- حفظ audit trail برای گزارش

### Fields — Draft

- id
- assessmentSessionId
- questionId
- selectedOptionId
- score
- answeredAt

### Important Rule

score باید در Answer ذخیره شود.

چرا؟

چون اگر بعداً امتیاز Option در مدل جدید تغییر کرد، گزارش قدیمی نباید تغییر کند.

---

# 6. Scoring & Diagnosis Domain

این بخش خروجی محاسبات سیستم را ذخیره می‌کند.

---

## 6.1 DomainScore

DomainScore نتیجه محاسبه یک Domain در یک AssessmentSession است.

### Responsibilities

- ذخیره امتیاز خام دامنه
- ذخیره حداکثر امتیاز دامنه
- ذخیره درصد دامنه
- آماده‌سازی داده برای Spider Chart

### Fields — Draft

- id
- assessmentSessionId
- domainId
- rawScore
- maxScore
- percentage
- healthLevel

### healthLevel Examples

- critical
- weak
- medium
- healthy

---

## 6.2 OverallScore

OverallScore نتیجه کلی Assessment است.

### Responsibilities

- ذخیره امتیاز کلی خام
- ذخیره حداکثر امتیاز کلی
- ذخیره درصد کلی

### Fields — Draft

- id
- assessmentSessionId
- rawScore
- maxScore
- percentage
- healthLevel

### Formula

Overall Score = Overall Raw Score / Overall Max Score × 100

### Important Rule

Overall Score نباید میانگین ساده Domain Percentageها باشد.

---

## 6.3 LayerScore

LayerScore وضعیت هر لایه اصلی را نشان می‌دهد.

### Responsibilities

- تجمیع وضعیت دامنه‌های داخل یک لایه
- کمک به گزارش ساده‌تر برای کاربر
- کمک به تشخیص ریشه‌ای‌تر

### Fields — Draft

- id
- assessmentSessionId
- layerId
- rawScore
- maxScore
- percentage
- healthLevel

---

## 6.4 Bottleneck

Bottleneck گلوگاه تشخیص‌داده‌شده در Assessment است.

### Responsibilities

- نگهداری دامنه‌های دارای اولویت اصلاح
- ذخیره امتیاز ضعف
- ذخیره امتیاز اولویت گلوگاه
- تعیین ترتیب نمایش گلوگاه‌ها

### Fields — Draft

- id
- assessmentSessionId
- domainId
- weaknessScore
- domainWeight
- priorityScore
- rank

### Formula

**Legacy (v1):**

Weakness Score = 100 - Domain Percentage

Bottleneck Priority Score = Weakness Score × Domain Weight

**v2:** Adapter maps `StructuredDiagnosis` primary issue + PI ranking to legacy bottleneck rows. See ADR 0011.

---

## 6.5.1 StructuredDiagnosis (v2)

JSON snapshot on `assessment_sessions.structured_diagnosis`. Contract in `docs/specs/diagnosis-engine-v2-spec.md` layer 9.

Key fields: `per_domain`, `primary_issue`, `structural_roots`, `quick_win`, `survival_status`, `issue_root_questions`, `health_weighted`.

---

## 6.5 Diagnosis

Diagnosis تشخیص نهایی یا جزئی سیستم است.

یک Assessment می‌تواند چند Diagnosis داشته باشد.

### Responsibilities

- ذخیره تشخیص‌های فعال‌شده توسط Ruleها
- اتصال تشخیص به گلوگاه‌ها یا لایه‌ها
- آماده‌سازی ورودی برای Report Engine

### Fields — Draft

- id
- assessmentSessionId
- diagnosisKey
- title
- description
- severity
- priority
- relatedDomainIds
- relatedLayerIds

### severity Examples

- low
- medium
- high
- critical

---

# 7. Report & Action Plan Domain

این بخش خروجی نهایی قابل نمایش به کاربر را نگهداری می‌کند.

---

## 7.1 Report

Report گزارش نهایی تولیدشده برای یک AssessmentSession است.

### Responsibilities

- نگهداری گزارش ساختاریافته
- نگهداری نسخه نهایی قابل نمایش
- حفظ خروجی تولیدشده حتی اگر مدل بعداً تغییر کند

### Fields — Draft

- id
- assessmentSessionId
- reportStatus
- structuredReport
- aiGeneratedText
- createdAt
- updatedAt

### reportStatus Examples

- generated
- ai-enhanced
- failed

### structuredReport

structuredReport می‌تواند JSON باشد و شامل بخش‌هایی مثل:

- overallSummary
- layerSummaries
- bottleneckSummaries
- domainResults
- actionPlans

---

## 7.2 ActionPlan

ActionPlan اقدام پیشنهادی برای کاربر است.

### Responsibilities

- نگهداری اقدام‌های ۷ روزه
- نگهداری اقدام‌های ۳۰ روزه
- اتصال اقدام‌ها به Diagnosis یا Bottleneck

### Fields — Draft

- id
- assessmentSessionId
- diagnosisId
- bottleneckId
- timeframe
- title
- description
- priority

### timeframe Examples

- seven-days
- thirty-days

---

# 8. Entity Relationship Summary

## User Relationships

- User has many Organizations
- User has many AssessmentSessions

## Organization Relationships

- Organization belongs to User
- Organization has many AssessmentSessions
- An organization can has many users

## ModelVersion Relationships

- ModelVersion has many Domains
- ModelVersion has many Layers
- ModelVersion has many Questions
- ModelVersion has many DiagnosticRules
- AssessmentSession belongs to ModelVersion

## Domain Relationships

- Domain belongs to ModelVersion
- Domain belongs to Layer
- Domain has many Questions
- Domain has many DomainScores
- Domain can appear in many Bottlenecks

## Question Relationships

- Question belongs to Domain
- Question has many QuestionOptions
- Question has many Answers

## AssessmentSession Relationships

- AssessmentSession belongs to User
- AssessmentSession belongs to Organization
- AssessmentSession belongs to ModelVersion
- AssessmentSession has many Answers
- AssessmentSession has many DomainScores
- AssessmentSession has one OverallScore
- AssessmentSession has many LayerScores
- AssessmentSession has many Bottlenecks
- AssessmentSession has many Diagnoses
- AssessmentSession has one Report

---

# 9. MVP Simplification Decisions

برای MVP، همه چیز لازم نیست از روز اول کامل باشد.

## Can be simplified in MVP

- Layer می‌تواند در Domain به صورت field ذخیره شود.
- DiagnosticRule می‌تواند اول در config file باشد.
- DomainWeight می‌تواند اول در Domain ذخیره شود.
- Admin UI لازم نیست.
- Authentication می‌تواند ساده باشد.

## Should not be skipped

- ModelVersion
- AssessmentSession
- Answer score snapshot
- DomainScore
- OverallScore
- Bottleneck
- Report

این‌ها برای اعتبار محصول حیاتی‌اند.

---

# 10. Data Integrity Rules

## Rule 1 — Snapshot Scores

وقتی کاربر گزینه‌ای را انتخاب می‌کند، score آن گزینه باید همان لحظه در Answer ذخیره شود.

## Rule 2 — Model Version Lock

هر AssessmentSession باید به یک ModelVersion مشخص قفل شود.

## Rule 3 — Report Persistence

گزارش نهایی باید ذخیره شود، نه اینکه هر بار از صفر محاسبه و تولید شود.

## Rule 4 — Config Change Safety

تغییر سوالات، گزینه‌ها، وزن‌ها یا Ruleها نباید گزارش‌های قبلی را خراب کند.

## Rule 5 — Backend is Source of Truth

Scoring، Diagnosis و Report Generation باید در Backend انجام شود، نه Frontend.

---

# 11. Draft Database Tables

این لیست هنوز Prisma Schema نهایی نیست، اما پیش‌نویس جدول‌های اصلی است.

## Core Tables

- users
- organizations
- model_versions
- layers
- domains
- questions
- question_options
- diagnostic_rules
- assessment_sessions
- answers
- domain_scores
- layer_scores
- overall_scores
- bottlenecks
- diagnoses
- reports
- action_plans

---

# 12. MVP Database Priority

برای MVP، اولویت پیاده‌سازی جدول‌ها:

## Must Have

- users
- organizations
- model_versions
- domains
- questions
- question_options
- assessment_sessions
- answers
- domain_scores
- overall_scores
- bottlenecks
- diagnoses
- reports
- action_plans

## Nice to Have

- layers
- layer_scores
- diagnostic_rules

اگر زمان کم باشد، layers و diagnostic_rules می‌توانند ابتدا در config باشند.

---

# 13. Phase 6 Decisions

## Decision 1 — ModelVersion is required

حتی در MVP باید ModelVersion داشته باشیم.

Reason:

برای جلوگیری از خراب شدن گزارش‌های قبلی بعد از تغییر مدل.

## Decision 2 — Answer stores score snapshot

Answer فقط selectedOptionId را ذخیره نمی‌کند؛ score را هم ذخیره می‌کند.

Reason:

اگر بعداً option score تغییر کند، Assessment قبلی باید همان نتیجه قبلی را حفظ کند.

## Decision 3 — OverallScore is stored separately

OverallScore باید ذخیره شود.

Reason:

گزارش‌ها باید قابل audit باشند و هر بار وابسته به محاسبه مجدد نباشند.

## Decision 4 — Report must persist

گزارش نهایی باید در دیتابیس ذخیره شود.

Reason:

اگر AI یا Report Engine بعداً تغییر کند، گزارش قبلی کاربر نباید عوض شود.

---

# 14. Definition of Done for Phase 6

Phase 6 زمانی Done است که:

- موجودیت‌های اصلی مشخص شده باشند.
- رابطه بین موجودیت‌ها روشن باشد.
- داده‌های ضروری MVP مشخص شده باشند.
- چیزهایی که می‌توانند در config باشند مشخص شده باشند.
- تصمیم‌های مهم ذخیره داده ثبت شده باشند.
- آماده ورود به Phase 7 — API Design باشیم.

---

# 15. Next Phase

Phase 7 — API Design

در فاز بعدی باید مشخص کنیم Frontend و Backend چطور با هم تعامل می‌کنند.

خروجی فاز بعد:

- API List
- Endpoint Contracts
- Request/Response Shape
- Error States
- Validation Rules