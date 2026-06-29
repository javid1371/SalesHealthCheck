import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "سیاست حریم خصوصی | Sales Health Check",
  description:
    "نحوه جمع‌آوری، استفاده و نگهداری اطلاعات شخصی در ارزیابی سلامت فروش",
};

const contactEmail = env.emailFrom ?? "support@example.com";

export default function PrivacyPage() {
  return (
    <PageLayout
      title="سیاست حریم خصوصی"
      subtitle="آخرین به‌روزرسانی: خرداد ۱۴۰۵"
      showBack
      backHref="/"
      maxWidth="xl"
    >
      <Card as="article" className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">۱. مقدمه</h2>
          <p className="text-sm leading-7 text-zinc-600">
            Sales Health Check («ما») ابزاری برای ارزیابی سلامت مسیر فروش
            کسب‌وکارهاست. این سند توضیح می‌دهد چه اطلاعاتی جمع‌آوری می‌کنیم،
            چرا از آن استفاده می‌کنیم و چگونه از آن محافظت می‌کنیم.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            ۲. اطلاعاتی که جمع‌آوری می‌کنیم
          </h2>
          <ul className="list-disc space-y-2 pr-5 text-sm leading-7 text-zinc-600">
            <li>
              <strong className="font-medium text-zinc-800">اطلاعات تماس:</strong>{" "}
              نام و شماره تلفن همراه (اصلی) — برای شخصی‌سازی گزارش،
              بازیابی لینک نتیجه و پیگیری درخواست مشاوره. در برخی
              فرآیندهای قدیمی‌تر ممکن است ایمیل نیز ثبت شده باشد.
            </li>
            <li>
              <strong className="font-medium text-zinc-800">
                اطلاعات کسب‌وکار:
              </strong>{" "}
              نام کسب‌وکار، حوزه فعالیت، اندازه تیم و مدل فروش — برای
              زمینه‌سازی تحلیل.
            </li>
            <li>
              <strong className="font-medium text-zinc-800">
                پاسخ‌های ارزیابی:
              </strong>{" "}
              انتخاب‌های شما در پرسشنامه — برای تولید امتیاز، تشخیص
              گلوگاه‌ها و گزارش.
            </li>
            <li>
              <strong className="font-medium text-zinc-800">
                درخواست مشاوره (اختیاری):
              </strong>{" "}
              نام، شماره تماس و پیام — در صورت ثبت درخواست تحلیل تخصصی.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            ۳. نحوه استفاده از اطلاعات
          </h2>
          <ul className="list-disc space-y-2 pr-5 text-sm leading-7 text-zinc-600">
            <li>اجرای ارزیابی و تولید گزارش شخصی‌سازی‌شده</li>
            <li>ارسال لینک بازیابی نتیجه (ایمیل در صورت ثبت، یا ورود با شماره در حساب کاربری)</li>
            <li>تماس برای پیگیری درخواست مشاوره (فقط با رضایت شما)</li>
            <li>بهبود کیفیت سرویس و رفع خطاهای فنی</li>
          </ul>
          <p className="text-sm leading-7 text-zinc-600">
            ما اطلاعات شما را به اشخاص ثالث برای اهداف بازاریابی نمی‌فروشیم.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            ۴. مدت نگهداری
          </h2>
          <p className="text-sm leading-7 text-zinc-600">
            داده‌های ارزیابی و گزارش تا زمانی که برای ارائه سرویس و پیگیری
            درخواست‌های مشاوره لازم باشد نگهداری می‌شوند. پس از آن، اطلاعات
            به‌صورت دوره‌ای حذف یا ناشناس‌سازی می‌شوند. نسخه‌های پشتیبان
            پایگاه داده طبق سیاست عملیاتی سرور (معمولاً حداکثر ۷ روز) نگهداری
            می‌شوند.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">۵. امنیت</h2>
          <p className="text-sm leading-7 text-zinc-600">
            دسترسی به گزارش تکمیل‌شده از طریق لینک اختصاصی (توکن) محافظت
            می‌شود. ارتباط با سرور از طریق HTTPS رمزنگاری می‌شود. دسترسی
            داخلی به داده‌ها محدود به نیاز عملیاتی است.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">۶. حقوق شما</h2>
          <p className="text-sm leading-7 text-zinc-600">
            می‌توانید درخواست دسترسی، اصلاح یا حذف اطلاعات شخصی خود را
            بدهید. برای این کار با ما تماس بگیرید. استفاده از سرویس بدون
            ارائه شماره تلفن همراه ممکن نیست.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">۷. تماس</h2>
          <p className="text-sm leading-7 text-zinc-600">
            برای سؤالات مربوط به حریم خصوصی یا درخواست حذف داده، ایمیل
            بزنید به:{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-emerald-700 hover:text-emerald-800"
              dir="ltr"
            >
              {contactEmail}
            </a>
          </p>
        </section>
      </Card>
    </PageLayout>
  );
}
