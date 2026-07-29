"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { ApiClientError } from "@/lib/api-client";
import {
  claimConsultationLeadRequest,
  logConsultationCallRequest,
  updateConsultationLeadRequest,
} from "@/lib/expert-client";
import { buildConsultationLeadDetailHref } from "@/modules/consultation/consultation-list.validators";
import type { ConsultationListItem } from "@/modules/consultation/consultation.types";
import {
  CALL_OUTCOME_LABELS,
  LOST_REASON_LABELS,
  LOST_REASONS,
  QUICK_CALL_OUTCOMES,
  resolveQuickCallLogFields,
  type CallOutcomeMatrix,
} from "@/modules/consultation/lead-activity";
import { isManualStatusTransitionAllowed } from "@/modules/consultation/lead-status";
import type { CallOutcome, LeadStatus, LostReason } from "@prisma/client";

const QUICK_ACTION_HIDDEN_STATUSES = new Set<LeadStatus>([
  "assessment_in_progress",
  "closed_won",
  "closed_lost",
]);

/** ~one column (17rem) + gap (1rem). */
const KANBAN_SCROLL_STEP_PX = 288;

function measureKanbanScrollEdges(scroller: HTMLElement): {
  canScrollLeft: boolean;
  canScrollRight: boolean;
} {
  if (scroller.scrollWidth <= scroller.clientWidth + 1) {
    return { canScrollLeft: false, canScrollRight: false };
  }

  const scrollerRect = scroller.getBoundingClientRect();
  let contentLeft = Infinity;
  let contentRight = -Infinity;
  for (const child of scroller.children) {
    const rect = child.getBoundingClientRect();
    contentLeft = Math.min(contentLeft, rect.left);
    contentRight = Math.max(contentRight, rect.right);
  }

  return {
    canScrollLeft: contentLeft < scrollerRect.left - 1,
    canScrollRight: contentRight > scrollerRect.right + 1,
  };
}

function stopKanbanScrollButtonPointer(
  event: React.PointerEvent | React.MouseEvent,
) {
  event.preventDefault();
  event.stopPropagation();
}

function canShowQuickActions(status: LeadStatus): boolean {
  return !QUICK_ACTION_HIDDEN_STATUSES.has(status);
}

function canMarkContacted(status: LeadStatus): boolean {
  return (
    status !== "contacted" &&
    isManualStatusTransitionAllowed(status, "contacted")
  );
}

