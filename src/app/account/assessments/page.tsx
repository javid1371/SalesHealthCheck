import Link from "next/link";
import { redirect } from "next/navigation";
import { HealthBadge } from "@/components/report/HealthBadge";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { readUserSession } from "@/lib/session";
import {
  listMyAssessments,
  overallScoreLabel,
} from "@/modules/account/account.service";
import { AccountLogoutButton } from "./AccountLogoutButton";

export default async function AccountAssessmentsPage() {
  const session = await readUserSession();
  if (!session) {
    redirect("/account/login");
  }

  const { assessments } = await listMyAssessments(session.userId);

  return (
    <PageLayout
      title="تست‌های من"
      subtitle="لیست ارزیابی‌های قبلی شما. می‌توانید نتیجه را ببینید یا تست ناتمام را ادامه دهید."
      showBack
      backHref="/"
      maxWidth="2xl"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <LinkButton href="/assessment/start" variant="primary">
          ارزیابی جدید
        </LinkButton>
        <AccountLogoutButton />
      </div>

      {assessments.length === 0 ? (
        <Card className="text-center">
          <p className="text-zinc-600">هنوز ارزیابی ثبت نشده است.</p>
          <LinkButton href="/assessment/start" className="mt-6">
            شروع اولین ارزیابی
          </LinkButton>
        </Card>
      ) : (
        <ul className="space-y-4">
          {assessments.map((item) => {
            const scoreLabel = overallScoreLabel(item);

            return (
              <li key={item.assessmentId}>
                <Card
                  as="article"
                  padding="compact"
                  className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="truncate text-lg font-semibold text-zinc-900">
                      {item.businessName}
                    </h2>
                    <p className="text-sm text-zinc-500">
                      شروع: {item.startedAt}
                      {item.completedAt
                        ? ` · پایان: ${item.completedAt}`
                        : null}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700">
                        {item.statusLabel}
                      </span>
                      {item.overallScore && (
                        <span className="flex items-center gap-1.5 text-zinc-700">
                          {scoreLabel}
                          <HealthBadge
                            level={item.overallScore.healthLevel}
                            size="sm"
                          />
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={item.actionUrl}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    {item.actionLabel}
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageLayout>
  );
}
