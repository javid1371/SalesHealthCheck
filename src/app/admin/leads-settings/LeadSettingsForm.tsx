"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CallOutcome, LeadStatus, LostReason } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateLeadSettingsRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { LeadSettings } from "@/modules/consultation/lead-config.service";
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOMES,
  LOST_REASON_LABELS,
  LOST_REASONS,
  type AfterCallSuggestion,
  type CallOutcomeMatrix,
} from "@/modules/consultation/lead-activity";
import type { StaffUserSummary } from "@/modules/staff/staff.types";

interface LeadSettingsFormProps {
  settings: LeadSettings;
  salesExperts: StaffUserSummary[];
}

const SUGGESTED_STATUS_OPTIONS: Array<{ value: "" | LeadStatus; label: string }> =
  [
    { value: "", label: "بدون تغییر" },
    { value: "new", label: "آماده تماس" },
    { value: "contacted", label: "تماس گرفته‌شده" },
    { value: "meeting_scheduled", label: "جلسه تنظیم‌شده" },
    { value: "closed_lost", label: "بسته — ناموفق" },
    { value: "unreachable", label: "در دسترس نیست" },
  ];

function followUpToInput(value: number | null | undefined): string {
  if (value === undefined) return "";
  if (value === null) return "clear";
  return String(value);
}

