import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { readUserSession } from "@/lib/session";
import { normalizePhone } from "@/modules/auth/auth.validators";
import { StartVerifyForm } from "./StartVerifyForm";

interface VerifyPageProps {
  searchParams: Promise<{ phone?: string }>;
}

export default async function AssessmentStartVerifyPage({
  searchParams,
}: VerifyPageProps) {
  const session = await readUserSession();
  if (session) {
    redirect("/assessment/start/info");
  }

  const { phone: rawPhone } = await searchParams;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!phone) {
    redirect("/assessment/start");
  }

  return (
    <PageLayout
      title="ورود کد تأیید"
      subtitle="کد ۶ رقمی ارسال‌شده را وارد کنید."
      showBack
      backHref="/assessment/start"
      maxWidth="md"
    >
      <StartVerifyForm phone={phone} />
    </PageLayout>
  );
}
