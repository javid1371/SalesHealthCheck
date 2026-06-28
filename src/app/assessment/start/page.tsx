import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

export default function AssessmentStartPage() {
  return (
    <PageLayout
      title="قبل از شروع"
      subtitle="چند نکته برای پاسخ‌دهی دقیق‌تر"
      showBack
      backHref="/"
    >
      <Card>
        <ul className="space-y-4 text-base leading-7 text-zinc-700">
          <li className="flex gap-3">
            <span className="mt-1 text-emerald-600">•</span>
            سوالات درباره وضعیت واقعی کسب‌وکار شماست، نه دانش تئوری.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 text-emerald-600">•</span>
            پاسخ درست یا غلط وجود ندارد.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 text-emerald-600">•</span>
            گزینه‌ای را انتخاب کنید که به واقعیت امروز کسب‌وکار شما نزدیک‌تر
            است.
          </li>
          <li className="flex gap-3">
            <span className="mt-1 text-emerald-600">•</span>
            هرچه صادقانه‌تر پاسخ دهید، گزارش دقیق‌تر خواهد بود.
          </li>
        </ul>

        <p className="mt-6 text-sm text-zinc-500">
          ارزیابی شامل ۱۶ بخش و حدود ۸۰ سوال است. پاسخ‌های شما در هر مرحله
          ذخیره می‌شوند.
        </p>

        <LinkButton href="/assessment/start/info" fullWidth className="mt-8">
          ادامه و ثبت اطلاعات کسب‌وکار
        </LinkButton>
      </Card>
    </PageLayout>
  );
}
