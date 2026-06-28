import { HealthBadge } from "@/components/report/HealthBadge";
import { BottleneckCard } from "@/components/report/BottleneckCard";
import { ActionPlanTimeline } from "@/components/report/ActionPlanTimeline";
import { DiagnosisSummaryPanel } from "@/components/report/DiagnosisSummaryPanel";
import { ReportSpecView } from "@/components/report/ReportSpecView";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { healthLevelBarColor } from "@/lib/health-colors";
import type { ReportResponse } from "@/modules/assessment/assessment.types";
import type { StructuredReport } from "@/types/report";

function barColorFromPercentage(percentage: number): string {
  if (percentage >= 76) return healthLevelBarColor("healthy");
  if (percentage >= 51) return healthLevelBarColor("medium");
  if (percentage >= 26) return healthLevelBarColor("weak");
  return healthLevelBarColor("critical");
}

interface DetailedReportSectionsProps {
  report: ReportResponse;
  onRequestAnalysis?: (destination?: "consultation" | "ai-purchase") => void;
}

export function DetailedReportSections({
  report,
  onRequestAnalysis,
}: DetailedReportSectionsProps) {
  if (report.reportSpec) {
    return (
      <ReportSpecView
        reportSpec={report.reportSpec}
        assessmentId={report.assessmentId}
        businessName={report.businessName}
        onCtaClick={(destination) => onRequestAnalysis?.(destination)}
      />
    );
  }

  return (
    <LegacyDetailedReportSections
      report={report}
      onRequestAnalysis={onRequestAnalysis}
    />
  );
}

function LegacyDetailedReportSections({
  report,
  onRequestAnalysis,
}: DetailedReportSectionsProps) {
  const structured = report.structuredReport as StructuredReport;
  const actionPlans = structured.actionPlans;
  const sevenDay =
    actionPlans?.sevenDay ??
    (structured.correctiveActions ?? []).slice(0, 1).map((action) => ({
      title: action.domainName,
      description: action.description,
    }));
  const thirtyDay =
    actionPlans?.thirtyDay ??
    (structured.correctiveActions ?? []).slice(1).map((action) => ({
      title: action.domainName,
      description: action.description,
    }));

  return (
    <div className="space-y-8">
      {structured.diagnosisSummary && (
        <DiagnosisSummaryPanel summary={structured.diagnosisSummary} />
      )}
      <Card as="section">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            label="خلاصه مدیریتی"
            title={
              report.overallScore
                ? `${Math.round(report.overallScore.percentage)}%`
                : undefined
            }
            subtitle={report.businessName ?? undefined}
          />
          {report.overallScore && (
            <HealthBadge level={report.overallScore.healthLevel} size="lg" />
          )}
        </div>
        <p className="mt-6 leading-7 text-zinc-700">
          {structured.overallSummary}
        </p>
      </Card>

      {structured.domainResults && structured.domainResults.length > 0 && (
        <Card as="section">
          <SectionHeader label="تحلیل" title="تحلیل ۱۶ دامنه" />
          <div className="mt-6 space-y-4">
            {structured.domainResults.map((domain) => (
              <div
                key={domain.domainSlug}
                className="rounded-xl border border-zinc-100 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-zinc-900">{domain.domainName}</p>
                  <span className="text-sm font-semibold text-zinc-700">
                    {Math.round(domain.percentage)}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${barColorFromPercentage(domain.percentage)}`}
                    style={{ width: `${domain.percentage}%` }}
                  />
                </div>
                {domain.bandLabel && (
                  <p className="mt-2 text-sm font-medium text-emerald-700">
                    {domain.bandLabel}
                  </p>
                )}
                {domain.bandDescription && (
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {domain.bandDescription}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          توضیح گلوگاه‌های اصلی
        </h2>
        <div className="space-y-4">
          {(structured.bottleneckSummaries ?? []).map((bottleneck) => (
            <BottleneckCard
              key={bottleneck.domainSlug}
              rank={bottleneck.rank}
              domainName={bottleneck.domainName}
              priorityScore={
                report.bottlenecks.find((b) => b.rank === bottleneck.rank)
                  ?.priorityScore ?? 0
              }
              summary={bottleneck.summary}
              salesImpact={bottleneck.salesImpact}
            />
          ))}
        </div>
      </section>

      {report.diagnoses.length > 0 && (
        <Card as="section">
          <SectionHeader label="تشخیص" title="تشخیص ریشه‌ای" />
          <div className="mt-6 space-y-4">
            {report.diagnoses.map((diagnosis) => (
              <div
                key={diagnosis.diagnosisKey}
                className="rounded-xl border border-zinc-100 p-4"
              >
                <p className="font-medium text-zinc-900">{diagnosis.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {diagnosis.description}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          برنامه اقدام
        </h2>
        <ActionPlanTimeline sevenDay={sevenDay} thirtyDay={thirtyDay} />
      </section>

      {onRequestAnalysis && (
        <Card
          as="section"
          className="border border-emerald-200 bg-emerald-50 text-center"
        >
          <h2 className="text-lg font-semibold text-zinc-900">
            قدم بعدی پیشنهادی
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            برای بررسی دقیق‌تر گلوگاه فروش خود، درخواست تحلیل اختصاصی ثبت
            کنید.
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => onRequestAnalysis()}
          >
            درخواست تحلیل دقیق‌تر
          </Button>
        </Card>
      )}
    </div>
  );
}
