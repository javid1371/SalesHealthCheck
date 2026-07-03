import { Card } from "@/components/ui/Card";
import type { AdminSmsFunnelMetrics } from "@/modules/admin/admin.types";

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">
        {value.toLocaleString("fa-IR")}
      </p>
    </div>
  );
}

export function SmsFunnelMetricsCard({
  metrics,
}: {
  metrics: AdminSmsFunnelMetrics;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">متریک قیف</h2>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="ارسال‌شده" value={metrics.smsSent} />
        <MetricCard label="در صف" value={metrics.smsPending} />
        <MetricCard label="ناموفق" value={metrics.smsFailed} />
        <MetricCard label="کلیک لینک" value={metrics.linkClicks} />
        <MetricCard label="شروع فرم تماس" value={metrics.consultationStarts} />
        <MetricCard label="لغو پیامک" value={metrics.optOutCount} />
      </div>
    </Card>
  );
}