function followUpFromInput(value: string): number | null | undefined {
  if (value === "") return undefined;
  if (value === "clear") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function LeadSettingsForm({
  settings,
  salesExperts,
}: LeadSettingsFormProps) {
  const router = useRouter();
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(
    settings.autoAssignEnabled,
  );
  const [createLeadOnAssessmentStart, setCreateLeadOnAssessmentStart] =
    useState(settings.createLeadOnAssessmentStart);
  const [pauseSystemLeadCreation, setPauseSystemLeadCreation] = useState(
    settings.pauseSystemLeadCreation,
  );
  const [assessmentIncompleteAfterHours, setAssessmentIncompleteAfterHours] =
    useState(String(settings.assessmentIncompleteAfterHours));
  const [expertNewLeadSms, setExpertNewLeadSms] = useState(
    settings.expertNewLeadSms,
  );
  const [adminOverdueFollowUpSmsEnabled, setAdminOverdueFollowUpSmsEnabled] =
    useState(settings.adminOverdueFollowUpSmsEnabled);
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
  const [slaHigh, setSlaHigh] = useState(
    String(settings.routingRules.firstContactSlaMinutesByBand.high),
  );
  const [slaMid, setSlaMid] = useState(
    String(settings.routingRules.firstContactSlaMinutesByBand.mid),
  );
  const [slaLow, setSlaLow] = useState(
    String(settings.routingRules.firstContactSlaMinutesByBand.low),
  );
  const [preferMessenger, setPreferMessenger] = useState(
    settings.routingRules.preferAssigneeBySource.messenger ?? "",
  );
  const [preferDirect, setPreferDirect] = useState(
    settings.routingRules.preferAssigneeBySource.direct ?? "",
  );
  const [excludeSources, setExcludeSources] = useState<string[]>(
    settings.routingRules.excludeSourcesFromAutoAssign,
  );
  const [requireCallOutcomeBeforeClose, setRequireCallOutcomeBeforeClose] =
    useState(settings.requireCallOutcomeBeforeClose);
  const [callOutcomeMatrix, setCallOutcomeMatrix] = useState<CallOutcomeMatrix>(
    settings.callOutcomeMatrix,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateMatrixEntry(
    outcome: CallOutcome,
    patch: Partial<AfterCallSuggestion> & {
      clearStatus?: boolean;
      clearLostReason?: boolean;
      nextFollowUpMode?: "unchanged" | "clear" | "days";
      nextFollowUpDaysText?: string;
    },
  ) {
    setCallOutcomeMatrix((prev) => {
      const current = { ...prev[outcome] };
      if (patch.clearStatus) {
        delete current.status;
      } else if (patch.status !== undefined) {
        current.status = patch.status;
      }
      if (patch.clearLostReason) {
        delete current.lostReason;
      } else if (patch.lostReason !== undefined) {
        current.lostReason = patch.lostReason;
      }
      if (patch.nextFollowUpMode === "unchanged") {
        delete current.nextFollowUpDays;
      } else if (patch.nextFollowUpMode === "clear") {
        current.nextFollowUpDays = null;
      } else if (patch.nextFollowUpMode === "days") {
        const days = followUpFromInput(patch.nextFollowUpDaysText ?? "1");
        if (typeof days === "number") {
          current.nextFollowUpDays = days;
        }
      }
      return { ...prev, [outcome]: current };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const preferAssigneeBySource: {
        messenger?: string;
        direct?: string;
      } = {};
      if (preferMessenger.trim()) {
        preferAssigneeBySource.messenger = preferMessenger.trim();
      }
      if (preferDirect.trim()) {
        preferAssigneeBySource.direct = preferDirect.trim();
      }

      await updateLeadSettingsRequest({
        autoAssignEnabled,
        createLeadOnAssessmentStart,
        pauseSystemLeadCreation,
        assessmentIncompleteAfterHours: Number.parseInt(
          assessmentIncompleteAfterHours,
          10,
        ),
        expertNewLeadSms,
        adminOverdueFollowUpSmsEnabled,
        maxOpenLeadsPerExpert: Number.parseInt(maxOpenLeadsPerExpert, 10),
        staleNewLeadHours: Number.parseInt(staleNewLeadHours, 10),
        hotLeadDirectAssigneeId: hotLeadDirectAssigneeId.trim() || null,
        autoAssignExcludeStaffIds,
        requireCallOutcomeBeforeClose,
        callOutcomeMatrix,
        routingRules: {
          firstContactSlaMinutesByBand: {
            high: Number.parseInt(slaHigh, 10),
            mid: Number.parseInt(slaMid, 10),
            low: Number.parseInt(slaLow, 10),
          },
          preferAssigneeBySource,
          excludeSourcesFromAutoAssign: excludeSources as Array<
            "direct" | "system" | "messenger"
          >,
        },
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

        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              قیف ارزیابی → لید
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              کنترل ایجاد لید سیستمی از مسیر ارزیابی، بدون خاموش کردن کل CRM.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800">
              آستانه بی‌فعالیتی تست (ساعت)
            </label>
            <input
              type="number"
              min={0}
              value={assessmentIncompleteAfterHours}
              onChange={(e) =>
                setAssessmentIncompleteAfterHours(e.target.value)
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-600">
              بعد از این مدت بدون فعالیت، لید «در حال انجام تست» به «پیگیری تکمیل
              تست» می‌رود.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={createLeadOnAssessmentStart}
              onChange={(e) => setCreateLeadOnAssessmentStart(e.target.checked)}
            />
            ایجاد لید سیستمی در شروع ارزیابی
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={pauseSystemLeadCreation}
              onChange={(e) => setPauseSystemLeadCreation(e.target.checked)}
            />
            توقف موقت ایجاد لید سیستمی جدید
          </label>
          <p className="text-xs text-zinc-500">
            با توقف ایجاد لید سیستمی، لیدهای موجود همچنان به‌روز می‌شوند؛ فقط
            ایجاد ردیف جدید با منبع system متوقف می‌شود.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
              الان در مانیتورینگ اعمال می‌شود؛ لیدهای «آماده تماس» قدیمی‌تر از
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

        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={adminOverdueFollowUpSmsEnabled}
            onChange={(e) =>
              setAdminOverdueFollowUpSmsEnabled(e.target.checked)
            }
          />
          <span>
            پیامک صبحگاهی پیگیری عقب‌افتاده به ادمین
            <span className="mt-0.5 block text-xs text-zinc-500">
              روزانه ۹–۱۱ (تهران) خلاصه عقب‌افتاده‌ها به‌ازای کارشناس ارسال
              می‌شود تا از کارشناسان پیگیری کنید.
            </span>
          </span>
        </label>

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

        <div className="space-y-4 rounded-xl border border-zinc-200 p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              قواعد مسیریابی و SLA تماس اول
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              لید داغ (hot) در صورت تنظیم، بر ترجیح بر اساس منبع اولویت دارد.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                SLA تماس اول — بالا (دقیقه)
              </label>
              <input
                type="number"
                min={1}
                value={slaHigh}
                onChange={(e) => setSlaHigh(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                SLA تماس اول — متوسط (دقیقه)
              </label>
              <input
                type="number"
                min={1}
                value={slaMid}
                onChange={(e) => setSlaMid(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                SLA تماس اول — پایین (دقیقه)
              </label>
              <input
                type="number"
                min={1}
                value={slaLow}
                onChange={(e) => setSlaLow(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                ترجیح کارشناس برای messenger
              </label>
              <select
                value={preferMessenger}
                onChange={(e) => setPreferMessenger(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">چرخش عادی</option>
                {salesExperts.map((expert) => (
                  <option key={expert.id} value={expert.id}>
                    {expert.name} ({expert.phone})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                ترجیح کارشناس برای direct
              </label>
              <select
                value={preferDirect}
                onChange={(e) => setPreferDirect(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">چرخش عادی</option>
                {salesExperts.map((expert) => (
                  <option key={expert.id} value={expert.id}>
                    {expert.name} ({expert.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              منابع خارج از تخصیص خودکار
            </p>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["direct", "direct"],
                  ["messenger", "messenger"],
                  ["system", "system"],
                ] as const
              ).map(([value, label]) => {
                const checked = excludeSources.includes(value);
                return (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setExcludeSources((prev) =>
                          e.target.checked
                            ? [...prev, value]
                            : prev.filter((item) => item !== value),
                        );
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-200 p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              ماتریس نتیجه تماس → پیشنهاد وضعیت
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              پیشنهادهای پس از ثبت تماس در صفحه لید و کانبان؛ کارشناس همچنان
              می‌تواند آن‌ها را تغییر دهد.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={requireCallOutcomeBeforeClose}
              onChange={(e) =>
                setRequireCallOutcomeBeforeClose(e.target.checked)
              }
            />
            برای بستن ناموفق / در دسترس نیست، نتیجه تماس الزامی باشد
          </label>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-right text-xs text-zinc-500">
                  <th className="px-2 py-2 font-medium">نتیجه تماس</th>
                  <th className="px-2 py-2 font-medium">وضعیت پیشنهادی</th>
                  <th className="px-2 py-2 font-medium">پیگیری (روز)</th>
                  <th className="px-2 py-2 font-medium">دلیل باخت</th>
                </tr>
              </thead>
              <tbody>
                {CALL_OUTCOMES.map((outcome) => {
                  const entry = callOutcomeMatrix[outcome];
                  const followUpValue = followUpToInput(entry.nextFollowUpDays);
                  return (
                    <tr
                      key={outcome}
                      className="border-b border-zinc-100 align-top"
                    >
                      <td className="px-2 py-2 font-medium text-zinc-800">
                        {CALL_OUTCOME_LABELS[outcome]}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={entry.status ?? ""}
                          onChange={(e) => {
                            const value = e.target.value as "" | LeadStatus;
                            if (!value) {
                              updateMatrixEntry(outcome, { clearStatus: true });
                            } else {
                              updateMatrixEntry(outcome, { status: value });
                            }
                          }}
                          className="w-full min-w-[9rem] rounded-lg border border-zinc-300 px-2 py-1.5"
                        >
                          {SUGGESTED_STATUS_OPTIONS.map((option) => (
                            <option key={option.value || "none"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={followUpValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              updateMatrixEntry(outcome, {
                                nextFollowUpMode: "unchanged",
                              });
                            } else if (value === "clear") {
                              updateMatrixEntry(outcome, {
                                nextFollowUpMode: "clear",
                              });
                            } else {
                              updateMatrixEntry(outcome, {
                                nextFollowUpMode: "days",
                                nextFollowUpDaysText: value,
                              });
                            }
                          }}
                          className="w-full min-w-[8rem] rounded-lg border border-zinc-300 px-2 py-1.5"
                        >
                          <option value="">بدون پیشنهاد</option>
                          <option value="clear">پاک کردن پیگیری</option>
                          {[1, 2, 3, 5, 7, 14].map((days) => (
                            <option key={days} value={String(days)}>
                              {days} روز بعد
                            </option>
                          ))}
                          {typeof entry.nextFollowUpDays === "number" &&
                          ![1, 2, 3, 5, 7, 14].includes(entry.nextFollowUpDays) ? (
                            <option value={String(entry.nextFollowUpDays)}>
                              {entry.nextFollowUpDays} روز بعد
                            </option>
                          ) : null}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={entry.lostReason ?? ""}
                          onChange={(e) => {
                            const value = e.target.value as "" | LostReason;
                            if (!value) {
                              updateMatrixEntry(outcome, {
                                clearLostReason: true,
                              });
                            } else {
                              updateMatrixEntry(outcome, { lostReason: value });
                            }
                          }}
                          className="w-full min-w-[8rem] rounded-lg border border-zinc-300 px-2 py-1.5"
                        >
                          <option value="">—</option>
                          {LOST_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {LOST_REASON_LABELS[reason]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
