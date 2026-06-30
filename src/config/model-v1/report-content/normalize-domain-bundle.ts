import { domainsV1 } from "../domains";
import { questionAnalysisMetadataV1 } from "../question-analysis-config";
import { questionsV1 } from "../questions";
import type { PublicQuestionConfig, QuestionAnalysisEntry } from "../types";
import {
  domainNumberToProjectSlug,
  notionDomainIdToProjectSlug,
} from "./domain-crosswalk";
import type {
  ActionContent,
  AnswerOptionContent,
  AnswerScore,
  DomainBundle,
  DomainFamily,
  DomainLevelContent,
  DomainLevelKey,
  QuestionContent,
  QuestionRootRule,
  RootCauseContent,
} from "./domain-bundle.types";

const LEVEL_LABEL_FA: Record<DomainLevelKey, string> = {
  critical: "بحرانی",
  weak: "ضعیف",
  average: "متوسط",
  healthy: "سالم",
  advanced: "پیشرفته",
};

const ANSWER_SCORES: AnswerScore[] = [0, 1, 2, 3];

type SnapshotDomainRow = {
  domain_bundle_title: string;
  properties: SnapshotProperties;
  body_seed_json?: RawDomainBundleSeed;
};

type SnapshotProperties = {
  domain_id: string;
  domain_number: number;
  engine_id: string;
  family: string;
  role_in_funnel_fa: string;
  public_summary_fa: string;
  internal_diagnosis_summary_fa: string;
  domain_levels_json: RawDomainLevel[] | null;
  questions_json: RawQuestionStub[] | null;
  root_causes_json: RawRootCause[] | null;
  question_root_rules_json: RawQuestionRootRule[] | null;
  symptoms_json: string[] | null;
  actions_json: RawAction[] | null;
  rendering_rules_fa: string;
};

type RawDomainBundleSeed = {
  domain_id: string;
  domain_number: number;
  engine_id: string;
  title_fa: string;
  family: DomainFamily;
  role_in_funnel_fa: string;
  public_summary_fa: string;
  internal_diagnosis_summary_fa: string;
  domain_levels: RawDomainLevel[];
  symptoms: string[];
  root_causes: RawRootCauseFull[];
  questions: RawQuestionFull[];
  question_root_rules: RawQuestionRootRule[];
  actions: RawAction[];
  rendering_rules_fa: string;
};

type RawDomainLevel = {
  level_key: DomainLevelKey;
  score_min: number;
  score_max: number;
  label_fa?: string;
  headline_fa: string;
  interpretation_fa?: string;
};

type RawQuestionStub = {
  id: string;
  label: string;
};

type RawQuestionFull = {
  question_id: string;
  question_number: number;
  question_text_fa?: string;
  internal_diagnosis_fa?: string;
  public_evidence_label_fa?: string;
  options: RawAnswerOption[];
};

type RawAnswerOption = {
  score: AnswerScore;
  text_fa: string;
  option_meaning_fa?: string;
  public_reflection_fa?: string;
};

type RawRootCause = {
  root_id: string;
  title_fa?: string;
  root_title_fa?: string;
  public_root_sentence_fa: string;
  mechanism_fa: string;
  sales_impact_fa: string;
};

type RawRootCauseFull = RawRootCause;

type RawQuestionRootRule = {
  question_id: string;
  condition: string;
  root_id: string;
  evidence_sentence_template_fa?: string;
};

type RawAction = {
  action_id: string;
  action_title_fa: string;
  quick_win_summary_fa: string;
  full_action_fa?: string;
  locked_teaser_fa: string;
};

export type DomainBundlesSnapshot = {
  domains: SnapshotDomainRow[];
};

function extractTitleFromBundleTitle(domainBundleTitle: string): string {
  return domainBundleTitle.replace(/^D\d+\s*[—–-]\s*/, "").trim();
}

function normalizeCondition(condition: string): string {
  return condition.replace(/\s+/g, "");
}

function normalizeDomainLevels(levels: RawDomainLevel[]): DomainLevelContent[] {
  return levels.map((level) => ({
    level_key: level.level_key,
    score_min: level.score_min,
    score_max: level.score_max,
    label_fa: level.label_fa ?? LEVEL_LABEL_FA[level.level_key],
    headline_fa: level.headline_fa,
    ...(level.interpretation_fa ? { interpretation_fa: level.interpretation_fa } : {}),
  }));
}

