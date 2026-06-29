import { renderReport } from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { ReportBlockList } from "@/components/report/ReportBlockList";
import { PrintReadyMarker } from "@/components/report/PrintReadyMarker";

interface ReportPrintViewProps {
  reportSpec: ReportSpec;
  businessName?: string | null;
  createdAt?: string | null;
}

function formatReportDate(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(
    new Date(iso),
  );
}

export function ReportPrintView({
  reportSpec,
  businessName,
  createdAt,
}: ReportPrintViewProps) {
  const viewModel = renderReport(reportSpec, { medium: "print", variant: "full" });

  return (
    <div className="mx-auto max-w-[210mm] space-y-8 px-4 py-8">
      <PrintReadyMarker />
      <header className="print-avoid-break border-b border-zinc-200 pb-6">
        <p className="text-sm text-zinc-500">Sales Health Check</p>
        {businessName && (
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">
            {businessName}
          </h1>
        )}
        {createdAt && (
          <p className="mt-2 text-sm text-zinc-500">
            {formatReportDate(createdAt)}
          </p>
        )}
        <p className="mt-4 text-4xl font-bold tabular-nums text-zinc-900">
          {Math.round(viewModel.healthGauge.percentage)}%
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {viewModel.healthGauge.label}
        </p>
      </header>
      <ReportBlockList viewModel={viewModel} />
      <footer className="print-avoid-break border-t border-zinc-200 pt-4 text-center text-xs text-zinc-400">
        Sales Health Check — گزارش سلامت فروش
      </footer>
    </div>
  );
}
