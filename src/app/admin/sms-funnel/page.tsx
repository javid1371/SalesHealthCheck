import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { readAdminSession } from "@/lib/session";
import {
  getAllResolvedSequences,
  getFunnelSettings,
} from "@/modules/sms-funnel/funnel-config.service";
import {
  getSmsFunnelAdminMetrics,
  listRecentSmsMessages,
  listSmsOptOuts,
} from "@/modules/sms-funnel/funnel.repository";
import { AdminNav } from "../AdminNav";
import { SmsFunnelMetricsCard } from "./SmsFunnelMetricsCard";
import { SmsFunnelSettingsForm } from "./SmsFunnelSettingsForm";
import { SmsStepEditor } from "./SmsStepEditor";

export default async function AdminSmsFunnelPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/login");
  }

  const [sequences, settings, metrics, recentSmsMessages, optOuts] =
    await Promise.all([
      getAllResolvedSequences(),
      getFunnelSettings(),
      getSmsFunnelAdminMetrics(),
      listRecentSmsMessages(20),
      listSmsOptOuts(50),
    ]);

  return (
    <PageLayout
      title="پنل ادمین — قیف پیامکی"
      subtitle="مدیریت متن پیام‌ها، زمان‌بندی، تنظیمات و مشاهده عملکرد قیف."
      showBack
      backHref="/admin/dashboard"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />

      <div className="space-y-8">
        <SmsFunnelSettingsForm settings={settings} />
        <SmsFunnelMetricsCard metrics={metrics} />

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            ویرایش پیام‌ها
          </h2>
          <div className="space-y-8">
            {sequences.map((sequence) => (
              <div key={sequence.key}>
                <h3 className="mb-3 text-base font-semibold text-zinc-800">
                  {sequence.label}
                </h3>
                <div className="space-y-4">
                  {sequence.steps.map((step) => (
                    <SmsStepEditor
                      key={`${sequence.key}-${step.stepKey}`}
                      sequenceKey={sequence.key}
                      step={step}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            پیام‌های اخیر
          </h2>
          {recentSmsMessages.length === 0 ? (
            <Card className="text-center">
              <p className="text-zinc-600">هنوز پیامی ثبت نشده است.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-700">مرحله</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">زمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recentSmsMessages.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-zinc-700">
                        {row.stepKey}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs text-zinc-600"
                        dir="ltr"
                      >
                        {row.phone}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{row.status}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {(row.sentAt ?? row.scheduledFor)
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            لغو اشتراک (Opt-out)
          </h2>
          {optOuts.length === 0 ? (
            <Card className="text-center">
              <p className="text-zinc-600">شماره لغواشتراکی ثبت نشده است.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
                    <th className="px-4 py-3 font-medium text-zinc-700">تاریخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {optOuts.map((row) => (
                    <tr key={row.phone}>
                      <td
                        className="px-4 py-3 font-mono text-xs text-zinc-600"
                        dir="ltr"
                      >
                        {row.phone}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {row.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