function normalizeRootCauses(rootCauses: RawRootCause[]): RootCauseContent[] {
  return rootCauses.map((root) => ({
    root_id: root.root_id,
    root_title_fa: root.root_title_fa ?? root.title_fa ?? root.root_id,
    public_root_sentence_fa: root.public_root_sentence_fa,
    mechanism_fa: root.mechanism_fa,
    sales_impact_fa: root.sales_impact_fa,
  }));
}

function normalizeQuestionRootRules(rules: RawQuestionRootRule[]): QuestionRootRule[] {
  return rules.map((rule) => ({
    question_id: rule.question_id,
    condition: normalizeCondition(rule.condition),
    root_id: rule.root_id,
    ...(rule.evidence_sentence_template_fa
      ? { evidence_sentence_template_fa: rule.evidence_sentence_template_fa }
      : {}),
  }));
}

function normalizeActions(actions: RawAction[]): ActionContent[] {
  return actions.map((action) => ({
    action_id: action.action_id,
    action_title_fa: action.action_title_fa,
    quick_win_summary_fa: action.quick_win_summary_fa,
    locked_teaser_fa: action.locked_teaser_fa,
    ...(action.full_action_fa ? { full_action_fa: action.full_action_fa } : {}),
  }));
}

function parseQuestionNumber(questionId: string, fallbackIndex: number): number {
  const match = questionId.match(/_q(\d+)$/i);
  if (match) {
    return Number(match[1]);
  }
  return fallbackIndex + 1;
}

function getQuestionBankEntry(
  projectSlug: string,
  questionNumber: number,
): PublicQuestionConfig | undefined {
  return questionsV1.find(
    (question) =>
      question.domainSlug === projectSlug && question.displayOrder === questionNumber,
  );
}

function getQuestionAnalysisEntry(
  projectSlug: string,
  questionNumber: number,
): QuestionAnalysisEntry | undefined {
  return questionAnalysisMetadataV1.find(
    (entry) => entry.domainSlug === projectSlug && entry.questionNumber === questionNumber,
  );
}

function mergeQuestionOptions(
  rawOptions: RawAnswerOption[] | undefined,
  bankQuestion: PublicQuestionConfig | undefined,
  analysis: QuestionAnalysisEntry | undefined,
): AnswerOptionContent[] {
  return ANSWER_SCORES.map((score) => {
    const rawOption = rawOptions?.find((option) => option.score === score);
    const bankOption = bankQuestion?.options.find((option) => option.score === score);
    const reflectionFromAnalysis = analysis?.optionInterpretations[score]?.trim();

    const textFa = bankOption?.text ?? rawOption?.text_fa ?? "";
    const publicReflection =
      rawOption?.public_reflection_fa?.trim() ||
      reflectionFromAnalysis ||
      undefined;

    return {
      score,
      text_fa: textFa,
      ...(rawOption?.option_meaning_fa
        ? { option_meaning_fa: rawOption.option_meaning_fa }
        : {}),
      ...(publicReflection ? { public_reflection_fa: publicReflection } : {}),
    };
  });
}

function mergeQuestionContent(
  rawQuestion: RawQuestionFull | RawQuestionStub,
  index: number,
  projectSlug: string,
  fullRawQuestion?: RawQuestionFull,
): QuestionContent {
  const questionId = "question_id" in rawQuestion ? rawQuestion.question_id : rawQuestion.id;
  const questionNumber =
    "question_number" in rawQuestion && rawQuestion.question_number
      ? rawQuestion.question_number
      : parseQuestionNumber(questionId, index);

  const bankQuestion = getQuestionBankEntry(projectSlug, questionNumber);
  const analysis = getQuestionAnalysisEntry(projectSlug, questionNumber);
  const mergedFull = fullRawQuestion ?? ("options" in rawQuestion ? rawQuestion : undefined);

  const publicEvidenceLabel =
    mergedFull?.public_evidence_label_fa?.trim() ||
    ("label" in rawQuestion ? rawQuestion.label.trim() : undefined);

  const internalDiagnosis =
    mergedFull?.internal_diagnosis_fa?.trim() ||
    analysis?.diagnosticIntent.trim() ||
    undefined;

  return {
    question_id: questionId,
    question_number: questionNumber,
    question_text_fa: bankQuestion?.text ?? mergedFull?.question_text_fa,
    ...(internalDiagnosis ? { internal_diagnosis_fa: internalDiagnosis } : {}),
    ...(publicEvidenceLabel ? { public_evidence_label_fa: publicEvidenceLabel } : {}),
    options: mergeQuestionOptions(mergedFull?.options, bankQuestion, analysis),
  };
}

