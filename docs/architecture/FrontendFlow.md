# Phase 8 — Frontend Flow

## هدف این سند

این سند مسیر تجربه کاربر در Sales Health Check را تعریف می‌کند.

در فازهای قبلی، معماری، داده و API را از پشت‌صحنه دیدیم.

در این فاز همه چیز را از دید کاربر می‌بینیم:

- کاربر چه صفحه‌هایی می‌بیند؟
- در هر صفحه چه کاری انجام می‌دهد؟
- سیستم چه چیزی باید نشان دهد؟
- چه loading، error و empty stateهایی لازم است؟
- کدام API در پشت هر صفحه صدا زده می‌شود؟

هدف این فاز این است که محصول برای کاربر ساده، روان و قابل فهم شود.

---

# 1. Frontend Principle

Frontend نباید پیچیدگی سیستم را به کاربر نشان دهد.

کاربر نباید بفهمد پشت صحنه ModelVersion، Scoring Engine، Diagnostic Engine، Report Engine یا AI Layer وجود دارد.

کاربر فقط باید این مسیر را تجربه کند:

«شروع کردم، چند سؤال درباره کسب‌وکارم جواب دادم، و در پایان فهمیدم مشکل فروش من کجاست و چه کاری باید انجام بدهم.»

---

# 2. Main User Flow

مسیر اصلی کاربر:

1. Landing Page
2. Start Assessment
3. Business Info
4. Question Flow
5. Review / Progress Check
6. Processing Result
7. Result Dashboard
8. Detailed Report
9. Next Action / CTA

---

# 3. Page 1 — Landing Page

## Purpose

کاربر باید در چند ثانیه بفهمد این ابزار چیست و چرا باید آن را کامل کند.

## User Questions

کاربر در این صفحه ناخودآگاه این سوال‌ها را دارد:

- این دقیقاً چیست؟
- برای من مناسب است؟
- چقدر زمان می‌برد؟
- خروجی‌اش چیست؟
- آیا ارزش دارد شروع کنم؟

## Page Content

### Hero Message

نمونه پیام:

«سلامت مسیر فروش کسب‌وکارت را در چند دقیقه بسنج و گلوگاه‌های اصلی فروش را پیدا کن.»

در یک ویدیو به صورت کامل توضیح میدیم و دلیل اینکه باید این تست رو انجام بده توضیح میدیم

### Supporting Text

این ابزار به شما کمک می‌کند بفهمید مشکل فروش شما از جذب مشتری است، پیام و پیشنهاد، پیگیری، مکالمه فروش، تجربه مشتری یا نبود عدد و تحلیل.

### Main CTA

شروع ارزیابی فروش

### Trust Elements

- مناسب برای مدیران کسب‌وکارهای کوچک و متوسط
- خروجی شامل امتیاز، گلوگاه‌ها و اقدام‌های پیشنهادی
- زمان تقریبی: ۱۰ تا ۱۵ دقیقه

## API Call

در این صفحه هنوز API لازم نیست.

## UI States

- Default
- CTA hover / tap

---

# 4. Page 2 — Start Assessment

## Purpose

آماده‌سازی کاربر برای شروع فرم.

این صفحه باید انتظارات را تنظیم کند.

## Content

باید به کاربر بگوییم:

- سوالات درباره وضعیت واقعی کسب‌وکار شماست.
- پاسخ درست یا غلط وجود ندارد.
- گزینه‌ای را انتخاب کنید که به واقعیت نزدیک‌تر است.
- بهتر است با صداقت جواب دهید تا گزارش دقیق‌تر شود.

## CTA

ادامه و ثبت اطلاعات کسب‌وکار

## API Call

هنوز API اصلی لازم نیست، مگر اینکه بخواهیم session را همین‌جا بسازیم.

## Recommendation

برای MVP بهتر است session بعد از ثبت Business Info ساخته شود.

---

# 5. Page 3 — Business Info

## Purpose

