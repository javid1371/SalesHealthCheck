import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { SpiderChart } from "@/components/charts/SpiderChart";
import { ReportShell } from "@/components/layout/ReportShell";
import { BottleneckCard } from "@/components/report/BottleneckCard";
import { DiagnosisSummaryPanel } from "@/components/report/DiagnosisSummaryPanel";
import { HealthBadge } from "@/components/report/HealthBadge";
import { ResultStickySummary } from "@/components/report/ResultStickySummary";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { healthLevelBarColor } from "@/lib/health-colors";
import { isAppError } from "@/lib/errors";
import { layerStatusLabelFa } from "@/lib/health-level";
import { healthLevelLabelFa } from "@/lib/health-level";
import { readAdminSession } from "@/lib/session";
import { getAssessmentResult } from "@/modules/assessment/assessment.service";
import type { AssessmentResultResponse } from "@/modules/assessment/assessment.types";
import { getAssessmentForAdmin } from "@/modules/admin/admin.service";
import { AdminLogoutButton } from "../AdminLogoutButton";
import type { StructuredReport } from "@/types/report";

interface AdminAssessmentDetailPageProps {
  params: Promise<{ id: string }>;
}

function AdminResultBody({ result }: { result: AssessmentResultResponse }) {
  const bottleneckSummaries =
    result.report.bottleneckSummaries as StructuredReport["bottleneckSummaries"];

  const bottlenecksWithSummary = result.bottlenecks.map((bottleneck) => {
    const summary = bottleneckSummaries?.find(
      (item) => item.domainName === bottleneck.domainName,
    );
    return { ...bottleneck, summary };
  });

  return (
    <div className="space-y-8">
      <ResultStickySummary
        percentage={result.overallScore.percentage}
        healthLevel={result.overallScore.healthLevel}
      />

      {result.report.diagnosisSummary && (
        <DiagnosisSummaryPanel summary={result.report.diagnosisSummary} />
      )}

      <Card as="section" padding="compact">
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

      <Card as="section" padding="compact">
        <SectionHeader
          label="نمودار"
          title="نمودار ۱۶ دامنه"
          subtitle="نمای کلی وضعیت هر بخش از مسیر فروش"
        />
        <div className="mt-6">
          <SpiderChart data={result.spiderChartData} />
        </div>
      </Card>

      <Card as="section" padding="compact">
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
                  layer.healthLevel as
                    | "healthy"
                    | "medium"
                    | "weak"
                    | "critical",
                )}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <section>
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
    </div>
  );
}

export default async function AdminAssessmentDetailPage({
  params,
}: AdminAssessmentDetailPageProps) {
  const adminSession = await readAdminSession();
  if (!adminSession) {
    redirect("/admin/login");
  }

  const { id: assessmentId } = await params;

  let detail;
  try {
    detail = await getAssessmentForAdmin(assessmentId);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  let result: AssessmentResultResponse | null = null;
  if (detail.status === "completed") {
    try {
      result = await getAssessmentResult(assessmentId, { adminSession });
    } catch (error) {
      if (!isAppError(error)) {
        throw error;
      }
    }
  }

  const scoreLabel = detail.overallScore
    ? `${detail.overallScore.percentage}٪ — ${healthLevelLabelFa(detail.overallScore.healthLevel)}`
    : null;

  return (
    <ReportShell
      title={detail.businessName}
      subtitle="نمای ادمین — گزارش ارزیابی"
      maxWidth="lg"
    >
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/assessments"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← بازگشت به لیست
          </Link>
          <AdminLogoutButton />
        </div>

        <Card padding="compact">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">وضعیت</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.statusLabel}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">کاربر</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.userName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">موبایل</dt>
              <dd className="mt-0.5 font-medium text-zinc-900" dir="ltr">
                {detail.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">ایمیل</dt>
              <dd className="mt-0.5 font-medium text-zinc-900" dir="ltr">
                {detail.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">شروع</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.startedAt}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">پایان</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.completedAt ?? "—"}
              </dd>
            </div>
            {scoreLabel && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">امتیاز کلی</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium text-zinc-900">
                  {scoreLabel}
                  {detail.overallScore && (
                    <HealthBadge
                      level={detail.overallScore.healthLevel}
                      size="sm"
                    />
                  )}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href={detail.expertViewUrl} variant="secondary">
              Expert View
            </LinkButton>
            {detail.resultUrl && (
              <LinkButton href={detail.resultUrl} variant="secondary">
                داشبورد نتیجه
              </LinkButton>
            )}
            {detail.reportUrl && (
              <LinkButton href={detail.reportUrl}>گزارش کامل</LinkButton>
            )}
          </div>
        </Card>
      </div>

      {detail.status !== "completed" && (
        <Card>
          <p className="text-sm leading-7 text-zinc-600">
            این ارزیابی هنوز تکمیل نشده است. پس از اتمام تست، گزارش در این
            صفحه نمایش داده می‌شود.
          </p>
        </Card>
      )}

      {result && <AdminResultBody result={result} />}
    </ReportShell>
  );
}
