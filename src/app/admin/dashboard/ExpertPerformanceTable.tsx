"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { AdminExpertPerformanceRow } from "@/modules/admin/admin.types";
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOMES,
} from "@/modules/consultation/lead-activity";

export function ExpertPerformanceTable({
  rows,
}: {
  rows: AdminExpertPerformanceRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-zinc-600">هنوز کارشناس فعالی ثبت نشده است.</p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
          <tr>
            <th className="px-4 py-3 font-medium text-zinc-700">کارشناس</th>
            <th className="px-4 py-3 font-medium text-zinc-700">تخصیص‌یافته</th>
            <th className="px-4 py-3 font-medium text-zinc-700">باز</th>
            <th className="px-4 py-3 font-medium text-zinc-700">تماس باز</th>
            <th className="px-4 py-3 font-medium text-zinc-700">جلسه باز</th>
            <th className="px-4 py-3 font-medium text-zinc-700">موفق</th>
            <th className="px-4 py-3 font-medium text-zinc-700">نرخ بستن</th>
            <th className="px-4 py-3 font-medium text-zinc-700">عقب‌افتاده</th>
            <th className="px-4 py-3 font-medium text-zinc-700">جدید هفته</th>
            <th className="px-4 py-3 font-medium text-zinc-700">تماس ۷روز</th>
            <th className="px-4 py-3 font-medium text-zinc-700">
              نرخ علاقه‌مند
            </th>
            <th className="px-4 py-3 font-medium text-zinc-700">جزئیات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => {
            const isExpanded = expandedId === row.staffUserId;
            return (
              <ExpertPerformanceRows
                key={row.staffUserId}
                row={row}
                isExpanded={isExpanded}
                onToggle={() =>
                  setExpandedId(isExpanded ? null : row.staffUserId)
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpertPerformanceRows({
  row,
  isExpanded,
  onToggle,
}: {
  row: AdminExpertPerformanceRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-zinc-50/80">
        <td className="px-4 py-3 font-medium text-zinc-900">{row.name}</td>
        <td className="px-4 py-3 text-zinc-600">
          {row.assigned.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.open.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.contactedOpen.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.meetingScheduledOpen.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-emerald-700">
          {row.closedWon.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.winRate.toLocaleString("fa-IR")}٪
        </td>
        <td
          className={`px-4 py-3 ${
            row.overdueFollowUpOpen > 0
              ? "font-medium text-red-700"
              : "text-zinc-600"
          }`}
        >
          {row.overdueFollowUpOpen.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.newThisWeek.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.totalCalls.toLocaleString("fa-IR")}
        </td>
        <td className="px-4 py-3 text-zinc-600">
          {row.totalCalls === 0
            ? "—"
            : `${row.connectedInterestedRate.toLocaleString("fa-IR")}٪`}
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
            aria-expanded={isExpanded}
          >
            {isExpanded ? "بستن" : "نتایج تماس"}
          </button>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-zinc-50/60">
          <td colSpan={12} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium text-zinc-700">
              نتایج تماس ۷ روز اخیر
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CALL_OUTCOMES.map((outcome) => (
                <div
                  key={outcome}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2"
                >
                  <span className="text-xs text-zinc-600">
                    {CALL_OUTCOME_LABELS[outcome]}
                  </span>
                  <span className="text-sm font-medium text-zinc-900">
                    {row.byOutcome[outcome].toLocaleString("fa-IR")}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
