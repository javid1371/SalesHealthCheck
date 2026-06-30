import {
  getDomainReportConfig,
  getQuestionAnalysis,
} from "@/config/model-v1/question-analysis-config";
import { firstSentence, lookupScoreBand } from "@/config/model-v1/question-bank/parse-score-bands";
import {
  type FallbackFieldKey,
  getFieldFallback,
  getStaticFieldFallback,
} from "@/config/model-v1/report-content/field-fallbacks";
import {
  getReportContentBundleBySlug,
  selectedScoreFallbackLabel,
} from "@/config/model-v1/report-content";
import type {
  AnswerOptionContent,
  AnswerScore,
  DomainBundle,
  DomainLevelContent,
  RootCauseContent,
} from "@/config/model-v1/report-content/domain-bundle.types";
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

export interface DomainAnswerSelection {
  question_id: string;
  selected_score: AnswerScore;
}

export interface TriggeredRootCauseEvidence {
  question_id: string;
  question_text_fa: string;
  selected_option_text_fa: string;
  public_reflection_fa: string;
  evidence_sentence_fa: string;
}

export interface TriggeredRootCause {
  root_cause: RootCauseContent;
  evidence: TriggeredRootCauseEvidence[];
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

function resolveStaticWithFallback(
  field:
    | "missingRootCause"
    | "missingMechanism"
    | "missingSalesImpact"
    | "missingLockedTeaser"
    | "missingPublicReflection",
  primary: string | undefined,
  ctx: FieldResolveContext,
): string {
  if (primary) {
    return primary;
  }

  logMissingContent({
    field,
    domainSlug: ctx.domainSlug,
    level: ctx.level,
    questionNumber: ctx.questionNumber,
    score: ctx.score,
  });

  return getStaticFieldFallback(field);
}

function answerScoreToFallbackLevel(score: AnswerScore): DomainLevel {
  if (score <= 1) {
    return "weak";
  }

  if (score === 2) {
    return "medium";
  }

  return "healthy";
}

export function getDomainBundle(domainId: string): DomainBundle | undefined {
  const bundle = getReportContentBundleBySlug(domainId);

  if (!bundle && process.env.NODE_ENV === "development") {
    console.warn(
      `[missing-content] no DomainBundle found for domain "${domainId}"`,
    );
  }

  return bundle;
}

export function getDomainLevel(
  bundle: DomainBundle,
  rawScore: number,
): DomainLevelContent {
  const matched = bundle.domain_levels.find(
    (level) => rawScore >= level.score_min && rawScore <= level.score_max,
  );

  if (matched) {
    return matched;
  }

  const sortedLevels = [...bundle.domain_levels].sort(
    (left, right) => left.score_min - right.score_min,
  );

  if (sortedLevels.length === 0) {
    return {
      level_key: "average",
      score_min: 0,
      score_max: 0,
      headline_fa: "",
    };
  }

  if (rawScore < sortedLevels[0].score_min) {
    return sortedLevels[0];
  }

  return sortedLevels[sortedLevels.length - 1];
}

export function getDomainSymptoms(bundle: DomainBundle): string[] {
  return bundle.symptoms
    .map((symptom) => symptom.trim())
    .filter((symptom) => symptom.length > 0);
}

export function getDomainPublicSummary(bundle: DomainBundle): string | undefined {
  return normalizeText(bundle.public_summary_fa);
}

export function getSelectedAnswerOption(
  bundle: DomainBundle,
  questionId: string,
  selectedScore: AnswerScore,
): AnswerOptionContent {
  const question = bundle.questions.find((entry) => entry.question_id === questionId);
  const matchedOption = question?.options.find(
    (option) => option.score === selectedScore,
  );

  if (matchedOption) {
    return matchedOption;
  }

  const ctx: FieldResolveContext = {
    domainSlug: bundle.domain_id,
    level: "medium",
    questionNumber: question?.question_number,
    score: selectedScore,
  };

  logMissingContent({
    field: "optionInterpretation",
    domainSlug: ctx.domainSlug,
    level: ctx.level,
    questionNumber: ctx.questionNumber,
    score: ctx.score,
  });

  return {
    score: selectedScore,
    text_fa: selectedScoreFallbackLabel(selectedScore),
    public_reflection_fa: getStaticFieldFallback("missingPublicReflection"),
  };
}

function evaluateRootRuleCondition(
  condition: string,
  score: number,
): boolean {
  const normalized = condition.replace(/\s+/g, "");
  const match = normalized.match(/^score([<=>=]+)(\d+)$/);

  if (!match) {
    return false;
  }

  const operator = match[1];
  const threshold = Number(match[2]);

  switch (operator) {
    case "<=":
      return score <= threshold;
    case ">=":
      return score >= threshold;
    case "<":
      return score < threshold;
    case ">":
      return score > threshold;
    case "==":
    case "=":
      return score === threshold;
    default:
      return false;
  }
}

function buildEvidenceSentence(
  ruleTemplate: string | undefined,
  questionText: string,
  selectedOptionText: string,
  publicReflection: string,
): string {
  const primary = normalizeText(ruleTemplate);

  if (primary) {
    return primary;
  }

  if (questionText && selectedOptionText) {
    return `در «${questionText}»، پاسخ شما (${selectedOptionText}) نشان می‌دهد: ${publicReflection}`;
  }

  return publicReflection;
}

function resolveRootCauseContent(
  rootCause: RootCauseContent | undefined,
  ctx: FieldResolveContext,
): RootCauseContent {
  return {
    root_id: rootCause?.root_id ?? "missing-root-cause",
    root_title_fa: rootCause?.root_title_fa ?? "",
    public_root_sentence_fa: resolveStaticWithFallback(
      "missingRootCause",
      normalizeText(rootCause?.public_root_sentence_fa),
      ctx,
    ),
    mechanism_fa: resolveStaticWithFallback(
      "missingMechanism",
      normalizeText(rootCause?.mechanism_fa),
      ctx,
    ),
    sales_impact_fa: resolveStaticWithFallback(
      "missingSalesImpact",
      normalizeText(rootCause?.sales_impact_fa),
      ctx,
    ),
  };
}

export function getTriggeredRootCauses(
  bundle: DomainBundle,
  answers: DomainAnswerSelection[],
): TriggeredRootCause[] {
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.question_id, answer.selected_score]),
  );
  const triggeredByRootId = new Map<string, TriggeredRootCause>();

  for (const rule of bundle.question_root_rules) {
    const selectedScore = answersByQuestionId.get(rule.question_id);

    if (selectedScore === undefined) {
      continue;
    }

    if (!evaluateRootRuleCondition(rule.condition, selectedScore)) {
      continue;
    }

    const question = bundle.questions.find(
      (entry) => entry.question_id === rule.question_id,
    );
    const selectedOption = getSelectedAnswerOption(
      bundle,
      rule.question_id,
      selectedScore,
    );
    const ctx: FieldResolveContext = {
      domainSlug: bundle.domain_id,
      level: answerScoreToFallbackLevel(selectedScore),
      questionNumber: question?.question_number,
      score: selectedScore,
    };
    const questionText =
      normalizeText(question?.question_text_fa) ??
      normalizeText(question?.public_evidence_label_fa) ??
      "";
    const selectedOptionText = normalizeText(selectedOption.text_fa) ?? "";
    const publicReflection =
      normalizeText(selectedOption.public_reflection_fa) ??
      resolveStaticWithFallback("missingPublicReflection", undefined, ctx);
    const evidenceSentence = buildEvidenceSentence(
      rule.evidence_sentence_template_fa,
      questionText,
      selectedOptionText,
      publicReflection,
    );
    const rawRootCause = bundle.root_causes.find(
      (entry) => entry.root_id === rule.root_id,
    );
    const evidence: TriggeredRootCauseEvidence = {
      question_id: rule.question_id,
      question_text_fa: questionText,
      selected_option_text_fa: selectedOptionText,
      public_reflection_fa: publicReflection,
      evidence_sentence_fa: evidenceSentence,
    };

    const existing = triggeredByRootId.get(rule.root_id);

    if (existing) {
      existing.evidence.push(evidence);
      continue;
    }

    triggeredByRootId.set(rule.root_id, {
      root_cause: resolveRootCauseContent(rawRootCause, ctx),
      evidence: [evidence],
    });
  }

  return [...triggeredByRootId.values()];
}

export function resolveLockedTeaser(
  domainSlug: string,
  level: DomainLevel,
  primary?: string,
): string {
  return resolveStaticWithFallback(
    "missingLockedTeaser",
    normalizeText(primary),
    { domainSlug, level },
  );
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
  getDomainBundle,
  getDomainLevel,
  getDomainSymptoms,
  getDomainPublicSummary,
  getSelectedAnswerOption,
  getTriggeredRootCauses,
  resolveLockedTeaser,
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
