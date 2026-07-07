import { notFound } from "next/navigation";
import { FunnelChartView } from "@/components/funnel/FunnelChartView";
import { env } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import {
  readAdminSession,
  readSalesExpertSession,
  readUserSession,
} from "@/lib/session";
import { getFunnel } from "@/modules/sales-funnel/sales-funnel.service";

export const dynamic = "force-dynamic";

interface FunnelPrintPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

type PrintPageResult =
  | {
      status: "success";
      funnelName: string;
      analysis: NonNullable<
        Awaited<ReturnType<typeof getFunnel>>["analysis"]
      > | null;
    }
  | { status: "not_found" }
  | { status: "denied" };

async function loadFunnelPrint(
  funnelId: string,
  access: {
    token?: string;
    userSession: Awaited<ReturnType<typeof readUserSession>>;
    adminSession: Awaited<ReturnType<typeof readAdminSession>>;
    salesExpertSession: Awaited<ReturnType<typeof readSalesExpertSession>>;
  },
): Promise<PrintPageResult> {
  try {
    const funnel = await getFunnel(funnelId, {
      token: access.token,
      userSession: access.userSession,
      adminSession: access.adminSession,
      salesExpertSession: access.salesExpertSession,
    });

    if (!funnel.analysis) {
      return { status: "not_found" };
    }

    return {
      status: "success",
      funnelName: funnel.name,
      analysis: funnel.analysis,
    };
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

export default async function FunnelPrintPage({
  params,
  searchParams,
}: FunnelPrintPageProps) {
  if (!env.salesFunnelEnabled) {
    notFound();
  }

  const { id } = await params;
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

  const result = await loadFunnelPrint(id, {
    token,
    userSession,
    adminSession,
    salesExpertSession,
  });

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "denied") {
    return <PrintAccessError message="دسترسی به این قیف مجاز نیست." />;
  }

  return (
    <FunnelChartView
      funnelName={result.funnelName}
      analysis={result.analysis}
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