گرفتن اطلاعات پایه کاربر و کسب‌وکار.

این اطلاعات برای سه هدف استفاده می‌شود:

1. ساخت AssessmentSession
2. شخصی‌سازی گزارش
3. ارتباط بعدی با کاربر

## Fields

### User Fields

- نام
- ایمیل یا شماره تماس

### Business Fields

- نام کسب‌وکار
- حوزه فعالیت
- اندازه تیم
- مدل فروش

## Sales Model Options

- آنلاین
- حضوری
- تلفنی
- دایرکت / پیام‌رسان
- ترکیبی

## Primary API

POST /api/assessments/start

## Success State

بعد از موفقیت:

- assessmentId دریافت می‌شود.
- کاربر به Question Flow منتقل می‌شود.

## Error States

- نام وارد نشده
- ایمیل یا شماره تماس وارد نشده
- نام کسب‌وکار وارد نشده
- مدل فروش انتخاب نشده
- خطای سرور

## UX Note

این فرم نباید طولانی باشد.

اگر همین ابتدا کاربر خسته شود، نرخ تکمیل Health Check پایین می‌آید.

---

# 6. Page 4 — Question Flow

## Purpose

قلب تجربه کاربر.

کاربر سوالات Evidence-Based را جواب می‌دهد.

## Key Principle

فرم نباید شبیه آزمون مدرسه باشد.

باید حس «تشخیص وضعیت کسب‌وکار» بدهد.

## Question Display Options

### Option A — One Question Per Page

مزیت:

- تمرکز بالا
- مناسب موبایل
- حس ساده‌تر

عیب:

- ممکن است طولانی به نظر برسد

### Option B — One Domain Per Page

مزیت:

- کاربر می‌فهمد الان در کدام بخش است
- برای ذخیره مرحله‌ای بهتر است

عیب:

- بعضی صفحه‌ها ممکن است سنگین شوند

### MVP Recommendation

برای MVP:

One Domain Per Page

یعنی هر صفحه شامل سوالات یک دامنه باشد.

مثلاً:

- شناخت مشتری مناسب
- ارزش پیشنهادی
- طراحی پیشنهاد
- تولید سرنخ

## Page Elements

- نام دامنه
- توضیح کوتاه دامنه
- Progress overall
- Progress domain
- سوال‌ها
- گزینه‌های Evidence-Based
- دکمه قبلی
- دکمه بعدی
- ذخیره خودکار یا ذخیره هنگام رفتن به مرحله بعد

## Primary API

GET /api/assessments/:assessmentId/questions

POST /api/assessments/:assessmentId/answers

## Save Behavior

پیشنهاد MVP:

وقتی کاربر از یک دامنه به دامنه بعدی می‌رود، پاسخ‌های همان دامنه ذخیره شوند.

## Error States

- سوال‌ها لود نشدند
- پاسخ ذخیره نشد
- اتصال قطع شد
- کاربر سوالی را جا گذاشته

## UX Rule

اگر ذخیره پاسخ‌ها fail شد، کاربر نباید فکر کند اطلاعاتش از بین رفته.

باید پیام واضح ببیند:

«پاسخ‌ها ذخیره نشدند. لطفاً دوباره تلاش کنید.»

---

# 7. Page 5 — Review / Progress Check

## Purpose

قبل از finish، کاربر ببیند آیا همه بخش‌ها کامل شده‌اند یا نه.

## Content

- تعداد دامنه‌های تکمیل‌شده
- تعداد سوالات پاسخ‌داده‌شده
- بخش‌های ناقص
- دکمه برگشت به بخش ناقص
- دکمه دریافت نتیجه

## Primary API

GET /api/assessments/:assessmentId

POST /api/assessments/:assessmentId/finish

## UX Note

این صفحه حس کنترل به کاربر می‌دهد.

به جای اینکه ناگهان خطای «فرم ناقص است» بگیرد، خودش می‌بیند چه چیزی مانده.

---

# 8. Page 6 — Processing Result

