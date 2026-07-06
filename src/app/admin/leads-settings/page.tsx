import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readAdminSession } from "@/lib/session";
import { getLeadSettings } from "@/modules/consultation/lead-config.service";
import { listStaffUsers } from "@/modules/staff/staff.service";
import { AdminNav } from "../AdminNav";
import { LeadSettingsForm } from "./LeadSettingsForm";

export default async function AdminLeadSettingsPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const [settings, staffUsers] = await Promise.all([
    getLeadSettings(),
    listStaffUsers(),
  ]);

  const salesExperts = staffUsers.filter(
    (user) => user.role === "sales_expert" && user.isActive,
  );

  return (
    <PageLayout
      title="پنل ادمین — تنظیمات لید"
      subtitle="مدیریت تخصیص خودکار، تأخیر لید سیستمی و اعلان SMS به کارشناسان."
      showBack
      backHref="/admin/dashboard"
      maxWidth="3xl"
      footer="minimal"
    >
      <AdminNav />
      <LeadSettingsForm settings={settings} salesExperts={salesExperts} />
    </PageLayout>
  );
}
