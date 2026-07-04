"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ReportShell } from "@/components/layout/ReportShell";
import { DetailedReportSections } from "@/components/report/DetailedReportSections";
import { DownloadReportPdf } from "@/components/report/DownloadReportPdf";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageState } from "@/components/ui/PageState";
import { apiGet } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import { PAGE_MESSAGES, resolveApiError } from "@/lib/page-messages";
import type { ReportResponse } from "@/modules/assessment/assessment.types";

function ReportContent() {
  const params = useParams<{ reportId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reportId = params.reportId;

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchReport() {
      const assessmentId = searchParams.get("assessmentId");
      const token =
        searchParams.get("token") ??
        (assessmentId ? getResultToken(assessmentId) : null) ??
        undefined;
      const url = token
        ? `/api/reports/${reportId}?token=${encodeURIComponent(token)}`
        : `/api/reports/${reportId}`;

      try {
        const data = await apiGet<ReportResponse>(url);
        if (cancelled) return;
        setReport(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(resolveApiError(err, PAGE_MESSAGES.notFound.report));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchReport();
    return () => {
      cancelled = true;
    };
  }, [reportId, searchParams, retryKey]);

  const loadError =
    error ?? (!loading && !report ? PAGE_MESSAGES.notFound.report : null);

  return (
    <PageState
      loading={loading}
      loadingMessage={PAGE_MESSAGES.loading.report}
      error={loadError}
      onRetry={() => {
        setLoading(true);
        setError(null);
        setRetryKey((k) => k + 1);
      }}
    >
      {report && (
        <ReportBody
          report={report}
          reportId={reportId}
          searchParams={searchParams}
          router={router}
        />
      )}
    </PageState>
  );
}

function ReportBody({
  report,
  reportId,
  searchParams,
  router,
}: {
  report: ReportResponse;
  reportId: string;
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
}) {
  const token =
    getResultToken(report.assessmentId) ?? searchParams.get("token") ?? "";
  const assessmentId = report.assessmentId;

  function navigateToCta() {
    const params = new URLSearchParams({ reportId });
    if (token) {
      params.set("token", token);
    }
    router.push(`/assessment/${assessmentId}/cta?${params.toString()}`);
  }

  return (
    <>
      <DetailedReportSections
        report={report}
        onRequestAnalysis={navigateToCta}
      />
      {report.reportSpec && (
        <Card padding="compact" className="mt-8">
          <DownloadReportPdf reportId={reportId} token={token || undefined} />
        </Card>
      )}
    </>
  );
}

export default function DetailedReportPage() {
  return (
    <ReportShell
      title="گزارش تفصیلی"
      subtitle="تحلیل عمیق وضعیت فروش و برنامه اقدام"
      maxWidth="5xl"
    >
      <Suspense
        fallback={
          <LoadingSpinner message={PAGE_MESSAGES.loading.default} />
        }
      >
        <ReportContent />
      </Suspense>
    </ReportShell>
  );
}
