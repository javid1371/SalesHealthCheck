import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readUserSession } from "@/lib/session";
import { StartPhoneForm } from "./StartPhoneForm";

export default async function AssessmentStartPage() {
  const session = await readUserSession();
  if (session) {
    redirect("/assessment/start/info");
  }

  return (
    <PageLayout
      title="تأیید شماره موبایل"
      subtitle="برای شروع ارزیابی، شماره موبایل خود را وارد کنید. کد تأیید برای شما ارسال می‌شود."
      showBack
      backHref="/"
      maxWidth="md"
    >
      <StartPhoneForm />
    </PageLayout>
  );
}
