"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkUpdateLeadsRequest,
  createManualLeadRequest,
} from "@/lib/admin-client";
import { claimConsultationLeadRequest } from "@/lib/expert-client";
import { buildConsultationLeadDetailHref } from "@/modules/consultation/consultation-list.validators";
import type { ConsultationListItem } from "@/modules/consultation/consultation.types";
import {
  LOST_REASON_LABELS,
  LOST_REASONS,
} from "@/modules/consultation/lead-activity";
import type { LeadStatus, LostReason } from "@prisma/client";

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: "assessment_in_progress", label: "در حال انجام تست" },
  { value: "assessment_incomplete", label: "پیگیری تکمیل تست" },
  { value: "assessment_completed", label: "تست تکمیل‌شده" },
  { value: "new", label: "آماده تماس" },
  { value: "contacted", label: "تماس گرفته‌شده" },
  { value: "meeting_scheduled", label: "جلسه تنظیم‌شده" },
  { value: "closed_won", label: "بسته — موفق" },
  { value: "closed_lost", label: "بسته — ناموفق" },
  { value: "unreachable", label: "در دسترس نیست" },
];

interface AssigneeOption {
  id: string;
  name: string;
}

interface ConsultationListWithAdminProps {
  requests: ConsultationListItem[];
  assigneeOptions: AssigneeOption[];
  exportQueryString: string;
  isAdmin: boolean;
  showClaimActions?: boolean;
  queueQueryString?: string;
}

