"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiClientError, apiDelete } from "@/lib/api-client";

interface FunnelListActionsProps {
  funnelId: string;
  funnelName: string;
}

export function FunnelListActions({
  funnelId,
  funnelName,
}: FunnelListActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `قیف «${funnelName}» حذف شود؟ این عمل قابل بازگشت نیست.`,
    );
    if (!confirmed) return;

    setError(null);
    setLoading(true);

    try {
      await apiDelete(`/api/funnels/${funnelId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "حذف قیف با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        variant="ghost"
        size="sm"
        loading={loading}
        loadingLabel="در حال حذف…"
        onClick={() => void handleDelete()}
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        حذف
      </Button>
    </div>
  );
}
