# GHCR خصوصی — ساخت توکن و تنظیم VPS

پروژه و Docker image روی GitHub **private** می‌مانند. VPS برای `docker pull` باید با توکن وارد GHCR شود.

## خلاصه

| کجا | چه توکنی | برای چه |
|-----|----------|---------|
| GitHub → Secrets → Actions | `GHCR_TOKEN` | deploy خودکار از CI به VPS |
| VPS (یک بار) | Classic PAT | `docker login ghcr.io` روی سرور |
| لپ‌تاپ (اختیاری) | Classic PAT | `./scripts/deploy-to-vps.sh` با `GHCR_TOKEN=...` |

**Push image به GHCR** را CI با `GITHUB_TOKEN` داخلی انجام می‌دهد — برای build/push توکن جدا لازم نیست.

> **مهم:** GitHub Packages (GHCR) فقط **Personal Access Token (classic)** را قبول می‌کند. Fine-grained token (`github_pat_...`) برای `docker pull` کار **نمی‌کند** — گزینه Packages در آن UI وجود ندارد.

---

## مرحله ۱ — ساخت Classic token

1. برو به: [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token** → **Generate new token (classic)**
3. **Note:** `sales-health-check-ghcr`
4. **Expiration:** 90 days یا No expiration
5. **Scopes** (فقط این دو):
   - ✅ **`read:packages`** — pull از GHCR
   - ✅ **`repo`** — چون repository خصوصی است
6. **Generate token**
7. توکن `ghp_...` را **فقط یک بار** کپی کن — در chat، commit، یا screenshot نگذار.

---

## مرحله ۲ — توکن در GitHub Actions (deploy خودکار)

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `GHCR_TOKEN` — Value: Classic PAT (`ghp_...`)
4. (اختیاری برای auto-deploy) secrets دیگر:

| Name | Value |
|------|--------|
| `VPS_SSH_HOST` | `root@193.163.201.132` |
| `VPS_SSH_KEY` | محتوای فایل private key |

---

## مرحله ۳ — لاگین دائمی روی VPS (یک بار)

```bash
ssh root@193.163.201.132
read -s GHCR_TOKEN && echo "$GHCR_TOKEN" | docker login ghcr.io -u javid1371 --password-stdin
unset GHCR_TOKEN
```

(`read -s` توکن را در history ترمینال ذخیره نمی‌کند.)

Expected: `Login Succeeded` — اعبار در `/root/.docker/config.json` می‌ماند.

تست:

```bash
docker pull ghcr.io/javid1371/sales-health-check:latest
```

---

## مرحله ۴ — bootstrap یا deploy

**اولین بار** (از لپ‌تاپ — توکن را inline ننویس؛ از env استفاده کن):

```bash
chmod +x scripts/bootstrap-vps.sh scripts/deploy-to-vps.sh
read -s GHCR_TOKEN && export GHCR_TOKEN
./scripts/bootstrap-vps.sh root@193.163.201.132
unset GHCR_TOKEN
```

**به‌روزرسانی‌های بعدی** (اگر روی VPS قبلاً `docker login` کردی):

```bash
./scripts/deploy-to-vps.sh root@193.163.201.132
```

---

## عیب‌یابی

| خطا | علت | راه‌حل |
|-----|-----|--------|
| `denied` / `unauthorized` | Classic PAT نیست یا scope کم | `read:packages` + `repo` |
| Fine-grained ساختم ولی Packages ندارم | GHCR classic-only است | Classic token بساز |
| `manifest unknown` | CI هنوز image push نکرده | Actions → job `build-push` روی `main` |
| `docker login` OK ولی pull fail | tag یا نام image | `ghcr.io/javid1371/sales-health-check:latest` |

---

## امنیت

- PAT را **هرگز** در chat، issue، commit، یا `.env` commit‌شده نگذار.
- اگر لو رفت: [github.com/settings/tokens](https://github.com/settings/tokens) → **Revoke** → توکن جدید بساز.
- فقط `read:packages` (+ `repo`) کافی است — `write:packages` لازم نیست.

## Related

- [production-deploy.md](./production-deploy.md) — bootstrap و architecture
- [README.md](../../README.md) — deploy سریع
