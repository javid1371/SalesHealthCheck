# MVP Manual Test Scenarios

Run locally after `npm run dev` with database seeded, or on staging after Docker deploy.

## Prerequisites

- PostgreSQL running (`docker compose up -d`)
- Migrations applied (`npm run db:migrate`)
- Seed applied (`npm run db:seed`)
- `.env` includes `AUTH_SESSION_SECRET` and `ADMIN_PASSWORD` for OTP/session/admin scenarios

## Scenario 1 — Full completion

1. Open `/` and click start assessment
2. Enter mobile number on `/assessment/start`; request OTP (check server logs in dev if SMS is not configured)
3. Enter 6-digit code on `/assessment/start/verify`
4. Fill business info: phone read-only from OTP session, name, business fields, **team size** from dropdown (no email field); complete all 16 domains (80 questions)
3. On Review, confirm 16/16 domains complete
4. Finish and wait for Result Dashboard
5. **Expected:** Overall score, spider chart, 3 bottlenecks, link to detailed report
6. Open detailed report — domain breakdown, diagnoses, 7-day and 30-day plans
7. **Pass criteria:** 3 bottlenecks with summaries; report loads with token or active user session

## Scenario 2 — Incomplete assessment

1. Complete OTP sign-in and start assessment; answer only 2–3 domains
2. Go to Review
3. **Expected:** Incomplete domains listed; Finish button disabled
4. Try `POST /api/assessments/:id/finish` via processing shortcut or API
5. **Expected:** 400 `assessment_not_complete`

## Scenario 3 — Change answer before finish

1. Complete assessment but before finish, change one answer in an earlier domain
2. Finish assessment
3. **Expected:** Updated domain score reflected in result and spider chart

## Scenario 4 — Revisit with token

1. Complete assessment; copy result URL with `?token=`
2. Close browser / open incognito
3. Paste URL
4. **Expected:** Same report and scores (no re-generation required)

## Scenario 5 — Idempotent finish

1. Complete assessment once; note `reportId`
2. Call finish again (reload processing page or POST finish)
3. **Expected:** Same `reportId`, no duplicate reports

## Scenario 6 — CTA lead form

1. From detailed report or `/assessment/:id/cta`, submit form with name + **required phone** (no email field in UI)
2. Open Prisma Studio: `npm run db:studio`
3. **Expected:** Row in `consultation_requests` with correct `assessment_session_id`

## Scenario 7 — Access recovery (phone + account)

1. Complete an assessment (phone-only flow is fine)
2. Open `/recover` (or footer link «بازیابی لینک نتیجه»)
3. Submit the same mobile number used at assessment start
4. **Expected:** Generic success message (no indication whether account exists); hint to try **حساب من** sign-in with the same number
5. If the assessment was started with an email on file, check inbox (or Resend dashboard in dev) for email with result URL + token
6. Open the link in incognito — same result dashboard as Scenario 4
7. Alternatively, sign in at `/account/login` with the same phone + OTP — **Expected:** completed assessments visible without token
8. Submit recovery 4 times quickly from same IP
9. **Expected:** 4th request returns 429 with `retry_after`

**Pass criteria:** No user enumeration; rate limit enforced; phone-only users can regain access via account login; email magic link still works when email was provided at start.

## Scenario 10 — OTP sign-in and returning user panel

1. Start a new assessment from `/assessment/start` with a fresh mobile number
2. **Expected:** Generic success after send (no hint whether number exists); OTP arrives via SMS or appears in server logs (dev)
3. Enter wrong code twice — **Expected:** generic invalid message; third wrong attempt also rejected
4. Request a new code after 60s — complete verification
5. **Expected:** HTTP-only session cookie set; redirect to business info with phone read-only and team size dropdown (no email field)
6. Finish at least one assessment, then open `/account/assessments`
7. **Expected:** List shows business name, status, score; completed row opens result **without** `?token=`
8. Log out from account panel; open `/account/login`, sign in with same phone + OTP
9. **Expected:** Assessments list still accessible

**Pass criteria:** Session required to start assessment; owner can revisit results via account panel; OTP responses never reveal whether a phone is registered.

## Scenario 11 — Admin panel

1. Open `/admin/login` without a session
2. Submit wrong password — **Expected:** 401, no admin cookie
3. Submit `ADMIN_PASSWORD` from env — **Expected:** redirect to `/admin/assessments`
4. **Expected:** Table lists assessments with filters (date, phone, business name, status) and pagination
5. Open a completed assessment detail — **Expected:** summary metadata, links to result/report/expert view
6. Open result URL from admin context — **Expected:** report loads without user `resultToken`
7. Log out — **Expected:** admin routes return to login

**Pass criteria:** Admin cookie required for list/detail; admin can view any completed report; admin logout clears access.

## Scenario 12 — Result access paths (token / owner / admin)

After completing an assessment (Scenario 1):

1. **Token path:** Open `/assessment/{id}/result?token={resultToken}` in incognito — **Expected:** loads
2. **Owner path:** Same browser with user session, open `/assessment/{id}/result` without token — **Expected:** loads
3. **Admin path:** With admin session, open same URL without token — **Expected:** loads
4. **Denied:** Incognito without token — **Expected:** access error (403)
5. **Denied:** Different user session — **Expected:** access error (403)

**Pass criteria:** All three authorized paths work; unauthorized sessions rejected.

## Scenario 8 — PDF download and print layout

Requires `PDF_GENERATION_ENABLED=true` and `APP_BASE_URL` set (see [pdf-export.md](../ops/pdf-export.md)). For local dev, run `npx playwright install chromium` once.

