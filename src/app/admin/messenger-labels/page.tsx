import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readAdminSession } from "@/lib/session";
import { getMessengerLabelsForAdmin } from "@/modules/messenger/messenger-labels-admin.service";
import { AdminNav } from "../AdminNav";
import { MessengerLabelsForm } from "./MessengerLabelsForm";

export default async function AdminMessengerLabelsPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/login");
  }

  const data = await getMessengerLabelsForAdmin();

  return (
    <PageLayout
      title="پنل ادمین — برچسب پیام‌رسان"
      subtitle="ویرایش برچسب کوتاه دکمه‌های ربات (حداکثر ۶۴ کاراکتر). نسخه وب دست‌نخورده می‌ماند."
      showBack
      backHref="/admin/dashboard"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />
      <MessengerLabelsForm
        domains={data.domains}
        modelVersionName={data.modelVersionName}
      />
    </PageLayout>
  );
}