export function ConsultationListWithAdmin({
  requests,
  assigneeOptions,
  exportQueryString,
  isAdmin,
  showClaimActions = false,
  queueQueryString = "",
}: ConsultationListWithAdminProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>("new");
  const bulkStatusOptions = STATUS_OPTIONS.filter(
    (option) => option.value !== "assessment_in_progress",
  );
  const [bulkLostReason, setBulkLostReason] = useState<LostReason | "">("");
  const [bulkLostNote, setBulkLostNote] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const allSelected =
    requests.length > 0 && selectedIds.size === requests.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((item) => item.id)));
    }
  }

  function toggleOne(id: string) {
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

  async function handleClaim(id: string) {
    setClaimingId(id);
    setError(null);
    setSuccess(null);
    try {
      await claimConsultationLeadRequest(id);
      setSuccess("سرنخ با موفقیت برداشته شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در برداشتن سرنخ.",
      );
    } finally {
      setClaimingId(null);
    }
  }

  async function handleBulkStatus() {
    if (selectedIds.size === 0) {
      return;
    }

    if (bulkStatus === "closed_lost" && !bulkLostReason) {
      setError("برای بستن ناموفق، دلیل باخت الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await bulkUpdateLeadsRequest({
        ids: [...selectedIds],
        status: bulkStatus,
        ...(bulkStatus === "closed_lost" && bulkLostReason
          ? {
              lostReason: bulkLostReason,
              ...(bulkLostReason === "other"
                ? { lostNote: bulkLostNote.trim() || null }
                : {}),
            }
          : {}),
      });
      setSuccess(`${result.updated.toLocaleString("fa-IR")} لید به‌روزرسانی شد.`);
      setSelectedIds(new Set());
      setBulkLostReason("");
      setBulkLostNote("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "خطا در به‌روزرسانی گروهی.",
      );
    } finally {
      setLoading(false);
    }
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
        assignedToId: bulkAssigneeId || null,
      });
      setSuccess(`${result.updated.toLocaleString("fa-IR")} لید تخصیص یافت.`);
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

  async function handleCreateManualLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await createManualLeadRequest({
        name: manualName.trim(),
        phone: manualPhone.trim() || undefined,
        email: manualEmail.trim() || undefined,
        message: manualMessage.trim() || undefined,
      });
      setSuccess("لید دستی ایجاد شد.");
      setManualName("");
      setManualPhone("");
      setManualEmail("");
      setManualMessage("");
      setShowManualForm(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "خطا در ایجاد لید.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {isAdmin ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <a
            href={`/api/admin/leads/export?${exportQueryString}`}
            className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            خروجی CSV
          </a>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowManualForm((value) => !value)}
          >
            {showManualForm ? "بستن فرم لید" : "لید دستی جدید"}
          </Button>
        </div>
      ) : null}

      {isAdmin && showManualForm ? (
        <form
          onSubmit={handleCreateManualLead}
          className="mb-6 grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-2"
        >
          <FieldLabel label="نام" htmlFor="manual-name">
            <Input
              id="manual-name"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              required
              disabled={loading}
            />
          </FieldLabel>
          <FieldLabel label="موبایل" htmlFor="manual-phone">
            <Input
              id="manual-phone"
              type="tel"
              dir="ltr"
              value={manualPhone}
              onChange={(event) => setManualPhone(event.target.value)}
              disabled={loading}
            />
          </FieldLabel>
          <FieldLabel label="ایمیل" htmlFor="manual-email">
            <Input
              id="manual-email"
              type="email"
              dir="ltr"
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              disabled={loading}
            />
          </FieldLabel>
          <FieldLabel label="پیام" htmlFor="manual-message">
            <Input
              id="manual-message"
              value={manualMessage}
              onChange={(event) => setManualMessage(event.target.value)}
              disabled={loading}
            />
          </FieldLabel>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" loading={loading} loadingLabel="در حال ایجاد…">
              ایجاد لید
            </Button>
          </div>
        </form>
      ) : null}

      {isAdmin && selectedIds.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-700">
            {selectedIds.size.toLocaleString("fa-IR")} لید انتخاب شده
          </p>
          <FieldLabel label="تغییر وضعیت" htmlFor="bulk-status">
            <Select
              id="bulk-status"
              value={bulkStatus}
              onChange={(event) => {
                const nextStatus = event.target.value as LeadStatus;
                setBulkStatus(nextStatus);
                if (nextStatus !== "closed_lost") {
                  setBulkLostReason("");
                  setBulkLostNote("");
                }
              }}
              disabled={loading}
            >
              {bulkStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>
          {bulkStatus === "closed_lost" ? (
            <>
              <FieldLabel label="دلیل باخت" htmlFor="bulk-lost-reason">
                <Select
                  id="bulk-lost-reason"
                  value={bulkLostReason}
                  onChange={(event) =>
                    setBulkLostReason(event.target.value as LostReason | "")
                  }
                  disabled={loading}
                  required
                >
                  <option value="">انتخاب دلیل</option>
                  {LOST_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {LOST_REASON_LABELS[reason]}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              {bulkLostReason === "other" ? (
                <FieldLabel label="توضیح (اختیاری)" htmlFor="bulk-lost-note">
                  <Input
                    id="bulk-lost-note"
                    value={bulkLostNote}
                    onChange={(event) => setBulkLostNote(event.target.value)}
                    disabled={loading}
                  />
                </FieldLabel>
              ) : null}
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleBulkStatus}
            loading={loading}
            loadingLabel="در حال اعمال…"
            disabled={bulkStatus === "closed_lost" && !bulkLostReason}
          >
            اعمال وضعیت
          </Button>
          <FieldLabel label="تخصیص به" htmlFor="bulk-assignee">
            <Select
              id="bulk-assignee"
              value={bulkAssigneeId}
              onChange={(event) => setBulkAssigneeId(event.target.value)}
              disabled={loading}
            >
              <option value="">بدون تخصیص</option>
              {assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldLabel>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleBulkAssign}
            loading={loading}
            loadingLabel="در حال تخصیص…"
          >
            اعمال تخصیص
          </Button>
        </div>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}
      {success ? (
        <p className="mb-4 text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
            <tr>
              {isAdmin ? (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="انتخاب همه"
                    className="rounded border-zinc-300"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
              <th className="px-4 py-3 font-medium text-zinc-700">SLA</th>
              <th className="px-4 py-3 font-medium text-zinc-700">منبع</th>
              <th className="px-4 py-3 font-medium text-zinc-700">احتمال خرید</th>
              <th className="px-4 py-3 font-medium text-zinc-700">تخصیص</th>
              <th className="px-4 py-3 font-medium text-zinc-700">نام</th>
              <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
              <th className="px-4 py-3 font-medium text-zinc-700">کسب‌وکار</th>
              <th className="px-4 py-3 font-medium text-zinc-700">امتیاز</th>
              <th className="px-4 py-3 font-medium text-zinc-700">پیام</th>
              <th className="px-4 py-3 font-medium text-zinc-700">تاریخ</th>
              <th className="px-4 py-3 font-medium text-zinc-700" aria-label="عملیات" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {requests.map((item) => {
              const phone = item.phone ?? item.assessmentUserPhone;
              return (
              <tr
                key={item.id}
                className={`align-top hover:bg-zinc-50/80 ${
                  item.sla.severity === "red"
                    ? "bg-red-50/60"
                    : item.sla.severity === "amber"
                      ? "bg-amber-50/50"
                      : ""
                }`}
              >
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`انتخاب ${item.name}`}
                      className="rounded border-zinc-300"
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700">
                      {item.statusLabel}
                    </span>
                    {item.status === "assessment_in_progress" ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                        تماس نگیرید
                      </span>
                    ) : null}
                    {item.status === "closed_lost" && item.lostReasonLabel ? (
                      <span className="rounded-full bg-zinc-50 px-2.5 py-0.5 text-xs text-zinc-600">
                        {item.lostReasonLabel}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {item.slaReason ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.sla.severity === "red"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.slaReason}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 ${
                      item.source === "system"
                        ? "bg-amber-100 text-amber-800"
                        : item.source === "messenger"
                          ? "bg-violet-100 text-violet-800"
                          : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {item.sourceLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {item.purchaseProbabilityLabel ?? "—"}
                  {item.adminProbabilityOverridePercent != null ? (
                    <span className="mr-1 text-xs text-amber-700">(دستی)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {item.pendingAssignment ? (
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sky-800">
                      در صف تخصیص
                    </span>
                  ) : (
                    (item.assignedToName ?? "—")
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-zinc-600" dir="ltr">
                  {phone ? (
                    <a
                      href={`tel:${phone}`}
                      className="font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      {phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {item.businessName ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {item.overallScorePercentage != null
                    ? `${item.overallScorePercentage}٪`
                    : "—"}
                </td>
                <td className="max-w-xs px-4 py-3 text-zinc-600">
                  {item.message ? (
                    <span className="line-clamp-3">{item.message}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {item.createdAt}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col gap-1 text-sm">
                    {showClaimActions && item.assignedToId == null ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleClaim(item.id)}
                        loading={claimingId === item.id}
                        loadingLabel="در حال برداشتن…"
                        disabled={claimingId != null}
                      >
                        برداشتن سرنخ
                      </Button>
                    ) : null}
                    <Link
                      href={buildConsultationLeadDetailHref(
                        item.id,
                        queueQueryString,
                      )}
                      className="font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      جزئیات لید
                    </Link>
                    {item.reportUrl ? (
                      <Link
                        href={item.reportUrl}
                        className="font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        گزارش کامل
                      </Link>
                    ) : null}
                    {item.resultUrl ? (
                      <Link
                        href={item.resultUrl}
                        className="text-zinc-700 hover:text-zinc-900"
                      >
                        خلاصه نتیجه
                      </Link>
                    ) : null}
                    {item.expertViewUrl ? (
                      <Link
                        href={item.expertViewUrl}
                        className="text-zinc-600 hover:text-zinc-800"
                      >
                        نمای فروش
                      </Link>
                    ) : null}
                    {isAdmin && item.adminAssessmentUrl ? (
                      <Link
                        href={item.adminAssessmentUrl}
                        className="text-zinc-500 hover:text-zinc-700"
                      >
                        جزئیات ادمین
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
