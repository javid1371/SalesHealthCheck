import { domainsV1 } from "../domains";

/**
 * Notion `domain_id` (snake_case) → project domain slug (kebab-case).
 * Explicit overrides where Notion naming differs from `domainsV1.slug`.
 */
export const NOTION_DOMAIN_ID_TO_PROJECT_SLUG: Record<string, string> = {
  persona: "persona",
  uvp: "uvp",
  offer_pricing: "offer-design",
  lead_generation: "lead-generation",
  lead_nurturing: "lead-nurturing",
  lead_response_capture: "speed-to-lead",
  lead_qualification: "lead-qualification",
  first_contact_trust: "initial-trust",
  needs_discovery: "needs-discovery",
  professional_presentation: "presentation",
  objection_handling: "objection-handling",
  sales_closing: "closing",
  customer_loyalty: "loyalty",
  touchpoint_consistency: "touchpoint-consistency",
  sales_path_clarity: "sales-journey-clarity",
  sales_measurement_optimization: "measurement-optimization",
};

/** Notion `domain_number` == `domainsV1.displayOrder` → project slug. */
export const DOMAIN_NUMBER_TO_PROJECT_SLUG: Record<number, string> = Object.fromEntries(
  domainsV1.map((domain) => [domain.displayOrder, domain.slug]),
) as Record<number, string>;

export const PROJECT_SLUG_TO_DOMAIN_NUMBER: Record<string, number> = Object.fromEntries(
  domainsV1.map((domain) => [domain.slug, domain.displayOrder]),
);

export function notionDomainIdToProjectSlug(notionDomainId: string): string {
  const mapped = NOTION_DOMAIN_ID_TO_PROJECT_SLUG[notionDomainId];
  if (mapped) {
    return mapped;
  }

  const hyphenated = notionDomainId.replace(/_/g, "-");
  if (PROJECT_SLUG_TO_DOMAIN_NUMBER[hyphenated] !== undefined) {
    return hyphenated;
  }

  throw new Error(`Unknown Notion domain_id: ${notionDomainId}`);
}

export function domainNumberToProjectSlug(domainNumber: number): string {
  const slug = DOMAIN_NUMBER_TO_PROJECT_SLUG[domainNumber];
  if (!slug) {
    throw new Error(`Unknown domain_number: ${domainNumber}`);
  }
  return slug;
}

export function projectSlugToDomainNumber(slug: string): number {
  const domainNumber = PROJECT_SLUG_TO_DOMAIN_NUMBER[slug];
  if (domainNumber === undefined) {
    throw new Error(`Unknown project domain slug: ${slug}`);
  }
  return domainNumber;
}

/** Validates that all 16 project domains are reachable via domain_number crosswalk. */
export function assertDomainCrosswalkComplete(): void {
  if (domainsV1.length !== 16) {
    throw new Error(`Expected 16 domains in domainsV1, got ${domainsV1.length}`);
  }

  for (const domain of domainsV1) {
    const fromNumber = domainNumberToProjectSlug(domain.displayOrder);
    if (fromNumber !== domain.slug) {
      throw new Error(
        `Crosswalk mismatch at displayOrder ${domain.displayOrder}: expected ${domain.slug}, got ${fromNumber}`,
      );
    }
  }

  const notionIds = Object.keys(NOTION_DOMAIN_ID_TO_PROJECT_SLUG);
  if (notionIds.length !== 16) {
    throw new Error(`Expected 16 Notion domain_id mappings, got ${notionIds.length}`);
  }
}
