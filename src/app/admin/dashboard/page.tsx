import Link from "next/link";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { readAdminSession } from "@/lib/session";
import { getAdminDashboard } from "@/modules/admin/admin.service";
import type { AdminLeadStatusFunnel } from "@/modules/admin/admin.types";
import { AdminNav } from "../AdminNav";

function KpiCard({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: "amber" | "red";
}) {
  const valueColor =
    highlight === "red"
      ? "text-red-700"
      : highlight === "amber"
        ? "text-amber-700"
        : "text-zinc-900";

  return (
    <Card className="text-center">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueColor}`}>
        {value.toLocaleString("fa-IR")}
        {suffix ? (
          <span className="text-lg font-normal text-zinc-600">{suffix}</span>
        ) : null}
      </p>
    </Card>
  );
}

function formatSmsDate(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function LeadStatusFunnelBar({ funnel }: { funnel: AdminLeadStatusFunnel }) {
  const stages = [
    { key: "new", label: "جدید", count: funnel.new, color: "bg-sky-500" },
    {
      key: "contacted",
      label: "تماس",
      count: funnel.contacted,
      color: "bg-blue-500",
    },
    {
      key: "meeting",
      label: "جلسه",
      count: funnel.meetingScheduled,
      color: "bg-violet-500",
    },
    {
      key: "won",
      label: "موفق",
      count: funnel.closedWon,
      color: "bg-emerald-500",
    },
    {
      key: "lost",
      label: "ناموفق",
      count: funnel.closedLost,
      color: "bg-zinc-400",
    },
  ] as const;

  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  if (total === 0) {
    return (
      <Card className="text-center">
        <p className="text-zinc-600">هنوز لیدی ثبت نشده است.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex h-8 overflow-hidden rounded-lg">
        {stages.map((stage) =>
          stage.count > 0 ? (
            <div
              key={stage.key}
              className={`${stage.color} flex items-center justify-center text-xs font-medium text-white`}
              style={{ width: `${(stage.count / total) * 100}%` }}
              title={`${stage.label}: ${stage.count.toLocaleString("fa-IR")}`}
            >
              {stage.count > 0 && (stage.count / total) * 100 >= 8
                ? stage.count.toLocaleString("fa-IR")
                : null}
            </div>
          ) : null,
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {stages.map((stage) => (
          <div key={stage.key} className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <p className="text-sm text-zinc-600">{stage.label}</p>
            </div>
            <p className="mt-1 text-xl font-semibold text-zinc-900">
              {stage.count.toLocaleString("fa-IR")}
            </p>
          </div>
        ))}
      </div>
      {funnel.unreachable > 0 ? (
        <p className="mt-3 text-center text-sm text-zinc-500">
          در دسترس نیست:{" "}
          <span className="font-medium text-zinc-700">
            {funnel.unreachable.toLocaleString("fa-IR")}
          </span>
        </p>
      ) : null}
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

      {dashboard.urgentLeads.length > 0 ||
      dashboard.leadKpis.highProbabilityUnassigned > 0 ||
      dashboard.leadKpis.staleNewLeads > 0 ||
      dashboard.leadKpis.overdueFollowUps > 0 ? (
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">لیدهای فوری</h2>
            <LinkButton href="/expert/consultations" variant="secondary" size="sm">
              همه لیدها
            </LinkButton>
          </div>
          <Card className="border-amber-200 bg-amber-50/50">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-sm text-zinc-600">احتمال بالا — بدون تخصیص</p>
                <p className="mt-1 text-2xl font-semibold text-amber-800">
                  {dashboard.leadKpis.highProbabilityUnassigned.toLocaleString(
                    "fa-IR",
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-zinc-600">لید جدید کهنه</p>
                <p className="mt-1 text-2xl font-semibold text-amber-800">
                  {dashboard.leadKpis.staleNewLeads.toLocaleString("fa-IR")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-zinc-600">پیگیری عقب‌افتاده</p>
                <p className="mt-1 text-2xl font-semibold text-red-700">
                  {dashboard.leadKpis.overdueFollowUps.toLocaleString("fa-IR")}
                </p>
              </div>
            </div>
            {dashboard.urgentLeads.length > 0 ? (
              <ul className="divide-y divide-amber-200/80 border-t border-amber-200/80">
                {dashboard.urgentLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className={`flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-3 ${
                      lead.severity === "red"
                        ? "rounded-lg bg-red-50/80 px-2"
                        : ""
                    }`}
                  >
                    <div>
                      <Link
                        href={lead.detailUrl}
                        className="font-medium text-emerald-800 hover:text-emerald-900"
                      >
                        {lead.name}
                      </Link>
                      <p className="text-xs text-zinc-600">
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 font-medium ${
                            lead.severity === "red"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {lead.reason}
                        </span>
                      </p>
                    </div>
                    <Link
                      href={lead.detailUrl}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      جزئیات ←
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">KPIهای لید</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="لید جدید این هفته"
            value={dashboard.leadKpis.newThisWeek}
          />
          <KpiCard
            label="در صف تخصیص"
            value={dashboard.leadKpis.pendingAssignment}
            highlight={
              dashboard.leadKpis.pendingAssignment > 0 ? "amber" : undefined
            }
          />
          <KpiCard
            label="پیگیری عقب‌افتاده"
            value={dashboard.leadKpis.overdueFollowUps}
            highlight={
              dashboard.leadKpis.overdueFollowUps > 0 ? "red" : undefined
            }
          />
          <KpiCard
            label="نرخ بستن"
            value={dashboard.leadKpis.closeRate}
            suffix="٪"
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">قیف وضعیت لید</h2>
          <div className="flex flex-wrap gap-3 text-sm text-zinc-500">
            <span>
              مستقیم:{" "}
              {dashboard.leadSourceBreakdown.direct.toLocaleString("fa-IR")}
            </span>
            <span>
              سیستم:{" "}
              {dashboard.leadSourceBreakdown.system.toLocaleString("fa-IR")}
            </span>
            <span>
              پیام‌رسان:{" "}
              {dashboard.leadSourceBreakdown.messenger.toLocaleString("fa-IR")}
            </span>
          </div>
        </div>
        <LeadStatusFunnelBar funnel={dashboard.leadStatusFunnel} />
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">متریک‌های فروش</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Card className="text-center">
            <p className="text-sm text-zinc-600">میانگین روز تا اولین تماس</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900">
              {dashboard.salesMetrics.avgDaysToFirstContact === null
                ? "—"
                : `${dashboard.salesMetrics.avgDaysToFirstContact.toLocaleString("fa-IR")} روز`}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-zinc-600">میانگین روز تا بستن</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-900">
              {dashboard.salesMetrics.avgDaysToClose === null
                ? "—"
                : `${dashboard.salesMetrics.avgDaysToClose.toLocaleString("fa-IR")} روز`}
            </p>
          </Card>
        </div>
        {dashboard.salesMetrics.avgDaysToFirstContact === null &&
        dashboard.salesMetrics.avgDaysToClose === null ? (
          <Card className="mb-4 text-center">
            <p className="text-sm text-zinc-600">
              هنوز داده کافی برای محاسبه میانگین زمان ثبت نشده است.
            </p>
          </Card>
        ) : null}
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700">منبع</th>
                <th className="px-4 py-3 font-medium text-zinc-700">کل لید</th>
                <th className="px-4 py-3 font-medium text-zinc-700">بسته — موفق</th>
                <th className="px-4 py-3 font-medium text-zinc-700">نرخ تبدیل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {dashboard.salesMetrics.sourceConversion.map((row) => (
                <tr key={row.source} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {row.sourceLabel}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.total.toLocaleString("fa-IR")}
                  </td>
                  <td className="px-4 py-3 text-emerald-700">
                    {row.closedWon.toLocaleString("fa-IR")}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.conversionRate.toLocaleString("fa-IR")}٪
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">KPIها</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="نفر شروع‌کننده این هفته"
            value={dashboard.kpis.usersStartedThisWeek}
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
            label="نفر تأییدشده این هفته"
            value={dashboard.kpis.usersVerifiedThisWeek}
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
        <div className="mt-4 space-y-1 text-sm text-zinc-500">
          <p>
            عملیاتی — تعداد ارزیابی این هفته:{" "}
            <span className="font-medium text-zinc-700">
              {dashboard.kpis.assessmentsThisWeek.toLocaleString("fa-IR")}
            </span>
          </p>
          <p>
            عملیاتی — تعداد ارزیابی این ماه:{" "}
            <span className="font-medium text-zinc-700">
              {dashboard.kpis.assessmentsThisMonth.toLocaleString("fa-IR")}
            </span>
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          قیف تبدیل
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          از ابتدا — هر نفر یک‌بار شمرده می‌شود
        </p>
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
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    نرخ بستن
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    پیگیری عقب‌افتاده
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    لید جدید این هفته
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
                    <td className="px-4 py-3 text-zinc-600">
                      {row.winRate.toLocaleString("fa-IR")}٪
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        row.overdueFollowUpOpen > 0
                          ? "font-medium text-red-700"
                          : "text-zinc-600"
                      }`}
                    >
                      {row.overdueFollowUpOpen.toLocaleString("fa-IR")}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.newThisWeek.toLocaleString("fa-IR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">پیام‌های اخیر</h2>
          <LinkButton href="/admin/sms-funnel" variant="secondary" size="sm">
            مدیریت قیف پیامکی
          </LinkButton>
        </div>
        {dashboard.recentSmsMessages.length === 0 ? (
          <Card className="text-center">
            <p className="text-zinc-600">هنوز پیامی ثبت نشده است.</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700">مرحله</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dashboard.recentSmsMessages.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-zinc-700">{row.stepKey}</td>
                    <td
                      className="px-4 py-3 font-mono text-xs text-zinc-600"
                      dir="ltr"
                    >
                      {row.phone}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{row.status}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatSmsDate(row.sentAt ?? row.scheduledFor)}
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
