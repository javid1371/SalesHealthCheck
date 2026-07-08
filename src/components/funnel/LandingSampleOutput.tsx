"use client";

import { SpiderChart } from "@/components/charts/SpiderChart";

const SAMPLE_DOMAIN_SCORES = [
  { domainName: "جذب مشتری", percentage: 62 },
  { domainName: "پیام و پیشنهاد", percentage: 48 },
  { domainName: "پیگیری", percentage: 55 },
  { domainName: "مکالمه فروش", percentage: 71 },
  { domainName: "تجربه مشتری", percentage: 58 },
  { domainName: "عدد و تحلیل", percentage: 44 },
];

export function LandingSampleOutput() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 sm:p-6">
      <p className="mb-4 text-center text-xs text-zinc-500">
        نمونه خروجی — داده‌های واقعی پس از تکمیل آزمون
      </p>
      <SpiderChart data={SAMPLE_DOMAIN_SCORES} />
    </div>
  );
}
