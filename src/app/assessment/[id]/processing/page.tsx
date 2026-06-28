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
import { apiPost } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import { PAGE_MESSAGES, resolveApiError } from "@/lib/page-messages";
import type { FinishAssessmentResponse } from "@/modules/assessment/assessment.types";

const PROCESSING_MESSAGES = [
  "در حال محاسبه امتیاز دامنه‌ها...",
  "در حال تشخیص گلوگاه‌های اصلی...",
  "در حال آماده‌سازی گزارش شما...",
];

function navigateToResult(
  router: ReturnType<typeof useRouter>,
  assessmentId: string,
  result: FinishAssessmentResponse,
) {
  const token = getResultToken(assessmentId);
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  router.replace(
    result.resultUrl || `/assessment/${assessmentId}/result${tokenParam}`,
  );
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
      try {
        const result = await apiPost<FinishAssessmentResponse>(
          `/api/assessments/${assessmentId}/finish`,
          {},
        );
        navigateToResult(router, assessmentId, result);
      } catch (err) {
        finishStarted.current = false;
        setError(resolveApiError(err, PAGE_MESSAGES.finishFailed));
      }
    }

    void finish();
  }, [assessmentId, router]);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      const result = await apiPost<FinishAssessmentResponse>(
        `/api/assessments/${assessmentId}/finish`,
        {},
      );
      navigateToResult(router, assessmentId, result);
    } catch (err) {
      setError(resolveApiError(err, PAGE_MESSAGES.finishFailed));
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
