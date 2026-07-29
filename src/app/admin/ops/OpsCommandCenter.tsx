"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  bulkUpdateLeadsRequest,
  updateSmsFunnelSettingsRequest,
} from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { OpsCommandCenterData } from "@/modules/admin/admin.types";

function formatFaDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function bandLabel(
  band: OpsCommandCenterData["queues"][number]["leads"][number]["purchaseProbabilityBand"],
): string {
  if (band === "high") return "بالا";
  if (band === "medium") return "متوسط";
  if (band === "low") return "پایین";
  return "—";
}

interface OpsCommandCenterProps {
  data: OpsCommandCenterData;
}

export function OpsCommandCenter({ data }: OpsCommandCenterProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [funnelEnabled, setFunnelEnabled] = useState(
    data.smsFunnel.funnelEnabled,
  );

  const allLeadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const queue of data.queues) {
      for (const lead of queue.leads) {
        ids.add(lead.id);
      }
    }
    return ids;
  }, [data.queues]);

  function toggleLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleQueue(queueKey: string, checked: boolean) {
    const queue = data.queues.find((item) => item.key === queueKey);
    if (!queue) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const lead of queue.leads) {
        if (checked) {
          next.add(lead.id);
        } else {
          next.delete(lead.id);
        }
      }
      return next;
    });
  }

  async function handleBulkAssign() {
    if (selectedIds.size === 0) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await bulkUpdateLeadsRequest({
        ids: [...selectedIds],
        assignedToId: assigneeId || null,
      });
      setSuccess(
        `${result.updated.toLocaleString("fa-IR")} لید ${
          assigneeId ? "تخصیص یافت" : "از تخصیص خارج شد"
        }.`,
      );
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "خطا در تخصیص گروهی.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSmsFunnel() {
    const nextEnabled = !funnelEnabled;
    setSmsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updateSmsFunnelSettingsRequest({ funnelEnabled: nextEnabled });
      setFunnelEnabled(nextEnabled);
      setSuccess(
        nextEnabled
          ? "قیف پیامکی دوباره فعال شد."
          : "قیف پیامکی موقتاً متوقف شد.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "تغییر وضعیت قیف پیامکی ناموفق بود.",
      );
    } finally {
      setSmsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {(error || success) && (
        <div className="space-y-2">
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
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {data.queues.map((queue) => (
          <Card
            key={queue.key}
            as={Link}
            href={queue.listHref}
            className="text-center transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <p className="text-sm text-zinc-600">{queue.title}</p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                queue.count > 0 ? "text-amber-700" : "text-zinc-900"
              }`}
            >
              {queue.count.toLocaleString("fa-IR")}
            </p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              اکشن سریع
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              تخصیص گروهی از صف‌های زیر، یا توقف موقت قیف SMS.
              {selectedIds.size > 0
                ? ` ${selectedIds.size.toLocaleString("fa-IR")} لید انتخاب شده.`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
              disabled={loading}
            >
              <option value="">بدون مسئول</option>
              {data.assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleBulkAssign()}
              loading={loading}
              disabled={selectedIds.size === 0}
            >
              تخصیص انتخاب‌شده‌ها
            </Button>
            <Button
              type="button"
              size="sm"
              variant={funnelEnabled ? "secondary" : "primary"}
              onClick={() => void handleToggleSmsFunnel()}
              loading={smsLoading}
            >
              {funnelEnabled ? "توقف موقت قیف SMS" : "فعال‌سازی قیف SMS"}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          وضعیت قیف پیامکی:{" "}
          <span
            className={
              funnelEnabled ? "font-medium text-emerald-700" : "font-medium text-red-700"
            }
          >
            {funnelEnabled ? "فعال" : "متوقف"}
          </span>
          {" · "}
          برای انتقال با دلیل، جزئیات لید را باز کنید.
        </p>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">
            ظرفیت کارشناسان
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            سقف باز:{" "}
            {data.settings.maxOpenLeadsPerExpert.toLocaleString("fa-IR")} لید
            {" · "}
            SLA تماس اول: بالا{" "}
            {data.settings.firstContactSlaMinutesByBand.high.toLocaleString(
              "fa-IR",
            )}
            / متوسط{" "}
            {data.settings.firstContactSlaMinutesByBand.mid.toLocaleString(
              "fa-IR",
            )}
            / پایین{" "}
            {data.settings.firstContactSlaMinutesByBand.low.toLocaleString(
              "fa-IR",
            )}{" "}
            دقیقه
          </p>
          {data.expertCapacity.length === 0 ? (
            <p className="text-sm text-zinc-500">کارشناس فعالی نیست.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="px-2 py-2 font-medium">کارشناس</th>
                    <th className="px-2 py-2 font-medium">باز</th>
                    <th className="px-2 py-2 font-medium">تماس امروز</th>
                    <th className="px-2 py-2 font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expertCapacity.map((row) => (
                    <tr
                      key={row.staffUserId}
                      className="border-b border-zinc-100"
                    >
                      <td className="px-2 py-2">
                        <Link
                          href={row.queueHref}
                          className="font-medium text-emerald-800 hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td
                        className={`px-2 py-2 ${
                          row.nearCapacity ? "font-semibold text-amber-700" : ""
                        }`}
                      >
                        {row.openLeads.toLocaleString("fa-IR")} /{" "}
                        {row.maxOpenLeads.toLocaleString("fa-IR")}
                        <span className="mr-1 text-xs text-zinc-500">
                          ({row.utilizationPercent.toLocaleString("fa-IR")}٪)
                        </span>
                      </td>
                      <td
                        className={`px-2 py-2 ${
                          row.dailyCapReached
                            ? "font-semibold text-amber-700"
                            : ""
                        }`}
                      >
                        {row.callsToday.toLocaleString("fa-IR")}
                        {row.maxDailyCalls != null
                          ? ` / ${row.maxDailyCalls.toLocaleString("fa-IR")}`
                          : ""}
                      </td>
                      <td className="px-2 py-2">
                        {row.assignmentPaused ? (
                          <span className="text-amber-800">توقف تخصیص</span>
                        ) : row.dailyCapReached ? (
                          <span className="text-amber-800">سقف روزانه</span>
                        ) : (
                          <span className="text-zinc-500">آماده</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">
            سلامت اتوماسیون
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            آخرین موفقیت/خطای cronها و صف SMS معوق.
          </p>
          <div
            className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
              data.automation.stalePendingSmsCount > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-zinc-100 bg-zinc-50 text-zinc-700"
            }`}
          >
            پیامک pending قدیمی‌تر از{" "}
            {data.automation.stalePendingSmsMinutes.toLocaleString("fa-IR")} دقیقه:{" "}
            <span className="font-semibold">
              {data.automation.stalePendingSmsCount.toLocaleString("fa-IR")}
            </span>
          </div>
          <ul className="space-y-3">
            {data.automation.heartbeats.map((item) => (
              <li
                key={item.key}
                className="rounded-xl border border-zinc-100 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900">{item.label}</span>
                  <span className="font-mono text-xs text-zinc-400">
                    {item.key}
                  </span>
                </div>
                <p className="mt-1 text-zinc-600">
                  آخرین موفقیت: {formatFaDateTime(item.lastSuccessAt)}
                </p>
                {item.lastError ? (
                  <p className="mt-1 text-red-700">
                    آخرین خطا ({formatFaDateTime(item.lastErrorAt)}):{" "}
                    {item.lastError}
                  </p>
                ) : (
                  <p className="mt-1 text-zinc-500">بدون خطای ثبت‌شده</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {data.queues.map((queue) => {
        const queueSelectedCount = queue.leads.filter((lead) =>
          selectedIds.has(lead.id),
        ).length;
        const allQueueSelected =
          queue.leads.length > 0 && queueSelectedCount === queue.leads.length;

        return (
          <Card key={queue.key}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {queue.title}{" "}
                  <span className="text-base font-normal text-zinc-500">
                    ({queue.count.toLocaleString("fa-IR")})
                  </span>
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{queue.description}</p>
              </div>
              <Link
                href={queue.listHref}
                className="text-sm font-medium text-emerald-800 hover:underline"
              >
                مشاهده کامل صف
              </Link>
            </div>

            {queue.leads.length === 0 ? (
              <p className="text-sm text-zinc-500">ردیفی برای نمایش نیست.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="px-2 py-2 font-medium">
                        <input
                          type="checkbox"
                          checked={allQueueSelected}
                          onChange={(event) =>
                            toggleQueue(queue.key, event.target.checked)
                          }
                          aria-label={`انتخاب همه ${queue.title}`}
                        />
                      </th>
                      <th className="px-2 py-2 font-medium">نام</th>
                      <th className="px-2 py-2 font-medium">وضعیت</th>
                      <th className="px-2 py-2 font-medium">احتمال</th>
                      <th className="px-2 py-2 font-medium">SLA</th>
                      <th className="px-2 py-2 font-medium">مسئول</th>
                      <th className="px-2 py-2 font-medium">زمان</th>
                      <th className="px-2 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {queue.leads.map((lead) => (
                      <tr
                        key={`${queue.key}-${lead.id}`}
                        className="border-b border-zinc-100"
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleLead(lead.id)}
                            aria-label={`انتخاب ${lead.name}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-medium text-zinc-900">
                            {lead.name}
                          </div>
                          {lead.phone ? (
                            <div className="text-xs text-zinc-500" dir="ltr">
                              {lead.phone}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">{lead.statusLabel}</td>
                        <td className="px-2 py-2">
                          {bandLabel(lead.purchaseProbabilityBand)}
                        </td>
                        <td className="px-2 py-2">
                          {lead.firstContactSlaBreached ? (
                            <span className="text-amber-800">
                              {lead.slaReason ?? "گذشته از SLA تماس اول"}
                            </span>
                          ) : lead.slaReason ? (
                            <span className="text-zinc-700">{lead.slaReason}</span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {lead.assignedToName ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-xs text-zinc-600">
                          {queue.key === "overdueFollowUps"
                            ? formatFaDateTime(lead.nextFollowUpAt)
                            : queue.key === "pendingAssignment"
                              ? formatFaDateTime(lead.assignScheduledFor)
                              : formatFaDateTime(lead.createdAt)}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={lead.detailUrl}
                            className="font-medium text-emerald-800 hover:underline"
                          >
                            جزئیات
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {allLeadIds.size === 0 ? (
        <Card className="text-center text-sm text-zinc-600">
          فعلاً صف اقدامی خالی است.
        </Card>
      ) : null}
    </div>
  );
}