## Purpose

بعد از ارسال نهایی، سیستم باید نتیجه را محاسبه و گزارش را تولید کند.

## User Experience

کاربر نباید صفحه خالی ببیند.

باید حس کند سیستم در حال تحلیل پاسخ‌هاست.

## Suggested Messages

- در حال محاسبه امتیاز دامنه‌ها...
- در حال تشخیص گلوگاه‌های اصلی...
- در حال آماده‌سازی گزارش شما...

## Primary API

POST /api/assessments/:assessmentId/finish

## Technical Note

اگر finish سریع باشد، این صفحه فقط چند ثانیه نمایش داده می‌شود.

اگر finish طولانی شود، بعداً می‌توان آن را async کرد.

## Error States

- scoring failed
- report generation failed
- AI generation failed

## Important UX Rule

اگر AI generation fail شد ولی Rule-Based Report آماده شد، کاربر باید همچنان نتیجه را ببیند.

نباید به خاطر AI کل تجربه خراب شود.

---

# 9. Page 7 — Result Dashboard

## Purpose

صفحه نتیجه اصلی.

این صفحه باید سریع و واضح به کاربر بگوید:

- وضعیت کلی فروش چطور است؟
- گلوگاه‌های اصلی کدام‌اند؟
- کدام بخش‌ها سالم‌ترند؟
- قدم بعدی چیست؟

## Page Sections

### 1. Overall Score

نمایش امتیاز کلی سلامت فروش.

مثلاً:

«امتیاز سلامت فروش شما: ۶۵ از ۱۰۰»

### 2. Health Level

- بحرانی
- ضعیف
- متوسط
- سالم

### 3. Spider Chart

نمایش ۱۶ دامنه.

### 4. Four Layer Summary

نمایش وضعیت ۴ لایه:

- بازار، پیام و پیشنهاد
- لید و مدیریت سرنخ
- مکالمه فروش و تبدیل
- رابطه، تجربه و بهینه‌سازی

### 5. Top 3 Bottlenecks

سه گلوگاه اصلی با توضیح کوتاه.

### 6. Immediate Actions

اقدام‌های ۷ روزه.

### 7. CTA

دعوت به خواندن گزارش کامل یا اقدام بعدی.

## Primary API

GET /api/assessments/:assessmentId/result

## UX Rule

این صفحه نباید خیلی متنی و سنگین باشد.

اول باید insight بدهد، بعد جزئیات.

---

# 10. Page 8 — Detailed Report

## Purpose

گزارش عمیق‌تر برای کاربری که می‌خواهد دقیق‌تر بفهمد مشکل چیست.

## Page Sections

### 1. Executive Summary

خلاصه قابل فهم از وضعیت فروش.

### 2. Domain Breakdown

تحلیل هر دامنه.

### 3. Bottleneck Explanation

توضیح اینکه چرا این سه مورد گلوگاه اصلی هستند.

### 4. Root Cause Diagnosis

تشخیص ریشه‌ای.

### 5. 7-Day Action Plan

اقدام‌های فوری و ساده.

### 6. 30-Day Action Plan

اقدام‌های ساختاری‌تر.

### 7. Recommended Next Step

مسیر بعدی پیشنهادی.

## Primary API

GET /api/reports/:reportId

## UX Rule

گزارش باید بخش‌بندی‌شده باشد.

کاربر نباید با یک متن بلند و خسته‌کننده روبه‌رو شود.

---

# 11. Page 9 — Next Action / CTA

## Purpose

بعد از گزارش، باید مسیر بعدی کاربر روشن باشد.

## CTA Options

برای MVP می‌توان یکی از این مسیرها را انتخاب کرد:

1. درخواست مشاوره
2. دریافت نسخه کامل‌تر تحلیل
3. ورود به دوره قیف فروش
4. عضویت در EMC در آینده
5. دانلود یا ذخیره گزارش

## Recommendation for MVP

CTA اصلی:

