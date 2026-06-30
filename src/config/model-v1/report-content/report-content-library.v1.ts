import type { DomainBundle } from "./domain-bundle.types";
import { assertDomainCrosswalkComplete } from "./domain-crosswalk";
import { REPORT_CONTENT_LIBRARY_V1 as GENERATED_REPORT_CONTENT_LIBRARY_V1 } from "./report-content-library.v1.generated";

assertDomainCrosswalkComplete();

export const REPORT_CONTENT_LIBRARY_V1: DomainBundle[] =
  GENERATED_REPORT_CONTENT_LIBRARY_V1;

const libraryBySlug = new Map(
  REPORT_CONTENT_LIBRARY_V1.map((bundle) => [bundle.domain_id, bundle]),
);

const libraryByDomainNumber = new Map(
  REPORT_CONTENT_LIBRARY_V1.map((bundle) => [bundle.domain_number, bundle]),
);

export function getReportContentBundleBySlug(domainSlug: string): DomainBundle | undefined {
  return libraryBySlug.get(domainSlug);
}

export function getReportContentBundleByDomainNumber(
  domainNumber: number,
): DomainBundle | undefined {
  return libraryByDomainNumber.get(domainNumber);
}
