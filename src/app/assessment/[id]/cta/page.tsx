"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ConsultationForm } from "@/components/assessment/ConsultationForm";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiPost } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import { PAGE_MESSAGES } from "@/lib/page-messages";

function CtaContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const assessmentId = params.id;
  const reportId = searchParams.get("reportId") ?? undefined;
  const token = searchParams.get("token");
  const resultHref = token
    ? `/assessment/${assessmentId}/result?token=${encodeURIComponent(token)}`
    : `/assessment/${assessmentId}/result`;

  useEffect(() => {
    const eventToken = token ?? getResultToken(assessmentId) ?? undefined;
    void apiPost("/api/funnel/events", {
      type: "consultation_started",
      assessmentSessionId: assessmentId,
      token: eventToken,
    }).catch(() => undefined);
  }, [assessmentId, token]);

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="text-xl font-semibold text-zinc-900">
          درخواست مشاوره رایگان
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-600">
          برای بررسی دقیق‌تر اولویت‌های شناسایی‌شده و دریافت نقشه اقدام
          اختصاصی، فرم زیر را تکمیل کنید. کارشناس ما با شما تماس می‌گیرد.
        </p>
        <div className="mt-8">
          <ConsultationForm assessmentId={assessmentId} reportId={reportId} />
        </div>
      </Card>

      <div className="text-center">
        <LinkButton href={resultHref} variant="secondary" size="sm">
          بازگشت به خلاصه نتیجه
        </LinkButton>
      </div>
    </div>
  );
}

export default function CtaPage() {
  return (
    <PageLayout
      title="قدم بعدی"
      subtitle="درخواست مشاوره رایگان"
      maxWidth="lg"
    >
      <Suspense fallback={<LoadingSpinner message={PAGE_MESSAGES.loading.default} />}>
        <CtaContent />
      </Suspense>
    </PageLayout>
  );
}