«برای بررسی دقیق‌تر گلوگاه فروش خود، درخواست تحلیل بدهید.»

چون هدف اولیه می‌تواند تولید مکالمه فروش یا لید مشاوره باشد.

---

# 12. Global UI States

## Loading States

- loading questions
- saving answers
- generating result
- loading report

## Error States

- network error
- validation error
- assessment not found
- report not ready
- result access denied

## Empty States

- no assessment yet
- report not generated yet
- no answers saved

---

# 13. Mobile First Rule

بیشتر کاربران احتمالاً با موبایل وارد می‌شوند.

بنابراین طراحی باید mobile-first باشد.

## Mobile UX Rules

- سوال‌ها کوتاه و واضح باشند.
- گزینه‌ها فضای کافی برای لمس داشته باشند.
- Progress همیشه مشخص باشد.
- کاربر بداند چقدر از مسیر مانده.
- متن گزارش در پاراگراف‌های کوتاه باشد.
- Spider Chart روی موبایل خوانا باشد.

---

# 14. Recommended MVP Frontend Flow

نسخه پیشنهادی MVP:

1. Landing Page
2. Start Explanation
3. Business Info
4. Domain-by-Domain Question Flow
5. Review Completion
6. Processing Result
7. Result Dashboard
8. Detailed Report
9. CTA

---

# 15. Frontend/API Mapping

## Landing Page

API: none

## Business Info

API: POST /api/assessments/start

## Question Flow

API:

- GET /api/assessments/:assessmentId/questions
- POST /api/assessments/:assessmentId/answers

## Review Completion

API:

- GET /api/assessments/:assessmentId

## Processing Result

API:

- POST /api/assessments/:assessmentId/finish

## Result Dashboard

API:

- GET /api/assessments/:assessmentId/result

## Detailed Report

API:

- GET /api/reports/:reportId

---

# 16. UX Decisions

## Decision 1 — Domain-by-Domain Question Flow

Reason:

برای MVP، بهتر از نمایش یک سؤال در هر صفحه است چون کاربر حس ساختار بهتری می‌گیرد و تعداد مراحل کمتر به نظر می‌رسد.

## Decision 2 — Review page before result

Reason:

کاربر قبل از ارسال نهایی حس کنترل دارد و می‌تواند بخش ناقص را تکمیل کند.

## Decision 3 — Result Dashboard before Detailed Report

Reason:

کاربر اول باید insight سریع بگیرد، بعد اگر خواست وارد جزئیات شود.

## Decision 4 — Report should be sectioned

Reason:

گزارش بلند بدون بخش‌بندی، خوانده نمی‌شود.

## Decision 5 — CTA should be action-oriented

Reason:

Health Check فقط نباید آگاهی بدهد؛ باید مسیر اقدام بعدی بسازد.

---

# 17. Open Questions

1. آیا فرم باید امکان ذخیره و ادامه بعدی داشته باشد؟
2. آیا کاربر باید بتواند قبل از نتیجه، پاسخ‌ها را ویرایش کند؟
3. آیا Spider Chart برای کاربر عمومی قابل فهم است یا باید توضیح کوتاه داشته باشد؟
4. آیا گزارش کامل باید پشت CTA باشد یا بلافاصله نمایش داده شود؟
5. CTA نهایی برای MVP دقیقاً مشاوره است، دوره است یا EMC؟

---

# 18. Definition of Done for Phase 8

Phase 8 زمانی Done است که:

- صفحات اصلی مشخص شده باشند.
- هدف هر صفحه روشن باشد.
- API هر صفحه مشخص باشد.
- loading، error و empty stateهای اصلی ثبت شده باشند.
- مسیر موبایل‌فرست مشخص شده باشد.
- آماده ورود به Phase 9 — Repository Architecture باشیم.

---

# 19. Next Phase

Phase 9 — Repository Architecture

در فاز بعد ساختار پروژه برای Cursor و توسعه AI-Native طراحی می‌شود.