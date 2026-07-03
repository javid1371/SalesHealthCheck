"use client";

import type {
  CtaPlacementId,
  ReportBlockId,
  ReportViewModel,
} from "@/modules/report/report.renderer";
import type { ReportSpec } from "@/types/report-spec";
import { SurvivalBanner } from "@/components/report/blocks/SurvivalBanner";
import { HealthGauge } from "@/components/report/blocks/HealthGauge";
import { ChartsSection } from "@/components/report/blocks/ChartsSection";
import { QuickWinBlock } from "@/components/report/blocks/QuickWinBlock";
import { IssuesSection } from "@/components/report/blocks/IssuesSection";
import { DomainAnatomy } from "@/components/report/blocks/DomainAnatomy";
import { BusinessMetricsGate } from "@/components/report/blocks/BusinessMetricsGate";
import { ValueAtStakeSection } from "@/components/report/blocks/ValueAtStakeSection";
import { ValueStakeTeaser } from "@/components/report/blocks/ValueStakeTeaser";
import { LockedPlanTeaser } from "@/components/report/blocks/LockedPlanTeaser";
import { ConfidenceNote } from "@/components/report/blocks/ConfidenceNote";
import { CtaSection } from "@/components/report/blocks/CtaSection";
import { SummaryActions } from "@/components/report/blocks/SummaryActions";
import { cn } from "@/lib/utils";

interface ReportBlockListProps {
  viewModel: ReportViewModel;
  assessmentId?: string;
  reportUrl?: string;
  onCtaClick?: () => void;
  onReportUpdated?: (reportSpec: ReportSpec) => void;
}

export function ReportBlockList({
  viewModel,
  assessmentId,
  reportUrl,
  onCtaClick,
  onReportUpdated,
}: ReportBlockListProps) {
  const { medium, presentation } = viewModel;
  const showMetricsGate =
    !presentation.hideInteractive &&
    viewModel.showMetricsGate &&
    assessmentId &&
    onReportUpdated;

  function renderCtaPlacement(placementId: CtaPlacementId, blockId: string) {
    const placement = viewModel.ctaPlacements.find((p) => p.id === placementId);
    if (!placement) return null;

    return (
      <CtaSection
        key={blockId}
        headline={placement.headline}
        buttonLabel={placement.buttonLabel}
        variant={placement.variant}
        medium={medium}
        hideButtons={presentation.hideInteractive}
        onCtaClick={onCtaClick}
        sectionId={placementId === "final" ? "result-actions" : undefined}
      />
    );
  }

  function renderBlock(blockId: ReportBlockId) {
    const domainPageBreakClass = cn(
      presentation.showPageBreakBeforeDomains &&
        blockId === "domain-breakdown" &&
        "print-page-break",
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
      case "cta-top":
        return renderCtaPlacement("top", blockId);
      case "cta-score":
        return renderCtaPlacement("score", blockId);
      case "cta-value":
        return renderCtaPlacement("afterValue", blockId);
      case "health-gauge":
        return (
          <HealthGauge
            key={blockId}
            gauge={viewModel.healthGauge}
            medium={medium}
          />
        );
      case "health-charts":
        if (medium === "print") {
          return (
            <div key={blockId}>
              <ChartsSection charts={viewModel.charts} medium={medium} />
            </div>
          );
        }

        return (
          <div key={blockId} className="space-y-6">
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
            compact={presentation.compactIssues}
          />
        );
      case "quick-win":
        return viewModel.quickWin ? (
          <QuickWinBlock
            key={blockId}
            quickWin={viewModel.quickWin}
            medium={medium}
            compact={presentation.compactIssues}
          />
        ) : null;
      case "metrics-gate":
        return showMetricsGate ? (
          <BusinessMetricsGate
            key={blockId}
            assessmentId={assessmentId}
            onReportUpdated={onReportUpdated}
          />
        ) : null;
      case "value-at-stake":
        return viewModel.valueAtStake ? (
          <ValueAtStakeSection
            key={blockId}
            valueAtStake={viewModel.valueAtStake}
            medium={medium}
          />
        ) : null;
      case "value-stake-teaser":
        return <ValueStakeTeaser key={blockId} medium={medium} />;
      case "domain-breakdown":
        return (
          <div key={blockId} className={domainPageBreakClass}>
            <DomainAnatomy
              domains={viewModel.domainBreakdown}
              medium={medium}
              onFixLockClick={
                presentation.hideInteractive ? undefined : onCtaClick
              }
            />
          </div>
        );
      case "locked-plan":
        return (
          <LockedPlanTeaser
            key={blockId}
            lockedPlan={viewModel.lockedPlan}
            medium={medium}
          />
        );
      case "confidence-note":
        return (
          <ConfidenceNote
            key={blockId}
            note={viewModel.confidenceNote}
            medium={medium}
          />
        );
      case "cta":
        return renderCtaPlacement("final", blockId);
      case "summary-actions":
        return reportUrl ? (
          <SummaryActions
            key={blockId}
            reportUrl={reportUrl}
            onConsultationClick={onCtaClick ? () => onCtaClick() : undefined}
          />
        ) : null;
      default:
        return null;
    }
  }

  return <>{viewModel.blockOrder.map(renderBlock)}</>;
}
