export {
  type ActionContent,
  type AnswerOptionContent,
  type AnswerScore,
  type DomainBundle,
  type DomainFamily,
  type DomainLevelContent,
  type DomainLevelKey,
  type QuestionContent,
  type QuestionRootRule,
  type RootCauseContent,
} from "./domain-bundle.types";

export {
  DOMAIN_NUMBER_TO_PROJECT_SLUG,
  NOTION_DOMAIN_ID_TO_PROJECT_SLUG,
  PROJECT_SLUG_TO_DOMAIN_NUMBER,
  assertDomainCrosswalkComplete,
  domainNumberToProjectSlug,
  notionDomainIdToProjectSlug,
  projectSlugToDomainNumber,
} from "./domain-crosswalk";

export {
  buildReportContentLibraryV1,
  normalizeDomainBundleFromSnapshotRow,
  type DomainBundlesSnapshot,
} from "./normalize-domain-bundle";

export {
  REPORT_CONTENT_LIBRARY_V1,
  getReportContentBundleByDomainNumber,
  getReportContentBundleBySlug,
} from "./report-content-library.v1";

export {
  type FallbackFieldKey,
  type FieldFallbacks,
  type LevelFallbackFieldKey,
  type StaticFallbackFieldKey,
  fieldFallbacksV1,
  getFieldFallback,
  getStaticFieldFallback,
  staticFieldFallbacksV1,
} from "./field-fallbacks";

export {
  type CtaDestination,
  type CtaMoment,
  type CtaPersonalizationInput,
  buildCtaHeadline,
  ctaButtonLabels,
  ctaDestinationByCapacity,
  ctaHeadlineTemplates,
  getCtaButtonLabel,
  getCtaDestination,
} from "./cta-templates";

export {
  type SurvivalBannerContent,
  confidenceHonestyNote,
  getSurvivalBannerContent,
  healthyDomainSummaryLine,
  incompleteDomainLabel,
  lockedFixLabel,
  lockedPlanTeaserBody,
  quickWinFixLockLabel,
  quickWinTeaserSuffix,
  resolveToneMode,
  selectedScoreFallbackLabel,
  shouldShowConfidenceNote,
  survivalBannerTemplates,
} from "./tone-templates";