### 8a — Print page preview (browser)

1. Complete Scenario 1 (or reuse an existing result URL with `?token=`)
2. Open `/report/{reportId}/print?token={token}` in a desktop-width browser window
3. **Expected:** Cover header with business name, date, overall score; full report below (no app nav, sticky bars, or copy-link UI)
4. **Expected:** All domain sections expanded (no collapse toggles); spider chart visible at larger size
5. **Expected:** No interactive forms (`BusinessMetricsGate`); CTA blocks show static text only or are omitted
6. Open browser print preview (Cmd/Ctrl+P)
7. **Expected:** A4 portrait layout; RTL text readable; health gauge bar uses semantic color (not always green)
8. **Pass criteria:** Layout matches detailed report content; charts and Persian typography render correctly

### 8b — PDF download (result + report pages)

1. On the **result dashboard** (`/assessment/{id}/result?token=`), click **دانلود PDF**
2. **Expected:** Button shows loading state («در حال آماده‌سازی PDF…»); file downloads within ~30s
3. Open the PDF in a viewer (Preview, Adobe, browser tab)
4. **Expected:** Valid PDF; RTL Persian text; cover page with overall score; charts not blank
5. Repeat from the **detailed report** page (`/report/{reportId}?token=`) — same file content
6. **Pass criteria:** Same `token` as report API; no separate login

### 8c — PDF disabled / errors

1. Set `PDF_GENERATION_ENABLED=false` (or unset) and restart the app
2. Click **دانلود PDF**
3. **Expected:** Error message «دانلود PDF در این سرور فعال نیست.» (503 `pdf_generation_disabled`)
4. Open `/report/{reportId}/print` without `?token=`
5. **Expected:** Access error message (no report content)

### 8d — API smoke (optional)

```bash
curl -o report.pdf "http://localhost:3000/api/reports/{reportId}/pdf?token={token}"
file report.pdf   # expect: PDF document
```

## Scenario 9 — Sticky assessment UX (progress, save, review)

Use a mobile viewport (375×812) or narrow browser window. Complete at least one domain for save-indicator checks; leave 1–2 domains incomplete for review checks.

### 9a — Sticky progress while scrolling

1. Start an assessment and open any domain questions page (`/assessment/{id}/questions/{domainIndex}`)
2. Scroll past several questions toward the bottom of the page
3. **Expected:** Sticky progress header stays visible below the app header (overall + domain bars); content does not slide under the header or show through the progress bar
4. **Expected:** Bottom action bar (بخش قبلی / بخش بعدی) stays fixed to the viewport bottom on mobile and desktop
5. On mobile (375×812), scroll horizontally — **Expected:** no horizontal page overflow; long question/option text wraps instead of widening the viewport
6. Open Review (`/assessment/{id}/review`) and scroll the domain list
7. **Expected:** Overall progress bar remains sticky at the top; bottom actions remain fixed

**Pass criteria:** Progress bars use brand color (`bg-brand-600`); safe-area padding on iOS notch devices (no clipping at top); opaque sticky zones (no content bleed-through); no horizontal scroll on questions pages.

### 9b — Save status indicator

1. On a questions page, select an answer
2. **Expected:** «در حال ذخیره…» appears in the sticky progress header (RTL: top-left area)
3. After save completes, **Expected:** «ذخیره شد» fades out within ~2s
4. Simulate offline or block network briefly and change an answer
5. **Expected:** Save indicator shows error state; inline error message still visible for serious failures

### 9c — Review incomplete navigation

1. Go to Review with at least one incomplete domain
2. **Expected:** «دریافت نتیجه» button disabled
3. **Expected:** Link «مشاهده N بخش ناقص» below the button scrolls/jumps to the incomplete-domains alert (`#incomplete-domains`)
4. Tap anywhere on an incomplete domain row (not only «تکمیل»)
5. **Expected:** Navigates to that domain’s questions page
6. **Expected:** Complete domains show green check styling (`bg-health-healthy-subtle`)

### 9d — Minimal footer in assessment flow

1. On questions, review, and processing routes, scroll to the page footer
2. **Expected:** Footer shows privacy link only (no «بازیابی لینک نتیجه»)
3. Open the home page or result dashboard
4. **Expected:** Full footer with recovery link is still available

### 9e — Result loading skeleton (optional)

1. Throttle network (DevTools → Slow 3G) and open result dashboard with valid token
2. **Expected:** Placeholder score/chart/layer skeleton layout (not centered spinner) until data loads

### 9f — Auto-scroll on answer

1. Open a domain questions page on mobile (375×812) and desktop
2. Select an answer for question 1
3. **Expected:** Viewport smoothly scrolls so **question 2 text** sits just below the sticky progress header (not hidden under it); respects `prefers-reduced-motion: reduce` → instant scroll
4. Select an answer for the last question in the domain
5. **Expected:** Viewport scrolls to the bottom action area (بخش بعدی / مرور پاسخ‌ها)
6. While scrolling manually, verify sticky top progress and fixed bottom actions remain flush with no content visible through the bars

**Manual mobile check:** Repeat steps 2–3 on Safari iOS and Chrome Android if available; confirm question text remains visible below both progress bars after each answer.

## Automated tests

```bash
npm test
npm run test:integration   # PostgreSQL + AUTH_SESSION_SECRET required
npm run lint
npm run build
```

Unit tests cover OTP validation, session cookies, `assertResultAccess`, and admin login. Integration tests cover finish flow, MVP QA scenarios, and auth/result access (session owner, admin bypass, legacy token).

All unit tests, lint, and production build should pass before deploy.
