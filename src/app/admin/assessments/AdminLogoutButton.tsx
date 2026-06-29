"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { adminLogoutRequest } from "@/lib/admin-client";

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await adminLogoutRequest();
      router.push("/admin/login");
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
