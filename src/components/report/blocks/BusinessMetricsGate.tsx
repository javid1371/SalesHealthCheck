"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiPatch, ApiClientError } from "@/lib/api-client";
import type { UpdateBusinessMetricsResponse } from "@/modules/assessment/assessment.types";
import type { ReportSpec } from "@/types/report-spec";

interface BusinessMetricsGateProps {
  assessmentId: string;
  onReportUpdated: (reportSpec: ReportSpec) => void;
}

export function BusinessMetricsGate({
  assessmentId,
  onReportUpdated,
}: BusinessMetricsGateProps) {
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [averageOrderValue, setAverageOrderValue] = useState("");
  const [monthlyLeads, setMonthlyLeads] = useState("");
  const [repeatPurchaseRate, setRepeatPurchaseRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await apiPatch<UpdateBusinessMetricsResponse>(
        `/api/assessments/${assessmentId}/business-metrics`,
        {
          monthlyRevenue: Number(monthlyRevenue),
          averageOrderValue: Number(averageOrderValue),
          monthlyLeads: Number(monthlyLeads),
          ...(repeatPurchaseRate.trim()
            ? { repeatPurchaseRate: Number(repeatPurchaseRate) }
            : {}),
        },
      );

      if (result.report.reportSpec) {
        onReportUpdated(result.report.reportSpec);
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ذخیره اعداد با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-zinc-900">
        ارزش در خطر — ورود ۴ عدد
      </h2>
      <p className="mt-2 text-sm leading-7 text-zinc-600">
        برای محاسبه پتانسیل قابل بازیابی، چهار عدد کسب‌وکار را وارد کنید.
        این بخش اختیاری است و می‌توانید بعداً تکمیل کنید.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              درآمد ماهانه (R0) — تومان
            </span>
            <input
              type="number"
              min={1}
              required
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm"
              placeholder="مثلاً ۵۰۰۰۰۰۰۰"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              میانگین سفارش (AOV) — تومان
            </span>
            <input
              type="number"
              min={1}
              required
              value={averageOrderValue}
              onChange={(e) => setAverageOrderValue(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm"
              placeholder="مثلاً ۲۰۰۰۰۰۰"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              سرنخ ماهانه (L)
            </span>
            <input
              type="number"
              min={1}
              required
              value={monthlyLeads}
              onChange={(e) => setMonthlyLeads(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm"
              placeholder="مثلاً ۱۰۰"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              نرخ تکرار خرید (RP) — اختیاری
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={repeatPurchaseRate}
              onChange={(e) => setRepeatPurchaseRate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm"
              placeholder="مثلاً ۱.۲"
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? "در حال محاسبه..." : "محاسبه ارزش در خطر"}
        </Button>
      </form>
    </section>
  );
}
