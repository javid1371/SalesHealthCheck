import { PageLayout } from "@/components/layout/PageLayout";
import {
  LandingFunnelTracker,
  LandingStartButton,
} from "@/components/funnel/LandingFunnel";
import { LandingHeroMedia } from "@/components/funnel/LandingHeroMedia";
import { LandingSampleOutput } from "@/components/funnel/LandingSampleOutput";
import { HealthGauge } from "@/components/report/blocks/HealthGauge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { countCompletedAssessments } from "@/modules/assessment/assessment.repository";

/** Hide the live count until there are enough completions to feel credible. */
const MIN_COMPLETED_TO_SHOW = 10;

/** Avoid build-time prerender — this page queries Postgres for the live count. */
export const dynamic = "force-dynamic";

const TRUST_BULLETS = [
  "اگه فروش داری ولی نمی‌دونی مشکل از کجاست، برای توئه",
  "تهش می‌فهمی اولویت چیه و از کجا باید شروع کنی",
  "جلسه و مشاور لازم نداره؛ چند تا سؤال کافیه",
] as const;

const SOCIAL_PROOF_QUOTES = [
  {
    quote:
      "«فکر می‌کردم جذب مشکل داره. معلوم شد پیگیری‌مون می‌لنگه.»",
    author: "مدیر بازاریابی، کسب‌وکار خدماتی",
  },
  {
    quote:
      "«دیگه جلسه حدس‌زنی نداریم. می‌دونیم اول باید چی کار کنیم.»",
    author: "بنیان‌گذار، فروش B2B",
  },
  {
    quote: "«۱۵ دقیقه طول کشید بفهمم پول کجا داره می‌سوزه.»",
    author: "مدیرعامل، فروشگاه آنلاین",
  },
] as const;

const SAMPLE_GAUGE = {
  percentage: 58,
  label: "سلامت کلی قیف فروش",
  survivalStatus: "AMBER" as const,
};

export default async function Home() {
  const completedCount = await countCompletedAssessments();
  const showCompletedCount = completedCount >= MIN_COMPLETED_TO_SHOW;

  return (
    <PageLayout maxWidth="lg">
      <LandingFunnelTracker />

      <div className="space-y-8">
        <Card padding="spacious">
          <SectionHeader label="Sales Health Check" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            ممکنه مشکل فروش‌ات جایی باشه که فکرشو نمی‌کنی
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            خیلی‌ها رو جذب مشتری خرج می‌کنن، ولی پول‌شون یه جای دیگه می‌سوزه. ۱۵
            دقیقه وقت بذار، ببین گیر اصلی کجاست.
          </p>

          <LandingHeroMedia />

          <ul className="mt-8 space-y-3">
            {TRUST_BULLETS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-zinc-700"
              >
                <span className="text-emerald-600">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <LandingStartButton
            href="/assessment/start"
            fullWidth
            className="mt-10"
          >
            رایگان شروع کن
          </LandingStartButton>
        </Card>

        <Card padding="spacious">
          <SectionHeader
            label="چیزی که می‌گیری"
            title="یه گزارش که بگه از کجا شروع کنی"
            subtitle="نمونه‌ست؛ مال خودت بعد از جواب‌هات می‌آد"
          />

          <div className="mt-8 space-y-6">
            <HealthGauge gauge={SAMPLE_GAUGE} />
            <LandingSampleOutput />
          </div>

          <p className="mt-6 text-sm leading-7 text-zinc-600">
            امتیاز، چند تا گلوگاه اصلی، و کارهایی که همون هفته می‌تونی انجام بدی.
            اگه بخوای می‌گه چقدر فروش داری از دست می‌دی.
          </p>
        </Card>

        <Card padding="spacious">
          <SectionHeader title="کسایی که تمومش کردن، دیگه حدس نمی‌زنن" />

          {showCompletedCount && (
            <p className="mt-4 text-sm text-zinc-600">
              تا الان{" "}
              <span className="font-semibold text-zinc-900">
                {completedCount.toLocaleString("fa-IR")}
              </span>{" "}
              نفر ارزیابی رو تموم کردن
            </p>
          )}

          <ul className="mt-8 space-y-6">
            {SOCIAL_PROOF_QUOTES.map((item) => (
              <li
                key={item.author}
                className="rounded-xl border border-zinc-100 bg-zinc-50 p-5"
              >
                <p className="text-sm leading-7 text-zinc-700">{item.quote}</p>
                <p className="mt-3 text-xs text-zinc-500">{item.author}</p>
              </li>
            ))}
          </ul>

          <LandingStartButton
            href="/assessment/start"
            fullWidth
            className="mt-10"
          >
            رایگان شروع کن
          </LandingStartButton>
        </Card>
      </div>
    </PageLayout>
  );
}
