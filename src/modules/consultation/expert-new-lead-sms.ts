import type { PurchaseProbability } from "@prisma/client";
import { env } from "@/lib/env";
import {
  formatPurchaseProbabilityLabel,
  resolveEffectivePurchaseProbability,
} from "./lead-insights";

export const EXPERT_NEW_LEAD_SMS_MAX_LENGTH = 500;

const PLACEHOLDER_RE = /\{\{(name|phone|probability|detailUrl)\}\}/;
const PLACEHOLDER_REPLACE_RE = /\{\{(name|phone|probability|detailUrl)\}\}/g;

export type ExpertNewLeadSmsLead = {
  id: string;
  name: string;
  phone: string | null | undefined;
  purchaseProbabilityPercent?: number | null;
  purchaseProbabilityBand?: PurchaseProbability | null;
  adminProbabilityOverridePercent?: number | null;
};

export function expertNewLeadSmsHasPlaceholders(template: string): boolean {
  return PLACEHOLDER_RE.test(template);
}

export function buildExpertLeadDetailUrl(leadId: string): string {
  const base = env.appBaseUrl.replace(/\/$/, "");
  return `${base}/expert/consultations/${leadId}`;
}

/**
 * Backward-compatible expert new-lead SMS body.
 * Templates without known placeholders are returned unchanged.
 */
export function renderExpertNewLeadSms(
  template: string,
  lead: ExpertNewLeadSmsLead,
): string {
  if (!expertNewLeadSmsHasPlaceholders(template)) {
    return template;
  }

  const effective = resolveEffectivePurchaseProbability({
    purchaseProbabilityPercent: lead.purchaseProbabilityPercent ?? null,
    purchaseProbabilityBand: lead.purchaseProbabilityBand ?? null,
    adminProbabilityOverridePercent:
      lead.adminProbabilityOverridePercent ?? null,
  });
  const probability =
    formatPurchaseProbabilityLabel(effective.percent, effective.band) ?? "";

  const values: Record<string, string> = {
    name: lead.name.trim(),
    phone: lead.phone?.trim() ?? "",
    probability,
    detailUrl: buildExpertLeadDetailUrl(lead.id),
  };

  return template.replace(PLACEHOLDER_REPLACE_RE, (_match, key: string) => {
    return values[key] ?? "";
  });
}
