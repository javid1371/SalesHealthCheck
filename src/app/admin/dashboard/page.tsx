import Link from "next/link";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { readAdminSession } from "@/lib/session";
import { startOfWeek } from "@/modules/admin/admin.repository";
import { getAdminDashboard } from "@/modules/admin/admin.service";
import type {
  AdminExpertPerformanceRow,
  AdminFullConversionFunnel,
  AdminLeadStatusFunnel,
} from "@/modules/admin/admin.types";
import { AdminNav } from "../AdminNav";
import { ExpertPerformanceTable } from "./ExpertPerformanceTable";

function sortExpertsForAttention(
  rows: AdminExpertPerformanceRow[],
): AdminExpertPerformanceRow[] {
  return [...rows].sort((a, b) => {
    if (b.overdueFollowUpOpen !== a.overdueFollowUpOpen) {
      return b.overdueFollowUpOpen - a.overdueFollowUpOpen;
    }
    return b.open - a.open;
  });
}

function expertQueueHref(row: AdminExpertPerformanceRow): string {
  const params = new URLSearchParams({ assignedToId: row.staffUserId });
  if (row.overdueFollowUpOpen > 0) {
    params.set("onlyOverdueFollowUp", "true");
  }
  return `/expert/consultations?${params.toString()}`;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function KpiCard({
  label,
  value,
  suffix,
  highlight,
  href,
  valueDisplay,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: "amber" | "red";
  href?: string;
  /** Override numeric formatting (e.g. "—", "۳ روز") */
  valueDisplay?: string;
}) {
  const valueColor =
    highlight === "red"
      ? "text-red-700"
      : highlight === "amber"
        ? "text-amber-700"
        : "text-zinc-900";

  const content = (
    <>
      <p className="text-sm text-zinc-600">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueColor}`}>
        {valueDisplay ?? (
          <>
            {value.toLocaleString("fa-IR")}
            {suffix ? (
              <span className="text-lg font-normal text-zinc-600">
                {suffix}
              </span>
            ) : null}
          </>
        )}
      </p>
    </>
  );

  if (href) {
    return (
      <Card
        as={Link}
        href={href}
        className="text-center transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        {content}
      </Card>
    );
  }

  return <Card className="text-center">{content}</Card>;
}

function LeadStatusFunnelBar({ funnel }: { funnel: AdminLeadStatusFunnel }) {
  const stages = [
    {
      key: "assessmentInProgress",
      label: "در حال تست",
      count: funnel.assessmentInProgress,
      color: "bg-rose-500",
    },
    {
      key: "assessmentIncomplete",
      label: "پیگیری تکمیل",
      count: funnel.assessmentIncomplete,
      color: "bg-orange-500",
    },
    {
      key: "assessmentCompleted",
      label: "تست تکمیل",
      count: funnel.assessmentCompleted,
      color: "bg-teal-500",
    },
    {
      key: "new",
      label: "آماده تماس",
      count: funnel.new,
      color: "bg-sky-500",
    },
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.key} className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${stage.color}`}
              />
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

function AttractionFunnelCard({
  started,
  completed,
  consultations,
  completedRate,
  consultationRate,
}: {
  started: number;
  completed: number;
  consultations: number;
  completedRate: number;
  consultationRate: number;
}) {
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-center">
          <p className="text-sm text-zinc-600">شروع</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {started.toLocaleString("fa-IR")}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-zinc-600">تکمیل</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {completed.toLocaleString("fa-IR")}
          </p>
          <p className="text-xs text-zinc-500">
            {completedRate.toLocaleString("fa-IR")}٪ از شروع
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-zinc-600">مشاوره</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {consultations.toLocaleString("fa-IR")}
          </p>
          <p className="text-xs text-zinc-500">
            {consultationRate.toLocaleString("fa-IR")}٪ از تکمیل
          </p>
        </div>
      </div>
    </Card>
  );
}

