import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { AdminReportPreview } from "@/components/report/AdminReportPreview";
import { ReportShell } from "@/components/layout/ReportShell";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { HealthBadge } from "@/components/report/HealthBadge";
import { isAppError } from "@/lib/errors";
import { healthLevelLabelFa } from "@/lib/health-level";
import { readAdminSession } from "@/lib/session";
import { getAssessmentResult } from "@/modules/assessment/assessment.service";
import type { AssessmentResultResponse } from "@/modules/assessment/assessment.types";
import { getAssessmentForAdmin } from "@/modules/admin/admin.service";
import { AdminLogoutButton } from "../AdminLogoutButton";

interface AdminAssessmentDetailPageProps {
  params: Promise<{ id: string }>;
}

function AdminResultBody({ result }: { result: AssessmentResultResponse }) {
  if (result.report.reportSpec) {
    return <AdminReportPreview reportSpec={result.report.reportSpec} />;
  }

  return (
    <Card className="text-center">
      <p className="text-sm leading-7 text-zinc-600">
        این ارزیابی reportSpec ندارد (نسخه قدیمی). از لینک «گزارش کامل» یا
        «داشبورد نتیجه» در بالا استفاده کنید.
      </p>
    </Card>
  );
}

export default async function AdminAssessmentDetailPage({
  params,
}: AdminAssessmentDetailPageProps) {
  const adminSession = await readAdminSession();
  if (!adminSession) {
    redirect("/admin/login");
  }

  const { id: assessmentId } = await params;

  let detail;
  try {
    detail = await getAssessmentForAdmin(assessmentId);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  let result: AssessmentResultResponse | null = null;
  if (detail.status === "completed") {
    try {
      result = await getAssessmentResult(assessmentId, { adminSession });
    } catch (error) {
      if (!isAppError(error)) {
        throw error;
      }
    }
  }

  const scoreLabel = detail.overallScore
    ? `${detail.overallScore.percentage}٪ — ${healthLevelLabelFa(detail.overallScore.healthLevel)}`
    : null;

  return (
    <ReportShell
      title={detail.businessName}
      subtitle="نمای ادمین — گزارش ارزیابی"
      maxWidth="lg"
    >
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/assessments"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← بازگشت به لیست
          </Link>
          <AdminLogoutButton />
        </div>

        <Card padding="compact">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">وضعیت</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.statusLabel}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">کاربر</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.userName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">موبایل</dt>
              <dd className="mt-0.5 font-medium text-zinc-900" dir="ltr">
                {detail.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">ایمیل</dt>
              <dd className="mt-0.5 font-medium text-zinc-900" dir="ltr">
                {detail.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">شروع</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.startedAt}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">پایان</dt>
              <dd className="mt-0.5 font-medium text-zinc-900">
                {detail.completedAt ?? "—"}
              </dd>
            </div>
            {scoreLabel && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">امتیاز کلی</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium text-zinc-900">
                  {scoreLabel}
                  {detail.overallScore && (
                    <HealthBadge
                      level={detail.overallScore.healthLevel}
                      size="sm"
                    />
                  )}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href={detail.expertViewUrl} variant="secondary">
              Expert View
            </LinkButton>
            {detail.resultUrl && (
              <LinkButton href={detail.resultUrl} variant="secondary">
                داشبورد نتیجه
              </LinkButton>
            )}
            {detail.reportUrl && (
              <LinkButton href={detail.reportUrl}>گزارش کامل</LinkButton>
            )}
          </div>
        </Card>
      </div>

      {detail.status !== "completed" && (
        <Card>
          <p className="text-sm leading-7 text-zinc-600">
            این ارزیابی هنوز تکمیل نشده است. پس از اتمام تست، گزارش در این
            صفحه نمایش داده می‌شود.
          </p>
        </Card>
      )}

      {result && <AdminResultBody result={result} />}
    </ReportShell>
  );
}
