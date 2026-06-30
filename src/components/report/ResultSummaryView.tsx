"use client";

import { useCallback, useMemo, useState } from "react";
import { renderReport } from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { ReportBlockList } from "@/components/report/ReportBlockList";

interface ResultSummaryViewProps {
  reportSpec: ReportSpec;
  assessmentId: string;
  reportUrl: string;
  onConsultationClick: () => void;
}

export function ResultSummaryView({
  reportSpec: initialSpec,
  assessmentId,
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

  return (
    <div className="space-y-8">
      <ReportBlockList
        viewModel={viewModel}
        assessmentId={assessmentId}
        reportUrl={reportUrl}
        onCtaClick={() => onConsultationClick()}
        onReportUpdated={handleReportUpdated}
      />
    </div>
  );
}
