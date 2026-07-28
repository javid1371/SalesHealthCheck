import { redirect } from "next/navigation";
import { readAdminSession, readSalesExpertSession } from "@/lib/session";
import { LoginClient } from "./LoginClient";

export default async function StaffLoginPage() {
  const adminSession = await readAdminSession();
  if (adminSession) {
    redirect("/admin/dashboard");
  }

  const expertSession = await readSalesExpertSession();
  if (expertSession) {
    redirect("/expert/dashboard");
  }

  return <LoginClient />;
}
