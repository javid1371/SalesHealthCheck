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
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
