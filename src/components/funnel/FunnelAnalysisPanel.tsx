import { Card } from "@/components/ui/Card";
import { formatToman } from "@/lib/report-ui";
import type { SalesFunnelAnalysis } from "@/modules/sales-funnel/sales-funnel.engine";
import { formatPercent } from "./funnel-utils";

interface FunnelAnalysisPanelProps {
  analysis: SalesFunnelAnalysis | null;
  title?: string;
}

export function FunnelAnalysisPanel({
  analysis,
  title = "تحلیل قیف",
}: FunnelAnalysisPanelProps) {
  if (!analysis) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">
          برای محاسبه تحلیل، حداقل یک مرحله با تعداد معتبر وارد کنید.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>

      <dl className="grid gap-3 sm:grid-cols-2">
        <MetricItem
          label="نرخ تبدیل کلی"
          value={formatPercent(analysis.overallConversionRate)}
        />
        {analysis.bottleneck && (
          <MetricItem
            label="گلوگاه (بیشترین ریزش)"
            value={`${analysis.bottleneck.fromName} → ${analysis.bottleneck.toName}`}
            hint={formatPercent(analysis.bottleneck.dropOffPercent)}
            highlight
          />
        )}
      </dl>

      {analysis.revenue && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-900">
            پیش‌بینی درآمد ماهانه
          </h3>
          <p className="mt-2 text-2xl font-bold text-emerald-800">
            {formatToman(analysis.revenue.monthly)}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            سالانه: {formatToman(analysis.revenue.annual)} · مشتری:{" "}
            {analysis.revenue.customers.toLocaleString("fa-IR")} · AOV:{" "}
            {formatToman(analysis.revenue.aov)}
          </p>
        </div>
      )}
    </Card>
  );
}

function MetricItem({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={`mt-1 text-sm font-semibold ${
          highlight ? "text-red-900" : "text-zinc-900"
        }`}
      >
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}
