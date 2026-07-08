import { PageLayout } from "@/components/layout/PageLayout";
import {
  LandingFunnelTracker,
  LandingStartButton,
} from "@/components/funnel/LandingFunnel";
import { LandingSampleOutput } from "@/components/funnel/LandingSampleOutput";
import { HealthGauge } from "@/components/report/blocks/HealthGauge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

const TRUST_BULLETS = [
  "مناسب برای مدیران کسب‌وکارهای کوچک و متوسط",
  "خروجی شامل امتیاز، گلوگاه‌ها و اقدام‌های پیشنهادی",
  "زمان تقریبی: ۱۰ تا ۱۵ دقیقه",
] as const;

const SOCIAL_PROOF_QUOTES = [
  {
    quote:
      "«برای اولین بار دیدم مشکل فروش از کجاست — نه حدس، بلکه با عدد و اولویت.»",
    author: "مدیر بازاریابی، کسب‌وکار خدماتی",
  },
  {
    quote:
      "«گزارش عملی بود؛ همان هفته دو اقدام کوتاه‌مدت را اجرا کردیم.»",
    author: "بنیان‌گذار، فروش B2B",
  },
  {
    quote:
      "«زیر ۱۵ دقیقه مشخص شد کدام بخش قیف بیشترین افت را دارد.»",
    author: "مدیرعامل، فروشگاه آنلاین",
  },
] as const;

const SAMPLE_GAUGE = {
  percentage: 58,
  label: "سلامت کلی قیف فروش",
  survivalStatus: "AMBER" as const,
};

export default function Home() {
  return (
    <PageLayout maxWidth="lg">
      <LandingFunnelTracker />

      <div className="space-y-8">
        <Card padding="spacious">
          <SectionHeader label="Sales Health Check" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            سلامت مسیر فروش کسب‌وکارت را بسنج
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-600">
            در چند دقیقه گلوگاه‌های اصلی فروش را پیدا کن و برنامه اقدام
            عملیاتی دریافت کن.
          </p>

          <div
            className="mt-8 flex aspect-video items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500"
            aria-hidden
          >
            ویدیو / تصویر معرفی (placeholder)
          </div>

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
            شروع ارزیابی فروش
          </LandingStartButton>
        </Card>

        <Card padding="spacious">
          <SectionHeader
            label="خروجی آزمون"
            title="بعد از آزمون چه می‌گیری؟"
            subtitle="نمونه‌ای از گزارش شخصی‌سازی‌شده — محتوای واقعی بر اساس پاسخ‌های شما"
          />

          <div className="mt-8 space-y-6">
            <HealthGauge gauge={SAMPLE_GAUGE} />
            <LandingSampleOutput />
          </div>

          <p className="mt-6 text-sm leading-7 text-zinc-600">
            علاوه بر امتیاز کلی، گلوگاه‌های اصلی، اقدام‌های پیشنهادی و در صورت
            تمایل، برآورد فرصت فروش از دست‌رفته را دریافت می‌کنید.
          </p>
        </Card>

        <Card padding="spacious">
          <SectionHeader
            label="اثبات اجتماعی"
            title="مدیران کسب‌وکارهایی مثل شما از این ابزار استفاده کرده‌اند"
          />

          <p className="mt-4 text-sm text-zinc-600">
            بیش از{" "}
            <span className="font-semibold text-zinc-900">۵۰۰+</span> ارزیابی
            تکمیل‌شده (placeholder)
          </p>

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
            شروع ارزیابی فروش
          </LandingStartButton>
        </Card>
      </div>
    </PageLayout>
  );
}
