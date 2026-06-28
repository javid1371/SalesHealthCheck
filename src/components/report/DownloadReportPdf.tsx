"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { resolveApiError } from "@/lib/page-messages";

interface DownloadReportPdfProps {
  reportId: string;
  token: string;
  className?: string;
}

const PDF_TIMEOUT_MS = 30_000;

export function DownloadReportPdf({
  reportId,
  token,
  className = "",
}: DownloadReportPdfProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);

    try {
      const response = await fetch(
        `/api/reports/${reportId}/pdf?token=${encodeURIComponent(token)}`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        let message = "دانلود PDF ناموفق بود. دوباره تلاش کنید.";
        try {
          const body = (await response.json()) as {
            error?: { message?: string; code?: string };
          };
          if (body.error?.code === "pdf_generation_disabled") {
            message = "دانلود PDF در این سرور فعال نیست.";
          } else if (body.error?.message) {
            message = body.error.message;
          }
        } catch {
          // Non-JSON error body — keep default message
        }
        setError(message);
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `sales-health-check-${reportId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("زمان دانلود PDF به پایان رسید. دوباره تلاش کنید.");
      } else {
        setError(resolveApiError(err, "دانلود PDF ناموفق بود."));
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [reportId, token]);

  return (
    <div className={className}>
      <Button
        variant="secondary"
        loading={loading}
        loadingLabel="در حال آماده‌سازی PDF…"
        onClick={() => void handleDownload()}
      >
        دانلود PDF
      </Button>
      <p className="mt-2 text-sm text-zinc-500">
        نسخه کامل برای مطالعه روی کامپیوتر یا چاپ
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
