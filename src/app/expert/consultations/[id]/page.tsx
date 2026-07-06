import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  readAdminSession,
  readSalesExpertSession,
} from "@/lib/session";
import { AppError } from "@/lib/errors";
import { getConsultationLeadDetail } from "@/modules/consultation/consultation.service";
import { listStaffUsers } from "@/modules/staff/staff.service";
import { ExpertNav } from "../../ExpertNav";
import { LeadDetailClient } from "./LeadDetailClient";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const adminSession = await readAdminSession();
  const salesExpertSession = await readSalesExpertSession();

  if (!adminSession && !salesExpertSession) {
    redirect("/expert/login");
  }

  const { id } = await params;
  const access = { adminSession, salesExpertSession };

  let lead;
  try {
    lead = await getConsultationLeadDetail(id, access);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    if (error instanceof AppError && error.status === 403) {
      redirect("/expert/consultations");
    }
    throw error;
  }

  const assigneeOptions = adminSession
    ? (await listStaffUsers())
        .filter((user) => user.role === "sales_expert" && user.isActive)
        .map((user) => ({ id: user.id, name: user.name }))
    : [];

  return (
    <PageLayout
      title={`لید — ${lead.name}`}
      subtitle="جزئیات تماس، خلاصه ارزیابی و پیگیری."
      showBack
      backHref="/expert/consultations"
      maxWidth="5xl"
      footer="minimal"
    >
      <ExpertNav isAdmin={Boolean(adminSession)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-zinc-600">وضعیت</p>
          <p className="mt-1 font-semibold text-zinc-900">{lead.statusLabel}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-600">منبع</p>
          <p className="mt-1 font-semibold text-zinc-900">{lead.sourceLabel}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-600">احتمال خرید</p>
          <p className="mt-1 font-semibold text-zinc-900">
            {lead.purchaseProbabilityLabel ?? "—"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-600">تخصیص</p>
          {lead.pendingAssignment ? (
            <div className="mt-1">
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-semibold text-sky-800">
                در صف تخصیص
              </span>
              {lead.assignScheduledFor ? (
                <p className="mt-1 text-sm text-zinc-600">
                  تخصیص خودکار: {lead.assignScheduledFor}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 font-semibold text-zinc-900">
              {lead.assignedToName ?? "—"}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-zinc-600">پیگیری بعدی</p>
          <p className="mt-1 font-semibold text-zinc-900">
            {lead.nextFollowUpAt ?? "—"}
          </p>
        </Card>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          اطلاعات تماس
        </h2>
        <Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-600">نام</dt>
              <dd className="font-medium text-zinc-900">{lead.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-600">موبایل</dt>
              <dd className="font-medium text-zinc-900" dir="ltr">
                {lead.phone ?? lead.assessmentUserPhone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-600">ایمیل</dt>
              <dd className="font-medium text-zinc-900" dir="ltr">
                {lead.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-600">کسب‌وکار</dt>
              <dd className="font-medium text-zinc-900">
                {lead.businessName ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-zinc-600">پیام</dt>
              <dd className="text-zinc-800">{lead.message ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      </section>

      {(lead.overallScorePercentage != null || lead.healthLevel) && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            خلاصه ارزیابی
          </h2>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              {lead.overallScorePercentage != null ? (
                <div>
                  <p className="text-sm text-zinc-600">امتیاز کلی</p>
                  <p className="text-xl font-semibold text-zinc-900">
                    {lead.overallScorePercentage}٪
                  </p>
                </div>
              ) : null}
              {lead.healthLevel ? (
                <div>
                  <p className="text-sm text-zinc-600">سطح سلامت</p>
                  <p className="text-xl font-semibold text-zinc-900">
                    {lead.healthLevel}
                  </p>
                </div>
              ) : null}
            </div>

            {lead.bottlenecks.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-zinc-700">
                  گلوگاه‌های اصلی
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600">
                  {lead.bottlenecks.map((item, index) => (
                    <li key={`${item.title}-${index}`}>{item.title}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {lead.diagnoses.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-zinc-700">
                  تشخیص‌ها
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600">
                  {lead.diagnoses.map((item, index) => (
                    <li key={`${item.title}-${index}`}>{item.title}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">لینک‌ها</h2>
        <div className="flex flex-wrap gap-3">
          {lead.expertViewUrl ? (
            <LinkButton href={lead.expertViewUrl} variant="secondary" size="sm">
              نمای فروش
            </LinkButton>
          ) : null}
          {lead.reportUrl ? (
            <LinkButton href={lead.reportUrl} variant="secondary" size="sm">
              گزارش کامل
            </LinkButton>
          ) : null}
          {lead.resultUrl ? (
            <LinkButton href={lead.resultUrl} variant="secondary" size="sm">
              خلاصه نتیجه
            </LinkButton>
          ) : null}
          {adminSession && lead.adminAssessmentUrl ? (
            <LinkButton
              href={lead.adminAssessmentUrl}
              variant="secondary"
              size="sm"
            >
              جزئیات ادمین
            </LinkButton>
          ) : null}
        </div>
      </section>

      <LeadDetailClient
        leadId={lead.id}
        initialStatus={lead.status}
        initialAssignedToId={lead.assignedToId}
        initialNextFollowUpAtIso={lead.nextFollowUpAtIso}
        initialAdminProbabilityOverridePercent={lead.adminProbabilityOverridePercent}
        isAdmin={Boolean(adminSession)}
        assigneeOptions={assigneeOptions}
      />

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          خط زمانی
        </h2>
        {lead.sla.severity !== "none" ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              lead.sla.severity === "red"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {lead.slaReason}
          </div>
        ) : null}
        {lead.timeline.length === 0 ? (
          <Card className="text-center">
            <p className="text-zinc-600">هنوز رویدادی ثبت نشده است.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {lead.timeline.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          entry.kind === "note"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {entry.label}
                      </span>
                      {entry.authorName ? (
                        <span className="font-medium text-zinc-800">
                          {entry.authorName}
                        </span>
                      ) : null}
                    </div>
                    <time>{entry.createdAt}</time>
                  </div>
                  {entry.detail ? (
                    <p className="whitespace-pre-wrap text-zinc-800">
                      {entry.detail}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
