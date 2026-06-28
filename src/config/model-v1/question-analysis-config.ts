import { loadModelV1FromCsv } from "./question-bank/load-model-v1-from-csv";
import type {
  DomainReportConfig,
  QuestionAnalysisEntry,
} from "./types";

export type { DomainReportConfig, QuestionAnalysisEntry } from "./types";

const model = loadModelV1FromCsv();

/** Internal-only per-question diagnostic metadata (not exposed via public assessment API). */
export const questionAnalysisMetadataV1: QuestionAnalysisEntry[] =
  model.questionAnalysis;

/** @deprecated Use questionAnalysisMetadataV1 */
export const questionAnalysisV1 = questionAnalysisMetadataV1;

export const domainReportConfigV1: DomainReportConfig[] = model.domains;

const domainReportConfigBySlug = new Map(
  domainReportConfigV1.map((config) => [config.domainSlug, config]),
);

const questionAnalysisByKey = new Map(
  questionAnalysisMetadataV1.map((entry) => [
    `${entry.domainSlug}:${entry.questionNumber}`,
    entry,
  ]),
);

export function getDomainReportConfig(
  domainSlug: string,
): DomainReportConfig | undefined {
  return domainReportConfigBySlug.get(domainSlug);
}

export function getQuestionAnalysis(
  domainSlug: string,
  questionNumber: number,
): QuestionAnalysisEntry | undefined {
  return questionAnalysisByKey.get(`${domainSlug}:${questionNumber}`);
}
