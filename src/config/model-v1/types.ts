import type { ScoreBand } from "./question-bank/parse-score-bands";

export type LayerConfig = {
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
};

export type DomainConfig = {
  slug: string;
  name: string;
  description: string;
  layerSlug: string;
  weight: number;
  displayOrder: number;
};

export type QuestionOptionConfig = {
  text: string;
  score: 0 | 1 | 2 | 3;
};

export type PublicQuestionConfig = {
  domainSlug: string;
  displayOrder: number;
  text: string;
  options: QuestionOptionConfig[];
};

export type QuestionConfig = PublicQuestionConfig;

export type QuestionAnalysisEntry = {
  domainSlug: string;
  questionNumber: number;
  diagnosticIntent: string;
  optionInterpretations: Record<0 | 1 | 2 | 3, string>;
};

export type DomainReportConfig = {
  domainSlug: string;
  correctiveAction: string;
  diagnosticSymptoms: string;
  domainScoreBands: ScoreBand[];
};

/** Full model-v1 payload parsed from the 13-column CSV. */
export type ModelV1FromCsv = {
  questions: PublicQuestionConfig[];
  questionAnalysis: QuestionAnalysisEntry[];
  domains: DomainReportConfig[];
};

export type { ScoreBand };
