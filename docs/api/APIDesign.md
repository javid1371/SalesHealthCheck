# Phase 7 — API Design

## هدف این سند

این سند طراحی اولیه APIهای سیستم Sales Health Check را تعریف می‌کند.

هدف این فاز این است که مشخص کنیم Frontend و Backend چطور با هم ارتباط می‌گیرند، چه داده‌هایی رد و بدل می‌شود، چه عملیات‌هایی لازم است و هر endpoint چه مسئولیتی دارد.

این سند هنوز کدنویسی نیست.

این سند قرارداد ارتباطی محصول است.

---

# 1. API Design Principle

API فقط نباید فرم را ذخیره کند.

API باید چرخه کامل Assessment را مدیریت کند:

Start → Load Questions → Submit Answers → Finish Assessment → Generate Scores → Generate Diagnosis → Generate Report → Show Result

بنابراین API باید حول مفهوم AssessmentSession طراحی شود، نه فقط Question یا Form.

---

# 2. Responsibility Boundaries

## Frontend Responsibilities

Frontend مسئول این موارد است:

- نمایش UI
- گرفتن اطلاعات کاربر
- نمایش سوال‌ها
- ارسال پاسخ‌ها
- نمایش progress
- نمایش loading و error state
- نمایش نتیجه

Frontend نباید مسئول این موارد باشد:

- محاسبه Score
- تشخیص Bottleneck
- اجرای Diagnostic Rules
- تولید Report
- تغییر وزن دامنه‌ها

## Backend Responsibilities

Backend مسئول این موارد است:

- ایجاد AssessmentSession
- بارگذاری active ModelVersion
- ذخیره پاسخ‌ها
- snapshot کردن score پاسخ‌ها
- محاسبه DomainScore
- محاسبه OverallScore
- محاسبه Bottleneck
- اجرای Diagnostic Engine
- تولید Report
- ذخیره نتیجه نهایی
- برگرداندن داده آماده نمایش به Frontend

---

# 3. MVP API List

## User Flow APIs

1. POST /api/assessments/start
2. GET /api/assessments/:assessmentId
3. GET /api/assessments/:assessmentId/questions
4. POST /api/assessments/:assessmentId/answers
5. PATCH /api/assessments/:assessmentId/business-info
6. POST /api/assessments/:assessmentId/finish
7. GET /api/assessments/:assessmentId/result
8. GET /api/reports/:reportId

## Optional MVP API

1. POST /api/reports/:reportId/regenerate-ai-text

## Future Admin APIs

- GET /api/admin/model-versions
- POST /api/admin/model-versions
- GET /api/admin/questions
- POST /api/admin/questions
- PATCH /api/admin/domain-weights
- GET /api/admin/diagnostic-rules
- POST /api/admin/diagnostic-rules

Admin APIs در MVP لازم نیستند.

---

# 4. Endpoint Contracts

## 4.1 POST /api/assessments/start

### Purpose

شروع یک Assessment جدید.

این endpoint باید User، Organization و AssessmentSession را بسازد یا پیدا کند.

### Request Body — Shape

- user.name
- user.email
- user.phone
- organization.businessName
- organization.industry
- organization.teamSize
- organization.salesModel

### Backend Actions

1. اعتبارسنجی اطلاعات اولیه
2. پیدا کردن active ModelVersion
3. ایجاد یا پیدا کردن User
4. ایجاد Organization
5. ایجاد AssessmentSession با status = started
6. اتصال AssessmentSession به active ModelVersion

### Response — Shape

- assessmentId
- status
- modelVersion.id
- modelVersion.versionNumber
- nextStep

### Error States

- 400 invalid_user_data
- 400 invalid_organization_data
- 404 active_model_version_not_found
- 500 assessment_start_failed

---

## 4.2 GET /api/assessments/:assessmentId

### Purpose

دریافت وضعیت کلی یک AssessmentSession.

### Response — Shape

- assessmentId
- status
- progress.answeredQuestions
- progress.totalQuestions
- progress.percentage
- organization.businessName
- organization.industry
- modelVersion.id
- modelVersion.versionNumber

### Error States

- 404 assessment_not_found
- 403 assessment_access_denied

---

## 4.3 GET /api/assessments/:assessmentId/questions

### Purpose

دریافت سوال‌ها و گزینه‌های مربوط به ModelVersion همان Assessment.

### Important Rule

سوال‌ها باید از ModelVersion متصل به AssessmentSession خوانده شوند، نه الزاماً latest active model.

### Response — Shape

- assessmentId
- modelVersion
- domains[]
    - domain.id
    - domain.name
    - domain.layer
    - domain.displayOrder
    - domain.questions[]
        - question.id
        - question.text
        - question.helpText
        - question.displayOrder
        - question.options[]
            - option.id
            - option.text
            - option.score
            - option.displayOrder

### Error States

- 404 assessment_not_found
- 404 questions_not_found
- 409 assessment_already_completed

