import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  readAdminSession,
  readSalesExpertSession,
} from "@/lib/session";
import { listConsultationRequests } from "@/modules/consultation/consultation.service";
import { validateConsultationListFilter } from "@/modules/consultation/consultation-list.validators";
import { AdminLogoutButton } from "@/app/admin/assessments/AdminLogoutButton";
import { ExpertConsultationFilters } from "./ExpertConsultationFilters";
import { ExpertLogoutButton } from "./ExpertLogoutButton";

interface ExpertConsultationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildPageHref(
  page: number,
  params: URLSearchParams,
): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/expert/consultations?${next.toString()}`;
}

export default async function ExpertConsultationsPage({
  searchParams,
}: ExpertConsultationsPageProps) {
  const adminSession = await readAdminSession();
  const salesExpertSession = await readSalesExpertSession();

  if (!adminSession && !salesExpertSession) {
    redirect("/expert/login");
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

  const filter = validateConsultationListFilter(urlSearchParams);
  const { requests, pagination } = await listConsultationRequests(filter);

  return (
    <PageLayout
      title="درخواست‌های مشاوره"
      subtitle="لیست لیدهای ثبت‌شده از CTA گزارش — برای پیگیری فروش."
      showBack
      backHref="/"
      maxWidth="5xl"
      footer="minimal"
    >
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        {adminSession ? (
          <>
            <LinkButton href="/admin/assessments" variant="secondary" size="sm">
              پنل ادمین
            </LinkButton>
            <AdminLogoutButton />
          </>
        ) : (
          <ExpertLogoutButton />
        )}
      </div>

      <Suspense fallback={<LoadingSpinner message="در حال بارگذاری فیلترها…" />}>
        <ExpertConsultationFilters />
      </Suspense>

      <p className="mb-4 text-sm text-zinc-600">
        {pagination.total.toLocaleString("fa-IR")} درخواست
        {pagination.totalPages > 1
          ? ` — صفحه ${pagination.page.toLocaleString("fa-IR")} از ${pagination.totalPages.toLocaleString("fa-IR")}`
          : null}
      </p>

      {requests.length === 0 ? (
        <Card className="text-center">
          <p className="text-zinc-600">درخواستی با این فیلترها یافت نشد.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700">نام</th>
                <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
                <th className="px-4 py-3 font-medium text-zinc-700">کسب‌وکار</th>
                <th className="px-4 py-3 font-medium text-zinc-700">امتیاز</th>
                <th className="px-4 py-3 font-medium text-zinc-700">پیام</th>
                <th className="px-4 py-3 font-medium text-zinc-700">تاریخ</th>
                <th className="px-4 py-3 font-medium text-zinc-700" aria-label="عملیات" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {requests.map((item) => (
                <tr key={item.id} className="align-top hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600" dir="ltr">
                    {item.phone ?? item.assessmentUserPhone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {item.businessName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {item.overallScorePercentage != null
                      ? `${item.overallScorePercentage}٪`
                      : "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-zinc-600">
                    {item.message ? (
                      <span className="line-clamp-3">{item.message}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {item.createdAt}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-col gap-1 text-sm">
                      {item.reportUrl ? (
                        <Link
                          href={item.reportUrl}
                          className="font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          گزارش کامل
                        </Link>
                      ) : null}
                      {item.resultUrl ? (
                        <Link
                          href={item.resultUrl}
                          className="text-zinc-700 hover:text-zinc-900"
                        >
                          خلاصه نتیجه
                        </Link>
                      ) : null}
                      {item.expertViewUrl ? (
                        <Link
                          href={item.expertViewUrl}
                          className="text-zinc-600 hover:text-zinc-800"
                        >
                          نمای فروش
                        </Link>
                      ) : null}
                      {adminSession && item.adminAssessmentUrl ? (
                        <Link
                          href={item.adminAssessmentUrl}
                          className="text-zinc-500 hover:text-zinc-700"
                        >
                          جزئیات ادمین
                        </Link>
                      ) : null}
                    </div>
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
