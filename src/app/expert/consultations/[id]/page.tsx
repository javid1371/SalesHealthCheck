import { redirect, notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  readAdminSession,
  readSalesExpertSession,
} from "@/lib/session";
import { AppError } from "@/lib/errors";
import {
  getConsultationLeadDetail,
  getConsultationLeadSmsHistory,
  getNextConsultationLeadId,
} from "@/modules/consultation/consultation.service";
import {
  buildConsultationListHref,
  consultationQueueQueryString,
  validateConsultationListFilter,
} from "@/modules/consultation/consultation-list.validators";
import { listStaffUsers } from "@/modules/staff/staff.service";
import type { LeadTimelineEntry } from "@/modules/consultation/consultation.types";
import { getLeadSettings } from "@/modules/consultation/lead-config.service";
import { ExpertNav } from "../../ExpertNav";
import { resolveLeadActionHint } from "@/modules/consultation/lead-sla";
import { LeadDetailClient } from "./LeadDetailClient";
import { LeadPhoneField } from "./LeadPhoneField";
import { LeadSmsHistoryPanel } from "./LeadSmsHistoryPanel";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function timelineBadgeClass(entry: LeadTimelineEntry): string {
  if (entry.kind === "note") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (entry.kind === "sms") {
    return "bg-sky-100 text-sky-800";
  }
  switch (entry.activityType) {
    case "created":
      return "bg-indigo-100 text-indigo-800";
    case "call_logged":
      return "bg-amber-100 text-amber-900";
    case "status_change":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const adminSession = await readAdminSession();
  const salesExpertSession = await readSalesExpertSession();

  if (!adminSession && !salesExpertSession) {
    redirect("/login");
  }

  const { id } = await params;
  const access = { adminSession, salesExpertSession };

  const rawParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      urlSearchParams.set(key, value[0]);
    }
  }
  const queueQueryString = consultationQueueQueryString(urlSearchParams);

  let lead;
  try {
    lead = await getConsultationLeadDetail(id, access);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    if (error instanceof AppError && error.status === 403) {
      redirect(buildConsultationListHref(queueQueryString));
    }
    throw error;
  }

  let nextLeadId: string | null = null;
  if (queueQueryString) {
    try {
      const filter = validateConsultationListFilter(urlSearchParams);
      nextLeadId = await getNextConsultationLeadId(id, filter, access);
    } catch {
      nextLeadId = null;
    }
  }

  const currentStaffUserId =
    adminSession?.staffUserId ?? salesExpertSession?.staffUserId ?? null;
  const canTransfer = Boolean(
    adminSession ||
      (salesExpertSession &&
        lead.assignedToId === salesExpertSession.staffUserId),
  );
  const canClaim = Boolean(
    !adminSession &&
      salesExpertSession &&
      lead.assignedToId == null &&
      lead.status !== "closed_won" &&
      lead.status !== "closed_lost",
  );

  const [assigneeOptions, smsHistory, leadSettings] = await Promise.all([
    canTransfer
      ? listStaffUsers().then((users) =>
          users
            .filter((user) => user.role === "sales_expert" && user.isActive)
            .map((user) => ({ id: user.id, name: user.name })),
        )
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    getConsultationLeadSmsHistory(id, access),
    getLeadSettings(),
  ]);

  const actionHint = resolveLeadActionHint({
    sla: lead.sla,
    slaReason: lead.slaReason,
    nextFollowUpAtIso: lead.nextFollowUpAtIso,
    lastCallOutcomeLabel: lead.lastCallOutcomeLabel,
    status: lead.status,
  });

  const leadSummary = (
    <section aria-labelledby="lead-summary-heading" className="space-y-4">
      <h2
        id="lead-summary-heading"
        className="text-lg font-semibold text-zinc-900"
      >
        خلاصه لید
      </h2>

      {actionHint ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            actionHint.severity === "red"
              ? "border-red-200 bg-red-50 text-red-800"
              : actionHint.severity === "amber"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
        >
          {actionHint.text}
        </p>
      ) : null}

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm text-zinc-600">نام</dt>
            <dd className="font-medium text-zinc-900">{lead.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-600">موبایل</dt>
            <dd>
              <LeadPhoneField
                phone={lead.phone ?? lead.assessmentUserPhone ?? null}
              />
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
          <div>
            <dt className="text-sm text-zinc-600">منبع</dt>
            <dd className="font-medium text-zinc-900">{lead.sourceLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-600">احتمال خرید</dt>
            <dd className="font-medium text-zinc-900">
              {lead.purchaseProbabilityLabel ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-600">وضعیت</dt>
            <dd className="font-medium text-zinc-900">{lead.statusLabel}</dd>
            {lead.status === "closed_lost" && lead.lostReasonLabel ? (
              <p className="mt-1 text-sm text-zinc-600">
                دلیل باخت: {lead.lostReasonLabel}
                {lead.lostNote ? ` — ${lead.lostNote}` : ""}
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-sm text-zinc-600">تخصیص</dt>
            <dd className="font-medium text-zinc-900">
              {lead.pendingAssignment ? (
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-semibold text-sky-800">
                  در صف تخصیص
                </span>
              ) : (
                (lead.assignedToName ?? "—")
              )}
            </dd>
            {lead.pendingAssignment && lead.assignScheduledFor ? (
              <p className="mt-1 text-sm text-zinc-600">
                تخصیص خودکار: {lead.assignScheduledFor}
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-sm text-zinc-600">پیگیری بعدی</dt>
            <dd className="font-medium text-zinc-900">
              {lead.nextFollowUpAt ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-600">آخرین تماس</dt>
            <dd className="font-medium text-zinc-900">
              {lead.lastCallOutcomeLabel ?? "—"}
            </dd>
            {lead.lastCalledAt ? (
              <p className="mt-1 text-sm text-zinc-600">{lead.lastCalledAt}</p>
            ) : null}
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-sm text-zinc-600">پیام</dt>
            <dd className="text-zinc-800">{lead.message ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      {(lead.overallScorePercentage != null || lead.healthLevel) && (
        <Card>
          <h3 className="mb-3 text-base font-semibold text-zinc-900">
            خلاصه ارزیابی
          </h3>
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
      )}

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
  );

  const historyExtras = (
    <>
      <LeadSmsHistoryPanel history={smsHistory} />

      <section aria-labelledby="lead-timeline-heading">
        <h3
          id="lead-timeline-heading"
          className="mb-4 text-base font-semibold text-zinc-900"
        >
          خط زمانی
        </h3>
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
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${timelineBadgeClass(entry)}`}
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
    </>
  );

  return (
    <PageLayout
      title={`لید — ${lead.name}`}
      subtitle="اقدام بعدی، خلاصه لید و تاریخچه پیگیری."
      showBack
      backHref={buildConsultationListHref(queueQueryString)}
      maxWidth="5xl"
      footer="minimal"
    >
      <ExpertNav isAdmin={Boolean(adminSession)} />

      <LeadDetailClient
        leadId={lead.id}
        initialStatus={lead.status}
        initialAssignedToId={lead.assignedToId}
        initialNextFollowUpAtIso={lead.nextFollowUpAtIso}
        initialAdminProbabilityOverridePercent={
          lead.adminProbabilityOverridePercent
        }
        initialLostReason={lead.lostReason}
        initialLostNote={lead.lostNote}
        isAdmin={Boolean(adminSession)}
        currentStaffUserId={currentStaffUserId}
        canTransfer={canTransfer}
        canClaim={canClaim}
        assigneeOptions={assigneeOptions}
        queueQueryString={queueQueryString}
        nextLeadId={nextLeadId}
        leadSummary={leadSummary}
        historyExtras={historyExtras}
        callOutcomeMatrix={leadSettings.callOutcomeMatrix}
      />
    </PageLayout>
  );
}
