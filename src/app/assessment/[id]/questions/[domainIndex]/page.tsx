"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AssessmentProgressHeader } from "@/components/assessment/AssessmentProgressHeader";
import { type SaveStatus } from "@/components/assessment/SaveStatusIndicator";
import { AssessmentShell } from "@/components/layout/AssessmentShell";
import {
  DomainQuestionForm,
  isDomainComplete,
} from "@/components/assessment/DomainQuestionForm";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  getAnswers,
  getQuestions,
  mergeAnswersFromServer,
  saveAnswers,
  saveQuestions,
  setAnswer,
  type AnswerMap,
} from "@/lib/assessment-storage";
import { PAGE_MESSAGES, resolveApiError } from "@/lib/page-messages";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";
import type {
  AssessmentAnswersResponse,
  SaveAnswersResponse,
} from "@/modules/assessment/assessment.types";

interface DevAutofillResponse {
  resultUrl: string;
}

const isDevAutofillEnabled = process.env.NODE_ENV !== "production";

export default function DomainQuestionsPage() {
  const params = useParams<{ id: string; domainIndex: string }>();
  const router = useRouter();
  const assessmentId = params.id;
  const domainIndex = Number.parseInt(params.domainIndex, 10);

  const [questionsData, setQuestionsData] =
    useState<QuestionsForAssessmentDto | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [devAutofilling, setDevAutofilling] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    const cachedQuestions = getQuestions(assessmentId);
    if (!cachedQuestions) return;

    setQuestionsData(cachedQuestions);
    setAnswers(getAnswers(assessmentId));
    setLoading(false);
  }, [assessmentId]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAnswers() {
      try {
        const data = await apiGet<AssessmentAnswersResponse>(
          `/api/assessments/${assessmentId}/answers`,
        );
        if (cancelled) return;
        const merged = mergeAnswersFromServer(assessmentId, data.answers);
        setAnswers(merged);
      } catch {
        // Ignore — e.g. completed assessment or no saved answers yet.
      }
    }

    void hydrateAnswers();
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  useEffect(() => {
    if (questionsData) return;

    let cancelled = false;

    async function fetchQuestions() {
      try {
        const data = await apiGet<QuestionsForAssessmentDto>(
          `/api/assessments/${assessmentId}/questions`,
        );
        if (cancelled) return;
        saveQuestions(assessmentId, data);
        setQuestionsData(data);
        setAnswers(getAnswers(assessmentId));
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          resolveApiError(err, PAGE_MESSAGES.notFound.questions),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, questionsData]);

  function retryLoadQuestions() {
    setLoadError(null);
    setLoading(true);
    setQuestionsData(null);
  }

  useEffect(() => {
    if (!questionsData) return;
    if (
      Number.isNaN(domainIndex) ||
      domainIndex < 0 ||
      domainIndex >= questionsData.domains.length
    ) {
      router.replace(`/assessment/${assessmentId}/questions/0`);
    }
  }, [questionsData, domainIndex, assessmentId, router]);

  function handleAnswerChange(questionId: string, optionId: string) {
    const updated = setAnswer(assessmentId, questionId, optionId);
    setAnswers({ ...updated });
    setSaveError(null);
    setSaveStatus("idle");
  }

  async function saveCurrentDomain(): Promise<boolean> {
    if (!questionsData) return false;

    const domain = questionsData.domains[domainIndex];
    if (!domain) return false;

    const domainAnswers = domain.questions
      .filter((q) => answers[q.id])
      .map((q) => ({
        questionId: q.id,
        selectedOptionId: answers[q.id],
      }));

    if (domainAnswers.length === 0) return true;

    setSaving(true);
    setSaveError(null);
    setSaveStatus("saving");
    try {
      await apiPost<SaveAnswersResponse>(
        `/api/assessments/${assessmentId}/answers`,
        { answers: domainAnswers },
      );
      saveAnswers(assessmentId, answers);
      setSaveStatus("saved");
      window.setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, 2000);
      return true;
    } catch (err) {
      setSaveError(resolveApiError(err, PAGE_MESSAGES.saveFailed));
      setSaveStatus("error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePrevious() {
    if (domainIndex === 0) return;
    const saved = await saveCurrentDomain();
    if (!saved) return;
    router.push(`/assessment/${assessmentId}/questions/${domainIndex - 1}`);
  }

  async function handleNext() {
    if (!questionsData) return;

    const domain = questionsData.domains[domainIndex];
    if (!isDomainComplete(domain.questions, answers)) {
      setSaveError("لطفاً به همه سوالات این بخش پاسخ دهید.");
      return;
    }

    const saved = await saveCurrentDomain();
    if (!saved) return;

    const isLastDomain = domainIndex === questionsData.domains.length - 1;
    if (isLastDomain) {
      router.push(`/assessment/${assessmentId}/review`);
    } else {
      router.push(`/assessment/${assessmentId}/questions/${domainIndex + 1}`);
    }
  }

  async function handleDevAutofill() {
    setDevAutofilling(true);
    setSaveError(null);
    setSaveStatus("saving");

    try {
      const data = await apiPost<DevAutofillResponse>(
        `/api/dev/assessments/${assessmentId}/autofill`,
        { strategy: "random" },
      );
      setSaveStatus("saved");
      router.push(data.resultUrl);
    } catch (err) {
      setSaveError(resolveApiError(err, PAGE_MESSAGES.saveFailed));
      setSaveStatus("error");
    } finally {
      setDevAutofilling(false);
    }
  }

  const domain = questionsData?.domains[domainIndex];
  const loadErrorMessage =
    loadError ??
    (!loading && !questionsData ? PAGE_MESSAGES.notFound.questions : null);

  return (
    <AssessmentShell
      loading={loading}
      loadingMessage={PAGE_MESSAGES.loading.questions}
      error={loadErrorMessage}
      onRetry={retryLoadQuestions}
      stickyProgress={
        questionsData && domain ? (
          <AssessmentProgressHeader
            overall={{
              current: Object.keys(answers).length,
              total: questionsData.domains.reduce(
                (sum, d) => sum + d.questions.length,
                0,
              ),
              label: "پیشرفت کلی",
            }}
            domain={{
              current: domain.questions.filter((q) => answers[q.id]).length,
              total: domain.questions.length,
              domainIndex: domainIndex + 1,
              domainTotal: questionsData.domains.length,
              domainName: domain.name,
            }}
            saveStatus={saveStatus}
          />
        ) : undefined
      }
      banner={
        saveError ? (
          <div className="mb-6">
            <ErrorMessage message={saveError} />
          </div>
        ) : undefined
      }
      reverseActionsOnMobile
      actions={
        questionsData && domain ? (
          <>
            {isDevAutofillEnabled && (
              <Button
                variant="ghost"
                fullWidth
                className="sm:w-auto"
                onClick={() => void handleDevAutofill()}
                loading={devAutofilling}
                loadingLabel="در حال ساخت گزارش تست..."
                disabled={saving}
              >
                پر کردن تستی و دیدن گزارش
              </Button>
            )}
            <Button
              variant="secondary"
              fullWidth
              className="sm:w-auto"
              onClick={() => void handlePrevious()}
              disabled={domainIndex === 0 || saving || devAutofilling}
            >
              بخش قبلی
            </Button>
            <Button
              fullWidth
              className="sm:w-auto"
              onClick={() => void handleNext()}
              loading={saving}
              loadingLabel="در حال ذخیره..."
              disabled={devAutofilling}
            >
              {domainIndex === questionsData.domains.length - 1
                ? "مرور پاسخ‌ها"
                : "بخش بعدی"}
            </Button>
          </>
        ) : undefined
      }
    >
      {questionsData && domain && (
        <DomainQuestionForm
          questions={domain.questions}
          answers={answers}
          onAnswerChange={handleAnswerChange}
        />
      )}
    </AssessmentShell>
  );
}