---

## 4.4 POST /api/assessments/:assessmentId/answers

### Purpose

ثبت یا به‌روزرسانی پاسخ‌های کاربر.

این endpoint می‌تواند یک پاسخ یا چند پاسخ را همزمان ذخیره کند.

### Request Body — Shape

- answers[]
    - questionId
    - selectedOptionId

### Backend Actions

1. پیدا کردن AssessmentSession
2. اطمینان از اینکه Assessment کامل نشده است
3. اطمینان از اینکه Question متعلق به ModelVersion همین Assessment است
4. اطمینان از اینکه selectedOption متعلق به همان Question است
5. خواندن score گزینه
6. ذخیره Answer همراه با score snapshot
7. به‌روزرسانی status به in-progress
8. برگرداندن progress جدید

### Important Rule

Frontend نباید score را ارسال کند.

Backend باید score را از QuestionOption بخواند و در Answer ذخیره کند.

### Response — Shape

- assessmentId
- savedAnswers
- progress.answeredQuestions
- progress.totalQuestions
- progress.percentage

### Error States

- 400 invalid_answer_payload
- 404 assessment_not_found
- 404 question_not_found
- 404 option_not_found
- 409 option_does_not_belong_to_question
- 409 question_does_not_belong_to_model_version
- 409 assessment_already_completed

---

## 4.5 PATCH /api/assessments/:assessmentId/business-info

### Purpose

ویرایش اطلاعات پایه کسب‌وکار قبل از تکمیل Assessment.

### Request Body — Shape

- businessName
- industry
- teamSize
- salesModel

### Response — Shape

- assessmentId
- organization.businessName
- organization.industry
- organization.teamSize
- organization.salesModel

### Error States

- 400 invalid_business_info
- 404 assessment_not_found
- 409 assessment_already_completed

---

## 4.6 POST /api/assessments/:assessmentId/finish

### Purpose

تکمیل Assessment و تولید نتیجه.

این endpoint مهم‌ترین endpoint سیستم است.

### Request Body — Shape

- generateAiExplanation: boolean

### Backend Actions

1. پیدا کردن AssessmentSession
2. بررسی اینکه همه سوال‌های required پاسخ داده شده‌اند
3. قفل کردن AssessmentSession
4. اجرای Scoring Engine
5. ذخیره DomainScoreها
6. ذخیره LayerScoreها اگر فعال باشند
7. ذخیره OverallScore
8. اجرای Diagnostic Engine
9. ذخیره Bottleneckها
10. ذخیره Diagnosisها
11. اجرای Report Engine
12. ذخیره Report
13. در صورت فعال بودن AI، اجرای AI Explanation Layer
14. به‌روزرسانی status به completed

### Response — Shape

- assessmentId
- status
- reportId
- resultUrl

### Error States

- 400 assessment_not_complete
- 404 assessment_not_found
- 409 assessment_already_completed
- 500 scoring_failed
- 500 diagnosis_failed
- 500 report_generation_failed
- 500 ai_generation_failed

### Important Rule

اگر AI generation fail شود، کل Assessment نباید fail شود.

در این حالت باید Rule-Based Report ذخیره شود و reportStatus = generated باشد.

AI می‌تواند بعداً retry شود.

---

## 4.7 GET /api/assessments/:assessmentId/result

### Purpose

دریافت نتیجه کامل آماده نمایش برای Frontend.

### Response — Shape

- assessmentId
- status
- overallScore
    - rawScore
    - maxScore
    - percentage
    - healthLevel
- domainScores[]
    - domainId
    - name
    - percentage
    - healthLevel
    - layer
- layerScores[]
- bottlenecks[]
    - rank
    - domainId
    - domainName
    - weaknessScore
    - domainWeight
    - priorityScore
- diagnoses[]
    - diagnosisKey
    - title
    - severity
    - priority
- report
    - id
    - reportStatus
    - overallSummary
    - layerSummaries
    - bottleneckSummaries
    - actionPlans

### Error States

- 404 assessment_not_found
- 409 assessment_not_completed
- 404 report_not_found

---

## 4.8 GET /api/reports/:reportId

### Purpose

دریافت گزارش نهایی بر اساس reportId.

این endpoint برای لینک مستقیم گزارش یا اشتراک‌گذاری آینده مفید است.

### Response — Shape

- reportId
- assessmentId
- reportStatus
- structuredReport
- aiGeneratedText
- createdAt

### Error States

- 404 report_not_found
- 403 report_access_denied

---

## 4.9 POST /api/reports/:reportId/regenerate-ai-text

### Purpose

تلاش مجدد برای تولید یا بهبود متن AI گزارش.

این endpoint در MVP اختیاری است.

### Request Body — Shape

- tone
- language

### Backend Actions

