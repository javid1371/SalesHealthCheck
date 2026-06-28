import type { BottleneckResult } from "@/types/diagnosis";
import type {
  DomainScoreResult,
  LayerScoreResult,
  OverallScoreResult,
} from "@/types/scoring";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { StructuredReport } from "@/types/report";
import type { CapacityMode, ReportSpec } from "@/types/report-spec";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";
import { getDomainReportConfig } from "@/config/model-v1/question-analysis-config";
import {
  firstSentence,
  lookupScoreBand,
} from "@/config/model-v1/question-bank/parse-score-bands";
import {
  defaultBottleneckTemplate,
  layerSummaryTemplates,
  overallSummaryTemplates,
} from "@/config/model-v1/report-templates";
import { healthLevelLabelFa } from "@/lib/health-level";
import {
  buildAnalysisContextFromDiagnosis,
  buildDiagnosisSummary,
} from "@/modules/diagnosis/diagnosis.helpers";
import {
  buildAnalysisContext,
  type AnalysisAnswerInput,
} from "./analysis-context";
import {
  composeReport,
  type ComposerAnswerInput,
} from "./report.composer";

export type { ComposerAnswerInput };

export interface ReportBuilderInput {
  overallScore: OverallScoreResult;
  domainScores: DomainScoreResult[];
  layerScores: LayerScoreResult[];
  bottlenecks: BottleneckResult[];
  domainNames: Map<string, string>;
  layerNames: Map<string, string>;
  structuredDiagnosis?: StructuredDiagnosis;
  answers?: AnalysisAnswerInput[] | ComposerAnswerInput[];
  valueAtStake?: ValueAtStakeSpec | null;
  capacityMode?: CapacityMode;
}

function getDomainReport(domainSlug: string) {
  return getDomainReportConfig(domainSlug);
}

function buildBottleneckSummaries(
  bottlenecks: BottleneckResult[],
  structuredDiagnosis: StructuredDiagnosis | undefined,
  domainNames: Map<string, string>,
): StructuredReport["bottleneckSummaries"] {
  if (structuredDiagnosis) {
    return bottlenecks.map((bottleneck) => {
      const rootQuestion = structuredDiagnosis.issueRootQuestions.find(
        (question) => question.domainSlug === bottleneck.domainSlug,
      );
      const config = getDomainReport(bottleneck.domainSlug);
      const fallbackSummary = config
        ? firstSentence(config.diagnosticSymptoms)
        : defaultBottleneckTemplate.summary;
      const symptoms = config?.diagnosticSymptoms ?? defaultBottleneckTemplate.salesImpact;

      return {
        rank: bottleneck.rank,
        domainSlug: bottleneck.domainSlug,
        domainName: domainNames.get(bottleneck.domainSlug) ?? bottleneck.domainName,
        summary: rootQuestion?.diagnosticIntent || fallbackSummary,
        salesImpact: symptoms,
      };
    });
  }

  return bottlenecks.map((bottleneck) => {
    const config = getDomainReport(bottleneck.domainSlug);
    const symptoms = config?.diagnosticSymptoms ?? defaultBottleneckTemplate.salesImpact;

    return {
      rank: bottleneck.rank,
      domainSlug: bottleneck.domainSlug,
      domainName: bottleneck.domainName,
      summary: config
        ? firstSentence(config.diagnosticSymptoms)
        : defaultBottleneckTemplate.summary,
      salesImpact: symptoms,
    };
  });
}

