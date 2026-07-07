import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateFunnelForm } from "@/components/funnel/CreateFunnelForm";
import { FunnelListActions } from "@/components/funnel/FunnelListActions";
import { formatFunnelDate } from "@/components/funnel/funnel-utils";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { env } from "@/lib/env";
import { readUserSession } from "@/lib/session";
import { listUserFunnels } from "@/modules/sales-funnel/sales-funnel.service";

export default async function FunnelListPage() {
  if (!env.salesFunnelEnabled) {
    notFound();
  }

  const session = await readUserSession();
  if (!session) {
    redirect("/account/login");
  }

  const funnels = await listUserFunnels(session);

  return (
    <PageLayout
      title="قیف‌های فروش"
      subtitle="مدل‌سازی، محاسبه و ترسیم قیف فروش بر اساس داده‌های ارزیابی یا ورودی دستی."
      showBack
      backHref="/account/assessments"
      maxWidth="2xl"
    >
      <div className="mb-6">
        <LinkButton href="/account/assessments" variant="secondary" size="md">
          تست‌های من
        </LinkButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          {funnels.length === 0 ? (
            <Card className="text-center">
              <p className="text-zinc-600">هنوز قیف فروشی ساخته نشده است.</p>
              <p className="mt-2 text-sm text-zinc-500">
                با فرم کنار صفحه یک قیف جدید بسازید یا از آخرین ارزیابی پیش‌پر
                کنید.
              </p>
            </Card>
          ) : (
            <ul className="space-y-4">
              {funnels.map((funnel) => (
                <li key={funnel.id}>
                  <Card
                    as="article"
                    padding="compact"
                    className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="truncate text-lg font-semibold text-zinc-900">
                        {funnel.name}
                      </h2>
                      <p className="text-sm text-zinc-500">
                        {funnel.stageCount.toLocaleString("fa-IR")} مرحله ·
                        به‌روزرسانی: {formatFunnelDate(funnel.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/funnel/${funnel.id}`}
                        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                      >
                        ویرایش
                      </Link>
                      <FunnelListActions
                        funnelId={funnel.id}
                        funnelName={funnel.name}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CreateFunnelForm />
      </div>
    </PageLayout>
  );
}
