"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateReportSettingsRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { ReportSettings } from "@/modules/report/report-config.service";
import type { CapacityMode } from "@/types/report-spec";

interface ReportSettingsFormProps {
  settings: ReportSettings;
}

const CAPACITY_OPTIONS: { value: CapacityMode; label: string; hint: string }[] =
  [
    {
      value: "free",
      label: "free",
      hint: "ظرفیت محدود — CTA مشاوره (پیش‌فرض عملیاتی)",
    },
    {
      value: "full",
      label: "full",
      hint: "ظرفیت کامل — مسیریابی CTA حالت کامل",
    },
  ];

export function ReportSettingsForm({ settings }: ReportSettingsFormProps) {
  const router = useRouter();
  const [capacityMode, setCapacityMode] = useState<CapacityMode>(
    settings.capacityMode,
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
      await updateReportSettingsRequest({ capacityMode });
      setSuccess("حالت CTA گزارش ذخیره شد.");
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
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">
        حالت CTA گزارش
      </h2>
      <p className="mb-6 text-sm text-zinc-600">
        این سوئیچ فقط مسیر CTA گزارش را کنترل می‌کند و با ظرفیت تخصیص لید
        (maxOpenLeads) متفاوت است. مقدار env فعلی:{" "}
        <span className="font-mono" dir="ltr">
          {settings.envCapacityMode}
        </span>
        {settings.capacityModeOverridden
          ? " — اکنون از پنل ادمین override شده است."
          : " — هنوز override پنل ذخیره نشده؛ از env استفاده می‌شود."}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-zinc-800">
            حالت CTA گزارش (CAPACITY_MODE)
          </legend>
          {CAPACITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50"
            >
              <input
                type="radio"
                name="capacityMode"
                value={option.value}
                checked={capacityMode === option.value}
                onChange={() => setCapacityMode(option.value)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-zinc-900" dir="ltr">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-zinc-600">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="text-xs text-zinc-500">
          گزارش‌های از قبل ساخته‌شده همان capacityMode ذخیره‌شده در reportSpec را
          نگه می‌دارند؛ تغییر فقط روی ارزیابی‌های جدید یا recompose اعمال می‌شود.
        </p>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}

        <Button type="submit" disabled={loading}>
          {loading ? "در حال ذخیره…" : "ذخیره"}
        </Button>
      </form>
    </Card>
  );
}
