"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  resetSmsFunnelStepRequest,
  updateSmsFunnelStepRequest,
} from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import {
  formatDelayMs,
  parseDelayInput,
} from "@/modules/sms-funnel/funnel-config.service";
import type { ResolvedStepForAdmin } from "@/modules/sms-funnel/sms-funnel-admin.types";

interface SmsStepEditorProps {
  sequenceKey: string;
  step: ResolvedStepForAdmin;
}

function delayToParts(delayMs: number): {
  value: number;
  unit: "minute" | "hour" | "day";
} {
  if (delayMs === 0) return { value: 0, unit: "minute" };
  const minutes = delayMs / (60 * 1000);
  if (minutes % (24 * 60) === 0 && minutes >= 24 * 60) {
    return { value: minutes / (24 * 60), unit: "day" };
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    return { value: minutes / 60, unit: "hour" };
  }
  return { value: minutes, unit: "minute" };
}

export function SmsStepEditor({ sequenceKey, step }: SmsStepEditorProps) {
  const router = useRouter();
  const initialDelay = delayToParts(step.delayMs);
  const [body, setBody] = useState(step.body);
  const [bodyLow, setBodyLow] = useState(step.bodyByScoreBand?.low ?? "");
  const [bodyMedium, setBodyMedium] = useState(step.bodyByScoreBand?.medium ?? "");
  const [bodyHigh, setBodyHigh] = useState(step.bodyByScoreBand?.high ?? "");
  const [delayValue, setDelayValue] = useState(String(initialDelay.value));
  const [delayUnit, setDelayUnit] = useState<"minute" | "hour" | "day">(
    initialDelay.unit,
  );
  const [enabled, setEnabled] = useState(step.enabled);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showScoreBands =
    Boolean(step.defaultBodyLow || step.defaultBodyMedium || step.defaultBodyHigh) ||
    Boolean(bodyLow || bodyMedium || bodyHigh);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const parsedDelay = Number.parseFloat(delayValue);
    if (!Number.isFinite(parsedDelay) || parsedDelay < 0) {
      setError("تاخیر باید عدد معتبر باشد.");
      setLoading(false);
      return;
    }

    try {
      await updateSmsFunnelStepRequest(sequenceKey, step.stepKey, {
        body,
        bodyLow: bodyLow.trim() ? bodyLow : null,
        bodyMedium: bodyMedium.trim() ? bodyMedium : null,
        bodyHigh: bodyHigh.trim() ? bodyHigh : null,
        delayMs: parseDelayInput(parsedDelay, delayUnit),
        enabled,
      });
      setSuccess("ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ذخیره پیام با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setError(null);
    setSuccess(null);
    setResetting(true);
    try {
      await resetSmsFunnelStepRequest(sequenceKey, step.stepKey);
      setSuccess("به پیش‌فرض بازگردانده شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "بازگردانی با خطا مواجه شد.",
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900">{step.stepKey}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            تاخیر فعلی: {formatDelayMs(step.delayMs)}
            {step.hasOverride ? " · سفارشی‌شده" : " · پیش‌فرض"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          فعال
        </label>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            متن پایه
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
          {step.defaultBody !== body ? (
            <p className="mt-1 text-xs text-zinc-500">
              پیش‌فرض: {step.defaultBody}
            </p>
          ) : null}
        </div>

        {showScoreBands ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                متن امتیاز پایین
              </label>
              <textarea
                value={bodyLow}
                onChange={(e) => setBodyLow(e.target.value)}
                rows={3}
                placeholder={step.defaultBodyLow ?? "اختیاری"}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                متن امتیاز متوسط
              </label>
              <textarea
                value={bodyMedium}
                onChange={(e) => setBodyMedium(e.target.value)}
                rows={3}
                placeholder={step.defaultBodyMedium ?? "اختیاری"}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                متن امتیاز بالا
              </label>
              <textarea
                value={bodyHigh}
                onChange={(e) => setBodyHigh(e.target.value)}
                rows={3}
                placeholder={step.defaultBodyHigh ?? "اختیاری"}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              تاخیر
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={delayValue}
              onChange={(e) => setDelayValue(e.target.value)}
              className="w-28 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              واحد
            </label>
            <select
              value={delayUnit}
              onChange={(e) =>
                setDelayUnit(e.target.value as "minute" | "hour" | "day")
              }
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="minute">دقیقه</option>
              <option value="hour">ساعت</option>
              <option value="day">روز</option>
            </select>
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

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={loading} disabled={loading || resetting}>
            ذخیره پیام
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={resetting}
            disabled={loading || resetting}
            onClick={() => void handleReset()}
          >
            بازگردانی به پیش‌فرض
          </Button>
        </div>
      </form>
    </Card>
  );
}
