import { notFound } from "next/navigation";
import { ReportShell } from "@/components/layout/ReportShell";
import { ExpertViewPanel } from "@/components/report/blocks/ExpertViewPanel";
import { Card } from "@/components/ui/Card";
import { isAppError } from "@/lib/errors";
import { readAdminSession } from "@/lib/session";
import { getExpertView } from "@/modules/assessment/assessment.service";

interface ExpertPageProps {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ adminToken?: string }>;
}

export default async function ExpertViewPage({
  params,
  searchParams,
}: ExpertPageProps) {
  const { assessmentId } = await params;
  const { adminToken } = await searchParams;
  const adminSession = await readAdminSession();

  let data;
  try {
    data = await getExpertView(assessmentId, {
      adminToken: adminToken ?? null,
      adminSession,
    });
  } catch (error) {
    if (isAppError(error) && error.status === 401) {
      return (
        <ReportShell title="دسترسی محدود" maxWidth="lg">
          <Card>
            <p className="text-sm leading-7 text-zinc-600">
              برای مشاهده این صفحه به توکن ادمین معتبر نیاز است. آدرس را با{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                ?adminToken=...
              </code>{" "}
              باز کنید.
            </p>
          </Card>
        </ReportShell>
      );
    }

    notFound();
  }

  return (
    <ReportShell
      title="Expert View"
      subtitle="نمای داخلی فروش — سرنخ، پیشنهاد و راهنمای افشا"
      maxWidth="lg"
    >
      <ExpertViewPanel
        expertView={data.expertView}
        businessName={data.businessName}
      />
    </ReportShell>
  );
}
