import Link from "next/link";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  readAdminSession,
  readSalesExpertSession,
} from "@/lib/session";
import { getExpertDashboard } from "@/modules/consultation/consultation.service";
import { ExpertNav } from "../ExpertNav";

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card className="text-center">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">
        {value.toLocaleString("fa-IR")}
      </p>
    </Card>
  );
}

export default async function ExpertDashboardPage() {
  const adminSession = await readAdminSession();
  const salesExpertSession = await readSalesExpertSession();

  if (!adminSession && !salesExpertSession) {
    redirect("/expert/login");
  }

  if (adminSession && !salesExpertSession) {
    redirect("/admin/dashboard");
  }

  const staffUserId = salesExpertSession?.staffUserId;
  if (!staffUserId) {
    redirect("/expert/login");
  }

  const dashboard = await getExpertDashboard(staffUserId);
  const expertName = salesExpertSession?.name;

  return (
    <PageLayout
      title={expertName ? `سلام ${expertName}` : "داشبورد کارشناس"}
      subtitle="خلاصه لیدهای تخصیص‌یافته و پیگیری‌های امروز."
      showBack
      backHref="/"
      maxWidth="5xl"
      footer="minimal"
    >
      <ExpertNav isAdmin={Boolean(adminSession)} />

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">KPIها</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="لید تخصیص‌یافته"
            value={dashboard.kpis.assignedTotal}
          />
          <KpiCard label="لید جدید" value={dashboard.kpis.newLeads} />
          <KpiCard
            label="نیازمند پیگیری امروز"
            value={dashboard.kpis.followUpDue}
          />
          <KpiCard
            label="بسته‌شده این ماه"
            value={dashboard.kpis.closedThisMonth}
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            پیگیری‌های امروز
          </h2>
          <LinkButton href="/expert/consultations" variant="secondary" size="sm">
            همه لیدها
          </LinkButton>
        </div>

        {dashboard.todayFollowUps.length === 0 ? (
          <Card className="text-center">
            <p className="text-zinc-600">
              امروز لیدی برای پیگیری ثبت نشده است.
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700">نام</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    کسب‌وکار
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    وضعیت
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    پیگیری بعدی
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700" aria-label="عملیات" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dashboard.todayFollowUps.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.businessName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700">
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.nextFollowUpAt ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={row.detailUrl}
                        className="font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageLayout>
  );
}
