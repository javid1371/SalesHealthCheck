"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ConsultationForm } from "@/components/assessment/ConsultationForm";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PAGE_MESSAGES } from "@/lib/page-messages";

function CtaContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const assessmentId = params.id;
  const reportId = searchParams.get("reportId") ?? undefined;
  const isAiMode = searchParams.get("mode") === "ai";
  const token = searchParams.get("token");
  const resultHref = token
    ? `/assessment/${assessmentId}/result?token=${encodeURIComponent(token)}`
    : `/assessment/${assessmentId}/result`;

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="text-xl font-semibold text-zinc-900">
          {isAiMode
            ? "خرید تحلیل AI + راهکارها"
            : "درخواست تحلیل دقیق‌تر گلوگاه فروش"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-600">
          {isAiMode
            ? "برای دریافت نقشه ۳۰ روزه اختصاصی، تحلیل AI و راهکارهای کامل دامنه‌ها، فرم زیر را تکمیل کنید."
            : "اگر می‌خواهید گلوگاه‌های شناسایی‌شده را با جزئیات بیشتر بررسی کنید و مسیر اصلاح اختصاصی دریافت کنید، فرم زیر را تکمیل کنید."}
        </p>
        <div className="mt-8">
          <ConsultationForm assessmentId={assessmentId} reportId={reportId} />
        </div>
      </Card>

      <div className="text-center">
        <LinkButton href={resultHref} variant="secondary" size="sm">
          بازگشت به داشبورد نتیجه
        </LinkButton>
      </div>
    </div>
  );
}

export default function CtaPage() {
  return (
    <PageLayout
      title="قدم بعدی"
      subtitle="درخواست بررسی اختصاصی گلوگاه فروش"
      maxWidth="lg"
    >
      <Suspense fallback={<LoadingSpinner message={PAGE_MESSAGES.loading.default} />}>
        <CtaContent />
      </Suspense>
    </PageLayout>
  );
}