/** Local calendar day + N days, as ISO (same shape as detail date field). */
function followUpAtIsoDaysFromNow(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}`).toISOString();
}

function formatFollowUpLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso.slice(0, 10);
  }
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(parsed);
}

const KANBAN_COLUMNS: Array<{
  status: LeadStatus;
  label: string;
  color: string;
}> = [
  {
    status: "assessment_in_progress",
    label: "در حال انجام تست",
    color: "border-rose-200 bg-rose-50/60",
  },
  {
    status: "assessment_incomplete",
    label: "پیگیری تکمیل تست",
    color: "border-orange-200 bg-orange-50/60",
  },
  {
    status: "assessment_completed",
    label: "تست تکمیل‌شده",
    color: "border-teal-200 bg-teal-50/60",
  },
  {
    status: "new",
    label: "آماده تماس",
    color: "border-sky-200 bg-sky-50/60",
  },
  {
    status: "contacted",
    label: "تماس گرفته‌شده",
    color: "border-blue-200 bg-blue-50/60",
  },
  {
    status: "meeting_scheduled",
    label: "جلسه تنظیم‌شده",
    color: "border-violet-200 bg-violet-50/60",
  },
  {
    status: "closed_won",
    label: "بسته — موفق",
    color: "border-emerald-200 bg-emerald-50/60",
  },
  {
    status: "closed_lost",
    label: "بسته — ناموفق",
    color: "border-zinc-200 bg-zinc-50/80",
  },
  {
    status: "unreachable",
    label: "در دسترس نیست",
    color: "border-amber-200 bg-amber-50/60",
  },
];

interface ConsultationKanbanViewProps {
  requests: ConsultationListItem[];
  showClaimActions?: boolean;
  queueQueryString?: string;
  callOutcomeMatrix?: CallOutcomeMatrix;
}

export function ConsultationKanbanView({
  requests: initialRequests,
  showClaimActions = false,
  queueQueryString = "",
  callOutcomeMatrix,
}: ConsultationKanbanViewProps) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<LeadStatus | null>(
    null,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLostMove, setPendingLostMove] = useState<{
    leadId: string;
    leadName: string;
    /** When set, confirm logs a quick call instead of a status-only move. */
    callOutcome?: CallOutcome;
  } | null>(null);
  const [pendingLostReason, setPendingLostReason] = useState<LostReason | "">(
    "",
  );
  const [pendingLostNote, setPendingLostNote] = useState("");

  const columns = useMemo(() => {
    const grouped = new Map<LeadStatus, ConsultationListItem[]>();
    for (const column of KANBAN_COLUMNS) {
      grouped.set(column.status, []);
    }

    for (const request of requests) {
      const bucket = grouped.get(request.status);
      if (bucket) {
        bucket.push(request);
      }
    }

    return KANBAN_COLUMNS.map((column) => ({
      ...column,
      items: grouped.get(column.status) ?? [],
    }));
  }, [requests]);

  function canDropOnto(status: LeadStatus): boolean {
    if (!draggingId) {
      return false;
    }
    const lead = requests.find((item) => item.id === draggingId);
    if (!lead) {
      return false;
    }
    return isManualStatusTransitionAllowed(lead.status, status);
  }

  async function handleClaim(leadId: string) {
    setClaimingId(leadId);
    setError(null);
    try {
      await claimConsultationLeadRequest(leadId);
      setRequests((current) => current.filter((item) => item.id !== leadId));
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

  async function applyLeadPatch(
    leadId: string,
    patch: {
      status?: LeadStatus;
      nextFollowUpAt?: string;
      lostReason?: LostReason;
      lostNote?: string | null;
    },
    optimistic: (item: ConsultationListItem) => ConsultationListItem,
  ) {
    setUpdatingId(leadId);
    setError(null);

    const previous = requests;
    setRequests((current) =>
      current.map((item) => (item.id === leadId ? optimistic(item) : item)),
    );

    try {
      await updateConsultationLeadRequest(leadId, patch);
      router.refresh();
    } catch (err) {
      setRequests(previous);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در به‌روزرسانی لید.",
      );
    } finally {
      setUpdatingId(null);
      setDraggingId(null);
      setDropTargetStatus(null);
    }
  }

  async function moveLead(
    leadId: string,
    newStatus: LeadStatus,
    lost?: { lostReason: LostReason; lostNote?: string | null },
  ) {
    const lead = requests.find((item) => item.id === leadId);
    if (!lead || lead.status === newStatus) {
      return;
    }

    if (!isManualStatusTransitionAllowed(lead.status, newStatus)) {
      setError("ورود دستی به وضعیت «در حال انجام تست» مجاز نیست.");
      setDraggingId(null);
      setDropTargetStatus(null);
      return;
    }

    if (newStatus === "closed_lost" && !lost?.lostReason) {
      setPendingLostMove({ leadId, leadName: lead.name });
      setPendingLostReason("");
      setPendingLostNote("");
      setDraggingId(null);
      setDropTargetStatus(null);
      return;
    }

    await applyLeadPatch(
      leadId,
      {
        status: newStatus,
        ...(lost?.lostReason
          ? {
              lostReason: lost.lostReason,
              ...(lost.lostReason === "other"
                ? { lostNote: lost.lostNote ?? null }
                : {}),
            }
          : {}),
      },
      (item) => ({
        ...item,
        status: newStatus,
        statusLabel:
          KANBAN_COLUMNS.find((column) => column.status === newStatus)?.label ??
          item.statusLabel,
        ...(lost?.lostReason
          ? {
              lostReason: lost.lostReason,
              lostReasonLabel: LOST_REASON_LABELS[lost.lostReason],
              lostNote:
                lost.lostReason === "other" ? (lost.lostNote ?? null) : null,
            }
          : {}),
      }),
    );
  }

  async function confirmLostMove() {
    if (!pendingLostMove || !pendingLostReason) {
      return;
    }
    const { leadId, callOutcome } = pendingLostMove;
    const lostNote =
      pendingLostReason === "other" ? pendingLostNote.trim() || null : null;
    setPendingLostMove(null);
    if (callOutcome) {
      await logQuickCall(leadId, callOutcome, {
        lostReason: pendingLostReason,
        lostNote,
      });
      return;
    }
    await moveLead(leadId, "closed_lost", {
      lostReason: pendingLostReason,
      lostNote,
    });
  }

  async function markContacted(leadId: string) {
    const lead = requests.find((item) => item.id === leadId);
    if (!lead || !canMarkContacted(lead.status)) {
      return;
    }
    await moveLead(leadId, "contacted");
  }

  async function setFollowUpInDays(leadId: string, days: number) {
    const lead = requests.find((item) => item.id === leadId);
    if (!lead || !canShowQuickActions(lead.status)) {
      return;
    }

    const nextFollowUpAt = followUpAtIsoDaysFromNow(days);
    await applyLeadPatch(leadId, { nextFollowUpAt }, (item) => ({
      ...item,
      nextFollowUpAt: formatFollowUpLabel(nextFollowUpAt),
      nextFollowUpAtIso: nextFollowUpAt.slice(0, 10),
    }));
  }

  async function logQuickCall(
    leadId: string,
    outcome: CallOutcome,
    lost?: { lostReason: LostReason; lostNote?: string | null },
  ) {
    const lead = requests.find((item) => item.id === leadId);
    if (!lead || !canShowQuickActions(lead.status)) {
      return;
    }

    const fields = resolveQuickCallLogFields(outcome, lost, callOutcomeMatrix);
    if (fields.needsLostReason) {
      setPendingLostMove({ leadId, leadName: lead.name, callOutcome: outcome });
      setPendingLostReason("");
      setPendingLostNote("");
      return;
    }

    const payload: Parameters<typeof logConsultationCallRequest>[1] = {
      outcome,
    };
    if (fields.status !== undefined) {
      payload.status = fields.status;
    }
    if (fields.nextFollowUpDays !== undefined) {
      payload.nextFollowUpAt =
        fields.nextFollowUpDays === null
          ? null
          : followUpAtIsoDaysFromNow(fields.nextFollowUpDays);
    }
    if (fields.lostReason) {
      payload.lostReason = fields.lostReason;
      if (fields.lostReason === "other") {
        payload.lostNote = fields.lostNote ?? null;
      }
    }

    const lostReason = fields.lostReason;

    setUpdatingId(leadId);
    setError(null);

    const previous = requests;
    const nowLabel = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const nextStatus = payload.status;
    const nextFollowUpAt = payload.nextFollowUpAt;
    setRequests((current) =>
      current.map((item) =>
        item.id === leadId
          ? {
              ...item,
              lastCallOutcome: outcome,
              lastCallOutcomeLabel: CALL_OUTCOME_LABELS[outcome],
              lastCalledAt: nowLabel,
              ...(nextStatus
                ? {
                    status: nextStatus,
                    statusLabel:
                      KANBAN_COLUMNS.find(
                        (column) => column.status === nextStatus,
                      )?.label ?? item.statusLabel,
                  }
                : {}),
              ...(nextFollowUpAt !== undefined
                ? {
                    nextFollowUpAt: nextFollowUpAt
                      ? formatFollowUpLabel(nextFollowUpAt)
                      : null,
                    nextFollowUpAtIso: nextFollowUpAt
                      ? nextFollowUpAt.slice(0, 10)
                      : null,
                  }
                : {}),
              ...(lostReason
                ? {
                    lostReason,
                    lostReasonLabel: LOST_REASON_LABELS[lostReason],
                    lostNote:
                      lostReason === "other" ? (lost?.lostNote ?? null) : null,
                  }
                : {}),
            }
          : item,
      ),
    );

    try {
      await logConsultationCallRequest(leadId, payload);
      router.refresh();
    } catch (err) {
      setRequests(previous);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در ثبت تماس.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function handleDragStart(leadId: string) {
    setDraggingId(leadId);
    setError(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetStatus(null);
  }

  function handleDragOver(event: React.DragEvent, status: LeadStatus) {
    if (!canDropOnto(status)) {
      return;
    }
    event.preventDefault();
    setDropTargetStatus(status);
  }

  function handleDrop(event: React.DragEvent, status: LeadStatus) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain") || draggingId;
    const lead = leadId
      ? requests.find((item) => item.id === leadId)
      : undefined;
    if (!leadId || !lead) {
      setDraggingId(null);
      setDropTargetStatus(null);
      return;
    }
    if (!isManualStatusTransitionAllowed(lead.status, status)) {
      setError("ورود دستی به وضعیت «در حال انجام تست» مجاز نیست.");
      setDraggingId(null);
      setDropTargetStatus(null);
      return;
    }
    void moveLead(leadId, status);
  }

  const updateScrollButtons = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const edges = measureKanbanScrollEdges(scroller);
    setCanScrollLeft(edges.canScrollLeft);
    setCanScrollRight(edges.canScrollRight);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    updateScrollButtons();
    scroller.addEventListener("scroll", updateScrollButtons, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      updateScrollButtons();
    });
    resizeObserver.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", updateScrollButtons);
      resizeObserver.disconnect();
    };
  }, [updateScrollButtons, columns]);

  return (
    <div>
      {error ? <ErrorMessage message={error} /> : null}

      {pendingLostMove ? (
        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-zinc-900">
            دلیل باخت برای «{pendingLostMove.leadName}»
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block">دلیل باخت</span>
              <select
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                value={pendingLostReason}
                onChange={(event) =>
                  setPendingLostReason(event.target.value as LostReason | "")
                }
              >
                <option value="">انتخاب دلیل</option>
                {LOST_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {LOST_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </label>
            {pendingLostReason === "other" ? (
              <label className="block text-sm text-zinc-700 sm:col-span-2">
                <span className="mb-1 block">توضیح (اختیاری)</span>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  value={pendingLostNote}
                  onChange={(event) => setPendingLostNote(event.target.value)}
                />
              </label>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!pendingLostReason || updatingId === pendingLostMove.leadId}
              onClick={() => void confirmLostMove()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              تأیید باخت
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingLostMove(null);
                setPendingLostReason("");
                setPendingLostNote("");
              }}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              انصراف
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        {canScrollLeft ? (
          <button
            type="button"
            draggable={false}
            aria-label="اسکرول به چپ"
            onPointerDown={stopKanbanScrollButtonPointer}
            onMouseDown={stopKanbanScrollButtonPointer}
            onClick={() => {
              scrollerRef.current?.scrollBy({
                left: -KANBAN_SCROLL_STEP_PX,
                behavior: "smooth",
              });
            }}
            className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-md hover:bg-zinc-50"
          >
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {canScrollRight ? (
          <button
            type="button"
            draggable={false}
            aria-label="اسکرول به راست"
            onPointerDown={stopKanbanScrollButtonPointer}
            onMouseDown={stopKanbanScrollButtonPointer}
            onClick={() => {
              scrollerRef.current?.scrollBy({
                left: KANBAN_SCROLL_STEP_PX,
                behavior: "smooth",
              });
            }}
            className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-md hover:bg-zinc-50"
          >
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="M7.5 4.5 13 10l-5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2"
        >
        {columns.map((column) => (
          <section
            key={column.status}
            className={`min-w-[17rem] flex-1 rounded-2xl border p-3 transition-colors ${
              column.color
            } ${
              dropTargetStatus === column.status &&
              draggingId &&
              canDropOnto(column.status)
                ? "ring-2 ring-emerald-500 ring-offset-2"
                : ""
            } ${
              draggingId &&
              column.status === "assessment_in_progress" &&
              !canDropOnto(column.status)
                ? "opacity-70"
                : ""
            }`}
            onDragOver={(event) => handleDragOver(event, column.status)}
            onDragLeave={() => setDropTargetStatus(null)}
            onDrop={(event) => handleDrop(event, column.status)}
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                {column.label}
              </h3>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {column.items.length.toLocaleString("fa-IR")}
              </span>
            </header>

            <div className="space-y-2">
              {column.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 bg-white/50 px-3 py-6 text-center text-xs text-zinc-500">
                  لیدی نیست
                </p>
              ) : (
                column.items.map((item) => (
                  <article
                    key={item.id}
                    draggable={!showClaimActions && updatingId !== item.id}
                    onDragStart={(event) => {
                      if (showClaimActions) {
                        event.preventDefault();
                        return;
                      }
                      const target = event.target as HTMLElement | null;
                      if (target?.closest("button, a, input, textarea, select")) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.setData("text/plain", item.id);
                      event.dataTransfer.effectAllowed = "move";
                      handleDragStart(item.id);
                    }}
                    onDragEnd={handleDragEnd}
                    className={`rounded-xl border border-zinc-200 bg-white p-3 shadow-sm ${
                      showClaimActions
                        ? ""
                        : "cursor-grab active:cursor-grabbing"
                    } ${
                      draggingId === item.id ? "opacity-50" : ""
                    } ${
                      item.status === "assessment_in_progress"
                        ? "border-rose-300"
                        : item.sla.severity === "red"
                          ? "border-red-200"
                          : item.sla.severity === "amber"
                            ? "border-amber-200"
                            : ""
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link
                        href={buildConsultationLeadDetailHref(
                          item.id,
                          queueQueryString,
                        )}
                        className="font-medium text-emerald-800 hover:text-emerald-900"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {item.name}
                      </Link>
                      {updatingId === item.id ? (
                        <span className="text-xs text-zinc-500">…</span>
                      ) : null}
                    </div>

                    {item.businessName ? (
                      <p className="mb-1 text-xs text-zinc-600">
                        {item.businessName}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {item.status === "assessment_in_progress" ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                          تماس نگیرید
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          item.source === "system"
                            ? "bg-sky-100 text-sky-800"
                            : item.source === "messenger"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {item.sourceLabel}
                      </span>
                      {item.purchaseProbabilityLabel ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          {item.purchaseProbabilityLabel}
                        </span>
                      ) : null}
                      {item.slaReason ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.sla.severity === "red"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.slaReason}
                        </span>
                      ) : null}
                    </div>

                    {item.assignedToName ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        {item.assignedToName}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">بدون تخصیص</p>
                    )}

                    {showClaimActions && item.assignedToId == null ? (
                      <button
                        type="button"
                        disabled={claimingId != null}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleClaim(item.id);
                        }}
                        className="mt-2 w-full rounded-lg bg-emerald-700 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {claimingId === item.id
                          ? "در حال برداشتن…"
                          : "برداشتن سرنخ"}
                      </button>
                    ) : null}

                    {item.nextFollowUpAt ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        پیگیری: {item.nextFollowUpAt}
                      </p>
                    ) : null}

                    {item.lastCallOutcomeLabel ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        آخرین تماس: {item.lastCallOutcomeLabel}
                      </p>
                    ) : null}

                    {item.status === "closed_lost" && item.lostReasonLabel ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        دلیل باخت: {item.lostReasonLabel}
                      </p>
                    ) : null}

                    {!showClaimActions && canShowQuickActions(item.status) ? (
                      <div
                        className="mt-2 flex flex-wrap gap-1"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        {canMarkContacted(item.status) ? (
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void markContacted(item.id);
                            }}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            تماس گرفتم
                          </button>
                        ) : null}
                        {QUICK_CALL_OUTCOMES.map((outcome) => (
                          <button
                            key={outcome}
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void logQuickCall(item.id, outcome);
                            }}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {CALL_OUTCOME_LABELS[outcome]}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void setFollowUpInDays(item.id, 1);
                          }}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          فردا
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void setFollowUpInDays(item.id, 3);
                          }}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ۳ روز
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
        </div>
      </div>
    </div>
  );
}
