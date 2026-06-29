"use client";

import { useCallback, useMemo, useState } from "react";
import { renderReport } from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { ReportBlockList } from "@/components/report/ReportBlockList";

interface ReportSpecViewProps {
  reportSpec: ReportSpec;
  assessmentId: string;
  businessName?: string | null;
  onCtaClick: () => void;
}

export function ReportSpecView({
  reportSpec: initialSpec,
  assessmentId,
  businessName,
  onCtaClick,
}: ReportSpecViewProps) {
  const [reportSpec, setReportSpec] = useState(initialSpec);

  const viewModel = useMemo(
    () => renderReport(reportSpec, { medium: "app", variant: "full" }),
    [reportSpec],
  );

  const handleReportUpdated = useCallback((updated: ReportSpec) => {
    setReportSpec(updated);
  }, []);

  return (
    <div className="space-y-8">
      {businessName && (
        <p className="text-sm text-zinc-500">{businessName}</p>
      )}
      <ReportBlockList
        viewModel={viewModel}
        assessmentId={assessmentId}
        onCtaClick={onCtaClick}
        onReportUpdated={handleReportUpdated}
      />
    </div>
  );
}
