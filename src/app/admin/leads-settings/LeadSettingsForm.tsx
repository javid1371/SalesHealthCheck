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
  const [assessmentIncompleteAfterHours, setAssessmentIncompleteAfterHours] =
    useState(String(settings.assessmentIncompleteAfterHours));
  const [expertNewLeadSms, setExpertNewLeadSms] = useState(
    settings.expertNewLeadSms,
  );
  const [maxOpenLeadsPerExpert, setMaxOpenLeadsPerExpert] = useState(
    String(settings.maxOpenLeadsPerExpert),
  );
  const [staleNewLeadHours, setStaleNewLeadHours] = useState(
    String(settings.staleNewLeadHours),
  );
  const [hotLeadDirectAssigneeId, setHotLeadDirectAssigneeId] = useState(
    settings.hotLeadDirectAssigneeId ?? "",
  );
  const [autoAssignExcludeStaffIds, setAutoAssignExcludeStaffIds] = useState<
    string[]
  >(settings.autoAssignExcludeStaffIds);
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
        assessmentIncompleteAfterHours: Number.parseInt(
          assessmentIncompleteAfterHours,
          10,
        ),
        expertNewLeadSms,
        maxOpenLeadsPerExpert: Number.parseInt(maxOpenLeadsPerExpert, 10),
        staleNewLeadHours: Number.parseInt(staleNewLeadHours, 10),
        hotLeadDirectAssigneeId: hotLeadDirectAssigneeId.trim() || null,
        autoAssignExcludeStaffIds,
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
              آستانه بی‌فعالیتی تست (ساعت)
            </label>
            <input
              type="number"
              min={0}
              value={assessmentIncompleteAfterHours}
              onChange={(e) =>
                setAssessmentIncompleteAfterHours(e.target.value)
              }
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              بعد از این مدت بدون فعالیت، لید «در حال انجام تست» به «پیگیری تکمیل
              تست» می‌رود.
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
            <p className="mt-1 text-xs text-zinc-500">
              الان در تخصیص اعمال می‌شود؛ کارشناس‌های پر رد می‌شوند (لیدهای «در
              حال انجام تست» در سقف شمرده نمی‌شوند).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              آستانه لید جدید کهنه (ساعت)
            </label>
            <input
              type="number"
              min={1}
              value={staleNewLeadHours}
              onChange={(e) => setStaleNewLeadHours(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">
              الان در مانیتورینگ اعمال می‌شود؛ لیدهای «درخواست مشاوره» قدیمی‌تر از
              این مدت در KPI و هشدارها کهنه محسوب می‌شوند.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3">
          <p className="text-sm font-medium text-zinc-600">
            تأخیر تخصیص لید سیستمی (ساعت) — منسوخ / بدون اثر
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            این تنظیم دیگر استفاده نمی‌شود؛ تخصیص با فعال بودن تخصیص خودکار و
            قوانین ظرفیت/لید داغ انجام می‌شود.
            {settings.systemAssignDelayHours > 0
              ? ` مقدار ذخیره‌شده قبلی: ${settings.systemAssignDelayHours} ساعت.`
              : null}
          </p>
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
          <p className="mt-1 text-xs text-zinc-500">
            بدون placeholder همان متن ثابت ارسال می‌شود. اختیاری:{" "}
            {"{{name}}"}, {"{{phone}}"}, {"{{probability}}"}, {"{{detailUrl}}"}{" "}
            (لینک مستقیم صفحه لید).
          </p>
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
            الان در تخصیص اعمال می‌شود؛ فقط برای لیدهای با احتمال خرید بالا، در
            صورت فعال و زیر سقف بودن این کارشناس؛ در غیر این صورت چرخش عادی.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700">
            خارج از تخصیص خودکار
          </p>
          <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
            {salesExperts.length === 0 ? (
              <p className="text-xs text-zinc-500">کارشناس فعالی نیست.</p>
            ) : (
              salesExperts.map((expert) => {
                const checked = autoAssignExcludeStaffIds.includes(expert.id);
                return (
                  <label
                    key={expert.id}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setAutoAssignExcludeStaffIds((prev) =>
                          e.target.checked
                            ? [...prev, expert.id]
                            : prev.filter((id) => id !== expert.id),
                        );
                      }}
                    />
                    {expert.name} ({expert.phone})
                  </label>
                );
              })
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            کارشناسان انتخاب‌شده در چرخش خودکار لید جدید/بدون تخصیص شرکت
            نمی‌کنند؛ تخصیص دستی همچنان ممکن است.
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
