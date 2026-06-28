import {
  getDomainReportConfig,
  getQuestionAnalysis,
} from "@/config/model-v1/question-analysis-config";
import { firstSentence, lookupScoreBand } from "@/config/model-v1/question-bank/parse-score-bands";
import {
  type FallbackFieldKey,
  getFieldFallback,
} from "@/config/model-v1/report-content/field-fallbacks";
import {
  buildCtaHeadline,
  getCtaButtonLabel,
  getCtaDestination,
  type CtaMoment,
  type CtaPersonalizationInput,
} from "@/config/model-v1/report-content/cta-templates";
import {
  getSurvivalBannerContent,
  resolveToneMode,
} from "@/config/model-v1/report-content/tone-templates";
import { logMissingContent } from "@/lib/missing-content-log";
import type { CapacityMode } from "@/types/report-spec";
import type {
  DiagnosisConfidence,
  DomainLevel,
  SurvivalStatus,
} from "@/types/structured-diagnosis";

export * from "@/config/model-v1/report-content";

export interface FieldResolveContext {
  domainSlug: string;
  level: DomainLevel;
  questionNumber?: number;
  score?: 0 | 1 | 2 | 3;
}

function normalizeText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveWithFallback(
  field: FallbackFieldKey,
  primary: string | undefined,
  ctx: FieldResolveContext,
): string {
  if (primary) {
    return primary;
  }

  const fallback = getFieldFallback(field, ctx.level);

  logMissingContent({
    field,
    domainSlug: ctx.domainSlug,
    level: ctx.level,
    questionNumber: ctx.questionNumber,
    score: ctx.score,
  });

  return fallback ?? "";
}

export function resolveDiagnosticSymptoms(
  domainSlug: string,
  level: DomainLevel,
): string {
  const config = getDomainReportConfig(domainSlug);
  return resolveWithFallback(
    "diagnosticSymptoms",
    normalizeText(config?.diagnosticSymptoms),
    { domainSlug, level },
  );
}

export function resolveDiagnosticIntent(
  domainSlug: string,
  questionNumber: number,
  level: DomainLevel,
  primary?: string,
): string {
  const fromQuestion = getQuestionAnalysis(domainSlug, questionNumber);
  const resolvedPrimary =
    normalizeText(primary) ?? normalizeText(fromQuestion?.diagnosticIntent);

  return resolveWithFallback("diagnosticIntent", resolvedPrimary, {
    domainSlug,
    level,
    questionNumber,
  });
}

export function resolveDomainScoreBand(
  domainSlug: string,
  rawScore: number,
  level: DomainLevel,
): string {
  const config = getDomainReportConfig(domainSlug);
  const band = config?.domainScoreBands
    ? lookupScoreBand(config.domainScoreBands, rawScore)
    : undefined;

  return resolveWithFallback(
    "domainScoreBand",
    normalizeText(band?.description),
    { domainSlug, level },
  );
}

export function resolveOptionInterpretation(
  domainSlug: string,
  questionNumber: number,
  score: 0 | 1 | 2 | 3,
  level: DomainLevel,
): string {
  const analysis = getQuestionAnalysis(domainSlug, questionNumber);
  const primary = normalizeText(analysis?.optionInterpretations[score]);

  return resolveWithFallback("optionInterpretation", primary, {
    domainSlug,
    level,
    questionNumber,
    score,
  });
}

export function resolveCorrectiveAction(
  domainSlug: string,
  level: DomainLevel,
): string {
  const config = getDomainReportConfig(domainSlug);
  return resolveWithFallback(
    "correctiveAction",
    normalizeText(config?.correctiveAction),
    { domainSlug, level },
  );
}

export function resolveQualitativeCost(
  domainSlug: string,
  level: DomainLevel,
): string {
  const config = getDomainReportConfig(domainSlug);
  const symptoms = normalizeText(config?.diagnosticSymptoms);
  const fromSymptoms = symptoms
    ? `نتیجه: ${firstSentence(symptoms)}`
    : undefined;

  return resolveWithFallback("qualitativeCost", fromSymptoms, {
    domainSlug,
    level,
  });
}

export function buildSurvivalBanner(
  survivalStatus: SurvivalStatus,
  confidence: DiagnosisConfidence,
) {
  const banner = getSurvivalBannerContent(survivalStatus);
  return {
    status: survivalStatus,
    tone: resolveToneMode(survivalStatus, confidence),
    message: banner.message,
  };
}

export function buildCtaSpec(
  moment: CtaMoment,
  capacityMode: CapacityMode,
  personalization: CtaPersonalizationInput,
) {
  return {
    moment,
    headline: buildCtaHeadline(moment, personalization),
    destination: getCtaDestination(capacityMode),
    buttonLabel: getCtaButtonLabel(capacityMode),
    personalization: {
      bindingConstraint: personalization.bindingConstraintDomainName,
      structuralRoots: personalization.structuralRootDomainNames ?? [],
    },
  };
}

export const contentLibraryV1 = {
  resolveDiagnosticSymptoms,
  resolveDiagnosticIntent,
  resolveDomainScoreBand,
  resolveOptionInterpretation,
  resolveCorrectiveAction,
  resolveQualitativeCost,
  buildSurvivalBanner,
  buildCtaSpec,
} as const;

export type ContentLibraryV1 = typeof contentLibraryV1;
