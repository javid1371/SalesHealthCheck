"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CopyResultLink } from "@/components/assessment/CopyResultLink";
import { ReportShell } from "@/components/layout/ReportShell";
import { SpiderChart } from "@/components/charts/SpiderChart";
import { HealthBadge } from "@/components/report/HealthBadge";
import { ResultStickySummary } from "@/components/report/ResultStickySummary";
import { BottleneckCard } from "@/components/report/BottleneckCard";
import { DiagnosisSummaryPanel } from "@/components/report/DiagnosisSummaryPanel";
import { DownloadReportPdf } from "@/components/report/DownloadReportPdf";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageState } from "@/components/ui/PageState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { apiGet } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import { healthLevelBarColor } from "@/lib/health-colors";
import { layerStatusLabelFa } from "@/lib/health-level";
import {
  PAGE_MESSAGES,
  isTokenAccessError,
  resolveApiError,
} from "@/lib/page-messages";
import type { AssessmentResultResponse } from "@/modules/assessment/assessment.types";
import type { StructuredReport } from "@/types/report";

const RESULT_TOC = [
  { id: "result-score", label: "امتیاز کلی" },
  { id: "result-chart", label: "نمودار دامنه‌ها" },
  { id: "result-layers", label: "وضعیت لایه‌ها" },
  { id: "result-bottlenecks", label: "گلوگاه‌ها" },
  { id: "result-report-cta", label: "گزارش کامل" },
];

function ResultContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const assessmentId = params.id;

  const [result, setResult] = useState<AssessmentResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchResult() {
      const token =
        searchParams.get("token") ?? getResultToken(assessmentId) ?? "";

      if (!token) {
        setError(PAGE_MESSAGES.tokenMissing);
        setLoading(false);
        return;
      }

      try {
        const data = await apiGet<AssessmentResultResponse>(
          `/api/assessments/${assessmentId}/result?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        setResult(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(resolveApiError(err, PAGE_MESSAGES.notFound.result));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchResult();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, searchParams, retryKey]);

  const loadError =
    error ?? (!loading && !result ? PAGE_MESSAGES.notFound.result : null);

  return (
    <PageState
      loading={loading}
      skeleton="result"
      loadingMessage={PAGE_MESSAGES.loading.result}
      error={loadError}
      onRetry={() => {
        setLoading(true);
        setError(null);
        setRetryKey((k) => k + 1);
      }}
      errorExtra={
        loadError && isTokenAccessError(loadError) ? (
          <p className="text-center text-sm text-zinc-600">
            لینک را گم کرده‌اید؟{" "}
            <Link
              href="/recover"
              className="font-medium text-emerald-700 hover:text-emerald-800"
            >
              بازیابی لینک نتیجه
            </Link>
          </p>
        ) : undefined
      }
    >
      {result && (
        <ResultDashboard
          assessmentId={assessmentId}
          result={result}
          token={
            searchParams.get("token") ?? getResultToken(assessmentId) ?? ""
          }
        />
      )}
    </PageState>
  );
}

function ResultDashboard({
  assessmentId,
  result,
  token,
}: {
  assessmentId: string;
  result: AssessmentResultResponse;
  token: string;
}) {
  const bottleneckSummaries =
    result.report.bottleneckSummaries as StructuredReport["bottleneckSummaries"];
  const layerSummaries =
    result.report.layerSummaries as StructuredReport["layerSummaries"];

  const bottlenecksWithSummary = result.bottlenecks.map((bottleneck) => {
    const summary = bottleneckSummaries?.find(
      (item) => item.domainName === bottleneck.domainName,
    );
    return { ...bottleneck, summary };
  });

  const reportUrl = `/report/${result.report.id}?token=${encodeURIComponent(token)}&assessmentId=${encodeURIComponent(assessmentId)}`;
  const diagnosisSummary = result.report.diagnosisSummary;

  return (
    <div className="space-y-8">
      <ResultStickySummary
        percentage={result.overallScore.percentage}
        healthLevel={result.overallScore.healthLevel}
      />
      {token && <CopyResultLink assessmentId={assessmentId} token={token} />}
      {token && result.report.reportSpec && (
        <Card padding="compact">
          <DownloadReportPdf reportId={result.report.id} token={token} />
        </Card>
      )}
      {diagnosisSummary && <DiagnosisSummaryPanel summary={diagnosisSummary} />}
      <Card
        as="section"
        id="result-score"
        padding="compact"
        className="scroll-mt-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            label="نتیجه ارزیابی"
            title={`${Math.round(result.overallScore.percentage)}%`}
            subtitle="امتیاز کلی سلامت فروش"
          />
          <HealthBadge level={result.overallScore.healthLevel} size="lg" />
        </div>
        <p className="mt-6 leading-7 text-zinc-700">
          {result.report.overallSummary}
        </p>
      </Card>

      <Card
        as="section"
        id="result-chart"
        padding="compact"
        className="scroll-mt-8"
      >
        <SectionHeader
          label="نمودار"
          title="نمودار ۱۶ دامنه"
          subtitle="نمای کلی وضعیت هر بخش از مسیر فروش"
        />
        <div className="mt-6">
          <SpiderChart data={result.spiderChartData} />
        </div>
      </Card>

      <Card
        as="section"
        id="result-layers"
        padding="compact"
        className="scroll-mt-8"
      >
        <SectionHeader label="لایه‌ها" title="وضعیت ۴ لایه" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {result.layerScores.map((layer) => (
            <div
              key={layer.layerId}
              className="rounded-xl border border-zinc-100 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">{layer.name}</p>
                <span className="text-sm font-semibold text-zinc-700">
                  {Math.round(layer.percentage)}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${healthLevelBarColor(layer.healthLevel)}`}
                  style={{ width: `${layer.percentage}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {layerStatusLabelFa(
                  layer.healthLevel as "healthy" | "medium" | "weak" | "critical",
                )}
              </p>
              {layerSummaries?.find((s) => s.layerName === layer.name) && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                  {
                    layerSummaries.find((s) => s.layerName === layer.name)
                      ?.summary
                  }
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <section id="result-bottlenecks" className="scroll-mt-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          ۳ گلوگاه اصلی فروش
        </h2>
        <div className="space-y-4">
          {bottlenecksWithSummary.map((bottleneck) => (
            <BottleneckCard
              key={bottleneck.domainId}
              rank={bottleneck.rank}
              domainName={bottleneck.domainName}
              priorityScore={bottleneck.priorityScore}
              summary={bottleneck.summary?.summary}
            />
          ))}
        </div>
      </section>

      <Card
        as="section"
        id="result-report-cta"
        padding="compact"
        className="scroll-mt-8 border border-emerald-200 bg-emerald-50 text-center"
      >
        <h2 className="text-lg font-semibold text-zinc-900">
          گزارش کامل و برنامه اقدام
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          برای تحلیل عمیق ۱۶ دامنه، تشخیص ریشه‌ای و برنامه ۷ و ۳۰ روزه، گزارش
          تفصیلی را ببینید.
        </p>
        <Link href={reportUrl} className="mt-6 inline-block">
          <Button size="lg">مشاهده گزارش کامل</Button>
        </Link>
      </Card>
    </div>
  );
}

export default function ResultPage() {
  return (
    <ReportShell
      title="داشبورد نتیجه"
      subtitle="خلاصه وضعیت فروش و اولویت‌های بهبود"
      toc={RESULT_TOC}
    >
      <Suspense
        fallback={
          <LoadingSpinner message={PAGE_MESSAGES.loading.default} />
        }
      >
        <ResultContent />
      </Suspense>
    </ReportShell>
  );
}
