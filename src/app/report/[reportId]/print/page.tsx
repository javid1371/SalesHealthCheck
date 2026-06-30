import { notFound } from "next/navigation";
import { ReportPrintView } from "@/components/report/ReportPrintView";
import { isAppError } from "@/lib/errors";
import { readAdminSession, readSalesExpertSession, readUserSession } from "@/lib/session";
import { getReport } from "@/modules/assessment/assessment.service";
import type { ReportResponse } from "@/modules/assessment/assessment.types";

interface ReportPrintPageProps {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ token?: string }>;
}

type PrintPageResult =
  | { status: "success"; report: ReportResponse }
  | { status: "not_found" }
  | { status: "denied" };

async function loadPrintReport(
  reportId: string,
  access: {
    token?: string;
    userSession: Awaited<ReturnType<typeof readUserSession>>;
    adminSession: Awaited<ReturnType<typeof readAdminSession>>;
    salesExpertSession: Awaited<ReturnType<typeof readSalesExpertSession>>;
  },
): Promise<PrintPageResult> {
  try {
    const report = await getReport(reportId, {
      token: access.token,
      userSession: access.userSession,
      adminSession: access.adminSession,
      salesExpertSession: access.salesExpertSession,
    });

    if (!report.reportSpec) {
      return { status: "not_found" };
    }

    return { status: "success", report };
  } catch (error) {
    if (isAppError(error)) {
      if (error.status === 404) {
        return { status: "not_found" };
      }
      return { status: "denied" };
    }
    throw error;
  }
}

export default async function ReportPrintPage({
  params,
  searchParams,
}: ReportPrintPageProps) {
  const { reportId } = await params;
  const { token } = await searchParams;
  const [userSession, adminSession, salesExpertSession] = await Promise.all([
    readUserSession(),
    readAdminSession(),
    readSalesExpertSession(),
  ]);

  const hasAccessCredential =
    !!token || !!userSession || !!adminSession || !!salesExpertSession;
  if (!hasAccessCredential) {
    return (
      <PrintAccessError message="برای مشاهده نسخه چاپ، توکن دسترسی در آدرس لازم است." />
    );
  }

  const result = await loadPrintReport(reportId, {
    token,
    userSession,
    adminSession,
    salesExpertSession,
  });

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "denied") {
    return <PrintAccessError message="دسترسی به این گزارش مجاز نیست." />;
  }

  const { report } = result;

  return (
    <ReportPrintView
      reportSpec={report.reportSpec!}
      businessName={report.businessName}
      createdAt={report.createdAt}
    />
  );
}

function PrintAccessError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8 text-center">
      <p className="text-sm text-zinc-600">{message}</p>
    </div>
  );
}
