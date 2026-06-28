"use client";

import Link from "next/link";

interface PrivacyConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function PrivacyConsentCheckbox({
  id,
  checked,
  onChange,
}: PrivacyConsentCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
        required
      />
      <span className="text-sm leading-6 text-zinc-700">
        با{" "}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-emerald-700 underline-offset-2 hover:text-emerald-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          سیاست حریم خصوصی
        </Link>{" "}
        آشنا هستم و به جمع‌آوری و استفاده از اطلاعات تماس خود برای ارائه
        خدمات موافقم.
      </span>
    </label>
  );
}
