import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readAdminSession } from "@/lib/session";
import { getReportSettings } from "@/modules/report/report-config.service";
import { AdminNav } from "../AdminNav";
import { ReportSettingsForm } from "./ReportSettingsForm";

export default async function AdminReportSettingsPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/login");
  }

  const settings = await getReportSettings();

  return (
    <PageLayout
      title="پنل ادمین — تنظیمات گزارش"
      subtitle="کنترل حالت CTA گزارش (CAPACITY_MODE) بدون نیاز به تغییر env و ریستارت."
      showBack
      backHref="/admin/dashboard"
      maxWidth="2xl"
      footer="minimal"
    >
      <AdminNav />
      <ReportSettingsForm settings={settings} />
    </PageLayout>
  );
}
