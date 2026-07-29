"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiClientError } from "@/lib/api-client";
import {
  addConsultationNoteRequest,
  claimConsultationLeadRequest,
  logConsultationCallRequest,
  transferConsultationLeadRequest,
  updateConsultationLeadRequest,
} from "@/lib/expert-client";
import {
  buildConsultationLeadDetailHref,
  buildConsultationListHref,
} from "@/modules/consultation/consultation-list.validators";
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOMES,
  LEAD_TRANSFER_REASON_LABELS,
  LEAD_TRANSFER_REASONS,
  LOST_REASON_LABELS,
  LOST_REASONS,
  TRANSFER_NOTE_MIN_LENGTH,
  suggestAfterCallDefaults,
  type CallOutcomeMatrix,
} from "@/modules/consultation/lead-activity";
import type {
  CallOutcome,
  LeadStatus,
  LeadTransferReason,
  LostReason,
} from "@prisma/client";

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

/** Local calendar day + N days as `YYYY-MM-DD` for date inputs. */
function localDateDaysFromNow(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface AssigneeOption {
  id: string;
  name: string;
}

interface LeadDetailClientProps {
  leadId: string;
  initialStatus: LeadStatus;
  initialAssignedToId: string | null;
  initialNextFollowUpAtIso: string | null;
  initialAdminProbabilityOverridePercent: number | null;
  initialLostReason: LostReason | null;
  initialLostNote: string | null;
  isAdmin: boolean;
  currentStaffUserId: string | null;
  canTransfer: boolean;
  canClaim?: boolean;
  assigneeOptions: AssigneeOption[];
  queueQueryString?: string;
  nextLeadId?: string | null;
  leadSummary?: ReactNode;
  historyExtras?: ReactNode;
  callOutcomeMatrix?: CallOutcomeMatrix;
}

export function LeadDetailClient({
  leadId,
  initialStatus,
  initialAssignedToId,
  initialNextFollowUpAtIso,
  initialAdminProbabilityOverridePercent,
  initialLostReason,
  initialLostNote,
  isAdmin,
  currentStaffUserId,
  canTransfer,
  canClaim = false,
  assigneeOptions,
  queueQueryString = "",
  nextLeadId = null,
  leadSummary,
  historyExtras,
  callOutcomeMatrix,
}: LeadDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [assignedToId, setAssignedToId] = useState(
    initialAssignedToId ?? "",
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    initialNextFollowUpAtIso ?? "",
  );
  const [adminProbabilityOverridePercent, setAdminProbabilityOverridePercent] =
    useState(
      initialAdminProbabilityOverridePercent != null
        ? String(initialAdminProbabilityOverridePercent)
        : "",
    );
  const [lostReason, setLostReason] = useState<LostReason | "">(
    initialLostReason ?? "",
  );
  const [lostNote, setLostNote] = useState(initialLostNote ?? "");
  const [noteBody, setNoteBody] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferReason, setTransferReason] = useState<LeadTransferReason | "">(
    "",
  );
  const [transferNote, setTransferNote] = useState("");
  const [callOutcome, setCallOutcome] = useState<CallOutcome | "">("");
  const [callStatus, setCallStatus] = useState<LeadStatus>(initialStatus);
  const [callNextFollowUpAt, setCallNextFollowUpAt] = useState(
    initialNextFollowUpAtIso ?? "",
  );
  const [callLostReason, setCallLostReason] = useState<LostReason | "">("");
  const [callLostNote, setCallLostNote] = useState("");
  const [callNote, setCallNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);

  const transferOptions = assigneeOptions.filter(
    (option) =>
      option.id !== currentStaffUserId && option.id !== (assignedToId || null),
  );

  function applyAfterCallSuggestions(outcome: CallOutcome | "") {
    if (!outcome) {
      setCallStatus(initialStatus);
      setCallNextFollowUpAt(initialNextFollowUpAtIso ?? "");
      setCallLostReason("");
      setCallLostNote("");
      return;
    }

    const suggestion = suggestAfterCallDefaults(outcome, callOutcomeMatrix);
    setCallStatus(suggestion.status ?? initialStatus);

    if (suggestion.nextFollowUpDays === undefined) {
      setCallNextFollowUpAt(initialNextFollowUpAtIso ?? "");
    } else if (suggestion.nextFollowUpDays === null) {
      setCallNextFollowUpAt("");
    } else {
      setCallNextFollowUpAt(localDateDaysFromNow(suggestion.nextFollowUpDays));
    }

    setCallLostReason(suggestion.lostReason ?? "");
    setCallLostNote("");
  }

  async function handleUpdateLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "closed_lost" && !lostReason) {
      setError("برای بستن ناموفق، دلیل باخت الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: {
        status?: LeadStatus;
        assignedToId?: string | null;
        nextFollowUpAt?: string | null;
        adminProbabilityOverridePercent?: number | null;
        lostReason?: LostReason;
        lostNote?: string | null;
      } = { status };

      if (isAdmin) {
        if (adminProbabilityOverridePercent.trim() === "") {
          payload.adminProbabilityOverridePercent = null;
        } else {
          payload.adminProbabilityOverridePercent = Number.parseInt(
            adminProbabilityOverridePercent,
            10,
          );
        }
      }

      payload.nextFollowUpAt = nextFollowUpAt
        ? new Date(nextFollowUpAt).toISOString()
        : null;

      if (status === "closed_lost" && lostReason) {
        payload.lostReason = lostReason;
        if (lostReason === "other") {
          payload.lostNote = lostNote.trim() || null;
        }
      }

      await updateConsultationLeadRequest(leadId, payload);
      setSuccess("تغییرات ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در ذخیره تغییرات.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUnassign() {
    if (!isAdmin || !assignedToId) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updateConsultationLeadRequest(leadId, { assignedToId: null });
      setAssignedToId("");
      setSuccess("تخصیص لید لغو شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در لغو تخصیص.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await claimConsultationLeadRequest(leadId);
      setAssignedToId(currentStaffUserId ?? "");
      setSuccess("سرنخ با موفقیت برداشته شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در برداشتن سرنخ.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transferToId || !transferReason) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await transferConsultationLeadRequest(leadId, {
        toStaffUserId: transferToId,
        reason: transferReason,
        note: transferNote.trim(),
      });
      setAssignedToId(transferToId);
      setTransferToId("");
      setTransferReason("");
      setTransferNote("");
      setSuccess("سرنخ منتقل شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در انتقال سرنخ.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogCall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!callOutcome) {
      return;
    }

    if (callStatus === "closed_lost" && !callLostReason) {
      setError("برای بستن ناموفق، دلیل باخت الزامی است.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const note = callNote.trim();
      const payload: Parameters<typeof logConsultationCallRequest>[1] = {
        outcome: callOutcome,
        status: callStatus,
        nextFollowUpAt: callNextFollowUpAt
          ? new Date(callNextFollowUpAt).toISOString()
          : null,
        ...(note ? { note } : {}),
      };

      if (callStatus === "closed_lost" && callLostReason) {
        payload.lostReason = callLostReason;
        if (callLostReason === "other") {
          payload.lostNote = callLostNote.trim() || null;
        }
      }

      await logConsultationCallRequest(leadId, payload);
      setCallOutcome("");
      setCallNote("");
      setCallLostReason("");
      setCallLostNote("");
      setCallStatus(callStatus);
      setStatus(callStatus);
      setNextFollowUpAt(callNextFollowUpAt);
      if (callStatus === "closed_lost" && callLostReason) {
        setLostReason(callLostReason);
        setLostNote(callLostReason === "other" ? callLostNote : "");
      }

      // Queue context: advance to next lead, or return to the filtered list.
      if (queueQueryString) {
        if (nextLeadId) {
          router.push(
            buildConsultationLeadDetailHref(nextLeadId, queueQueryString),
          );
        } else {
          router.push(buildConsultationListHref(queueQueryString));
        }
        return;
      }

      setSuccess("تماس و پیگیری ثبت شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در ثبت تماس.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteBody.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addConsultationNoteRequest(leadId, noteBody.trim());
      setNoteBody("");
      setSuccess("یادداشت ثبت شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "خطا در ثبت یادداشت.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (canClaim) {
    return (
      <div className="space-y-6">
        <Card>
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">
            صف تیم
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            این سرنخ هنوز تخصیص نشده است. با برداشتن آن، مالک پیگیری می‌شوید.
          </p>
          {error ? <ErrorMessage message={error} /> : null}
          {success ? (
            <p className="mb-4 text-sm text-emerald-700" role="status">
              {success}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={() => void handleClaim()}
            loading={loading}
            loadingLabel="در حال برداشتن…"
          >
            برداشتن سرنخ
          </Button>
        </Card>
        {leadSummary}
        {historyExtras ? (
          <details
            className="rounded-2xl border border-zinc-200 bg-white"
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer select-none px-5 py-4 text-lg font-semibold text-zinc-900">
              تاریخچه
            </summary>
            <div className="space-y-6 border-t border-zinc-200 px-5 py-5">
              {historyExtras}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {queueQueryString && nextLeadId ? (
        <p className="text-sm text-zinc-500">
          <Link
            href={buildConsultationLeadDetailHref(nextLeadId, queueQueryString)}
            className="hover:text-zinc-700 hover:underline"
          >
            سرنخ بعدی
          </Link>
        </p>
      ) : null}
      <section aria-labelledby="lead-next-action-heading">
        <h2
          id="lead-next-action-heading"
          className="mb-4 text-lg font-semibold text-zinc-900"
        >
          اقدام بعدی
        </h2>
        <div className="space-y-4">
          <Card>
            <h3 className="mb-4 text-base font-semibold text-zinc-900">
              بعد از تماس
            </h3>
            <form onSubmit={handleLogCall} className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="نتیجه تماس" htmlFor="lead-call-outcome">
                <Select
                  id="lead-call-outcome"
                  value={callOutcome}
                  onChange={(event) => {
                    const next = event.target.value as CallOutcome | "";
                    setCallOutcome(next);
                    applyAfterCallSuggestions(next);
                  }}
                  disabled={loading}
                  required
                >
                  <option value="">انتخاب نتیجه</option>
                  {CALL_OUTCOMES.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {CALL_OUTCOME_LABELS[outcome]}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="وضعیت" htmlFor="lead-call-status">
                <Select
                  id="lead-call-status"
                  value={callStatus}
                  onChange={(event) => {
                    const nextStatus = event.target.value as LeadStatus;
                    setCallStatus(nextStatus);
                    if (nextStatus !== "closed_lost") {
                      setCallLostReason("");
                      setCallLostNote("");
                    }
                  }}
                  disabled={loading || !callOutcome}
                >
                  {STATUS_OPTIONS.filter(
                    (option) =>
                      option.value !== "assessment_in_progress" ||
                      callStatus === "assessment_in_progress",
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="پیگیری بعدی" htmlFor="lead-call-follow-up">
                <Input
                  id="lead-call-follow-up"
                  type="date"
                  value={callNextFollowUpAt}
                  onChange={(event) => setCallNextFollowUpAt(event.target.value)}
                  disabled={loading || !callOutcome}
                />
              </FieldLabel>

              {callStatus === "closed_lost" ? (
                <>
                  <FieldLabel
                    label="دلیل باخت"
                    htmlFor="lead-call-lost-reason"
                  >
                    <Select
                      id="lead-call-lost-reason"
                      value={callLostReason}
                      onChange={(event) =>
                        setCallLostReason(event.target.value as LostReason | "")
                      }
                      disabled={loading || !callOutcome}
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

                  {callLostReason === "other" ? (
                    <div className="sm:col-span-2">
                      <FieldLabel
                        label="توضیح باخت (اختیاری)"
                        htmlFor="lead-call-lost-note"
                      >
                        <textarea
                          id="lead-call-lost-note"
                          rows={2}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          value={callLostNote}
                          onChange={(event) =>
                            setCallLostNote(event.target.value)
                          }
                          disabled={loading}
                          placeholder="توضیح کوتاه دربارهٔ دلیل باخت…"
                        />
                      </FieldLabel>
                    </div>
                  ) : null}
                </>
              ) : null}

              <div className="sm:col-span-2">
                <FieldLabel label="یادداشت (اختیاری)" htmlFor="lead-call-note">
                  <textarea
                    id="lead-call-note"
                    rows={2}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={callNote}
                    onChange={(event) => setCallNote(event.target.value)}
                    disabled={loading}
                    placeholder="خلاصه کوتاه از تماس…"
                  />
                </FieldLabel>
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button
                  type="submit"
                  loading={loading}
                  loadingLabel="در حال ثبت…"
                  disabled={
                    !callOutcome ||
                    (callStatus === "closed_lost" && !callLostReason)
                  }
                >
                  ثبت
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h3 className="mb-1 text-base font-semibold text-zinc-900">
              وضعیت و پیگیری
            </h3>
            <p className="mb-4 text-sm text-zinc-500">
              برای تغییر بدون ثبت تماس
            </p>
            <form
              onSubmit={handleUpdateLead}
              className="grid gap-4 sm:grid-cols-2"
            >
              <FieldLabel label="وضعیت" htmlFor="lead-status">
                <Select
                  id="lead-status"
                  value={status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as LeadStatus;
                    setStatus(nextStatus);
                    if (nextStatus !== "closed_lost") {
                      setLostReason(initialLostReason ?? "");
                      setLostNote(initialLostNote ?? "");
                    }
                  }}
                  disabled={loading}
                >
                  {STATUS_OPTIONS.filter(
                    (option) =>
                      option.value !== "assessment_in_progress" ||
                      status === "assessment_in_progress",
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="پیگیری بعدی" htmlFor="lead-follow-up">
                <Input
                  id="lead-follow-up"
                  type="date"
                  value={nextFollowUpAt}
                  onChange={(event) => setNextFollowUpAt(event.target.value)}
                  disabled={loading}
                />
              </FieldLabel>

              {status === "closed_lost" ? (
                <>
                  <FieldLabel label="دلیل باخت" htmlFor="lead-lost-reason">
                    <Select
                      id="lead-lost-reason"
                      value={lostReason}
                      onChange={(event) =>
                        setLostReason(event.target.value as LostReason | "")
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

                  {lostReason === "other" ? (
                    <div className="sm:col-span-2">
                      <FieldLabel
                        label="توضیح باخت (اختیاری)"
                        htmlFor="lead-lost-note"
                      >
                        <textarea
                          id="lead-lost-note"
                          rows={2}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          value={lostNote}
                          onChange={(event) => setLostNote(event.target.value)}
                          disabled={loading}
                          placeholder="توضیح کوتاه دربارهٔ دلیل باخت…"
                        />
                      </FieldLabel>
                    </div>
                  ) : null}
                </>
              ) : null}

              {isAdmin ? (
                <FieldLabel
                  label="بازنویسی احتمال خرید (٪)"
                  htmlFor="lead-probability-override"
                >
                  <Input
                    id="lead-probability-override"
                    type="number"
                    min={0}
                    max={100}
                    dir="ltr"
                    placeholder="خالی = مقدار سیستمی"
                    value={adminProbabilityOverridePercent}
                    onChange={(event) =>
                      setAdminProbabilityOverridePercent(event.target.value)
                    }
                    disabled={loading}
                  />
                </FieldLabel>
              ) : null}

              <div className="flex items-end sm:col-span-2">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={loading}
                  loadingLabel="در حال ذخیره…"
                  disabled={status === "closed_lost" && !lostReason}
                >
                  ذخیره تغییرات
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </section>

      {error ? <ErrorMessage message={error} /> : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}

      {leadSummary}

      <details
        className="rounded-2xl border border-zinc-200 bg-white"
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none px-5 py-4 text-lg font-semibold text-zinc-900">
          تاریخچه
        </summary>
        <div className="space-y-6 border-t border-zinc-200 px-5 py-5">
          <Card className="border-zinc-100 shadow-none">
            <h3 className="mb-4 text-base font-semibold text-zinc-900">
              افزودن یادداشت
            </h3>
            <form onSubmit={handleAddNote} className="space-y-4">
              <FieldLabel label="متن یادداشت" htmlFor="lead-note">
                <textarea
                  id="lead-note"
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  disabled={loading}
                />
              </FieldLabel>
              <Button
                type="submit"
                variant="secondary"
                loading={loading}
                loadingLabel="در حال ثبت…"
                disabled={!noteBody.trim()}
              >
                ثبت یادداشت
              </Button>
            </form>
          </Card>

          {canTransfer ? (
            <Card className="border-zinc-100 shadow-none">
              <h3 className="mb-4 text-base font-semibold text-zinc-900">
                انتقال سرنخ
              </h3>
              <form
                onSubmit={handleTransfer}
                className="grid gap-4 sm:grid-cols-2"
              >
                <FieldLabel label="انتقال به همکار" htmlFor="lead-transfer-to">
                  <Select
                    id="lead-transfer-to"
                    value={transferToId}
                    onChange={(event) => setTransferToId(event.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="">انتخاب کارشناس</option>
                    {transferOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>

                <FieldLabel label="دلیل انتقال" htmlFor="lead-transfer-reason">
                  <Select
                    id="lead-transfer-reason"
                    value={transferReason}
                    onChange={(event) =>
                      setTransferReason(
                        event.target.value as LeadTransferReason | "",
                      )
                    }
                    disabled={loading}
                    required
                  >
                    <option value="">انتخاب دلیل</option>
                    {LEAD_TRANSFER_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {LEAD_TRANSFER_REASON_LABELS[reason]}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>

                <div className="sm:col-span-2">
                  <FieldLabel
                    label="یادداشت انتقال"
                    htmlFor="lead-transfer-note"
                  >
                    <textarea
                      id="lead-transfer-note"
                      rows={3}
                      required
                      minLength={TRANSFER_NOTE_MIN_LENGTH}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={transferNote}
                      onChange={(event) => setTransferNote(event.target.value)}
                      disabled={loading}
                      placeholder={`حداقل ${TRANSFER_NOTE_MIN_LENGTH} کاراکتر — زمینهٔ انتقال را بنویسید`}
                    />
                  </FieldLabel>
                </div>

                <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
                  <Button
                    type="submit"
                    loading={loading}
                    loadingLabel="در حال انتقال…"
                    disabled={
                      !transferToId ||
                      !transferReason ||
                      transferNote.trim().length < TRANSFER_NOTE_MIN_LENGTH
                    }
                  >
                    انتقال سرنخ
                  </Button>
                  {isAdmin && assignedToId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={loading}
                      loadingLabel="در حال لغو…"
                      onClick={handleUnassign}
                    >
                      لغو تخصیص
                    </Button>
                  ) : null}
                </div>
              </form>
            </Card>
          ) : null}

          {historyExtras}
        </div>
      </details>
    </div>
  );
}
