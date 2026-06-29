import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readUserSession } from "@/lib/session";
import { findUserById } from "@/modules/assessment/assessment.repository";
import { BusinessInfoForm } from "./BusinessInfoForm";

export default async function BusinessInfoPage() {
  const session = await readUserSession();
  if (!session) {
    redirect("/assessment/start");
  }

  const user = await findUserById(session.userId);
  if (!user?.phone) {
    redirect("/assessment/start");
  }

  return (
    <PageLayout
      title="اطلاعات کسب‌وکار"
      subtitle="این اطلاعات برای شخصی‌سازی گزارش استفاده می‌شود."
      showBack
      backHref="/assessment/start"
      maxWidth="md"
    >
      <BusinessInfoForm
        phone={user.phone}
        defaultName={user.name ?? ""}
      />
    </PageLayout>
  );
}
