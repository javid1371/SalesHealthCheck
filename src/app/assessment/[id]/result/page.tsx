"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ReportShell } from "@/components/layout/ReportShell";
import { ResultSummaryView } from "@/components/report/ResultSummaryView";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageState } from "@/components/ui/PageState";
import { LinkButton } from "@/components/ui/LinkButton";
import { apiGet, apiPost } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import {
  PAGE_MESSAGES,
  isTokenAccessError,
  resolveApiError,
} from "@/lib/page-messages";
import type { AssessmentResultResponse } from "@/modules/assessment/assessment.types";

function ResultContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const assessmentId = params.id;

  const [result, setResult] = useState<AssessmentResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchResult() {
      const token =
        searchParams.get("token") ?? getResultToken(assessmentId) ?? undefined;
      const url = token
        ? `/api/assessments/${assessmentId}/result?token=${encodeURIComponent(token)}`
        : `/api/assessments/${assessmentId}/result`;

      try {
        const data = await apiGet<AssessmentResultResponse>(url);
        if (cancelled) return;
        setResult(data);
        setError(null);

        const tokenForEvent =
          searchParams.get("token") ?? getResultToken(assessmentId) ?? undefined;
        void apiPost("/api/funnel/events", {
          type: "report_viewed",
          assessmentSessionId: assessmentId,
          token: tokenForEvent,
        }).catch(() => undefined);
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
          router={router}
        />
      )}
    </PageState>
  );
}

function ResultDashboard({
  assessmentId,
  result,
  token,
  router,
}: {
  assessmentId: string;
  result: AssessmentResultResponse;
  token: string;
  router: ReturnType<typeof useRouter>;
}) {
  const reportSpec = result.report.reportSpec;

  const reportQuery = new URLSearchParams({ assessmentId });
  if (token) {
    reportQuery.set("token", token);
  }
  const reportUrl = `/report/${result.report.id}?${reportQuery.toString()}`;

  function navigateToConsultation() {
    const params = new URLSearchParams({
      token,
      reportId: result.report.id,
    });
    router.push(`/assessment/${assessmentId}/cta?${params.toString()}`);
  }

  if (!reportSpec) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-sm leading-7 text-zinc-600">
          گزارش شما در حال آماده‌سازی است. لطفاً چند لحظه دیگر دوباره تلاش
          کنید.
        </p>
        <LinkButton href="/recover" variant="secondary" size="sm">
          بازیابی لینک نتیجه
        </LinkButton>
      </div>
    );
  }

  return (
    <ResultSummaryView
      reportSpec={reportSpec}
      assessmentId={assessmentId}
      reportUrl={reportUrl}
      onConsultationClick={navigateToConsultation}
    />
  );
}

export default function ResultPage() {
  return (
    <ReportShell
      title="خلاصه نتیجه"
      subtitle="در این صفحه خلاصه نتیجه را می‌بینید؛ فراموش نکنید در پایین صفحه حتماً روی «مشاهده گزارش کامل» کلیک کنید."
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
