import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  readAdminSession,
  readSalesExpertSession,
} from "@/lib/session";
import { listConsultationRequests } from "@/modules/consultation/consultation.service";
import { validateConsultationListFilter } from "@/modules/consultation/consultation-list.validators";
import { listStaffUsers } from "@/modules/staff/staff.service";
import { ExpertNav } from "@/app/expert/ExpertNav";
import { ExpertConsultationFilters } from "./ExpertConsultationFilters";
import { ConsultationListWithAdmin } from "./ConsultationListWithAdmin";
import { ConsultationKanbanView } from "./ConsultationKanbanView";
import { ConsultationViewToggle } from "./ConsultationViewToggle";

const KANBAN_PAGE_SIZE = 100;

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
  const view =
    urlSearchParams.get("view") === "kanban" ? "kanban" : ("list" as const);
  const listFilter =
    view === "kanban"
      ? { ...filter, status: undefined, page: 1, pageSize: KANBAN_PAGE_SIZE }
      : filter;
  const access = { adminSession, salesExpertSession };
  const { requests, pagination } = await listConsultationRequests(
    listFilter,
    access,
  );

  const exportQueryParams = new URLSearchParams(urlSearchParams);
  exportQueryParams.delete("page");
  exportQueryParams.delete("pageSize");
  const exportQueryString = exportQueryParams.toString();

  const assigneeOptions = adminSession
    ? (await listStaffUsers())
        .filter((user) => user.role === "sales_expert" && user.isActive)
        .map((user) => ({ id: user.id, name: user.name }))
    : [];

  const pageTitle = adminSession ? "درخواست‌های مشاوره" : "لیدهای من";
  const pageSubtitle = adminSession
    ? "لیست همه لیدها — فیلتر بر اساس وضعیت و تخصیص."
    : "لیدهای تخصیص‌یافته به شما برای پیگیری فروش.";

  return (
    <PageLayout
      title={pageTitle}
      subtitle={pageSubtitle}
      showBack
      backHref="/"
      maxWidth="5xl"
      footer="minimal"
    >
      <ExpertNav isAdmin={Boolean(adminSession)} />

      <Suspense fallback={<LoadingSpinner message="در حال بارگذاری فیلترها…" />}>
        <ExpertConsultationFilters
          isAdmin={Boolean(adminSession)}
          assigneeOptions={assigneeOptions}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ConsultationViewToggle currentView={view} />
      </Suspense>

      <p className="mb-4 text-sm text-zinc-600">
        {pagination.total.toLocaleString("fa-IR")} درخواست
        {view === "list" && pagination.totalPages > 1
          ? ` — صفحه ${pagination.page.toLocaleString("fa-IR")} از ${pagination.totalPages.toLocaleString("fa-IR")}`
          : null}
        {view === "kanban" && pagination.total > KANBAN_PAGE_SIZE
          ? ` — نمایش ${KANBAN_PAGE_SIZE.toLocaleString("fa-IR")} مورد اول`
          : null}
      </p>

      {requests.length === 0 ? (
        <Card className="text-center">
          <p className="text-zinc-600">درخواستی با این فیلترها یافت نشد.</p>
        </Card>
      ) : view === "kanban" ? (
        <ConsultationKanbanView requests={requests} />
      ) : (
        <ConsultationListWithAdmin
          requests={requests}
          assigneeOptions={assigneeOptions}
          exportQueryString={exportQueryString}
          isAdmin={Boolean(adminSession)}
        />
      )}

      {view === "list" && pagination.totalPages > 1 && (
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
