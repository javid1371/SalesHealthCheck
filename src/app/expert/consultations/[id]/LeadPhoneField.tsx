"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface LeadPhoneFieldProps {
  phone: string | null;
}

export function LeadPhoneField({ phone }: LeadPhoneFieldProps) {
  const [copied, setCopied] = useState(false);

  if (!phone) {
    return <span className="font-medium text-zinc-900">—</span>;
  }

  const phoneNumber = phone;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" dir="ltr">
      <a
        href={`tel:${phoneNumber}`}
        className="font-medium text-emerald-700 hover:text-emerald-800"
      >
        {phoneNumber}
      </a>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void handleCopy()}
        className="h-7 px-2 text-xs"
        aria-label="کپی شماره موبایل"
      >
        {copied ? "کپی شد" : "کپی"}
      </Button>
    </div>
  );
}
