import Link from "next/link";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { readAdminSession } from "@/lib/session";
import { getAdminDashboard } from "@/modules/admin/admin.service";
import { AdminNav } from "../AdminNav";

function KpiCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">
        {value.toLocaleString("fa-IR")}
        {suffix ? (
          <span className="text-lg font-normal text-zinc-600">{suffix}</span>
        ) : null}
      </p>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const dashboard = await getAdminDashboard();

  return (
    <PageLayout
      title="پنل ادمین — داشبورد"
      subtitle="نمای کلی KPIها، قیف تبدیل و عملکرد کارشناس‌ها."
      showBack
      backHref="/"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">KPIها</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="نفر تأییدشده امروز"
            value={dashboard.kpis.usersVerifiedToday}
          />
          <KpiCard
            label="نفر تأییدشده این هفته"
            value={dashboard.kpis.usersVerifiedThisWeek}
          />
          <KpiCard
            label="نفر تأییدشده این ماه"
            value={dashboard.kpis.usersVerifiedThisMonth}
          />
          <KpiCard
            label="نفر تکمیل‌کننده این هفته"
            value={dashboard.kpis.usersCompletedThisWeek}
          />
          <KpiCard
            label="نرخ تکمیل نفر"
            value={dashboard.kpis.userCompletionRate}
            suffix="٪"
          />
          <KpiCard
            label="لید بحرانی (نفر)"
            value={dashboard.kpis.usersCriticalLeads}
          />
          <KpiCard
            label="درخواست مشاوره جدید (نفر)"
            value={dashboard.kpis.usersNewConsultations}
          />
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          عملیاتی — تعداد ارزیابی این هفته:{" "}
          <span className="font-medium text-zinc-700">
            {dashboard.kpis.assessmentsThisWeek.toLocaleString("fa-IR")}
          </span>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          قیف تبدیل
        </h2>
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <p className="text-sm text-zinc-600">نفر شروع‌کننده</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.funnel.started.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">نفر تکمیل‌کننده</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.funnel.completed.toLocaleString("fa-IR")}
              </p>
              <p className="text-xs text-zinc-500">
                {dashboard.funnel.completedRate.toLocaleString("fa-IR")}٪ از
                نفر شروع‌کننده
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">نفر درخواست مشاوره</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.funnel.consultations.toLocaleString("fa-IR")}
              </p>
              <p className="text-xs text-zinc-500">
                {dashboard.funnel.consultationRate.toLocaleString("fa-IR")}٪ از
                نفر تکمیل‌کننده
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">قیف پیامکی</h2>
          <LinkButton href="/admin/sms-funnel" variant="secondary" size="sm">
            مدیریت قیف پیامکی
          </LinkButton>
        </div>
        <Card>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="text-center">
              <p className="text-sm text-zinc-600">ارسال‌شده</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.smsFunnel.smsSent.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">در صف</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.smsFunnel.smsPending.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">ناموفق</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.smsFunnel.smsFailed.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">کلیک لینک</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.smsFunnel.linkClicks.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">شروع فرم تماس</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.smsFunnel.consultationStarts.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">لغو پیامک</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.smsFunnel.optOutCount.toLocaleString("fa-IR")}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            عملکرد کارشناس‌ها
          </h2>
          <LinkButton href="/admin/staff" variant="secondary" size="sm">
            مدیریت کاربران
          </LinkButton>
        </div>

        {dashboard.expertPerformance.length === 0 ? (
          <Card className="text-center">
            <p className="text-zinc-600">هنوز کارشناس فعالی ثبت نشده است.</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700">کارشناس</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    لید تخصیص‌یافته
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">باز</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    بسته — موفق
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    بسته — ناموفق
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dashboard.expertPerformance.map((row) => (
                  <tr key={row.staffUserId} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.assigned.toLocaleString("fa-IR")}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.open.toLocaleString("fa-IR")}
                    </td>
                    <td className="px-4 py-3 text-emerald-700">
                      {row.closedWon.toLocaleString("fa-IR")}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.closedLost.toLocaleString("fa-IR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/assessments"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          مشاهده همه ارزیابی‌ها ←
        </Link>
        <Link
          href="/expert/consultations"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          مشاهده همه لیدها ←
        </Link>
      </div>
    </PageLayout>
  );
}
