import Link from "next/link";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { cn } from "@/lib/utils";
import {
  readAdminSession,
  readSalesExpertSession,
} from "@/lib/session";
import { buildConsultationLeadDetailHref } from "@/modules/consultation/consultation-list.validators";
import type { ExpertDashboardFollowUpRow } from "@/modules/consultation/consultation.types";
import { getExpertDashboard } from "@/modules/consultation/consultation.service";
import { ExpertNav } from "../ExpertNav";

function PriorityKpiCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "danger" | "accent";
}) {
  return (
    <Card
      as={Link}
      href={href}
      padding="compact"
      className={cn(
        "text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
        tone === "danger" &&
          "border border-red-200 bg-red-50 hover:bg-red-100/80",
        tone === "accent" &&
          "border border-amber-200 bg-amber-50 hover:bg-amber-100/80",
        tone === "default" && "hover:bg-zinc-50",
      )}
    >
      <p
        className={cn(
          "text-sm",
          tone === "danger" && "text-red-800",
          tone === "accent" && "text-amber-900",
          tone === "default" && "text-zinc-600",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold",
          tone === "danger" && "text-red-900",
          tone === "accent" && "text-amber-950",
          tone === "default" && "text-zinc-900",
        )}
      >
        {value.toLocaleString("fa-IR")}
      </p>
    </Card>
  );
}

function PriorityLeadTable({
  rows,
  emptyMessage,
  showAssignee,
  queueQueryString,
}: {
  rows: ExpertDashboardFollowUpRow[];
  emptyMessage: string;
  showAssignee: boolean;
  queueQueryString: string;
}) {
  if (rows.length === 0) {
    return (
      <Card className="text-center" padding="compact">
        <p className="text-zinc-600">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
          <tr>
            <th className="px-4 py-3 font-medium text-zinc-700">نام</th>
            <th className="px-4 py-3 font-medium text-zinc-700">کسب‌وکار</th>
            {showAssignee ? (
              <th className="px-4 py-3 font-medium text-zinc-700">کارشناس</th>
            ) : null}
            <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
            <th className="px-4 py-3 font-medium text-zinc-700">پیگیری بعدی</th>
            <th
              className="px-4 py-3 font-medium text-zinc-700"
              aria-label="عملیات"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-zinc-50/80">
              <td className="px-4 py-3 font-medium text-zinc-900">
                <span className="inline-flex flex-wrap items-center gap-2">
                  {row.name}
                  {row.isStaleNew ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      کهنه
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {row.businessName ?? "—"}
              </td>
              {showAssignee ? (
                <td className="px-4 py-3 text-zinc-600">
                  {row.assignedToName ?? "بدون تخصیص"}
                </td>
              ) : null}
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
                  href={buildConsultationLeadDetailHref(
                    row.id,
                    queueQueryString,
                  )}
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
  );
}

function PrioritySection({
  title,
  href,
  linkLabel,
  totalCount,
  rows,
  emptyMessage,
  showAssignee,
  queueQueryString,
  tone = "default",
}: {
  title: string;
  href: string;
  linkLabel: string;
  totalCount: number;
  rows: ExpertDashboardFollowUpRow[];
  emptyMessage: string;
  showAssignee: boolean;
  queueQueryString: string;
  tone?: "default" | "danger";
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className={cn(
            "text-lg font-semibold",
            tone === "danger" ? "text-red-900" : "text-zinc-900",
          )}
        >
          {title}
          <span className="mr-2 text-base font-normal text-zinc-500">
            ({totalCount.toLocaleString("fa-IR")})
          </span>
        </h2>
        <LinkButton href={href} variant="secondary" size="sm">
          {linkLabel}
        </LinkButton>
      </div>
      <PriorityLeadTable
        rows={rows}
        emptyMessage={emptyMessage}
        showAssignee={showAssignee}
        queueQueryString={queueQueryString}
      />
    </section>
  );
}

export default async function ExpertDashboardPage() {
  const adminSession = await readAdminSession();
  const salesExpertSession = await readSalesExpertSession();

  if (!adminSession && !salesExpertSession) {
    redirect("/login");
  }

  const isAdminView = Boolean(adminSession);
  const staffUserId = salesExpertSession?.staffUserId;

  if (!isAdminView && !staffUserId) {
    redirect("/login");
  }

  // Admin sees team-wide queue; expert sees only their assigned leads.
  const dashboard = await getExpertDashboard(
    isAdminView ? undefined : staffUserId,
  );
  const expertName = salesExpertSession?.name;

  return (
    <PageLayout
      title={
        isAdminView
          ? "نمای کارشناس"
          : expertName
            ? `سلام ${expertName}`
            : "داشبورد کارشناس"
      }
      subtitle={
        isAdminView
          ? "صف اولویت تیمی — پیگیری‌ها و لیدها در کل سیستم."
          : "صف کار امروز — اول عقب‌افتاده‌ها، بعد پیگیری امروز و لیدهای جدید."
      }
      showBack
      backHref="/"
      maxWidth="5xl"
      footer="minimal"
    >
      <ExpertNav isAdmin={isAdminView} />

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          اولویت امروز
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PriorityKpiCard
            label="پیگیری عقب‌افتاده"
            value={dashboard.kpis.overdueFollowUp}
            href="/expert/consultations?onlyOverdueFollowUp=true"
            tone="danger"
          />
          <PriorityKpiCard
            label="پیگیری امروز"
            value={dashboard.kpis.followUpDueToday}
            href="/expert/consultations?onlyFollowUpDueToday=true"
          />
          <PriorityKpiCard
            label="لید جدید / کهنه"
            value={dashboard.kpis.newLeads}
            href="/expert/consultations?status=new"
            tone="accent"
          />
          <PriorityKpiCard
            label="صف تیم (بدون تخصیص)"
            value={dashboard.kpis.teamQueue}
            href="/expert/consultations?onlyTeamQueue=true"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton
            href="/expert/consultations?excludeAssessmentInProgress=true"
            variant="secondary"
            size="sm"
          >
            صف تماس
          </LinkButton>
          <LinkButton href="/expert/consultations" variant="secondary" size="sm">
            همه لیدها
          </LinkButton>
        </div>
      </section>

      <PrioritySection
        title="پیگیری‌های عقب‌افتاده"
        href="/expert/consultations?onlyOverdueFollowUp=true"
        linkLabel="مشاهده همه عقب‌افتاده‌ها"
        totalCount={dashboard.kpis.overdueFollowUp}
        rows={dashboard.overdueFollowUps}
        emptyMessage="پیگیری عقب‌افتاده‌ای ندارید."
        showAssignee={isAdminView}
        queueQueryString="onlyOverdueFollowUp=true"
        tone="danger"
      />

      <PrioritySection
        title="پیگیری‌های امروز"
        href="/expert/consultations?onlyFollowUpDueToday=true"
        linkLabel="مشاهده پیگیری‌های امروز"
        totalCount={dashboard.kpis.followUpDueToday}
        rows={dashboard.todayFollowUps}
        emptyMessage="برای امروز پیگیری باقی‌مانده‌ای ثبت نشده است."
        showAssignee={isAdminView}
        queueQueryString="onlyFollowUpDueToday=true"
      />

      <PrioritySection
        title="لیدهای جدید (قدیمی‌ترین اول)"
        href="/expert/consultations?status=new"
        linkLabel="مشاهده لیدهای جدید"
        totalCount={dashboard.kpis.newLeads}
        rows={dashboard.newLeadRows}
        emptyMessage="لید جدیدی در صف نیست."
        showAssignee={isAdminView}
        queueQueryString="status=new"
      />
    </PageLayout>
  );
}
