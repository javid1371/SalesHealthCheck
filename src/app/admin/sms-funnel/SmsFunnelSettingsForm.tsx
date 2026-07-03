"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateSmsFunnelSettingsRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { FunnelSettings } from "@/modules/sms-funnel/sms-funnel-admin.types";

interface SmsFunnelSettingsFormProps {
  settings: FunnelSettings;
}

export function SmsFunnelSettingsForm({ settings }: SmsFunnelSettingsFormProps) {
  const router = useRouter();
  const [funnelEnabled, setFunnelEnabled] = useState(settings.funnelEnabled);
  const [quietHoursStart, setQuietHoursStart] = useState(
    String(settings.quietHoursStart),
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    String(settings.quietHoursEnd),
  );
  const [maxUnanswered, setMaxUnanswered] = useState(
    String(settings.maxUnanswered),
  );
  const [kavenegarSenderLine, setKavenegarSenderLine] = useState(
    settings.kavenegarSenderLine ?? "",
  );
  const [kavenegarOtpTemplate, setKavenegarOtpTemplate] = useState(
    settings.kavenegarOtpTemplate ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await updateSmsFunnelSettingsRequest({
        funnelEnabled,
        quietHoursStart: Number.parseInt(quietHoursStart, 10),
        quietHoursEnd: Number.parseInt(quietHoursEnd, 10),
        maxUnanswered: Number.parseInt(maxUnanswered, 10),
        kavenegarSenderLine: kavenegarSenderLine.trim() || null,
        kavenegarOtpTemplate: kavenegarOtpTemplate.trim() || null,
      });
      setSuccess("تنظیمات ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ذخیره تنظیمات با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">
        تنظیمات سراسری
      </h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={funnelEnabled}
            onChange={(e) => setFunnelEnabled(e.target.checked)}
          />
          قیف پیامکی فعال باشد
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              ساعت شروع مجاز (۰–۲۳)
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={quietHoursStart}
              onChange={(e) => setQuietHoursStart(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              ساعت پایان مجاز (۰–۲۳)
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={quietHoursEnd}
              onChange={(e) => setQuietHoursEnd(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              سقف پیام بدون واکنش
            </label>
            <input
              type="number"
              min={1}
              value={maxUnanswered}
              onChange={(e) => setMaxUnanswered(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-zinc-900">کاوه‌نگار</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                settings.apiKeyConfigured
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}
            >
              {settings.apiKeyConfigured
                ? "کلید API از env تنظیم شده"
                : "کلید API تنظیم نشده — OTP/SMS واقعی کار نمی‌کند"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                خط ارسال SMS
              </label>
              <input
                type="text"
                value={kavenegarSenderLine}
                onChange={(e) => setKavenegarSenderLine(e.target.value)}
                placeholder="مثلاً 10004346"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                نام قالب OTP
              </label>
              <input
                type="text"
                value={kavenegarOtpTemplate}
                onChange={(e) => setKavenegarOtpTemplate(e.target.value)}
                placeholder="مثلاً verify"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            کلید API فقط از متغیر محیطی سرور خوانده می‌شود. خط ارسال و قالب OTP
            پس از ذخیره بلافاصله اعمال می‌شوند.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-700" role="status">
            {success}
          </p>
        ) : null}

        <Button type="submit" loading={loading} disabled={loading}>
          ذخیره تنظیمات
        </Button>
      </form>
    </Card>
  );
}
