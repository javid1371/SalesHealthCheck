"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CopyResultLink } from "@/components/assessment/CopyResultLink";
import { ProcessingStepper } from "@/components/assessment/ProcessingStepper";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ApiClientError, apiGet, apiPost } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import { trackFunnelEvent } from "@/lib/funnel-track";
import { PAGE_MESSAGES, resolveApiError } from "@/lib/page-messages";
import type {
  EnqueueFinishAssessmentResult,
  FinishAssessmentResponse,
  FinishJobStatusResponse,
} from "@/modules/assessment/assessment.types";

const PROCESSING_MESSAGES = [
  "در حال محاسبه امتیاز دامنه‌ها...",
  "در حال تشخیص گلوگاه‌های اصلی...",
  "در حال آماده‌سازی گزارش شما...",
];

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;

function isCompletedFinish(
  result: EnqueueFinishAssessmentResult,
): result is FinishAssessmentResponse {
  return "reportId" in result && result.status === "completed";
}

function navigateToResult(
  router: ReturnType<typeof useRouter>,
  assessmentId: string,
  resultUrl?: string,
) {
  const token = getResultToken(assessmentId);
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  router.replace(resultUrl || `/assessment/${assessmentId}/result${tokenParam}`);
}

async function pollFinishStatus(
  assessmentId: string,
  token: string | null,
): Promise<FinishJobStatusResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await apiGet<FinishJobStatusResponse>(
      `/api/assessments/${assessmentId}/finish`,
      { token },
    );

    if (status.status === "completed" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return {
    status: "failed",
    error: "آماده‌سازی گزارش بیش از حد طول کشید. لطفاً دوباره تلاش کنید.",
  };
}

function finishFlowErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return resolveApiError(err, PAGE_MESSAGES.finishFailed);
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return PAGE_MESSAGES.finishFailed;
}

async function runFinishFlow(
  assessmentId: string,
  token: string | null,
): Promise<{ resultUrl?: string }> {
  const result = await apiPost<EnqueueFinishAssessmentResult>(
    `/api/assessments/${assessmentId}/finish`,
    {},
    { token },
  );

  if (isCompletedFinish(result)) {
    return { resultUrl: result.resultUrl };
  }

  const status = await pollFinishStatus(assessmentId, token);
  if (status.status === "completed") {
    return { resultUrl: status.resultUrl };
  }

  throw new Error(status.error || PAGE_MESSAGES.finishFailed);
}

export default function ProcessingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = params.id;

  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const finishStarted = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (finishStarted.current) return;
    finishStarted.current = true;

    async function finish() {
      setError(null);
      const token = getResultToken(assessmentId);
      try {
        const { resultUrl } = await runFinishFlow(assessmentId, token);
        void trackFunnelEvent({
          type: "assessment_completed",
          assessmentSessionId: assessmentId,
        });
        navigateToResult(router, assessmentId, resultUrl);
      } catch (err) {
        finishStarted.current = false;
        setError(finishFlowErrorMessage(err));
      }
    }

    void finish();
  }, [assessmentId, router]);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    const token = getResultToken(assessmentId);
    try {
      const { resultUrl } = await runFinishFlow(assessmentId, token);
      void trackFunnelEvent({
        type: "assessment_completed",
        assessmentSessionId: assessmentId,
      });
      navigateToResult(router, assessmentId, resultUrl);
    } catch (err) {
      setError(finishFlowErrorMessage(err));
    } finally {
      setRetrying(false);
    }
  }

  const resultToken = getResultToken(assessmentId);

  return (
    <PageLayout title="در حال تحلیل پاسخ‌ها" maxWidth="md" footer="minimal">
      <Card padding="compact" className="space-y-6">
        {resultToken && (
          <CopyResultLink assessmentId={assessmentId} token={resultToken} />
        )}
        {error ? (
          <>
            <ErrorMessage
              title="خطا در تولید گزارش"
              message={error}
              onRetry={() => void handleRetry()}
            />
            <Button
              variant="secondary"
              onClick={() => router.push(`/assessment/${assessmentId}/review`)}
            >
              بازگشت به مرور
            </Button>
          </>
        ) : retrying ? (
          <LoadingSpinner message={PAGE_MESSAGES.loading.retry} />
        ) : (
          <div className="space-y-8">
            <ProcessingStepper
              activeStep={messageIndex as 0 | 1 | 2}
            />
            <LoadingSpinner message={PROCESSING_MESSAGES[messageIndex]} />
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
