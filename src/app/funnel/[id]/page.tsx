import { notFound, redirect } from "next/navigation";
import { FunnelEditor } from "@/components/funnel/FunnelEditor";
import { PageLayout } from "@/components/layout/PageLayout";
import { env } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import {
  readAdminSession,
  readSalesExpertSession,
  readUserSession,
} from "@/lib/session";
import { getFunnel } from "@/modules/sales-funnel/sales-funnel.service";

export const dynamic = "force-dynamic";

interface FunnelEditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function FunnelEditorPage({
  params,
  searchParams,
}: FunnelEditorPageProps) {
  if (!env.salesFunnelEnabled) {
    notFound();
  }

  const { id } = await params;
  const { token } = await searchParams;

  if (token) {
    redirect(
      `/funnel/${id}/chart?token=${encodeURIComponent(token)}`,
    );
  }

  const [userSession, adminSession, salesExpertSession] = await Promise.all([
    readUserSession(),
    readAdminSession(),
    readSalesExpertSession(),
  ]);

  if (!userSession && !adminSession && !salesExpertSession) {
    redirect("/account/login");
  }

  try {
    const funnel = await getFunnel(id, {
      userSession,
      adminSession,
      salesExpertSession,
    });

    return (
      <PageLayout
        title={funnel.name}
        subtitle="ویرایش مراحل، پیش‌بینی درآمد، what-if و goal-seek"
        showBack
        backHref="/funnel"
        maxWidth="5xl"
      >
        <FunnelEditor initialFunnel={funnel} />
      </PageLayout>
    );
  } catch (error) {
    if (isAppError(error)) {
      if (error.status === 404) {
        notFound();
      }
      if (error.status === 403) {
        return (
          <PageLayout title="دسترسی مجاز نیست" showBack backHref="/funnel">
            <p className="text-sm text-zinc-600">
              شما به این قیف دسترسی ندارید.
            </p>
          </PageLayout>
        );
      }
    }
    throw error;
  }
}
