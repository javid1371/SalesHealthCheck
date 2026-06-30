"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { salesExpertLogoutRequest } from "@/lib/expert-client";

export function ExpertLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await salesExpertLogoutRequest();
      router.push("/expert/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={loading}
      loadingLabel="در حال خروج…"
      onClick={() => void handleLogout()}
    >
      خروج
    </Button>
  );
}
