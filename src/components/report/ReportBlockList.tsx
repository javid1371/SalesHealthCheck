"use client";

import type {
  ReportBlockId,
  ReportViewModel,
} from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { SurvivalBanner } from "@/components/report/blocks/SurvivalBanner";
import { HealthGauge } from "@/components/report/blocks/HealthGauge";
import { ChartsSection } from "@/components/report/blocks/ChartsSection";
import { QuickWinTeaser } from "@/components/report/blocks/QuickWinTeaser";
import { IssuesSection } from "@/components/report/blocks/IssuesSection";
import { DomainAnatomy } from "@/components/report/blocks/DomainAnatomy";
import { BusinessMetricsGate } from "@/components/report/blocks/BusinessMetricsGate";
import { ValueAtStakeSection } from "@/components/report/blocks/ValueAtStakeSection";
import { QuickWinFull } from "@/components/report/blocks/QuickWinFull";
import { LockedPlanTeaser } from "@/components/report/blocks/LockedPlanTeaser";
import { ConfidenceNote } from "@/components/report/blocks/ConfidenceNote";
import { CtaSection } from "@/components/report/blocks/CtaSection";
import { cn } from "@/lib/utils";

interface ReportBlockListProps {
  viewModel: ReportViewModel;
  assessmentId?: string;
  onCtaClick?: (destination: "consultation" | "ai-purchase") => void;
  onReportUpdated?: (reportSpec: ReportSpec) => void;
}

export function ReportBlockList({
  viewModel,
  assessmentId,
  onCtaClick,
  onReportUpdated,
}: ReportBlockListProps) {
  const { medium, presentation } = viewModel;
  const showMetricsGate =
    !presentation.hideInteractive &&
    viewModel.valueAtStake === null &&
    assessmentId &&
    onReportUpdated;

  function renderBlock(blockId: ReportBlockId) {
    const pageBreakClass = cn(
      presentation.showPageBreakHints && "print-page-break",
    );

    switch (blockId) {
      case "survival-banner":
        return (
          <SurvivalBanner
            key={blockId}
            banner={viewModel.survivalBanner}
            medium={medium}
          />
        );
      case "health-charts":
        return (
          <div key={blockId} className={cn("space-y-6", pageBreakClass)}>
            <HealthGauge gauge={viewModel.healthGauge} medium={medium} />
            <ChartsSection charts={viewModel.charts} medium={medium} />
          </div>
        );
      case "issues":
        return (
          <IssuesSection
            key={blockId}
            issues={viewModel.issues}
            medium={medium}
          />
        );
      case "quick-win-teaser":
        return viewModel.quickWinTeaser ? (
          <QuickWinTeaser
            key={blockId}
            teaser={viewModel.quickWinTeaser}
            medium={medium}
          />
        ) : null;
      case "domain-breakdown":
        return (
          <div key={blockId} className={cn("space-y-6", pageBreakClass)}>
            <DomainAnatomy
              domains={viewModel.domainBreakdown}
              medium={medium}
              onFixLockClick={
                presentation.hideInteractive ? undefined : onCtaClick
              }
            />
            {showMetricsGate && (
              <BusinessMetricsGate
                assessmentId={assessmentId}
                onReportUpdated={onReportUpdated}
              />
            )}
          </div>
        );
      case "value-at-stake":
        return viewModel.valueAtStake ? (
          <ValueAtStakeSection
            key={blockId}
            valueAtStake={viewModel.valueAtStake}
            medium={medium}
          />
        ) : null;
      case "quick-win-full":
        return viewModel.quickWin ? (
          <QuickWinFull
            key={blockId}
            quickWin={viewModel.quickWin}
            medium={medium}
          />
        ) : null;
      case "locked-plan":
        return (
          <LockedPlanTeaser
            key={blockId}
            lockedPlan={viewModel.lockedPlan}
            medium={medium}
          />
        );
      case "confidence-cta":
        return (
          <div key={blockId} className="space-y-6">
            <ConfidenceNote note={viewModel.confidenceNote} medium={medium} />
            {!presentation.hideInteractive && onCtaClick && (
              <CtaSection ctas={viewModel.ctas} onCtaClick={onCtaClick} />
            )}
            {presentation.hideInteractive && viewModel.ctas.length > 0 && (
              <CtaSection
                ctas={viewModel.ctas}
                medium={medium}
                hideButtons
              />
            )}
          </div>
        );
      default:
        return null;
    }
  }

  return <>{viewModel.blockOrder.map(renderBlock)}</>;
}
