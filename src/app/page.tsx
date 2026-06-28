import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function Home() {
  return (
    <PageLayout maxWidth="lg">
      <Card padding="spacious">
        <SectionHeader label="Sales Health Check" />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          سلامت مسیر فروش کسب‌وکارت را بسنج
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          در چند دقیقه گلوگاه‌های اصلی فروش را پیدا کن و برنامه اقدام
          عملیاتی دریافت کن.
        </p>

        <div className="mt-8 space-y-3 text-sm text-zinc-600">
          <p>
            این ابزار به شما کمک می‌کند بفهمید مشکل فروش شما از جذب مشتری
            است، پیام و پیشنهاد، پیگیری، مکالمه فروش، تجربه مشتری یا نبود
            عدد و تحلیل.
          </p>
        </div>

        <ul className="mt-8 space-y-3 border-t border-zinc-100 pt-8">
          <li className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="text-emerald-600">✓</span>
            مناسب برای مدیران کسب‌وکارهای کوچک و متوسط
          </li>
          <li className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="text-emerald-600">✓</span>
            خروجی شامل امتیاز، گلوگاه‌ها و اقدام‌های پیشنهادی
          </li>
          <li className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="text-emerald-600">✓</span>
            زمان تقریبی: ۱۰ تا ۱۵ دقیقه
          </li>
        </ul>

        <LinkButton href="/assessment/start" fullWidth className="mt-10">
          شروع ارزیابی فروش
        </LinkButton>
      </Card>
    </PageLayout>
  );
}