function rawSeedFromSnapshotRow(row: SnapshotDomainRow): RawDomainBundleSeed {
  if (row.body_seed_json) {
    return row.body_seed_json;
  }

  const props = row.properties;
  const questionStubs = props.questions_json ?? [];

  return {
    domain_id: props.domain_id,
    domain_number: props.domain_number,
    engine_id: props.engine_id,
    title_fa: extractTitleFromBundleTitle(row.domain_bundle_title),
    family: props.family as DomainFamily,
    role_in_funnel_fa: props.role_in_funnel_fa,
    public_summary_fa: props.public_summary_fa,
    internal_diagnosis_summary_fa: props.internal_diagnosis_summary_fa,
    domain_levels: props.domain_levels_json ?? [],
    symptoms: props.symptoms_json ?? [],
    root_causes: props.root_causes_json ?? [],
    questions: questionStubs.map((stub, index) => ({
      question_id: stub.id,
      question_number: parseQuestionNumber(stub.id, index),
      public_evidence_label_fa: stub.label,
      options: [],
    })),
    question_root_rules: props.question_root_rules_json ?? [],
    actions: props.actions_json ?? [],
    rendering_rules_fa: props.rendering_rules_fa,
  };
}

export function normalizeDomainBundleFromSnapshotRow(row: SnapshotDomainRow): DomainBundle {
  const raw = rawSeedFromSnapshotRow(row);
  const projectSlug = domainNumberToProjectSlug(raw.domain_number);

  const slugFromNotion = notionDomainIdToProjectSlug(raw.domain_id);
  if (slugFromNotion !== projectSlug) {
    throw new Error(
      `Crosswalk conflict for domain_number ${raw.domain_number}: notion domain_id "${raw.domain_id}" maps to "${slugFromNotion}", expected "${projectSlug}"`,
    );
  }

  const domainConfig = domainsV1.find((domain) => domain.slug === projectSlug);
  const titleFa = raw.title_fa.trim() || domainConfig?.name || projectSlug;

  const questions = raw.questions.map((question, index) =>
    mergeQuestionContent(question, index, projectSlug, "options" in question ? question : undefined),
  );

  return {
    domain_id: projectSlug,
    domain_number: raw.domain_number,
    engine_id: raw.engine_id,
    title_fa: titleFa,
    family: raw.family,
    role_in_funnel_fa: raw.role_in_funnel_fa,
    public_summary_fa: raw.public_summary_fa,
    internal_diagnosis_summary_fa: raw.internal_diagnosis_summary_fa,
    domain_levels: normalizeDomainLevels(raw.domain_levels),
    symptoms: raw.symptoms,
    root_causes: normalizeRootCauses(raw.root_causes),
    questions,
    question_root_rules: normalizeQuestionRootRules(raw.question_root_rules),
    actions: normalizeActions(raw.actions),
    rendering_rules_fa: raw.rendering_rules_fa,
  };
}

export function buildReportContentLibraryV1(
  snapshot: DomainBundlesSnapshot,
): DomainBundle[] {
  if (snapshot.domains.length !== 16) {
    throw new Error(
      `Expected 16 domain bundles in snapshot, got ${snapshot.domains.length}`,
    );
  }

  const bundles = snapshot.domains.map(normalizeDomainBundleFromSnapshotRow);
  bundles.sort((a, b) => a.domain_number - b.domain_number);

  const numbers = new Set(bundles.map((bundle) => bundle.domain_number));
  if (numbers.size !== 16) {
    throw new Error("Duplicate domain_number in normalized library");
  }

  return bundles;
}
