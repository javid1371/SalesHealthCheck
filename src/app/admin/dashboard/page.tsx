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
            label="ارزیابی امروز"
            value={dashboard.kpis.assessmentsToday}
          />
          <KpiCard
            label="ارزیابی این هفته"
            value={dashboard.kpis.assessmentsThisWeek}
          />
          <KpiCard
            label="ارزیابی این ماه"
            value={dashboard.kpis.assessmentsThisMonth}
          />
          <KpiCard
            label="نرخ تکمیل"
            value={dashboard.kpis.completionRate}
            suffix="٪"
          />
          <KpiCard
            label="لیدهای بحرانی"
            value={dashboard.kpis.criticalLeads}
          />
          <KpiCard
            label="درخواست مشاوره جدید"
            value={dashboard.kpis.newConsultations}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          قیف تبدیل
        </h2>
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <p className="text-sm text-zinc-600">شروع‌شده</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.funnel.started.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">تکمیل‌شده</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.funnel.completed.toLocaleString("fa-IR")}
              </p>
              <p className="text-xs text-zinc-500">
                {dashboard.funnel.completedRate.toLocaleString("fa-IR")}٪ از
                شروع‌شده
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-600">درخواست مشاوره</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {dashboard.funnel.consultations.toLocaleString("fa-IR")}
              </p>
              <p className="text-xs text-zinc-500">
                {dashboard.funnel.consultationRate.toLocaleString("fa-IR")}٪ از
                تکمیل‌شده
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
