"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { logoutRequest } from "@/lib/auth-client";

export function AccountLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logoutRequest();
      router.push("/account/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "در حال خروج…" : "خروج"}
    </Button>
  );
}
