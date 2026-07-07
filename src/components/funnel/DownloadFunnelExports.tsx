"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { resolveApiError } from "@/lib/page-messages";

interface DownloadFunnelExportsProps {
  funnelId: string;
  token?: string;
  className?: string;
}

const EXPORT_TIMEOUT_MS = 30_000;

async function resolveExportError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: string };
    };
    if (body.error?.code === "pdf_generation_disabled") {
      return "خروجی تصویری در این سرور فعال نیست.";
    }
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // Non-JSON error body — keep default message
  }
  return fallbackMessage;
}

function buildExportUrl(
  funnelId: string,
  format: "pdf" | "png",
  token?: string,
): string {
  const base = `/api/funnels/${funnelId}/${format}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export function DownloadFunnelExports({
  funnelId,
  token,
  className = "",
}: DownloadFunnelExportsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = useCallback(
    async (format: "pdf" | "png") => {
      const setLoading = format === "pdf" ? setPdfLoading : setPngLoading;
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        EXPORT_TIMEOUT_MS,
      );

      try {
        const response = await fetch(buildExportUrl(funnelId, format, token), {
          signal: controller.signal,
        });

        if (!response.ok) {
          const fallback =
            format === "pdf"
              ? "دانلود PDF ناموفق بود. دوباره تلاش کنید."
              : "دانلود PNG ناموفق بود. دوباره تلاش کنید.";
          setError(await resolveExportError(response, fallback));
          return;
        }

        const blob = await response.blob();
        triggerDownload(blob, `sales-funnel-${funnelId}.${format}`);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("زمان دانلود به پایان رسید. دوباره تلاش کنید.");
        } else {
          setError(
            resolveApiError(
              err,
              format === "pdf"
                ? "دانلود PDF ناموفق بود."
                : "دانلود PNG ناموفق بود.",
            ),
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [funnelId, token],
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={pdfLoading}
          loadingLabel="در حال آماده‌سازی PDF…"
          onClick={() => void downloadFile("pdf")}
        >
          دانلود PDF
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={pngLoading}
          loadingLabel="در حال آماده‌سازی PNG…"
          onClick={() => void downloadFile("png")}
        >
          دانلود PNG
        </Button>
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        خروجی نمودار و تحلیل قیف برای اشتراک یا چاپ
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
