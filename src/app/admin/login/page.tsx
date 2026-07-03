import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/session";
import { AdminLoginClient } from "./AdminLoginClient";

export default async function AdminLoginPage() {
  const session = await readAdminSession();
  if (session) {
    redirect("/admin/dashboard");
  }

  return <AdminLoginClient />;
}
