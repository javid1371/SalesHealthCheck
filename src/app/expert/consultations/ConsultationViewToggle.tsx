"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ConsultationView = "list" | "kanban";

interface ConsultationViewToggleProps {
  currentView: ConsultationView;
  showTeamQueueToggle?: boolean;
  isTeamQueue?: boolean;
}

function buildViewHref(
  view: ConsultationView,
  searchParams: URLSearchParams,
): string {
  const next = new URLSearchParams(searchParams);
  if (view === "list") {
    next.delete("view");
  } else {
    next.set("view", view);
  }
  next.delete("page");
  const query = next.toString();
  return query ? `/expert/consultations?${query}` : "/expert/consultations";
}

function buildTeamQueueHref(
  enable: boolean,
  searchParams: URLSearchParams,
): string {
  const next = new URLSearchParams(searchParams);
  if (enable) {
    next.set("onlyTeamQueue", "true");
  } else {
    next.delete("onlyTeamQueue");
  }
  next.delete("page");
  const query = next.toString();
  return query ? `/expert/consultations?${query}` : "/expert/consultations";
}

export function ConsultationViewToggle({
  currentView,
  showTeamQueueToggle = false,
  isTeamQueue = false,
}: ConsultationViewToggleProps) {
  const searchParams = useSearchParams();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-600">نمایش:</span>
        <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1">
          <Link
            href={buildViewHref("list", searchParams)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              currentView === "list"
                ? "bg-emerald-700 text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            جدول
          </Link>
          <Link
            href={buildViewHref("kanban", searchParams)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              currentView === "kanban"
                ? "bg-emerald-700 text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            کانبان
          </Link>
        </div>
      </div>

      {showTeamQueueToggle ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600">محدوده:</span>
          <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1">
            <Link
              href={buildTeamQueueHref(false, searchParams)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !isTeamQueue
                  ? "bg-emerald-700 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              لیدهای من
            </Link>
            <Link
              href={buildTeamQueueHref(true, searchParams)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isTeamQueue
                  ? "bg-emerald-700 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              صف تیم
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
