import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/session";
import { AccountLoginClient } from "./AccountLoginClient";

export default async function AccountLoginPage() {
  const session = await readUserSession();
  if (session) {
    redirect("/account/assessments");
  }

  return <AccountLoginClient />;
}
