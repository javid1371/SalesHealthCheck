"use client";

import { useCallback, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { buildResultUrl } from "@/modules/assessment/assessment.validators";

interface CopyResultLinkProps {
  assessmentId: string;
  token: string;
}

export function CopyResultLink({ assessmentId, token }: CopyResultLinkProps) {
  const [copied, setCopied] = useState(false);
  const relativeUrl = buildResultUrl(assessmentId, token);
  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${relativeUrl}`
      : relativeUrl;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }, [fullUrl]);

  return (
    <Alert
      variant="warning"
      title="این لینک را ذخیره کنید — راه دیگری برای ورود ندارید"
      className="rounded-2xl p-4 sm:p-5"
    >
      <p>
        با این لینک می‌توانید بعداً به نتیجه و گزارش خود دسترسی داشته باشید.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          readOnly
          value={fullUrl}
          dir="ltr"
          className="min-w-0 flex-1 border-amber-200 py-2"
          aria-label="لینک نتیجه ارزیابی"
        />
        <Button
          variant="secondary"
          onClick={() => void handleCopy()}
          className="shrink-0"
        >
          {copied ? "کپی شد!" : "کپی لینک"}
        </Button>
      </div>
    </Alert>
  );
}
