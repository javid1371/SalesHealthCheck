"use client";

import { useCallback, useMemo, useState } from "react";
import { renderReport } from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { ReportBlockList } from "@/components/report/ReportBlockList";
import { CopyResultLink } from "@/components/assessment/CopyResultLink";
import { DownloadReportPdf } from "@/components/report/DownloadReportPdf";
import { ResultStickySummary } from "@/components/report/ResultStickySummary";
import { Card } from "@/components/ui/Card";
import { resolveHealthLevel } from "@/lib/health-level";

interface ResultSummaryViewProps {
  reportSpec: ReportSpec;
  assessmentId: string;
  reportId: string;
  token?: string;
  reportUrl: string;
  onConsultationClick: () => void;
}

export function ResultSummaryView({
  reportSpec: initialSpec,
  assessmentId,
  reportId,
  token,
  reportUrl,
  onConsultationClick,
}: ResultSummaryViewProps) {
  const [reportSpec, setReportSpec] = useState(initialSpec);

  const viewModel = useMemo(
    () => renderReport(reportSpec, { medium: "app", variant: "summary" }),
    [reportSpec],
  );

  const handleReportUpdated = useCallback((updated: ReportSpec) => {
    setReportSpec(updated);
  }, []);

  const healthLevel = resolveHealthLevel(viewModel.healthGauge.percentage);

  return (
    <div className="space-y-8">
      <ResultStickySummary
        percentage={viewModel.healthGauge.percentage}
        healthLevel={healthLevel}
      />
      <ReportBlockList
        viewModel={viewModel}
        assessmentId={assessmentId}
        reportUrl={reportUrl}
        onCtaClick={() => onConsultationClick()}
        onReportUpdated={handleReportUpdated}
      />
      <Card padding="compact" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {token && <CopyResultLink assessmentId={assessmentId} token={token} />}
        <DownloadReportPdf reportId={reportId} token={token} />
      </Card>
    </div>
  );
}
