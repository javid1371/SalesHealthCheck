---
source: Notion
notion_url: https://app.notion.com/p/47c733bfa68d43d9a9de581b5f88284c
snapshot_date: 2026-06-29
---

# Cursor Implementation Guide — Report Content Library v1

> این صفحه راهنمای اجرایی Cursor برای پیاده‌سازی **Report Content Library v1** در پروژه Sales Health Check است. این صفحه را به Cursor بده تا دقیقاً بفهمد دیتابیس محتوایی جدید چه نقشی دارد، چه فایل‌هایی باید بسازد، چه typeهایی لازم است، و Report Engine چطور باید از محتوا استفاده کند.

## 1. هدف این راهنما
این پروژه یک **Sales Health Check MVP** دارد که سه لایه اصلی دارد:
```
Assessment Question Bank
	↓
Diagnosis Engine
	↓
Report Content Library
	↓
Report Engine
	↓
User Report / PDF
```
**هدف این راهنما:**  
پیاده‌سازی یک لایه گزارش‌دهی قطعی، تست‌پذیر، بدون AI و مبتنی بر محتوای آماده.
## 2. نقش هر لایه
### Assessment Question Bank
منبع سؤال‌ها، گزینه‌ها و امتیازهای خام است. این لایه برای ساخت فرم و گرفتن پاسخ کاربر استفاده می‌شود.
### Diagnosis Engine
مسئول تشخیص است.
کارهای مجاز Diagnosis Engine:
- محاسبه امتیازها
- تعیین سطح هر دامنه
- تشخیص دامنه‌های ضعیف
- انتخاب primary issue
- انتخاب structural roots
- انتخاب binding constraint
- انتخاب quick win
- تولید `diagnosis_object`
### Report Content Library
منبع متن‌های آماده گزارش است.
این لایه شامل:
- تفسیر سطح دامنه
- نشانه‌های قابل نمایش
- ریشه‌های قابل فهم برای کاربر
- مکانیزم اثرگذاری ریشه
- اثر روی فروش
- متن آینه‌سازی پاسخ کاربر
- اقدام quick win
- تیزر راهکار قفل‌شده
### Report Engine
مسئول روایت و رندر گزارش است.
کارهای مجاز Report Engine:
- گرفتن `diagnosis_object`
- پیدا کردن محتوای متناظر در Report Content Library
- ساختن Report Spec
- رندر گزارش در اپ و PDF
کارهای غیرمجاز Report Engine:
- تشخیص جدید نسازد
- امتیازها را دوباره محاسبه نکند
- از AI برای تولید متن استفاده نکند
- فیلدهای internal را به کاربر نشان ندهد
- راهکار کامل همه دامنه‌ها را رایگان نشان ندهد
---
## 3. منبع داده در Notion
صفحه منبع:
[Sales Health Check — Report Content Library v1](https://app.notion.com/p/8a472c052d3242fcbf7e68c4921ecdf6)
دیتابیس منبع:
https://app.notion.com/p/32af24eade0544d092052dc8c7b4f75d
هر ردیف این دیتابیس نماینده یک **DomainBundle** از مدل ۱۶ دامنه‌ای Sales Health Check است.
## 4. ردیف‌های دیتابیس
در دیتابیس ۱۶ ردیف وجود دارد:
<table header-row="true">
<tr>
<td>ردیف</td>
<td>domain_id</td>
<td>عنوان</td>
<td>نقش</td>
</tr>
<tr>
<td>D01</td>
<td>persona</td>
<td>Persona / شناخت مشتری مناسب</td>
<td>شناخت مشتری مناسب و نامناسب</td>
</tr>
<tr>
<td>D02</td>
<td>uvp</td>
<td>UVP / ارزش پیشنهادی</td>
<td>وضوح دلیل انتخاب و تمایز</td>
</tr>
<tr>
<td>D03</td>
<td>offer_pricing</td>
<td>طراحی پیشنهاد، قیمت‌گذاری و بسته‌بندی خرید</td>
<td>شفافیت پیشنهاد و دفاع از قیمت</td>
</tr>
<tr>
<td>D04</td>
<td>lead_generation</td>
<td>تولید سرنخ</td>
<td>جریان ورودی جدید و کیفیت جذب</td>
</tr>
<tr>
<td>D05</td>
<td>lead_nurturing</td>
<td>پرورش سرنخ‌ها</td>
<td>گرم‌کردن سرنخ‌های ناآماده</td>
</tr>
<tr>
<td>D06</td>
<td>lead_response_capture</td>
<td>سرعت ارتباط اولیه و ثبت سرنخ</td>
<td>ثبت، مالکیت و پاسخ سریع به سرنخ</td>
</tr>
<tr>
<td>D07</td>
<td>lead_qualification</td>
<td>صلاحیت‌سنجی و اولویت‌بندی سرنخ‌ها</td>
<td>تشخیص لید مناسب و بااولویت</td>
</tr>
<tr>
<td>D08</td>
<td>first_contact_trust</td>
<td>کیفیت ارتباط اولیه و اعتمادسازی</td>
<td>اعتمادسازی در اولین تماس</td>
</tr>
<tr>
<td>D09</td>
<td>needs_discovery</td>
<td>کشف نیاز</td>
<td>فهم مسئله واقعی مشتری قبل از ارائه</td>
</tr>
<tr>
<td>D10</td>
<td>professional_presentation</td>
<td>ارائه حرفه‌ای</td>
<td>ارائه نتیجه‌محور و متصل به مسئله مشتری</td>
</tr>
<tr>
<td>D11</td>
<td>objection_handling</td>
<td>برخورد با اعتراضات</td>
<td>مدیریت تردید، اعتراض و ریسک خرید</td>
</tr>
<tr>
<td>D12</td>
<td>sales_closing</td>
<td>نهایی‌سازی فروش</td>
<td>کاهش اصطکاک لحظه خرید</td>
</tr>
<tr>
<td>D13</td>
<td>customer_loyalty</td>
<td>وفاداری مشتری</td>
<td>خرید مجدد، رضایت، معرفی و CLV</td>
</tr>
<tr>
<td>D14</td>
<td>touchpoint_consistency</td>
<td>یکپارچگی Touchpoint</td>
<td>یکدستی تجربه مشتری در نقاط تماس</td>
</tr>
<tr>
<td>D15</td>
<td>sales_path_clarity</td>
<td>شفافیت مسیر فروش</td>
<td>شناخت مسیر واقعی مشتری و نقطه ریزش</td>
</tr>
<tr>
<td>D16</td>
<td>sales_measurement_optimization</td>
<td>اندازه‌گیری، تحلیل و بهینه‌سازی فروش</td>
<td>مدیریت داده‌محور قیف فروش</td>
</tr>
</table>
---
## 5. قانون معماری اصلی
> **Diagnosis Engine تصمیم می‌گیرد چه چیزی خراب است. Report Engine فقط تصمیم می‌گیرد چطور آن را به کاربر نشان دهد.**

Cursor باید این قانون را رعایت کند:
```
Do not create new diagnosis inside the Report Engine.
Do not recalculate scores inside the Report Engine.
Do not generate report text with AI.
Only map diagnosis_object to Report Content Library.
```
---
## 6. قانون نمایش public و internal
### فیلدهای داخلی
این فیلدها فقط برای موتور، تست، دیباگ، QA یا Expert View هستند:
```
internal_diagnosis_fa
internal_diagnosis_summary_fa
rendering_rules_fa
```
این فیلدها نباید مستقیماً به کاربر نهایی نمایش داده شوند.
### فیلدهای قابل نمایش به کاربر
این فیلدها مجازند در گزارش کاربر نمایش داده شوند:
```
public_summary_fa
public_reflection_fa
public_root_sentence_fa
mechanism_fa
sales_impact_fa
quick_win_summary_fa
locked_teaser_fa
level_interpretation_fa
symptoms
```
### قانون سخت
```
Never render internal_diagnosis_fa directly to the user.
Never render internal_diagnosis_summary_fa directly to the user.
Never render rendering_rules_fa directly to the user.
```
---
## 7. فایل‌هایی که باید ساخته شوند
Cursor باید این ساختار را بسازد یا با ساختار فعلی پروژه هماهنگ کند:
```
src/
	features/
		report-content/
			report-content.types.ts
			report-content-library.v1.ts
			report-content.service.ts
			report-content.mapper.ts
			report-content.fallbacks.ts

		report-engine/
			report-engine.types.ts
			report-composer.ts
			report-renderer.tsx
			report-blocks/
				DomainBreakdownCard.tsx
				EvidenceCard.tsx
				RootCauseCard.tsx
				LockedActionCard.tsx
				QuickWinCard.tsx

	tests/
		report-content.test.ts
		report-composer.test.ts
```
اگر پروژه ساختار متفاوتی دارد، همین مسئولیت‌ها باید در مسیرهای معادل پیاده‌سازی شوند.
---
## 8. TypeScript types
Cursor باید این typeها را بسازد:
```typescript
export type DomainLevelKey =
  | "critical"
  | "weak"
  | "average"
  | "healthy"
  | "advanced"

export type DomainFamily =
  | "strategy"
  | "acquisition"
  | "nurture"
  | "operations"
  | "conversion"
  | "retention"
  | "experience"
  | "measurement"

export type DomainLevelContent = {
  level_key: DomainLevelKey
  score_min: number
  score_max: number
  label_fa: string
  headline_fa: string
  interpretation_fa?: string
}

export type AnswerOptionContent = {
  score: 0 | 1 | 2 | 3
  text_fa: string
  option_meaning_fa: string
  public_reflection_fa: string
}

export type QuestionContent = {
  question_id: string
  question_number: number
  question_text_fa: string
  internal_diagnosis_fa: string
  public_evidence_label_fa: string
  options: AnswerOptionContent[]
}

export type RootCauseContent = {
  root_id: string
  root_title_fa: string
  public_root_sentence_fa: string
  mechanism_fa: string
  sales_impact_fa: string
}

export type QuestionRootRule = {
  question_id: string
  condition: string
  root_id: string
  evidence_sentence_template_fa: string
}

export type ActionContent = {
  action_id: string
  action_title_fa: string
  quick_win_summary_fa: string
  full_action_fa?: string
  locked_teaser_fa: string
}

export type DomainBundle = {
  domain_id: string
  domain_number: number
  engine_id: string
  title_fa: string
  family: DomainFamily
  role_in_funnel_fa: string
  public_summary_fa: string
  internal_diagnosis_summary_fa: string
  domain_levels: DomainLevelContent[]
  symptoms: string[]
  root_causes: RootCauseContent[]
  questions: QuestionContent[]
  question_root_rules: QuestionRootRule[]
  actions: ActionContent[]
  rendering_rules_fa: string
}
```
---
## 9. Diagnosis object contract
Report Engine باید این شکل ورودی را مصرف کند. اگر ساختار پروژه متفاوت است، یک adapter بساز.
```typescript
export type DiagnosisObject = {
  per_domain: Array<{
    domain_id: string
    engine_id: string
    raw_score: number
    pct: number
    level: "critical" | "weak" | "average" | "healthy" | "advanced"
    weak_question_ids?: string[]
  }>
  answers: Array<{
    question_id: string
    selected_score: 0 | 1 | 2 | 3
  }>
  quick_win?: {
    domain_id: string
  }
}
```
---
## 10. خروجی Report Composer
Report Composer باید خروجی ساختاریافته بسازد، نه JSX مستقیم.
```typescript
export type EvidenceCard = {
  question_id: string
  question_text_fa: string
  selected_score: 0 | 1 | 2 | 3
  selected_option_text_fa: string
  public_reflection_fa: string
  evidence_sentence_fa?: string
}

export type RootCauseReportCard = {
  root_id: string
  root_title_fa: string
  public_root_sentence_fa: string
  mechanism_fa: string
  sales_impact_fa: string
  evidence: EvidenceCard[]
}

export type DomainReportSection = {
  domain_id: string
  engine_id: string
  title_fa: string
  family: DomainFamily
  raw_score: number
  pct: number
  level: DomainLevelKey
  level_headline_fa: string
  level_interpretation_fa?: string
  symptoms: string[]
  evidence_cards: EvidenceCard[]
  root_causes: RootCauseReportCard[]
  locked_action_teaser?: string
  quick_win_action?: {
    action_id: string
    action_title_fa: string
    quick_win_summary_fa: string
    full_action_fa?: string
  }
}
```
---
## 11. توابعی که باید پیاده‌سازی شوند
### 11.1 getDomainBundle
```typescript
getDomainBundle(domainId: string): DomainBundle
```
رفتار:
- از `REPORT_CONTENT_LIBRARY_V1` دامنه را پیدا کند.
- اگر پیدا نشد، خطای کنترل‌شده یا fallback بدهد.
- نباید باعث شکستن کل گزارش شود.
### 11.2 getDomainLevel
```typescript
getDomainLevel(bundle: DomainBundle, rawScore: number): DomainLevelContent
```
رفتار:
- بر اساس `score_min` و `score_max` سطح درست را پیدا کند.
- اگر سطح پیدا نشد، fallback level بدهد.
### 11.3 getSelectedAnswerOption
```typescript
getSelectedAnswerOption(
  bundle: DomainBundle,
  questionId: string,
  selectedScore: 0 | 1 | 2 | 3
): AnswerOptionContent
```
رفتار:
- سؤال را در bundle پیدا کند.
- گزینه متناظر با score انتخاب‌شده را پیدا کند.
- اگر گزینه نبود، fallback امن بدهد:
	- متن پاسخ: `پاسخ شما: {score} از ۳`
	- public_reflection: خالی یا متن fallback
### 11.4 getTriggeredRootCauses
```typescript
getTriggeredRootCauses(
  bundle: DomainBundle,
  answers: Array<{ question_id: string; selected_score: 0 | 1 | 2 | 3 }>
): Array<{
  root_cause: RootCauseContent
  evidence: Array<{
    question_id: string
    question_text_fa: string
    selected_option_text_fa: string
    public_reflection_fa: string
    evidence_sentence_fa: string
  }>
}>
```
رفتار:
- ruleهای `question_root_rules` را بخواند.
- شرط‌های ساده مثل `score <= 1` را روی پاسخ‌ها اعمال کند.
- root causeهای فعال را پیدا کند.
- evidence را از سؤال، پاسخ انتخاب‌شده و public_reflection بسازد.
- root causeهای تکراری را merge کند.
### 11.5 buildDomainBreakdown
```typescript
buildDomainBreakdown(
  diagnosisDomain: {
    domain_id: string
    engine_id: string
    raw_score: number
    pct: number
    level: string
    weak_question_ids?: string[]
  },
  answers: Array<{ question_id: string; selected_score: 0 | 1 | 2 | 3 }>,
  quickWinDomainId?: string
): DomainReportSection
```
رفتار:
1. `domain_id` را از diagnosis بگیرد.
2. `DomainBundle` مربوطه را پیدا کند.
3. سطح دامنه را از `domain_levels` پیدا کند.
4. سؤال‌های ضعیف را شناسایی کند.
5. پاسخ انتخاب‌شده کاربر را پیدا کند.
6. root causeهای فعال را با ruleها استخراج کند.
7. EvidenceCard بسازد.
8. RootCauseReportCard بسازد.
9. اگر `domain_id === quickWinDomainId`، راهکار کامل را باز کند.
10. اگر quick win نیست، فقط `locked_teaser_fa` را نشان دهد.
### 11.6 composeReport
```typescript
composeReport(diagnosis: DiagnosisObject): {
  domain_sections: DomainReportSection[]
}
```
رفتار:
- برای هر دامنه diagnosis، `buildDomainBreakdown` را اجرا کند.
- دامنه‌های بحرانی و ضعیف را کامل‌تر نمایش دهد.
- دامنه‌های سالم را خلاصه‌تر نمایش دهد.
- خروجی کاملاً deterministic باشد.
---
## 12. قانون نمایش ریشه در گزارش
برای هر دامنه ضعیف یا بحرانی، ساختار نمایش باید این باشد:
```
1. عنوان دامنه
2. امتیاز و سطح
3. تفسیر سطح
4. نشانه‌ها
5. شواهد از پاسخ کاربر
6. ریشه قابل فهم
7. مکانیزم اثرگذاری
8. اثر روی فروش
9. اقدام قفل‌شده یا quick win
```
### قالب Evidence Card
```
سؤال:
[question_text_fa]

پاسخ شما:
[selected_option_text_fa]

برداشت:
[public_reflection_fa]
```
### قالب Root Cause Card
```
ریشه احتمالی:
[public_root_sentence_fa]

چرا این اتفاق روی فروش اثر می‌گذارد؟
[mechanism_fa]

اثر روی فروش:
[sales_impact_fa]
```
### قالب Locked Action
```
🔒 چطور درستش کنیم؟
[locked_teaser_fa]
```
### قالب Quick Win
```
✅ برد سریع پیشنهادی
[quick_win_summary_fa]

اقدام کامل:
[full_action_fa]
```
---
## 13. قانون quick win و محتوای قفل‌شده
> گزارش رایگان باید تشخیص را سخاوتمندانه نشان دهد، اما درمان کامل را فقط برای quick win باز کند.

قانون:
```
If domain_id === quickWinDomainId:
	Show quick_win_summary_fa
	Show full_action_fa if available

Else:
	Show locked_teaser_fa only
	Do not show full_action_fa
```
این قانون برای حفظ مرز رایگان/پولی مهم است.
---
## 14. Fallback rules
Renderer و Composer نباید null، undefined یا بخش خالی نشان دهند.
### قوانین fallback
```
If field is missing:
	1. Use field-specific fallback from report-content.fallbacks.ts.
	2. If no fallback exists, omit that sub-section.
	3. Never render null/undefined.
	4. Never break the whole report because one field is missing.
```
### fallbackهای پیشنهادی
```typescript
export const REPORT_CONTENT_FALLBACKS = {
  missingDomainTitle: "این بخش از قیف فروش",
  missingSelectedOption: (score: number) => `پاسخ شما: ${score} از ۳`,
  missingPublicReflection: "این پاسخ یک نشانه قابل بررسی در مسیر فروش شماست.",
  missingRootCause: "در این بخش یک الگوی قابل بررسی دیده می‌شود.",
  missingMechanism: "این وضعیت می‌تواند روی کیفیت تصمیم‌گیری و فروش اثر بگذارد.",
  missingSalesImpact: "اثر این بخش معمولاً در کاهش تبدیل، افزایش اصطکاک یا سخت‌تر شدن رشد فروش دیده می‌شود.",
  missingLockedTeaser: "در نسخه کامل، مسیر اصلاح این بخش به‌صورت مرحله‌به‌مرحله ارائه می‌شود."
}
```
---
## 15. UI Components
### DomainBreakdownCard
نمای کلی هر دامنه:
- عنوان دامنه
- امتیاز خام
- درصد
- سطح
- headline سطح
- تفسیر سطح
### EvidenceCard
نمای سؤال و پاسخ کاربر:
- متن سؤال
- پاسخ انتخاب‌شده
- public reflection
### RootCauseCard
نمای ریشه:
- عنوان ریشه
- public root sentence
- mechanism
- sales impact
### LockedActionCard
نمای قفل:
- locked teaser
- CTA به تماس یا خرید تحلیل کامل
### QuickWinCard
نمای اقدام کامل:
- action title
- quick win summary
- full action
---
## 16. تست‌هایی که باید نوشته شوند
Cursor باید تست‌هایی بنویسد که این موارد را ثابت کند:
```
1. Internal diagnosis fields are never included in user-facing output.
2. A weak answer triggers the correct root cause.
3. selected_score maps to the correct answer option.
4. quick_win domain shows full_action.
5. non-quick_win domain shows only locked_teaser.
6. missing content does not render null/undefined.
7. composer output is deterministic for the same input.
8. Report Engine does not recalculate score.
9. Report Engine does not create new diagnosis.
```
### تست نمونه
```typescript
it("does not expose internal diagnosis fields", () => {
  const report = composeReport(sampleDiagnosis)
  const serialized = JSON.stringify(report)

  expect(serialized).not.toContain("internal_diagnosis_fa")
  expect(serialized).not.toContain("internal_diagnosis_summary_fa")
})
```
### تست quick win
```typescript
it("shows full action only for quick win domain", () => {
  const report = composeReport({
    ...sampleDiagnosis,
    quick_win: { domain_id: "persona" }
  })

  const persona = report.domain_sections.find(s => s.domain_id === "persona")
  const uvp = report.domain_sections.find(s => s.domain_id === "uvp")

  expect(persona?.quick_win_action?.full_action_fa).toBeDefined()
  expect(uvp?.quick_win_action).toBeUndefined()
  expect(uvp?.locked_action_teaser).toBeDefined()
})
```
---
## 17. Cursor Prompt — مرحله اول: ساخت Data Layer و Composer
این پرامپت را به Cursor بده:
```
You are working on the Sales Health Check MVP.

I have created a Notion page called:
Sales Health Check — Report Content Library v1

Inside it, there is a database:
Report Content Library — Domain Bundles

This database is the final content library for the Report Engine.

Important architecture rule:
The Diagnosis Engine decides what is wrong.
The Report Engine must NOT create new diagnosis.
The Report Engine only receives diagnosis_object and maps it to prepared content from Report Content Library.

Please implement the Report Content Library and Report Composer.

Goal:
Build a deterministic, no-AI report generation layer that uses the content library to create user-facing report sections.

Required files:
- src/features/report-content/report-content.types.ts
- src/features/report-content/report-content-library.v1.ts
- src/features/report-content/report-content.service.ts
- src/features/report-content/report-content.mapper.ts
- src/features/report-content/report-content.fallbacks.ts
- src/features/report-engine/report-composer.ts
- src/features/report-engine/report-engine.types.ts
- src/features/report-engine/report-renderer.tsx
- tests/report-content.test.ts
- tests/report-composer.test.ts

Data source:
Use the Notion database rows as seed data.
Each row represents one DomainBundle.
For D01 to D04, the full Cursor seed JSON is inside the page body.
For D05 to D16, use the database properties:
- domain_id
- domain_number
- engine_id
- family
- role_in_funnel_fa
- public_summary_fa
- internal_diagnosis_summary_fa
- domain_levels_json
- questions_json
- root_causes_json
- question_root_rules_json
- symptoms_json
- actions_json
- rendering_rules_fa

Create TypeScript types:
- DomainBundle
- DomainLevelContent
- QuestionContent
- AnswerOptionContent
- RootCauseContent
- QuestionRootRule
- ActionContent

Important:
Never render internal fields to the user:
- internal_diagnosis_fa
- internal_diagnosis_summary_fa
- rendering_rules_fa

Only render public-facing fields:
- public_summary_fa
- public_reflection_fa
- public_root_sentence_fa
- mechanism_fa
- sales_impact_fa
- quick_win_summary_fa
- locked_teaser_fa

Implement these functions:
1. getDomainBundle(domainId: string): DomainBundle
2. getDomainLevel(bundle: DomainBundle, rawScore: number): DomainLevelContent
3. getSelectedAnswerOption(bundle, questionId, selectedScore): AnswerOptionContent
4. getTriggeredRootCauses(bundle, answers)
5. buildDomainBreakdown(diagnosisDomain, answers, quickWinDomainId)
6. composeReport(diagnosis)

Rendering rule:
For each weak or critical domain, render:
1. Domain header
2. Symptoms
3. Evidence cards:
   - question text
   - selected answer text
   - public reflection
4. Root cause card
5. Sales impact
6. Locked action teaser

If domain_id === quickWinDomainId:
Show the quick_win_summary_fa and full_action_fa.
Otherwise:
Only show locked_teaser_fa.

Fallback rules:
If a field is missing:
- Do not render empty/null/undefined.
- Use fallback text from report-content.fallbacks.ts.
- If no fallback exists, omit the sub-section.
- Never break the report UI because of missing content.

Tests:
Write tests that prove:
1. Internal diagnosis fields are never included in user-facing output.
2. A weak answer triggers the correct root cause.
3. selected_score maps to the correct answer option.
4. quick_win domain shows full_action.
5. non-quick_win domain shows only locked_teaser.
6. missing content does not render null/undefined.
7. composer output is deterministic for the same input.

Do not modify the Diagnosis Engine.
Do not recalculate scores in the Report Engine.
Do not use AI generation.
The output must be deterministic and snapshot-testable.
```
---
## 18. Cursor Prompt — مرحله دوم: اتصال به UI گزارش
بعد از اینکه مرحله اول انجام شد، این پرامپت را بده:
```
Now connect the Report Content Library to the existing Report Engine.

Find the current report generation flow.

Wherever the app currently renders domain diagnosis, replace the direct rendering with buildDomainBreakdown() from the report-content layer.

The report should show:
- domain title
- score and level
- level interpretation
- symptoms
- evidence from user answers
- public root cause
- mechanism
- sales impact
- locked action teaser
- quick win full action only for quick_win domain

Important:
Do not show raw internal diagnosis.
Do not show full corrective actions for every domain.
Only quick_win can show full_action_fa.
All other domains show locked_teaser_fa.

Add or update UI components:
- DomainBreakdownCard
- EvidenceCard
- RootCauseCard
- LockedActionCard
- QuickWinCard

Make sure the report is still deterministic and passes tests.
```
---
## 19. Cursor Prompt — مرحله سوم: PDF
اگر خروجی PDF هم داری، این پرامپت را بده:
```
Make the PDF report use the same Report Spec as the in-app report.

Do not create separate PDF logic.

The flow should be:
diagnosis_object
→ report composer
→ report spec
→ app renderer
→ pdf renderer

Both app and PDF must use the same content library and the same report spec.
Only the visual layout can differ.

Do not duplicate report logic in the PDF renderer.
```
---
## 20. نکات اجرایی مهم برای Cursor
### 20.1 فایل ثابت بهتر از اتصال مستقیم به Notion است
برای MVP، بهتر است دیتای Notion به یک فایل ثابت TypeScript تبدیل شود:
```
src/features/report-content/report-content-library.v1.ts
```
مثال:
```typescript
export const REPORT_CONTENT_LIBRARY_V1: DomainBundle[] = [
  {
    domain_id: "persona",
    domain_number: 1,
    engine_id: "D01",
    title_fa: "Persona / شناخت مشتری مناسب",
    family: "strategy",
    ...
  }
]
```
مزیت:
- deterministic
- تست‌پذیر
- سریع
- بدون وابستگی runtime به Notion API
- مناسب snapshot test
### 20.2 از Notion به seed
روش پیشنهادی:
```
1. دیتابیس Report Content Library — Domain Bundles را باز کن.
2. ردیف‌های D01 تا D16 را به Cursor بده.
3. برای D01-D04 از JSON کامل داخل body هر ردیف استفاده کن.
4. برای D05-D16 از propertyهای دیتابیس استفاده کن.
5. خروجی را در report-content-library.v1.ts ذخیره کن.
```
### 20.3 بعداً می‌توان sync ساخت
در نسخه‌های بعدی می‌توان یک sync script ساخت که Notion را بخواند و seed تولید کند، اما برای MVP لازم نیست.
---
## 21. چیزهایی که نباید انجام شود
```
Do not use AI to write the report.
Do not ask the model to invent root causes.
Do not render internal diagnosis directly.
Do not reveal full corrective actions for every domain.
Do not recalculate diagnosis in report layer.
Do not make PDF report logic separate from app report logic.
```
---
## 22. تعریف موفقیت
این پیاده‌سازی وقتی موفق است که:
```
1. یک diagnosis_object یکسان همیشه گزارش یکسان بسازد.
2. همه متن‌های گزارش از Report Content Library بیایند.
3. internal diagnosis در گزارش کاربر دیده نشود.
4. ریشه‌ها به زبان قابل فهم و بدون قضاوت نمایش داده شوند.
5. شواهد از پاسخ واقعی کاربر ساخته شوند.
6. فقط quick_win راهکار کامل داشته باشد.
7. باقی دامنه‌ها locked teaser داشته باشند.
8. خروجی app و PDF از یک Report Spec مشترک ساخته شوند.
9. تست‌ها ثابت کنند Report Engine تشخیص جدید نمی‌سازد.
```
---
## 23. ساختار نهایی تجربه گزارش
برای هر دامنه مشکل‌دار، گزارش باید این حس را بسازد:
```
من دارم نشانه‌ای را می‌بینم که در پاسخ‌های خودم هم وجود دارد.
پس تشخیص بی‌ربط یا کلی نیست.
حالا می‌فهمم ریشه احتمالی چیست.
می‌فهمم این مشکل چطور روی فروش اثر می‌گذارد.
یک برد سریع می‌گیرم.
برای راهکار کامل باید وارد مرحله بعد شوم.
```
این یعنی گزارش فقط یک خروجی تحلیلی نیست؛ خودش بخشی از قیف فروش محصول است.
