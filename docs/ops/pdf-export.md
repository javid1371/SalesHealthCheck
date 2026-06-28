# PDF export (Playwright headless Chromium)

Sales Health Check generates PDF reports by rendering the print page (`/report/[id]/print`) in headless Chromium and calling `page.pdf()`. This reuses the same React report blocks as the app (RTL, Vazirmatn, Recharts) without a separate PDF template.

## Enable / disable

| Variable | Default | Description |
|----------|---------|-------------|
| `PDF_GENERATION_ENABLED` | unset (disabled) | Set to `true` to enable `GET /api/reports/[id]/pdf?token=` |
| `APP_BASE_URL` | `http://localhost:3000` | Must be the **public URL** Playwright can reach (same origin as the running app) |

When disabled, the download button still appears on result/report pages but the API returns `503` with code `pdf_generation_disabled`.

## Local development

1. Install dependencies (Playwright is in `package.json`):

   ```bash
   npm install
   npx playwright install chromium
   ```

2. Set in `.env`:

   ```bash
   PDF_GENERATION_ENABLED=true
   APP_BASE_URL=http://localhost:3000
   ```

3. Run the app (`npm run dev` or `npm start`), finish an assessment, then use **دانلود PDF** or open:

   ```
   http://localhost:3000/report/{reportId}/print?token={resultToken}
   ```

   Browser print preview (Cmd/Ctrl+P) uses the same layout and `src/styles/print.css`.

## Docker production

The production `Dockerfile` runner stage uses `node:20-bookworm-slim` (not Alpine) so Chromium system libraries install cleanly.

During image build:

```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install-deps chromium && npx playwright install chromium
```

In `.env` on the server:

```bash
PDF_GENERATION_ENABLED=true
APP_BASE_URL=https://your-domain.com
```

`APP_BASE_URL` must match the URL Caddy serves — Playwright navigates to `{APP_BASE_URL}/report/.../print` from **inside** the app container. With Docker Compose, that is typically the public HTTPS URL (Caddy proxies to the app on port 3000).

### Memory and timeouts

- Each PDF opens a new browser tab; the browser process is reused across requests.
- Request timeout: **30 seconds** (client and server).
- Recommended VPS RAM: **≥ 2 GB** if PDF export is enabled alongside Postgres and Caddy.
- Under load, consider a queue or rate limit — PDF generation is CPU-heavy.

### Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Empty charts in PDF | Chart not painted before capture — check `data-print-ready` on `<html>`; increase wait or ensure Recharts renders on print page |
| `pdf_generation_failed` | Wrong `APP_BASE_URL`, app not listening, or Chromium missing in image |
| 403 on print URL | Missing or invalid `token` query param |
| Slow first PDF | Cold Chromium launch — subsequent requests reuse the browser |

## API

```
GET /api/reports/{reportId}/pdf?token={resultToken}
```

- **200** — `application/pdf`, `Content-Disposition: attachment`
- **403** — invalid token
- **404** — report or reportSpec not found
- **503** — `PDF_GENERATION_ENABLED` not set to `true`

Same `token` as the JSON report API — no separate auth.

Manual QA: [Scenario 8](../qa/MVP-Manual-Test-Scenarios.md#scenario-8--pdf-download-and-print-layout) in the MVP test scenarios doc.

## Related files

| File | Role |
|------|------|
| `src/app/report/[reportId]/print/page.tsx` | Server-rendered print layout |
| `src/styles/print.css` | A4 page breaks, print color |
| `src/modules/report/report-pdf.service.ts` | Playwright PDF generation |
| `src/components/report/DownloadReportPdf.tsx` | Result + report download UX |
