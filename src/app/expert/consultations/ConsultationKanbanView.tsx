"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { ApiClientError } from "@/lib/api-client";
import { updateConsultationLeadRequest } from "@/lib/expert-client";
import type { ConsultationListItem } from "@/modules/consultation/consultation.types";
import type { LeadStatus } from "@prisma/client";

const KANBAN_COLUMNS: Array<{
  status: LeadStatus;
  label: string;
  color: string;
}> = [
  { status: "new", label: "جدید", color: "border-sky-200 bg-sky-50/60" },
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
}

export function ConsultationKanbanView({
  requests: initialRequests,
}: ConsultationKanbanViewProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<LeadStatus | null>(
    null,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function moveLead(leadId: string, newStatus: LeadStatus) {
    const lead = requests.find((item) => item.id === leadId);
    if (!lead || lead.status === newStatus) {
      return;
    }

    setUpdatingId(leadId);
    setError(null);

    const previous = requests;
    setRequests((current) =>
      current.map((item) =>
        item.id === leadId
          ? {
              ...item,
              status: newStatus,
              statusLabel:
                KANBAN_COLUMNS.find((column) => column.status === newStatus)
                  ?.label ?? item.statusLabel,
            }
          : item,
      ),
    );

    try {
      await updateConsultationLeadRequest(leadId, { status: newStatus });
      router.refresh();
    } catch (err) {
      setRequests(previous);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در تغییر وضعیت لید.",
      );
    } finally {
      setUpdatingId(null);
      setDraggingId(null);
      setDropTargetStatus(null);
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
    event.preventDefault();
    setDropTargetStatus(status);
  }

  function handleDrop(event: React.DragEvent, status: LeadStatus) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain");
    if (leadId) {
      void moveLead(leadId, status);
    }
  }

  return (
    <div>
      {error ? <ErrorMessage message={error} /> : null}

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <section
            key={column.status}
            className={`min-w-[17rem] flex-1 rounded-2xl border p-3 transition-colors ${
              column.color
            } ${
              dropTargetStatus === column.status && draggingId
                ? "ring-2 ring-emerald-500 ring-offset-2"
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
                    draggable={updatingId !== item.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", item.id);
                      event.dataTransfer.effectAllowed = "move";
                      handleDragStart(item.id);
                    }}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab rounded-xl border border-zinc-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                      draggingId === item.id ? "opacity-50" : ""
                    } ${
                      item.sla.severity === "red"
                        ? "border-red-200"
                        : item.sla.severity === "amber"
                          ? "border-amber-200"
                          : ""
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link
                        href={item.detailUrl}
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
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