export function buildStructuredReport(input: ReportBuilderInput): StructuredReport {
  const {
    overallScore,
    domainScores,
    layerScores,
    bottlenecks,
    domainNames,
    layerNames,
    structuredDiagnosis,
    answers = [],
  } = input;

  const overallSummary = overallSummaryTemplates[overallScore.healthLevel];

  const layerSummaries = layerScores.map((layerScore) => ({
    layerSlug: layerScore.layerSlug,
    layerName: layerNames.get(layerScore.layerSlug) ?? layerScore.layerSlug,
    summary: layerSummaryTemplates[layerScore.healthLevel],
    percentage: layerScore.percentage,
  }));

  const bottleneckSummaries = buildBottleneckSummaries(
    bottlenecks,
    structuredDiagnosis,
    domainNames,
  );

  const domainResults = domainScores.map((score) => {
    const config = getDomainReport(score.domainSlug);
    const band = config
      ? lookupScoreBand(config.domainScoreBands, score.rawScore)
      : undefined;

    return {
      domainSlug: score.domainSlug,
      domainName: domainNames.get(score.domainSlug) ?? score.domainSlug,
      percentage: score.percentage,
      healthLevel: healthLevelLabelFa(score.healthLevel),
      rawScore: score.rawScore,
      bandLabel: band?.label,
      bandDescription: band?.description,
    };
  });

  const correctiveActions = buildCorrectiveActions(bottlenecks, domainNames);
  const actionPlans = buildActionPlans(bottlenecks, domainNames);

  const report: StructuredReport = {
    overallSummary,
    layerSummaries,
    bottleneckSummaries,
    domainResults,
    correctiveActions,
    actionPlans,
  };

  if (structuredDiagnosis) {
    report.diagnosisSummary = buildDiagnosisSummary(structuredDiagnosis, domainNames);
    report.analysisContext = buildAnalysisContextFromDiagnosis(
      structuredDiagnosis,
      domainScores.map((score) => ({
        domainSlug: score.domainSlug,
        rawScore: score.rawScore,
      })),
    );
  } else if (answers.length > 0) {
    report.analysisContext = buildAnalysisContext(answers, domainScores);
  }

  return report;
}

function buildCorrectiveActions(
  bottlenecks: BottleneckResult[],
  domainNames: Map<string, string>,
): StructuredReport["correctiveActions"] {
  const actions: StructuredReport["correctiveActions"] = [];
  const seenDomains = new Set<string>();

  for (const bottleneck of bottlenecks) {
    if (seenDomains.has(bottleneck.domainSlug)) continue;

    const config = getDomainReport(bottleneck.domainSlug);
    if (!config?.correctiveAction) continue;

    seenDomains.add(bottleneck.domainSlug);
    actions.push({
      domainSlug: bottleneck.domainSlug,
      domainName: domainNames.get(bottleneck.domainSlug) ?? bottleneck.domainName,
      description: config.correctiveAction,
    });
  }

  return actions;
}

function buildActionPlans(
  bottlenecks: BottleneckResult[],
  domainNames: Map<string, string>,
): NonNullable<StructuredReport["actionPlans"]> {
  const sevenDay: Array<{ title: string; description: string }> = [];
  const thirtyDay: Array<{ title: string; description: string }> = [];

  for (const bottleneck of bottlenecks) {
    const config = getDomainReport(bottleneck.domainSlug);
    if (!config?.correctiveAction) continue;

    const title =
      domainNames.get(bottleneck.domainSlug) ?? bottleneck.domainName;
    const item = { title, description: config.correctiveAction };

    if (bottleneck.rank === 1) {
      sevenDay.push(item);
    } else {
      thirtyDay.push(item);
    }
  }

  return { sevenDay, thirtyDay };
}

/** Builds ReportSpec via Composer when v2 StructuredDiagnosis is present. */
export function buildReportSpec(input: ReportBuilderInput): ReportSpec | null {
  if (!input.structuredDiagnosis) {
    return null;
  }

  const composerAnswers: ComposerAnswerInput[] = (input.answers ?? []).map(
    (answer) => ({
      domainSlug: answer.domainSlug,
      questionNumber: answer.questionNumber,
      score: answer.score as 0 | 1 | 2 | 3,
    }),
  );

  return composeReport({
    diagnosis: input.structuredDiagnosis,
    valueAtStake: input.valueAtStake ?? null,
    answers: composerAnswers,
    capacityMode: input.capacityMode ?? "free",
    domainNames: input.domainNames,
  });
}

export interface FullReportOutput {
  structuredReport: StructuredReport;
  reportSpec: ReportSpec | null;
}

/** Thin orchestrator: legacy structuredReport + v2 ReportSpec. */
export function buildFullReport(input: ReportBuilderInput): FullReportOutput {
  return {
    structuredReport: buildStructuredReport(input),
    reportSpec: buildReportSpec(input),
  };
}
