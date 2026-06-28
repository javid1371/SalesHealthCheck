import {
  getDomainReportConfig,
  getQuestionAnalysis,
} from "@/config/model-v1/question-analysis-config";
import { lookupScoreBand } from "@/config/model-v1/question-bank/parse-score-bands";
import type { DomainScoreResult } from "@/types/scoring";
import type { StructuredReport } from "@/types/report";

export interface AnalysisAnswerInput {
  domainSlug: string;
  questionNumber: number;
  score: number;
}

export function buildAnalysisContext(
  answers: AnalysisAnswerInput[],
  domainScores: DomainScoreResult[],
): NonNullable<StructuredReport["analysisContext"]> {
  const perQuestion = answers.map((answer) => {
    const analysis = getQuestionAnalysis(answer.domainSlug, answer.questionNumber);
    const score = answer.score as 0 | 1 | 2 | 3;
    const selectedInterpretation =
      analysis?.optionInterpretations[score] ?? "";

    return {
      domainSlug: answer.domainSlug,
      questionNumber: answer.questionNumber,
      diagnosticIntent: analysis?.diagnosticIntent ?? "",
      selectedScore: answer.score,
      selectedInterpretation,
    };
  });

  const domainInterpretations = domainScores.map((score) => {
    const config = getDomainReportConfig(score.domainSlug);
    const band = config
      ? lookupScoreBand(config.domainScoreBands, score.rawScore)
      : undefined;

    return {
      domainSlug: score.domainSlug,
      rawScore: score.rawScore,
      bandLabel: band?.label ?? "",
      bandDescription: band?.description ?? "",
    };
  });

  return { perQuestion, domainInterpretations };
}
