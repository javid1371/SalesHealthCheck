import type { SalesModel } from "@prisma/client";

export const SALES_MODEL_OPTIONS: Array<{
  value: SalesModel;
  label: string;
}> = [
  { value: "online", label: "آنلاین" },
  { value: "offline", label: "حضوری" },
  { value: "phone", label: "تلفنی" },
  { value: "direct_message", label: "دایرکت / پیام‌رسان" },
  { value: "hybrid", label: "ترکیبی" },
];

export function salesModelLabel(value: SalesModel | string | null): string {
  const option = SALES_MODEL_OPTIONS.find((o) => o.value === value);
  return option?.label ?? String(value ?? "—");
}
