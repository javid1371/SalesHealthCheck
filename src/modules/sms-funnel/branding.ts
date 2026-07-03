import { env } from "@/lib/env";

export const SMS_BRAND_SIGNATURE = "— سلامت سیستم فروش | جاوید مقدم";

export function buildBrandedSmsMessage(body: string, link?: string): string {
  const parts = [body.trim()];
  if (link) {
    parts.push(link.trim());
  }
  parts.push(SMS_BRAND_SIGNATURE);
  return parts.join("\n");
}

export function buildShortLinkUrl(slug: string): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  return `${base}/l/${slug}`;
}