1. پیدا کردن Report
2. خواندن structuredReport
3. ارسال structuredReport به AI Explanation Layer
4. ذخیره aiGeneratedText جدید
5. تغییر reportStatus به ai-enhanced

### Response — Shape

- reportId
- reportStatus

### Error States

- 404 report_not_found
- 500 ai_generation_failed

---

# 5. Normal User Flow

1. POST /api/assessments/start
2. GET /api/assessments/:assessmentId/questions
3. POST /api/assessments/:assessmentId/answers
4. POST /api/assessments/:assessmentId/finish
5. GET /api/assessments/:assessmentId/result

---

# 6. Validation Rules

## User Validation

- name required
- email یا phone حداقل یکی required
- email باید format معتبر داشته باشد
- phone باید format قابل قبول داشته باشد

## Organization Validation

- businessName required
- industry optional but recommended
- teamSize required
- salesModel required

## Answer Validation

- questionId required
- selectedOptionId required
- selectedOption باید متعلق به question باشد
- question باید متعلق به modelVersion همان assessment باشد
- completed assessment نباید answer جدید بگیرد

## Finish Validation

- همه سوال‌های required باید answer داشته باشند
- Assessment نباید قبلاً completed شده باشد
- ModelVersion باید وجود داشته باشد

---

# 7. Error Response Shape

همه APIها باید error structure یکسان داشته باشند.

Error باید شامل این موارد باشد:

- error.code
- error.message
- error.details

### Error Design Rule

Frontend باید بتواند بر اساس error.code رفتار مناسب نشان دهد.

---

# 8. Authentication Direction

برای MVP، Authentication می‌تواند ساده باشد.

گزینه‌های ممکن:

1. magic link بعداً اضافه شود
2. result access با secure token باشد
3. Assessment لینک اختصاصی داشته باشد

## MVP Recommendation

برای نسخه اول:

- کاربر با نام + ایمیل/شماره شروع کند.
- AssessmentSession یک accessToken یا resultToken داشته باشد.
- صفحه result با assessmentId + token قابل مشاهده باشد.

این تصمیم باید در ADR جداگانه ثبت شود.

---

# 9. Security & Privacy Notes

- کاربر نباید بتواند Assessment دیگران را با حدس زدن ID ببیند.
- Result باید با token یا authentication محافظت شود.
- اطلاعات تماس کاربر نباید در responseهای غیرضروری برگردد.
- AI نباید داده‌های حساس غیرضروری دریافت کند.
- Structured Report باید قبل از ارسال به AI محدود و کنترل‌شده باشد.

---

# 10. Idempotency & Retry Rules

## Answer Submission

POST answers باید بتواند پاسخ قبلی را update کند.

یعنی اگر کاربر به یک سوال دوباره جواب داد، answer جدید ساخته نشود؛ همان answer قبلی update شود.

## Finish Assessment

finish باید تا حدی idempotent باشد.

اگر Assessment قبلاً completed شده، بهتر است response شامل reportId قبلی برگردد، نه اینکه دوباره کل گزارش تولید شود.

---

# 11. API Design Decisions

## Decision 1 — AssessmentSession is the center of API

Reason:

کل جریان Health Check حول یک بار اجرای Assessment می‌چرخد.

## Decision 2 — Frontend never sends score

Reason:

Backend باید source of truth باشد و score snapshot را خودش ذخیره کند.

## Decision 3 — Finish endpoint triggers scoring and diagnosis

Reason:

Scoring، Diagnosis و Report باید یک transaction منطقی داشته باشند.

## Decision 4 — AI failure should not fail Assessment

Reason:

Rule-Based Report باید همیشه قابل تولید باشد.

AI فقط لایه توضیح است، نه هسته محصول.

## Decision 5 — Questions come from session modelVersion

Reason:

اگر مدل جدید فعال شد، Assessmentهای در حال اجرا یا قدیمی نباید خراب شوند.

---

# 12. Open Questions

این موارد باید در فازهای بعدی تصمیم‌گیری شوند:

1. آیا MVP نیاز به login واقعی دارد یا resultToken کافی است؟
2. آیا پاسخ‌ها page-by-page ذخیره می‌شوند یا question-by-question؟
3. آیا finish باید synchronous باشد یا async job؟
4. آیا AI generation در همان request انجام شود یا background job؟
5. آیا گزارش قابل share عمومی باشد یا فقط خصوصی؟

---

# 13. Definition of Done for Phase 7

Phase 7 زمانی Done است که:

- APIهای اصلی MVP مشخص شده باشند.
- request/response shape اولیه داشته باشد.
- Error states مشخص باشند.
- validation rules مشخص باشند.
- Backend/Frontend boundaries روشن باشند.
- آماده ورود به Phase 8 — Frontend Flow باشیم.

---

# 14. Next Phase

Phase 8 — Frontend Flow

در فاز بعد باید تجربه کاربر، صفحات، stateها، loadingها، errorها و مسیر کامل UI را طراحی کنیم.