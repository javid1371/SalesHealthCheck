import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readAdminSession } from "@/lib/session";
import { getOpsCommandCenter } from "@/modules/admin/admin.service";
import { AdminNav } from "../AdminNav";
import { OpsCommandCenter } from "./OpsCommandCenter";

export default async function AdminOpsPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/login");
  }

  const data = await getOpsCommandCenter();

  return (
    <PageLayout
      title="اتاق فرمان عملیات"
      subtitle="صف‌های قابل اقدام، تخصیص سریع، ظرفیت کارشناسان و سلامت اتوماسیون."
      showBack
      backHref="/admin/dashboard"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />
      <OpsCommandCenter data={data} />
    </PageLayout>
  );
}
