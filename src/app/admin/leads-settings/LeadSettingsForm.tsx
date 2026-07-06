"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateLeadSettingsRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { LeadSettings } from "@/modules/consultation/lead-config.service";
import type { StaffUserSummary } from "@/modules/staff/staff.types";

interface LeadSettingsFormProps {
  settings: LeadSettings;
  salesExperts: StaffUserSummary[];
}

export function LeadSettingsForm({
  settings,
  salesExperts,
}: LeadSettingsFormProps) {
  const router = useRouter();
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(
    settings.autoAssignEnabled,
  );
  const [systemAssignDelayHours, setSystemAssignDelayHours] = useState(
    String(settings.systemAssignDelayHours),
  );
  const [expertNewLeadSms, setExpertNewLeadSms] = useState(
    settings.expertNewLeadSms,
  );
  const [maxOpenLeadsPerExpert, setMaxOpenLeadsPerExpert] = useState(
    String(settings.maxOpenLeadsPerExpert),
  );
  const [hotLeadDirectAssigneeId, setHotLeadDirectAssigneeId] = useState(
    settings.hotLeadDirectAssigneeId ?? "",
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
      await updateLeadSettingsRequest({
        autoAssignEnabled,
        systemAssignDelayHours: Number.parseInt(systemAssignDelayHours, 10),
        expertNewLeadSms,
        maxOpenLeadsPerExpert: Number.parseInt(maxOpenLeadsPerExpert, 10),
        hotLeadDirectAssigneeId: hotLeadDirectAssigneeId.trim() || null,
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
        تنظیمات تخصیص لید
      </h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={autoAssignEnabled}
            onChange={(e) => setAutoAssignEnabled(e.target.checked)}
          />
          تخصیص خودکار لید فعال باشد
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              تأخیر تخصیص لید سیستمی (ساعت)
            </label>
            <input
              type="number"
              min={0}
              value={systemAssignDelayHours}
              onChange={(e) => setSystemAssignDelayHours(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              برای لیدهای hot شناسایی‌شده از Health Check؛ ۰ یعنی فوری.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              سقف لید باز هر کارشناس
            </label>
            <input
              type="number"
              min={1}
              value={maxOpenLeadsPerExpert}
              onChange={(e) => setMaxOpenLeadsPerExpert(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            متن SMS اطلاع لید جدید به کارشناس
          </label>
          <textarea
            value={expertNewLeadSms}
            onChange={(e) => setExpertNewLeadSms(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            تخصیص مستقیم لید hot (اختیاری)
          </label>
          <select
            value={hotLeadDirectAssigneeId}
            onChange={(e) => setHotLeadDirectAssigneeId(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">چرخش بین کارشناسان فعال</option>
            {salesExperts.map((expert) => (
              <option key={expert.id} value={expert.id}>
                {expert.name} ({expert.phone})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            اگر انتخاب شود، لیدهای hot مستقیماً به این کارشناس می‌روند.
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