function FullConversionFunnelSection({
  funnel,
}: {
  funnel: AdminFullConversionFunnel;
}) {
  const maxCount = Math.max(...funnel.steps.map((step) => step.count), 1);

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">
        جزئیات قیف تبدیل
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        از بازدید فرود تا ثبت مشاوره — هر بازدیدکننده/کاربر یک‌بار در هر مرحله
        شمرده می‌شود
      </p>
      <Card className="space-y-4">
        {funnel.steps.map((step) => (
          <div key={step.key} className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-zinc-800">{step.label}</span>
              <span className="text-zinc-600">
                {step.count.toLocaleString("fa-IR")}
                {step.dropOffPercent !== null ? (
                  <span className="mr-2 text-xs text-amber-700">
                    (ریزش {step.dropOffPercent.toLocaleString("fa-IR")}٪)
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${maxCount > 0 ? (step.count / maxCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </Card>

      {funnel.domainDropOff.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-3 text-base font-semibold text-zinc-900">
            ریزش دامنه‌به‌دامنه
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700">دامنه</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    تکمیل‌کننده
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">ریزش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {funnel.domainDropOff.map((row) => (
                  <tr key={row.domainIndex} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {row.domainSlug
                        ? `دامنه ${(row.domainIndex + 1).toLocaleString("fa-IR")} — ${row.domainSlug}`
                        : `دامنه ${(row.domainIndex + 1).toLocaleString("fa-IR")}`}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.count.toLocaleString("fa-IR")}
                    </td>
                    <td className="px-4 py-3 text-amber-700">
                      {row.dropOffPercent === null
                        ? "—"
                        : `${row.dropOffPercent.toLocaleString("fa-IR")}٪`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default async function AdminDashboardPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/login");
  }

  const dashboard = await getAdminDashboard();
  const weekStartFrom = toDateInputValue(startOfWeek());
  const consultationsNewThisWeekHref = `/expert/consultations?from=${weekStartFrom}`;
  const consultationsPendingAssignmentHref =
    "/expert/consultations?onlyPendingAssignment=true";
  const consultationsOverdueHref =
    "/expert/consultations?onlyOverdueFollowUp=true";
  const consultationsStaleNewHref =
    "/expert/consultations?status=new&onlyStaleNew=true";
  const consultationsHotUnassignedHref =
    "/expert/consultations?onlyHot=true&onlyUnassigned=true";
  const attentionExperts = sortExpertsForAttention(dashboard.expertPerformance);

  const avgDaysDisplay =
    dashboard.salesMetrics.avgDaysToFirstContact === null
      ? "—"
      : `${dashboard.salesMetrics.avgDaysToFirstContact.toLocaleString("fa-IR")} روز`;

  return (
    <PageLayout
      title="پنل ادمین — داشبورد"
      subtitle="نظارت مدیریتی: نرخ‌ها، قیف‌ها و عملکرد تیم."
      showBack
      backHref="/"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">کارت امتیاز</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="ورودی هفته"
            value={dashboard.leadKpis.newThisWeek}
            href={consultationsNewThisWeekHref}
          />
          <KpiCard
            label="نرخ تکمیل ارزیابی"
            value={dashboard.funnel.completedRate}
            suffix="٪"
          />
          <KpiCard
            label="نرخ مشاوره از تکمیل"
            value={dashboard.funnel.consultationRate}
            suffix="٪"
          />
          <KpiCard
            label="نرخ بستن"
            value={dashboard.leadKpis.closeRate}
            suffix="٪"
          />
          <KpiCard
            label="میانگین روز تا اولین تماس"
            value={dashboard.salesMetrics.avgDaysToFirstContact ?? 0}
            valueDisplay={avgDaysDisplay}
          />
          <KpiCard
            label="سلامت تیم — عقب‌افتاده"
            value={dashboard.leadKpis.overdueFollowUps}
            highlight={
              dashboard.leadKpis.overdueFollowUps > 0 ? "red" : undefined
            }
            href={consultationsOverdueHref}
          />
        </div>
        {dashboard.leadKpis.pendingAssignment > 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            صف تخصیص:{" "}
            <Link
              href={consultationsPendingAssignmentHref}
              className="font-medium text-amber-800 hover:text-amber-900"
            >
              {dashboard.leadKpis.pendingAssignment.toLocaleString("fa-IR")} لید
            </Link>
          </p>
        ) : null}
      </section>

      <section className="mb-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">
              قیف جذب
            </h2>
            <p className="mb-4 text-sm text-zinc-500">
              شروع → تکمیل → ثبت درخواست مشاوره توسط کاربر (هر نفر یک‌بار)
            </p>
            <AttractionFunnelCard
              started={dashboard.funnel.started}
              completed={dashboard.funnel.completed}
              consultations={dashboard.funnel.consultations}
              completedRate={dashboard.funnel.completedRate}
              consultationRate={dashboard.funnel.consultationRate}
            />
          </div>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  قیف فروش
                </h2>
                <p className="mt-1 text-sm text-zinc-500">وضعیت فعلی لیدها</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
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
                  {dashboard.leadSourceBreakdown.messenger.toLocaleString(
                    "fa-IR",
                  )}
                </span>
              </div>
            </div>
            <LeadStatusFunnelBar funnel={dashboard.leadStatusFunnel} />
          </div>
        </div>
      </section>

      <FullConversionFunnelSection funnel={dashboard.fullConversionFunnel} />

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              عملکرد کارشناسان
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              توجه صف و بار کارشناسان — جزئیات کامل در پایین جمع‌وجور است.
            </p>
          </div>
          <LinkButton href="/admin/staff" variant="secondary" size="sm">
            مدیریت کاربران
          </LinkButton>
        </div>

        <Card className="mb-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-800">توجه صف</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href={consultationsOverdueHref}
              className="rounded-xl border border-zinc-100 px-3 py-2 text-center transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <p className="text-xs text-zinc-600">پیگیری عقب‌افتاده</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  dashboard.leadKpis.overdueFollowUps > 0
                    ? "text-red-700"
                    : "text-zinc-900"
                }`}
              >
                {dashboard.leadKpis.overdueFollowUps.toLocaleString("fa-IR")}
              </p>
            </Link>
            <Link
              href={consultationsStaleNewHref}
              className="rounded-xl border border-zinc-100 px-3 py-2 text-center transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <p className="text-xs text-zinc-600">لید کهنه آماده تماس</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  dashboard.leadKpis.staleNewLeads > 0
                    ? "text-amber-700"
                    : "text-zinc-900"
                }`}
              >
                {dashboard.leadKpis.staleNewLeads.toLocaleString("fa-IR")}
              </p>
            </Link>
            <Link
              href={consultationsHotUnassignedHref}
              className="rounded-xl border border-zinc-100 px-3 py-2 text-center transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <p className="text-xs text-zinc-600">احتمال‌بالای بدون تخصیص</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  dashboard.leadKpis.highProbabilityUnassigned > 0
                    ? "text-amber-700"
                    : "text-zinc-900"
                }`}
              >
                {dashboard.leadKpis.highProbabilityUnassigned.toLocaleString(
                  "fa-IR",
                )}
              </p>
            </Link>
          </div>
        </Card>

        {attentionExperts.length === 0 ? (
          <Card className="mb-4 text-center">
            <p className="text-zinc-600">هنوز کارشناس فعالی ثبت نشده است.</p>
          </Card>
        ) : (
          <div className="mb-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700">نام</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">باز</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    عقب‌افتاده
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700">
                    تماس ۷روز
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {attentionExperts.map((row) => {
                  const href = expertQueueHref(row);
                  return (
                    <tr key={row.staffUserId} className="hover:bg-zinc-50/80">
                      <td className="p-0">
                        <Link
                          href={href}
                          className="block px-4 py-3 font-medium text-zinc-900"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={href}
                          className="block px-4 py-3 text-zinc-600"
                        >
                          {row.open.toLocaleString("fa-IR")}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={href}
                          className={`block px-4 py-3 ${
                            row.overdueFollowUpOpen > 0
                              ? "font-medium text-red-700"
                              : "text-zinc-600"
                          }`}
                        >
                          {row.overdueFollowUpOpen.toLocaleString("fa-IR")}
                        </Link>
                      </td>
                      <td className="p-0">
                        <Link
                          href={href}
                          className="block px-4 py-3 text-zinc-600"
                        >
                          {row.totalCalls.toLocaleString("fa-IR")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details>
          <summary className="mb-3 cursor-pointer select-none text-sm font-medium text-zinc-800">
            جزئیات عملکرد
          </summary>
          <ExpertPerformanceTable rows={dashboard.expertPerformance} />
        </details>
      </section>

      <section className="mb-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              تبدیل بر اساس منبع
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-700">منبع</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">کل</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">موفق</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">نرخ</th>
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
            {dashboard.salesMetrics.avgDaysToClose !== null ? (
              <p className="mt-3 text-sm text-zinc-500">
                میانگین روز تا بستن:{" "}
                <span className="font-medium text-zinc-700">
                  {dashboard.salesMetrics.avgDaysToClose.toLocaleString("fa-IR")}{" "}
                  روز
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">
              دلایل باخت ۳۰ روز اخیر
            </h2>
            <p className="mb-4 text-sm text-zinc-600">
              لیدهای بسته — ناموفق به تفکیک دلیل.
            </p>
            {dashboard.lostReasonBreakdownLast30Days.every(
              (row) => row.count === 0,
            ) ? (
              <Card className="text-center">
                <p className="text-zinc-600">
                  در ۳۰ روز اخیر باخت ثبت‌شده‌ای نیست.
                </p>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-700">
                        دلیل
                      </th>
                      <th className="px-4 py-3 font-medium text-zinc-700">
                        تعداد
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dashboard.lostReasonBreakdownLast30Days
                      .filter((row) => row.count > 0)
                      .map((row) => (
                        <tr
                          key={row.reason ?? "unknown"}
                          className="hover:bg-zinc-50/80"
                        >
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {row.reasonLabel}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {row.count.toLocaleString("fa-IR")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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

      <div className="flex flex-wrap gap-3">
        <Link
          href="/expert/consultations"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          همه لیدها ←
        </Link>
        <Link
          href="/admin/assessments"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          ارزیابی‌ها ←
        </Link>
        <Link
          href="/admin/leads-settings"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          تنظیمات لید ←
        </Link>
        <Link
          href="/admin/sms-funnel"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          قیف پیامکی ←
        </Link>
      </div>
    </PageLayout>
  );
}
