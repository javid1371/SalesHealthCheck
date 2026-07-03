import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HealthBadge } from "@/components/report/HealthBadge";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { healthLevelLabelFa } from "@/lib/health-level";
import { readAdminSession } from "@/lib/session";
import { listAssessments } from "@/modules/admin/admin.service";
import { validateAdminAssessmentFilter } from "@/modules/admin/admin.validators";
import { AdminNav } from "../AdminNav";
import { AdminAssessmentFilters } from "./AdminAssessmentFilters";

interface AdminAssessmentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildPageHref(
  page: number,
  params: URLSearchParams,
): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/assessments?${next.toString()}`;
}

export default async function AdminAssessmentsPage({
  searchParams,
}: AdminAssessmentsPageProps) {
  const session = await readAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const rawParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      urlSearchParams.set(key, value[0]);
    }
  }

  const filter = validateAdminAssessmentFilter(urlSearchParams);
  const { assessments, pagination } = await listAssessments(filter);

  return (
    <PageLayout
      title="پنل ادمین — ارزیابی‌ها"
      subtitle="جستجو و مشاهدهٔ ارزیابی‌های ثبت‌شده."
      showBack
      backHref="/admin/dashboard"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />

      <Suspense fallback={<LoadingSpinner message="در حال بارگذاری فیلترها…" />}>
        <AdminAssessmentFilters />
      </Suspense>

      <p className="mb-4 text-sm text-zinc-600">
        {pagination.total.toLocaleString("fa-IR")} ارزیابی
        {pagination.totalPages > 1
          ? ` — صفحه ${pagination.page.toLocaleString("fa-IR")} از ${pagination.totalPages.toLocaleString("fa-IR")}`
          : null}
      </p>

      {assessments.length === 0 ? (
        <Card className="text-center">
          <p className="text-zinc-600">ارزیابی‌ای با این فیلترها یافت نشد.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700">کسب‌وکار</th>
                <th className="px-4 py-3 font-medium text-zinc-700">کاربر</th>
                <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
                <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
                <th className="px-4 py-3 font-medium text-zinc-700">امتیاز</th>
                <th className="px-4 py-3 font-medium text-zinc-700">شروع</th>
                <th className="px-4 py-3 font-medium text-zinc-700" aria-label="عملیات" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {assessments.map((item) => (
                <tr key={item.assessmentId} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {item.businessName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {item.userName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {item.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700">
                      {item.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.overallScore ? (
                      <span className="inline-flex items-center gap-1.5 text-zinc-700">
                        {item.overallScore.percentage}٪ —{" "}
                        {healthLevelLabelFa(item.overallScore.healthLevel)}
                        <HealthBadge
                          level={item.overallScore.healthLevel}
                          size="sm"
                        />
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{item.startedAt}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={item.detailUrl}
                      className="font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      مشاهده
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-center gap-3"
          aria-label="صفحه‌بندی"
        >
          {pagination.page > 1 ? (
            <Link
              href={buildPageHref(pagination.page - 1, urlSearchParams)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              قبلی
            </Link>
          ) : null}
          {pagination.page < pagination.totalPages ? (
            <Link
              href={buildPageHref(pagination.page + 1, urlSearchParams)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              بعدی
            </Link>
          ) : null}
        </nav>
      )}
    </PageLayout>
  );
}
