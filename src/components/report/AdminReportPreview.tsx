"use client";

import { useMemo } from "react";
import { renderReport } from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { ReportBlockList } from "@/components/report/ReportBlockList";

interface AdminReportPreviewProps {
  reportSpec: ReportSpec;
}

export function AdminReportPreview({ reportSpec }: AdminReportPreviewProps) {
  const viewModel = useMemo(
    () => renderReport(reportSpec, { medium: "app", variant: "full" }),
    [reportSpec],
  );

  return <ReportBlockList viewModel={viewModel} />;
}
