"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AssessmentProgressHeader } from "@/components/assessment/AssessmentProgressHeader";
import { AssessmentShell } from "@/components/layout/AssessmentShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { apiGet } from "@/lib/api-client";
import {
  getAnswers,
  getQuestions,
  mergeAnswersFromServer,
  saveQuestions,
} from "@/lib/assessment-storage";
import { PAGE_MESSAGES, resolveApiError } from "@/lib/page-messages";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";
import type {
  AssessmentAnswersResponse,
  AssessmentStatusResponse,
} from "@/modules/assessment/assessment.types";

interface DomainStatus {
  index: number;
  name: string;
  total: number;
  answered: number;
  complete: boolean;
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assessmentId = params.id;

  const [questionsData, setQuestionsData] =
    useState<QuestionsForAssessmentDto | null>(() => getQuestions(assessmentId));
  const [answers, setAnswers] = useState(() => getAnswers(assessmentId));
  const [status, setStatus] = useState<AssessmentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        let questions = getQuestions(assessmentId);
        if (!questions) {
          questions = await apiGet<QuestionsForAssessmentDto>(
            `/api/assessments/${assessmentId}/questions`,
          );
          if (cancelled) return;
          saveQuestions(assessmentId, questions);
        }

        const assessmentStatus = await apiGet<AssessmentStatusResponse>(
          `/api/assessments/${assessmentId}`,
        );
        if (cancelled) return;

        let mergedAnswers = getAnswers(assessmentId);
        try {
          const savedAnswers = await apiGet<AssessmentAnswersResponse>(
            `/api/assessments/${assessmentId}/answers`,
          );
          if (cancelled) return;
          mergedAnswers = mergeAnswersFromServer(
            assessmentId,
            savedAnswers.answers,
          );
        } catch {
          // Ignore — e.g. completed assessment.
        }

        setQuestionsData(questions);
        setAnswers(mergedAnswers);
        setStatus(assessmentStatus);
      } catch (err) {
        if (cancelled) return;
        setError(resolveApiError(err, PAGE_MESSAGES.notFound.generic));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, retryKey]);

  function retryLoadData() {
    setError(null);
    setLoading(true);
    setQuestionsData(null);
    setAnswers(getAnswers(assessmentId));
    setStatus(null);
    setRetryKey((k) => k + 1);
  }

  const domainStatuses: DomainStatus[] = useMemo(() => {
    if (!questionsData) return [];
    return questionsData.domains.map((domain, index) => {
      const answered = domain.questions.filter((q) => answers[q.id]).length;
      return {
        index,
        name: domain.name,
        total: domain.questions.length,
        answered,
        complete: answered === domain.questions.length,
      };
    });
  }, [questionsData, answers]);

  const incompleteDomains = domainStatuses.filter((d) => !d.complete);
  const allComplete = incompleteDomains.length === 0;

  function handleFinish() {
    router.push(`/assessment/${assessmentId}/processing`);
  }

  const loadError =
    error ??
    (!loading && (!questionsData || !status)
      ? PAGE_MESSAGES.notFound.generic
      : null);

  const totalQuestions =
    questionsData?.domains.reduce((sum, d) => sum + d.questions.length, 0) ?? 0;

  return (
    <AssessmentShell
      title="مرور پاسخ‌ها"
      subtitle="قبل از دریافت نتیجه، وضعیت تکمیل را بررسی کنید."
      loading={loading}
      loadingMessage={PAGE_MESSAGES.loading.default}
      error={loadError}
      onRetry={retryLoadData}
      stickyProgress={
        questionsData && status ? (
          <AssessmentProgressHeader
            overall={{
              current: status.progress.answeredQuestions,
              total: totalQuestions,
              label: "پیشرفت کلی",
            }}
          />
        ) : undefined
      }
      actions={
        questionsData && status ? (
          <>
            <LinkButton
              href={`/assessment/${assessmentId}/questions/${questionsData.domains.length - 1}`}
              variant="secondary"
              size="md"
              className="w-full sm:w-auto"
            >
              بازگشت به سوالات
            </LinkButton>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <Button onClick={handleFinish} disabled={!allComplete}>
                دریافت نتیجه
              </Button>
              {!allComplete && (
                <a
                  href="#incomplete-domains"
                  className="text-center text-sm font-medium text-brand-700 hover:text-brand-800"
                >
                  مشاهده {incompleteDomains.length} بخش ناقص
                </a>
              )}
            </div>
          </>
        ) : undefined
      }
    >
      {questionsData && status && (
        <>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-zinc-500">دامنه‌های تکمیل‌شده</p>
              <p className="text-2xl font-bold text-zinc-900">
                {domainStatuses.filter((d) => d.complete).length} از{" "}
                {domainStatuses.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">سوالات پاسخ‌داده‌شده</p>
              <p className="text-2xl font-bold text-zinc-900">
                {status.progress.answeredQuestions} از {totalQuestions}
              </p>
            </div>
          </div>

          {incompleteDomains.length > 0 && (
            <Alert
              id="incomplete-domains"
              variant="warning"
              title={`${incompleteDomains.length} بخش ناقص باقی مانده`}
              className="mb-6 scroll-mt-24"
            >
              <p>برای دریافت گزارش، همه بخش‌ها باید کامل شوند.</p>
            </Alert>
          )}

          <ul className="divide-y divide-zinc-100">
            {domainStatuses.map((domain) => {
              const statusIconClass = domain.complete
                ? "bg-health-healthy-subtle text-health-healthy-emphasis"
                : "bg-amber-100 text-amber-700";
              const rowContent = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${statusIconClass}`}
                    >
                      {domain.complete ? "✓" : "!"}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">{domain.name}</p>
                      <p className="text-sm text-zinc-500">
                        {domain.answered} از {domain.total} سوال
                      </p>
                    </div>
                  </div>
                  {!domain.complete && (
                    <span className="shrink-0 text-sm font-medium text-brand-700">
                      تکمیل
                    </span>
                  )}
                </>
              );

              return (
                <li key={domain.index}>
                  {domain.complete ? (
                    <div className="flex items-center justify-between gap-3 py-4">
                      {rowContent}
                    </div>
                  ) : (
                    <Link
                      href={`/assessment/${assessmentId}/questions/${domain.index}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-zinc-50"
                    >
                      {rowContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AssessmentShell>
  );
}
