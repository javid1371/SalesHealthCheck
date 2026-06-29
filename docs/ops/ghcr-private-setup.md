# GHCR خصوصی — ساخت توکن و تنظیم VPS

پروژه و Docker image روی GitHub **private** می‌مانند. VPS برای `docker pull` باید با توکن وارد GHCR شود.

## خلاصه

| کجا | چه توکنی | برای چه |
|-----|----------|---------|
| GitHub → Secrets → Actions | `GHCR_TOKEN` | deploy خودکار از CI به VPS |
| VPS (یک بار) | همان PAT | `docker login ghcr.io` روی سرور |
| لپ‌تاپ (اختیاری) | همان PAT | `./scripts/deploy-to-vps.sh` با `GHCR_TOKEN=...` |

**Push image به GHCR** را CI با `GITHUB_TOKEN` داخلی انجام می‌دهد — برای build/push توکن جدا لازم نیست.

---

## مرحله ۱ — ساخت Personal Access Token

### روش پیشنهادی: Fine-grained token

1. برو به: [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
2. **Generate new token**
3. **Token name:** مثلاً `sales-health-check-ghcr`
4. **Expiration:** 90 days یا No expiration (پروژه شخصی — No expiration راحت‌تر، ولی امنیت کمتر)
5. **Resource owner:** اکانت خودت (`javid1371`)
6. **Repository access:** **Only select repositories** → تیک **SalesHealthCheck**
7. **Permissions → Repository permissions:**
   - **Contents:** Read-only (برای package لینک‌شده به repo خصوصی)
8. **Permissions → Account permissions:**
   - **Packages:** Read-only (برای pull روی VPS)
9. **Generate token**
10. توکن را **فقط یک بار** کپی کن (شبیه `github_pat_11ABC...` یا `ghp_xxxx`) — بعداً دوباره نشان داده نمی‌شود.

### روش جایگزین: Classic token

1. برو به: [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**
3. Note: `sales-health-check-ghcr`
4. Scopes:
   - ✅ `read:packages`
   - ✅ `repo` (چون repository خصوصی است)
5. Generate و کپی کن (`ghp_...`).

---

## مرحله ۲ — توکن در GitHub Actions (deploy خودکار)

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `GHCR_TOKEN` — Value: همان PAT
4. (اختیاری برای auto-deploy) secrets دیگر:

| Name | Value |
|------|--------|
| `VPS_SSH_HOST` | `root@193.163.201.132` |
| `VPS_SSH_KEY` | محتوای فایل private key (مثلاً `~/.ssh/id_ed25519`) |

بعد از push به `main`، job `deploy` با این توکن روی VPS لاگین می‌کند و image را pull می‌کند.

---

## مرحله ۳ — لاگین دائمی روی VPS (یک بار)

SSH به سرور:

```bash
ssh root@193.163.201.132
```

لاگین Docker به GHCR (به‌جای `TOKEN` همان PAT را بگذار؛ username همان GitHub username):

```bash
echo "TOKEN" | docker login ghcr.io -u javid1371 --password-stdin
```

Expected: `Login Succeeded`

اعتبار در `/root/.docker/config.json` ذخیره می‌شود — deployهای بعدی بدون `GHCR_TOKEN` در env هم کار می‌کنند.

تست pull:

```bash
docker pull ghcr.io/javid1371/sales-health-check:latest
```

---

## مرحله ۴ — bootstrap یا deploy

**اولین بار** (از لپ‌تاپ):

```bash
cd /path/to/SalesHealthCheck
chmod +x scripts/bootstrap-vps.sh scripts/deploy-to-vps.sh

# اگر روی VPS هنوز docker login نکردی:
GHCR_TOKEN=github_pat_xxxx ./scripts/bootstrap-vps.sh root@193.163.201.132
```

**به‌روزرسانی‌های بعدی:**

```bash
GHCR_TOKEN=github_pat_xxxx ./scripts/deploy-to-vps.sh root@193.163.201.132
# یا اگر روی VPS قبلاً docker login کردی:
./scripts/deploy-to-vps.sh root@193.163.201.132
```

---

## عیب‌یابی

| خطا | علت | راه‌حل |
|-----|-----|--------|
| `denied` / `unauthorized` on pull | توکن نادرست یا scope کم | PAT با `read:packages` + دسترسی repo |
| `manifest unknown` | هنوز CI image را push نکرده | Actions → آخرین run روی `main` → job `build-push` باید سبز باشد |
| Package پیدا نمی‌شود | اولین build هنوز اجرا نشده | یک بار push به `main` و صبر برای CI |
| `docker login` موفق ولی pull fail | package به repo دیگر لینک است | از URL دقیق `ghcr.io/javid1371/sales-health-check` استفاده کن |

---

## امنیت

- PAT را در chat، commit، یا `.env` commit‌شده نگذار.
- فقط `read:packages` برای VPS کافی است — write لازم نیست.
- اگر توکن لو رفت: GitHub → Settings → tokens → **Delete** و توکن جدید بساز.

## Related

- [production-deploy.md](./production-deploy.md) — bootstrap و architecture
- [README.md](../../README.md) — deploy سریع
